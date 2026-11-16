//! An incremental syntect highlighter for the editor, installed through `set_highlighter_factory` (the vendored
//! `gpui-shell` adapter stays as herdr ships it).
//!
//! Every line keeps the parser state at its start and its styled spans. An edit marks its lines unknown and moves
//! the *frontier* (the first line not known to be right) back to the edit; parsing resumes there and stops as soon
//! as a line starts in the state its cached entry started in (convergence: everything after it is unchanged). So a
//! keystroke reparses about one line. Up to [`SYNC_BUDGET`] of parsing runs on the UI thread in `update`; the rest
//! (opening a file, `set_value`, opening a block comment) runs on a background thread over a snapshot of the
//! text, published in chunks tagged with a generation. Any edit or convergence bumps the generation, so a chunk
//! parsed for an older text is dropped and never coloured. Lines not yet parsed draw plain or keep their previous
//! colours (their text is unchanged; only their context may be), as CodeMirror does.
//!
//! Files over [`MAX_HIGHLIGHT_CHARS`] are not highlighted (the web's `editorSyntax.ts` rule). Fold candidates stay
//! brace-based, computed when the editor asks.

use super::theme::{kind_name, KIND_COUNT};
use futures::StreamExt as _;
use gpui::{Context, HighlightStyle, SharedString, Task, Window};
use gpui_base::input::{
    EditorState, FoldRange, HighlightStyleResolver, InputEdit, InputHighlighter,
    InputHighlighterFactory, Rope, RopeExt as _,
};
use std::cell::RefCell;
use std::collections::HashMap;
use std::ops::Range;
use std::rc::{Rc, Weak};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, LazyLock};
use std::time::{Duration, Instant};
use syntect::parsing::{ParseState, Scope, ScopeStack, SyntaxReference, SyntaxSet};
use syntect::util::LinesWithEndings;

/// Above this many characters a file is drawn plain: parsing it must not cost typing latency.
pub const MAX_HIGHLIGHT_CHARS: usize = 300_000;

/// Parsing done on the UI thread per update before the rest moves to the background.
pub const SYNC_BUDGET: Duration = Duration::from_millis(2);

/// A background parse publishes its lines after this much work, or [`CHUNK_LINES`] lines.
const CHUNK_TIME: Duration = Duration::from_millis(8);
const CHUNK_LINES: usize = 2_000;

static SYNTAXES: LazyLock<SyntaxSet> = LazyLock::new(SyntaxSet::load_defaults_newlines);

/// Test-only delay per background-parsed line, to prove that typing during a slow parse never shows stale colours.
static SLOW_LINE_NANOS: AtomicU64 = AtomicU64::new(0);

#[doc(hidden)]
pub fn slow_background_parse_for_tests(per_line: Duration) {
    SLOW_LINE_NANOS.store(per_line.as_nanos() as u64, Ordering::Relaxed);
}

/// The highlight cap in force; a test may lift it to time the highlighter on a large file.
static MAX_CHARS: AtomicUsize = AtomicUsize::new(MAX_HIGHLIGHT_CHARS);

#[doc(hidden)]
pub fn set_max_highlight_chars_for_tests(chars: usize) {
    MAX_CHARS.store(chars, Ordering::Relaxed);
}

fn highlightable(text: &Rope) -> bool {
    text.len_chars() <= MAX_CHARS.load(Ordering::Relaxed)
}

/// Background parses running now, for a test waiting until every line is coloured.
static RUNNING: AtomicUsize = AtomicUsize::new(0);

#[doc(hidden)]
pub fn background_parses_running() -> usize {
    RUNNING.load(Ordering::Acquire)
}

/// The grammar for a file name or language name (`main.rs`, `Makefile`, `rust`), if there is one.
pub fn syntax_for(name: &str) -> Option<&'static SyntaxReference> {
    let file = name.rsplit('/').next().unwrap_or(name);
    // ponytail: syntect's default grammars have no TypeScript; its JavaScript grammar colours most of it. Upgrade
    // path: a TypeScript grammar (bat's set, `two-face`) loaded into `SYNTAXES`.
    let extension = file.rsplit_once('.').map(|(_, e)| match e {
        "ts" | "tsx" | "mts" | "cts" => "js",
        e => e,
    });
    let found = SYNTAXES
        .find_syntax_by_extension(file)
        .or_else(|| extension.and_then(|e| SYNTAXES.find_syntax_by_extension(e)))
        .or_else(|| extension.and_then(|e| SYNTAXES.find_syntax_by_extension(&e.to_lowercase())))
        .or_else(|| SYNTAXES.find_syntax_by_token(file))?;
    (found.name != "Plain Text").then_some(found)
}

/// The factory Perch editors install: a highlighter for every language syntect knows, none otherwise.
pub fn factory() -> InputHighlighterFactory {
    Rc::new(|language| {
        IncrementalHighlighter::new(language).map(|h| Box::new(h) as Box<dyn InputHighlighter>)
    })
}

/// Parser state at a line boundary.
#[derive(Clone, PartialEq, Eq)]
struct State {
    parse: ParseState,
    scopes: ScopeStack,
}

/// A styled run inside one line: byte offsets from the line's start and a kind ([`kind_name`]).
type Span = (u32, u32, u8);

#[derive(Clone)]
struct Line {
    /// Shared with neighbouring lines that start in the same state (most of a file).
    start: Arc<State>,
    spans: Box<[Span]>,
}

/// Maps scopes to kinds, remembering each scope's answer.
#[derive(Default)]
struct Kinds(HashMap<Scope, Option<u8>>);

impl Kinds {
    fn of(&mut self, scopes: &ScopeStack) -> Option<u8> {
        scopes
            .scopes
            .iter()
            .rev()
            .find_map(|scope| *self.0.entry(*scope).or_insert_with(|| kind(*scope)))
    }
}

/// The web's lezer-tag rules (`editorSyntax.ts` `syntaxStyle`) in syntect's scope names.
fn kind(scope: Scope) -> Option<u8> {
    let s = scope.build_string();
    let starts = |prefixes: &[&str]| prefixes.iter().any(|p| s.starts_with(p));
    let name = if starts(&["comment"]) {
        "comment"
    } else if starts(&["invalid"]) {
        "invalid"
    } else if starts(&[
        "constant.character.escape",
        "string.regexp",
        "entity.name.tag",
        "markup.underline.link",
        "string.other.link",
    ]) {
        "tag"
    } else if starts(&["string"]) {
        "string"
    } else if starts(&["constant"]) {
        "number"
    } else if starts(&["keyword.operator.word", "keyword.operator.new"]) {
        "keyword"
    } else if starts(&["keyword.operator"]) {
        return None;
    } else if starts(&["keyword", "storage"]) {
        "keyword"
    } else if starts(&[
        "entity.name.function",
        "support.function",
        "variable.function",
        "entity.other.attribute-name",
        "variable.other.member",
        "variable.other.property",
        "support.type.property-name",
        "meta.property-name",
    ]) {
        "function"
    } else if starts(&[
        "entity.name.type",
        "entity.name.class",
        "entity.name.struct",
        "entity.name.enum",
        "entity.name.trait",
        "entity.name.union",
        "entity.name.namespace",
        "entity.name.module",
        "entity.name.macro",
        "entity.other.inherited-class",
        "support.type",
        "support.class",
        "support.macro",
    ]) {
        "type"
    } else if starts(&["markup.heading", "markup.bold", "entity.name.section"]) {
        "heading"
    } else if starts(&["markup.italic"]) {
        "emphasis"
    } else {
        return None;
    };
    (0..KIND_COUNT).find(|k| kind_name(*k) == name)
}

/// Parses one line from `state` (left at the line's end) and returns its spans.
fn parse_line(state: &mut State, line: &str, kinds: &mut Kinds) -> Box<[Span]> {
    let mut spans: Vec<Span> = Vec::new();
    let mut push = |range: Range<usize>, scopes: &ScopeStack, kinds: &mut Kinds| {
        if range.is_empty() {
            return;
        }
        let Some(k) = kinds.of(scopes) else { return };
        match spans.last_mut() {
            Some(last) if last.1 as usize == range.start && last.2 == k => {
                last.1 = range.end as u32
            }
            _ => spans.push((range.start as u32, range.end as u32, k)),
        }
    };
    // A grammar error leaves the line plain and the state where it was.
    if let Ok(operations) = state.parse.parse_line(line, &SYNTAXES) {
        let mut cursor = 0;
        for (index, operation) in operations {
            push(cursor..index, &state.scopes, kinds);
            let _ = state.scopes.apply(&operation);
            cursor = index;
        }
        push(cursor..line.len(), &state.scopes, kinds);
    }
    spans.into_boxed_slice()
}

/// One published piece of a background parse: lines `from..` for the text of `generation`.
struct Chunk {
    generation: u64,
    from: usize,
    lines: Vec<Line>,
}

/// What a background parse needs: a snapshot, where to start and in what state.
struct Job {
    generation: u64,
    current: Arc<AtomicU64>,
    text: Rope,
    from: usize,
    state: State,
}

impl Job {
    /// Parses from `from` to the end, sending chunks; stops early once its generation is no longer current.
    fn run(self, mut send: impl FnMut(Chunk) -> bool) {
        let rows = self.text.lines_len();
        let start = self.text.line_start_offset(self.from);
        let text = self.text.slice(start..).to_string();
        let mut kinds = Kinds::default();
        let mut state = self.state;
        let mut recent = Vec::new();
        let mut batch = Vec::new();
        let mut from = self.from;
        let mut clock = Instant::now();
        let mut lines = LinesWithEndings::from(&text);
        for _ in self.from..rows {
            if self.current.load(Ordering::Acquire) != self.generation {
                return;
            }
            // Read per line, so a test can end a slowed parse by setting the delay back to zero.
            let slow = SLOW_LINE_NANOS.load(Ordering::Relaxed);
            if slow != 0 {
                std::thread::sleep(Duration::from_nanos(slow));
            }
            let line = lines.next().unwrap_or("");
            let start = shared(&mut recent, &state);
            let spans = parse_line(&mut state, line, &mut kinds);
            batch.push(Line { start, spans });
            if batch.len() >= CHUNK_LINES || clock.elapsed() >= CHUNK_TIME {
                let n = batch.len();
                if !send(Chunk {
                    generation: self.generation,
                    from,
                    lines: std::mem::take(&mut batch),
                }) {
                    return;
                }
                from += n;
                clock = Instant::now();
            }
        }
        if !batch.is_empty() {
            send(Chunk {
                generation: self.generation,
                from,
                lines: batch,
            });
        }
    }
}

/// `state` as an `Arc`, the previous line's when they are equal.
/// How many distinct line-start states [`shared`] remembers.
const RECENT_STATES: usize = 8;

/// `state` as a shared value: one of the `recent` (most recent first) when equal, so lines that alternate between a
/// few states (a file's top level, a body's statements) hold a handful of states, not one per line.
// ponytail: a linear scan of a few states per line; a hash of the parse stack would let a whole file share.
fn shared(recent: &mut Vec<Arc<State>>, state: &State) -> Arc<State> {
    if let Some(i) = recent.iter().position(|p| **p == *state) {
        let found = recent.remove(i);
        recent.insert(0, found.clone());
        return found;
    }
    let fresh = Arc::new(state.clone());
    recent.insert(0, fresh.clone());
    recent.truncate(RECENT_STATES);
    fresh
}

/// The highlighter's data, shared with the task that installs background results.
struct Core {
    syntax: &'static SyntaxReference,
    text: Option<Rope>,
    /// One entry per line of `text`; `None` for a line whose text changed since it was parsed.
    lines: Vec<Option<Line>>,
    /// Lines before this are right.
    frontier: usize,
    /// The parser state at the start of line `frontier`.
    frontier_state: State,
    /// Bumped by every edit and every convergence; a background parse of another generation is stale.
    generation: Arc<AtomicU64>,
    /// False above [`MAX_HIGHLIGHT_CHARS`].
    enabled: bool,
}

impl Core {
    fn new(syntax: &'static SyntaxReference) -> Self {
        Self {
            syntax,
            text: None,
            lines: Vec::new(),
            frontier: 0,
            frontier_state: Self::initial(syntax),
            generation: Arc::default(),
            enabled: false,
        }
    }

    fn initial(syntax: &'static SyntaxReference) -> State {
        State {
            parse: ParseState::new(syntax),
            scopes: ScopeStack::new(),
        }
    }

    fn bump(&self) -> u64 {
        self.generation.fetch_add(1, Ordering::AcqRel) + 1
    }

    fn done(&self) -> bool {
        !self.enabled || self.frontier >= self.lines.len()
    }

    /// Starts over on `text`.
    fn reset(&mut self, text: Rope) {
        self.bump();
        self.enabled = highlightable(&text);
        self.lines = if self.enabled {
            vec![None; text.lines_len()]
        } else {
            Vec::new()
        };
        self.frontier = 0;
        self.frontier_state = Self::initial(self.syntax);
        self.text = Some(text);
    }

    /// Follows one edit; `text` is the text right after it.
    fn edit(&mut self, edit: &InputEdit, text: Rope) {
        let Some(old) = self.text.as_ref() else {
            return self.reset(text);
        };
        let consistent = edit.start_byte <= edit.old_end_byte
            && edit.start_byte <= edit.new_end_byte
            && edit.old_end_byte <= old.len()
            && old.len() - (edit.old_end_byte - edit.start_byte)
                + (edit.new_end_byte - edit.start_byte)
                == text.len();
        let enabled = highlightable(&text);
        if !consistent || enabled != self.enabled || !enabled || self.lines.len() != old.lines_len()
        {
            return self.reset(text);
        }
        self.bump();
        // The first line whose text may have changed; one earlier when the edit starts a line, since a change
        // at a line's start can join it to the line before.
        let mut first = text.offset_to_point(edit.start_byte).row;
        if first > 0 && text.line_start_offset(first) == edit.start_byte {
            first -= 1;
        }
        let new_end = text.offset_to_point(edit.new_end_byte).row;
        let delta = text.lines_len() as isize - old.lines_len() as isize;
        let old_end = (new_end as isize - delta) as usize;
        let start_state = (first < self.frontier).then(|| {
            self.lines[first]
                .as_ref()
                .map(|l| State::clone(&l.start))
                .unwrap_or_else(|| self.frontier_state.clone())
        });
        let old_end = old_end.min(self.lines.len().saturating_sub(1)).max(first);
        self.lines.splice(
            first..=old_end,
            std::iter::repeat_n(None, new_end - first + 1),
        );
        // A frontier at or before `first` is untouched: the text before it did not change.
        if let Some(state) = start_state {
            self.frontier = first;
            self.frontier_state = state;
        }
        self.text = Some(text);
    }

    fn line_text(&self, row: usize) -> String {
        let text = self.text.as_ref().expect("a text");
        text.slice(text.line_start_offset(row)..text.line_start_offset(row + 1))
            .to_string()
    }

    /// Records line `frontier` as `line` and moves past it. Returns true when the rest converged (or ended).
    fn accept(&mut self, line: Line, end: State) -> bool {
        let at = self.frontier;
        self.lines[at] = Some(line);
        self.frontier += 1;
        self.frontier_state = end;
        self.converge()
    }

    /// When the next line's cached entry starts in the frontier's state, every cached line up to the next unknown
    /// one is right: skip them. Returns true once nothing is left to parse.
    fn converge(&mut self) -> bool {
        let matches = self
            .lines
            .get(self.frontier)
            .and_then(Option::as_ref)
            .is_some_and(|l| *l.start == self.frontier_state);
        if matches {
            self.bump();
            let unknown = self.lines[self.frontier..]
                .iter()
                .position(Option::is_none)
                .map(|i| i + self.frontier);
            match unknown {
                None => self.frontier = self.lines.len(),
                Some(row) => {
                    // The state an unknown line starts in is its predecessor's end.
                    let before = self.lines[row - 1].as_ref().expect("cached").clone();
                    let mut state = State::clone(&before.start);
                    parse_line(&mut state, &self.line_text(row - 1), &mut Kinds::default());
                    self.frontier = row;
                    self.frontier_state = state;
                }
            }
        }
        self.done()
    }

    /// Parses from the frontier on this thread for up to `budget`. Returns true when done.
    fn advance(&mut self, budget: Duration) -> bool {
        if self.done() || self.converge() {
            return true;
        }
        let clock = Instant::now();
        let mut kinds = Kinds::default();
        let mut recent = Vec::new();
        loop {
            let mut state = self.frontier_state.clone();
            let start = shared(&mut recent, &state);
            let spans = parse_line(&mut state, &self.line_text(self.frontier), &mut kinds);
            if self.accept(Line { start, spans }, state) {
                return true;
            }
            if clock.elapsed() >= budget {
                return false;
            }
        }
    }

    fn job(&self) -> Option<Job> {
        (!self.done()).then(|| Job {
            generation: self.generation.load(Ordering::Acquire),
            current: self.generation.clone(),
            text: self.text.clone().expect("a text"),
            from: self.frontier,
            state: self.frontier_state.clone(),
        })
    }

    /// Takes a background chunk. Returns false when it is stale or the parse is finished.
    fn install(&mut self, chunk: Chunk) -> bool {
        if chunk.generation != self.generation.load(Ordering::Acquire)
            || chunk.from != self.frontier
        {
            return false;
        }
        let mut lines = chunk.lines.into_iter().peekable();
        while let Some(line) = lines.next() {
            if self.frontier >= self.lines.len() {
                return false;
            }
            // The next line's start is this one's end; the last line's end is found by reparsing it.
            let end = match lines.peek() {
                Some(next) => State::clone(&next.start),
                None => {
                    let mut state = State::clone(&line.start);
                    parse_line(
                        &mut state,
                        &self.line_text(self.frontier),
                        &mut Kinds::default(),
                    );
                    state
                }
            };
            if self.accept(line, end) {
                return false;
            }
            // `accept` may have skipped ahead (convergence): the rest of this chunk is no longer in line.
            if self.generation.load(Ordering::Acquire) != chunk.generation {
                return false;
            }
        }
        true
    }

    /// Ordered, gap-free runs over `range`, plain where nothing is known.
    fn styles(
        &self,
        range: &Range<usize>,
        resolver: &dyn HighlightStyleResolver,
    ) -> Vec<(Range<usize>, HighlightStyle)> {
        let mut runs = Vec::new();
        let mut cursor = range.start;
        if let (Some(text), true) = (self.text.as_ref(), self.enabled) {
            let first = text.offset_to_point(range.start.min(text.len())).row;
            let mut row = first;
            while row < self.lines.len() {
                let line_start = text.line_start_offset(row);
                if line_start >= range.end {
                    break;
                }
                if let Some(line) = &self.lines[row] {
                    for &(from, to, kind) in line.spans.iter() {
                        let start = (line_start + from as usize).max(range.start);
                        let end = (line_start + to as usize).min(range.end);
                        if start >= end || end <= cursor {
                            continue;
                        }
                        if cursor < start {
                            runs.push((cursor..start, HighlightStyle::default()));
                        }
                        runs.push((
                            start.max(cursor)..end,
                            resolver.style(kind_name(kind)).unwrap_or_default(),
                        ));
                        cursor = end;
                    }
                }
                row += 1;
            }
        }
        if cursor < range.end {
            runs.push((cursor..range.end, HighlightStyle::default()));
        }
        runs
    }
}

/// The highlighter one editor owns.
pub struct IncrementalHighlighter {
    language: SharedString,
    core: Rc<RefCell<Core>>,
    /// Installs a background parse's chunks; dropped (cancelled) when a newer parse starts.
    task: Option<Task<()>>,
}

impl IncrementalHighlighter {
    /// A highlighter for `language` (a file name or language name), or none when syntect has no grammar for it.
    pub fn new(language: &str) -> Option<Self> {
        let syntax = syntax_for(language)?;
        Some(Self {
            language: language.to_string().into(),
            core: Rc::new(RefCell::new(Core::new(syntax))),
            task: None,
        })
    }

    fn spawn(&mut self, job: Job, cx: &mut Context<EditorState>) {
        let (sender, mut receiver) = futures::channel::mpsc::unbounded();
        // Its own thread rather than GPUI's background executor: a headless test's executor runs "background"
        // tasks inline on the main thread, which would hide exactly what this is for. It stops at its next line
        // once its generation is stale (an edit, a convergence, the highlighter dropped).
        RUNNING.fetch_add(1, Ordering::AcqRel);
        let spawned = std::thread::Builder::new()
            .name("perch-editor-highlight".into())
            .spawn(move || {
                job.run(|chunk| sender.unbounded_send(chunk).is_ok());
                RUNNING.fetch_sub(1, Ordering::AcqRel);
            });
        if spawned.is_err() {
            // No thread: the frontier stays put and the next edit tries again; the text still draws.
            RUNNING.fetch_sub(1, Ordering::AcqRel);
        }
        let core: Weak<RefCell<Core>> = Rc::downgrade(&self.core);
        self.task = Some(cx.spawn(async move |this, cx| {
            while let Some(chunk) = receiver.next().await {
                let Some(core) = core.upgrade() else { break };
                let more = core.borrow_mut().install(chunk);
                if this.update(cx, |_, cx| cx.notify()).is_err() || !more {
                    break;
                }
            }
        }));
    }
}

impl Drop for IncrementalHighlighter {
    fn drop(&mut self) {
        // Stops a background parse at its next line.
        self.core.borrow().bump();
    }
}

impl InputHighlighter for IncrementalHighlighter {
    fn language(&self) -> SharedString {
        self.language.clone()
    }

    fn update(
        &mut self,
        edit: Option<InputEdit>,
        text: &Rope,
        _folding: bool,
        _window: &mut Window,
        cx: &mut Context<EditorState>,
    ) {
        let job = {
            let mut core = self.core.borrow_mut();
            match edit {
                Some(edit) if core.text.is_some() => core.edit(&edit, text.clone()),
                _ => core.reset(text.clone()),
            }
            core.advance(SYNC_BUDGET);
            core.job()
        };
        match job {
            Some(job) => self.spawn(job, cx),
            None => self.task = None,
        }
    }

    fn update_batch(
        &mut self,
        edits: &[(InputEdit, Rope)],
        _folding: bool,
        _window: &mut Window,
        cx: &mut Context<EditorState>,
    ) {
        let job = {
            let mut core = self.core.borrow_mut();
            for (edit, text) in edits {
                if core.text.is_some() {
                    core.edit(edit, text.clone());
                } else {
                    core.reset(text.clone());
                }
            }
            core.advance(SYNC_BUDGET);
            core.job()
        };
        match job {
            Some(job) => self.spawn(job, cx),
            None => self.task = None,
        }
    }

    fn styles(
        &self,
        range: &Range<usize>,
        resolver: &dyn HighlightStyleResolver,
    ) -> Vec<(Range<usize>, HighlightStyle)> {
        self.core.borrow().styles(range, resolver)
    }

    fn fold_ranges(&self, text: &Rope) -> Vec<FoldRange> {
        brace_fold_ranges(&text.to_string())
    }
}

/// Brace pairs on different lines, outside `"` strings and `//` comments (the vendored adapter's rule).
fn brace_fold_ranges(text: &str) -> Vec<FoldRange> {
    let mut starts = Vec::new();
    let mut ranges = Vec::new();
    for (line_number, line) in text.lines().enumerate() {
        let mut chars = line.chars().peekable();
        let mut quoted = false;
        let mut escaped = false;
        while let Some(character) = chars.next() {
            if !quoted && character == '/' && chars.peek() == Some(&'/') {
                break;
            }
            if character == '"' && !escaped {
                quoted = !quoted;
            } else if !quoted && character == '{' {
                starts.push(line_number);
            } else if !quoted && character == '}' {
                if let Some(start_line) = starts.pop() {
                    if start_line < line_number {
                        ranges.push(FoldRange::new(start_line, line_number));
                    }
                }
            }
            escaped = quoted && character == '\\' && !escaped;
        }
    }
    ranges
}

#[cfg(test)]
mod tests {
    use super::*;
    use gpui_base::input::Point;

    /// Every line's spans from a whole-file parse, by absolute byte range.
    fn full(syntax: &'static SyntaxReference, text: &str) -> Vec<(usize, usize, u8)> {
        let mut state = Core::initial(syntax);
        let mut kinds = Kinds::default();
        let mut out = Vec::new();
        let mut offset = 0;
        for line in LinesWithEndings::from(text) {
            for (a, b, k) in parse_line(&mut state, line, &mut kinds).iter() {
                out.push((offset + *a as usize, offset + *b as usize, *k));
            }
            offset += line.len();
        }
        out
    }

    fn spans(core: &Core) -> Vec<(usize, usize, u8)> {
        let text = core.text.as_ref().unwrap();
        let mut out = Vec::new();
        for (row, line) in core.lines.iter().enumerate() {
            let base = text.line_start_offset(row);
            for (a, b, k) in line.as_ref().expect("parsed").spans.iter() {
                out.push((base + *a as usize, base + *b as usize, *k));
            }
        }
        out
    }

    /// Applies `range -> insert` to `text` and `core` as the editor would.
    fn apply(core: &mut Core, text: &mut String, range: Range<usize>, insert: &str) {
        let old = Rope::from(text.as_str());
        text.replace_range(range.clone(), insert);
        let new = Rope::from(text.as_str());
        let point = |rope: &Rope, at: usize| -> Point { rope.offset_to_point(at) };
        let edit = InputEdit {
            start_byte: range.start,
            old_end_byte: range.end,
            new_end_byte: range.start + insert.len(),
            start_position: point(&old, range.start),
            old_end_position: point(&old, range.end),
            new_end_position: point(&new, range.start + insert.len()),
        };
        core.edit(&edit, new);
    }

    fn finish(core: &mut Core) {
        while !core.advance(Duration::from_secs(60)) {}
    }

    /// A small deterministic generator (no dependency).
    struct Seeded(u64);
    impl Seeded {
        fn next(&mut self, n: usize) -> usize {
            self.0 = self
                .0
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            ((self.0 >> 33) as usize) % n.max(1)
        }
    }

    fn rust_file(lines: usize) -> String {
        (0..lines)
            .map(|i| match i % 7 {
                0 => format!("/// doc {i}\nfn f{i}(x: u32) -> u32 {{"),
                1 => format!("    let s = \"text {i} \\n\"; // note"),
                2 => "    /* block */ x + 1".into(),
                3 => "}".into(),
                4 => format!("struct S{i} {{ a: Vec<u8> }}"),
                5 => format!("const C{i}: f64 = {i}.5;"),
                _ => "impl Trait for T { fn g(&self) {} }".into(),
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn ts_file(lines: usize) -> String {
        (0..lines)
            .map(|i| match i % 6 {
                0 => format!("export function f{i}(a: number): string {{"),
                1 => format!("  const t = `tpl ${{a}} {i}`; // c"),
                2 => "  return /re[a-z]+/.test('x') ? \"y\" : 'z';".into(),
                3 => "}".into(),
                4 => format!("interface I{i} {{ k?: Array<string> }}"),
                _ => "/* comment */ let v = { a: 1, b: true, c: null };".into(),
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    const SNIPPETS: [&str; 10] = ["a", "\n", "\"", "/*", "*/", "{", "}", "'", "`", "// x\n"];

    #[test]
    fn lines_share_their_start_states() {
        // Statements alternating between a few parse states, as Perch's editor timing files are.
        let text: String = (0..10_000)
            .map(|i| match i % 5 {
                0 => format!("fn f{i}() -> u8 {{ 1 }}\n"),
                1 => format!("let s = \"v{i}\"; // n\n"),
                2 => format!("/* b */ x += {};\n", i % 97),
                3 => "struct S { a: u32 }\n".to_string(),
                _ => format!("const C: f64 = {i}.5;\n"),
            })
            .collect();
        let syntax = syntax_for("main.rs").unwrap();
        let job = Job {
            generation: 0,
            current: Arc::new(AtomicU64::new(0)),
            text: Rope::from(text.as_str()),
            from: 0,
            state: Core::initial(syntax),
        };
        let mut lines = Vec::new();
        job.run(|chunk| {
            lines.extend(chunk.lines);
            true
        });
        assert_eq!(lines.len(), 10_001);
        let distinct: std::collections::HashSet<_> =
            lines.iter().map(|l| Arc::as_ptr(&l.start)).collect();
        assert!(
            distinct.len() <= RECENT_STATES,
            "{} distinct start states",
            distinct.len()
        );
    }

    #[test]
    fn random_edits_match_a_full_parse() {
        for (name, source) in [("main.rs", rust_file(2_000)), ("app.ts", ts_file(2_000))] {
            let syntax = syntax_for(name).unwrap();
            let mut text = source;
            let mut core = Core::new(syntax);
            core.reset(Rope::from(text.as_str()));
            finish(&mut core);
            assert_eq!(spans(&core), full(syntax, &text), "{name}: initial");
            let mut random = Seeded(7);
            for step in 0..500 {
                let at = random.next(text.len());
                let at = (0..=at).rev().find(|i| text.is_char_boundary(*i)).unwrap();
                let end = (at + random.next(12)).min(text.len());
                let end = (end..=text.len())
                    .find(|i| text.is_char_boundary(*i))
                    .unwrap();
                let insert = if random.next(3) == 0 {
                    ""
                } else {
                    SNIPPETS[random.next(SNIPPETS.len())]
                };
                apply(&mut core, &mut text, at..end, insert);
                // Interleave: sometimes the next edit lands before the parse caught up.
                if random.next(4) != 0 {
                    finish(&mut core);
                }
                if step % 50 == 49 {
                    finish(&mut core);
                    assert_eq!(
                        spans(&core),
                        full(syntax, &text),
                        "{name}: after edit {step}"
                    );
                }
            }
            finish(&mut core);
            assert_eq!(spans(&core), full(syntax, &text), "{name}: at the end");
        }
    }

    #[test]
    fn a_one_line_edit_converges_after_a_line_or_two() {
        let syntax = syntax_for("rust").unwrap();
        let mut text = rust_file(2_000);
        let mut core = Core::new(syntax);
        core.reset(Rope::from(text.as_str()));
        finish(&mut core);
        let at = text.find("let s").unwrap();
        apply(&mut core, &mut text, at..at, "x");
        let frontier = core.frontier;
        // Parse two lines' worth at most: it must be done.
        let mut parsed = 0;
        while !core.done() && parsed < 3 {
            let mut state = core.frontier_state.clone();
            let spans = parse_line(
                &mut state,
                &core.line_text(core.frontier),
                &mut Kinds::default(),
            );
            let start = Arc::new(core.frontier_state.clone());
            core.accept(Line { start, spans }, state);
            parsed += 1;
        }
        assert!(
            core.done(),
            "converged within {parsed} lines from line {frontier}"
        );
        assert_eq!(spans(&core), full(syntax, &text));
    }

    #[test]
    fn opening_a_block_comment_recolours_the_rest_and_closing_it_restores() {
        let syntax = syntax_for("rs").unwrap();
        let mut text = rust_file(300);
        let mut core = Core::new(syntax);
        core.reset(Rope::from(text.as_str()));
        finish(&mut core);
        let comment = (0..KIND_COUNT)
            .find(|k| kind_name(*k) == "comment")
            .unwrap();
        let last = text.rfind("const").unwrap();
        let before = spans(&core);
        apply(&mut core, &mut text, 0..0, "/*");
        finish(&mut core);
        let after = spans(&core);
        assert!(
            after
                .iter()
                .any(|(a, b, k)| *k == comment && *a <= last && *b > last),
            "the last line is in the comment now"
        );
        assert_eq!(after, full(syntax, &text));
        apply(&mut core, &mut text, 0..2, "");
        finish(&mut core);
        assert_eq!(spans(&core), before);
    }

    #[test]
    fn a_background_chunk_for_an_older_text_is_dropped() {
        let syntax = syntax_for("rust").unwrap();
        let mut text = rust_file(500);
        let mut core = Core::new(syntax);
        core.reset(Rope::from(text.as_str()));
        let job = core.job().unwrap();
        let mut chunks = Vec::new();
        Job {
            current: Arc::new(AtomicU64::new(job.generation)),
            ..job
        }
        .run(|c| {
            chunks.push(c);
            true
        });
        // The text changes while the parse runs: its results are for the old text.
        apply(&mut core, &mut text, 0..0, "/*");
        for chunk in chunks {
            assert!(!core.install(chunk), "a stale chunk is refused");
        }
        assert!(
            core.lines.iter().all(Option::is_none),
            "nothing stale was coloured"
        );
        // A parse of the current text installs and matches a full parse.
        let job = core.job().unwrap();
        let mut chunks = Vec::new();
        Job {
            current: Arc::new(AtomicU64::new(job.generation)),
            ..job
        }
        .run(|c| {
            chunks.push(c);
            true
        });
        for chunk in chunks {
            core.install(chunk);
        }
        assert!(core.done());
        assert_eq!(spans(&core), full(syntax, &text));
    }

    #[test]
    fn large_and_unknown_files_are_plain() {
        assert!(syntax_for("notes.unknownext").is_none());
        assert!(syntax_for("README").is_none());
        assert!(syntax_for("Makefile").is_some());
        assert!(syntax_for("src/main.rs").is_some());
        assert!(
            syntax_for("app.tsx").is_some(),
            "TypeScript falls back to JavaScript"
        );
        let syntax = syntax_for("rust").unwrap();
        let mut core = Core::new(syntax);
        core.reset(Rope::from("x".repeat(MAX_HIGHLIGHT_CHARS + 1).as_str()));
        assert!(core.done(), "nothing to parse past the cap");
        let runs = core.styles(
            &(0..10),
            &super::super::theme::SyntaxColours::new(&crate::mods::theme::resolve("perch")),
        );
        assert_eq!(runs.len(), 1);
        assert_eq!(runs[0].1, HighlightStyle::default());
    }

    #[test]
    fn styles_cover_the_range_without_gaps() {
        let syntax = syntax_for("rust").unwrap();
        let text = rust_file(40);
        let mut core = Core::new(syntax);
        core.reset(Rope::from(text.as_str()));
        finish(&mut core);
        let colours =
            super::super::theme::SyntaxColours::new(&crate::mods::theme::resolve("perch"));
        for range in [0..text.len(), 5..17, 100..300] {
            let runs = core.styles(&range, &colours);
            assert_eq!(runs.first().unwrap().0.start, range.start);
            assert_eq!(runs.last().unwrap().0.end, range.end);
            for pair in runs.windows(2) {
                assert_eq!(pair[0].0.end, pair[1].0.start);
            }
            assert!(runs.iter().any(|(_, s)| s.color.is_some()));
        }
    }
}
