//! The main area's tabs and splits, with no GPUI.
//!
//! The web's model (`workspaceTabs.ts`, `splitSets.ts`, `tiledPanes.ts`): a tab is a session, the
//! strip lists the tabs in order, and a split set shows several tabs side by side: a row or column
//! of panes, nested to any depth, at most [`MAX_SPLIT`] panes. A pane is a tab, so closing a pane
//! closes its tab. A session shows in one place at a time because a tab is named by its session.
//! Like the web's, this is per viewer: it is never sent to the core, so no other client reads it
//! and the layout the web stores for a session (`session.layout.set`) is never written.
//!
//! This holds ids and shapes only. The window keeps what each id means (its terminal) and draws
//! [`Tabs::visible`].

/// Most panes a split set holds.
pub const MAX_SPLIT: usize = 4;

/// Fewest pixels a resize by key leaves a pane, as the web's `MIN_PANE_PX` (48 and the gap).
pub const MIN_PANE_PX: f32 = 54.0;

/// Most places Back and Forward remember, as the web's.
const MAX_PLACES: usize = 50;

/// Panes side by side (`Row`) or stacked (`Col`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Dir {
    Row,
    Col,
}

/// A side of the focused pane: where a split puts the new pane, or which neighbour to go to.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Side {
    Left,
    Right,
    Up,
    Down,
}

impl Side {
    /// `left`, `right`, `up`, `down`, and the split command's `below` for down.
    pub fn parse(word: &str) -> Option<Self> {
        Some(match word {
            "left" => Self::Left,
            "right" => Self::Right,
            "up" => Self::Up,
            "down" | "below" => Self::Down,
            _ => return None,
        })
    }

    /// The web's name for the side (`DropZone`).
    pub fn word(self) -> &'static str {
        match self {
            Self::Left => "left",
            Self::Right => "right",
            Self::Up => "up",
            Self::Down => "down",
        }
    }

    fn dir(self) -> Dir {
        match self {
            Self::Left | Self::Right => Dir::Row,
            Self::Up | Self::Down => Dir::Col,
        }
    }

    fn after(self) -> bool {
        matches!(self, Self::Right | Self::Down)
    }
}

/// A pane (a tab's id) or a row or column of nodes with size fractions summing to 1.
#[derive(Clone, Debug, PartialEq)]
pub enum Node {
    Pane(String),
    Split {
        dir: Dir,
        kids: Vec<Node>,
        sizes: Vec<f32>,
    },
}

fn equal(n: usize) -> Vec<f32> {
    vec![1.0 / n as f32; n]
}

impl Node {
    /// The panes, in layout order.
    pub fn leaves(&self) -> Vec<&str> {
        match self {
            Node::Pane(id) => vec![id],
            Node::Split { kids, .. } => kids.iter().flat_map(Node::leaves).collect(),
        }
    }

    fn has(&self, id: &str) -> bool {
        self.leaves().contains(&id)
    }

    /// `self` without pane `id`: a split left with one child becomes that child, and a child of
    /// the parent's own direction merges into it. The others keep their proportions.
    fn without(&self, id: &str) -> Option<Node> {
        let Node::Split { dir, kids, sizes } = self else {
            return match self {
                Node::Pane(pane) if pane == id => None,
                other => Some(other.clone()),
            };
        };
        let kept: Vec<(Node, f32)> = kids
            .iter()
            .zip(sizes)
            .filter_map(|(kid, size)| kid.without(id).map(|kid| (kid, *size)))
            .collect();
        if kept.len() <= 1 {
            return kept.into_iter().next().map(|(kid, _)| kid);
        }
        let total: f32 = kept.iter().map(|(_, size)| size).sum();
        let (mut kids, mut sizes) = (Vec::new(), Vec::new());
        for (kid, size) in kept {
            let share = if total > 0.0 {
                size / total
            } else {
                1.0 / kids.len().max(1) as f32
            };
            match kid {
                Node::Split {
                    dir: inner,
                    kids: inner_kids,
                    sizes: inner_sizes,
                } if inner == *dir => {
                    sizes.extend(inner_sizes.iter().map(|s| s * share));
                    kids.extend(inner_kids);
                }
                kid => {
                    kids.push(kid);
                    sizes.push(share);
                }
            }
        }
        Some(Node::Split {
            dir: *dir,
            kids,
            sizes,
        })
    }

    /// `new` on `side` of pane `target`: a sibling when the parent runs that way, else `target`
    /// is replaced by a row or column of the two.
    fn insert_beside(&self, target: &str, new: &str, side: Side) -> Node {
        let pair = |first: Node, second: Node| Node::Split {
            dir: side.dir(),
            kids: vec![first, second],
            sizes: vec![0.5, 0.5],
        };
        match self {
            Node::Pane(id) if id == target => {
                let (old, new) = (Node::Pane(id.clone()), Node::Pane(new.into()));
                if side.after() {
                    pair(old, new)
                } else {
                    pair(new, old)
                }
            }
            Node::Pane(_) => self.clone(),
            Node::Split { dir, kids, sizes } => {
                let at = kids
                    .iter()
                    .position(|kid| matches!(kid, Node::Pane(id) if id == target));
                match at {
                    Some(at) if *dir == side.dir() => {
                        let mut kids = kids.clone();
                        kids.insert(at + usize::from(side.after()), Node::Pane(new.into()));
                        Node::Split {
                            dir: *dir,
                            sizes: equal(kids.len()),
                            kids,
                        }
                    }
                    _ => Node::Split {
                        dir: *dir,
                        kids: kids
                            .iter()
                            .map(|kid| kid.insert_beside(target, new, side))
                            .collect(),
                        sizes: sizes.clone(),
                    },
                }
            }
        }
    }

    fn swap(&self, a: &str, b: &str) -> Node {
        match self {
            Node::Pane(id) if id == a => Node::Pane(b.into()),
            Node::Pane(id) if id == b => Node::Pane(a.into()),
            Node::Pane(_) => self.clone(),
            Node::Split { dir, kids, sizes } => Node::Split {
                dir: *dir,
                kids: kids.iter().map(|kid| kid.swap(a, b)).collect(),
                sizes: sizes.clone(),
            },
        }
    }
}

/// Where a pane is, as fractions of the whole.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

/// Each pane's place in `node` laid out in the unit square.
pub fn layout(node: &Node, rect: Rect, out: &mut Vec<(String, Rect)>) {
    match node {
        Node::Pane(id) => out.push((id.clone(), rect)),
        Node::Split { dir, kids, sizes } => {
            let mut at = 0.0;
            for (kid, size) in kids.iter().zip(sizes) {
                let r = match dir {
                    Dir::Row => Rect {
                        x: rect.x + rect.w * at,
                        w: rect.w * size,
                        ..rect
                    },
                    Dir::Col => Rect {
                        y: rect.y + rect.h * at,
                        h: rect.h * size,
                        ..rect
                    },
                };
                layout(kid, r, out);
                at += size;
            }
        }
    }
}

/// The tabs, the split sets, and which tab has the keyboard.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Tabs {
    strip: Vec<String>,
    /// Each a split of two or more tabs; a tab is in at most one.
    sets: Vec<Node>,
    active: Option<String>,
    /// The focused pane fills the area (`panes.zoom`).
    zoomed: bool,
    /// Preview tabs (a file opened by a single click, drawn in italics): the next previewed
    /// file of the same workspace takes its place until it is kept.
    previews: Vec<String>,
}

impl Tabs {
    /// The tab ids in order.
    pub fn strip(&self) -> &[String] {
        &self.strip
    }

    /// The tab with the keyboard.
    pub fn active(&self) -> Option<&str> {
        self.active.as_deref()
    }

    pub fn zoomed(&self) -> bool {
        self.zoomed && self.set_of(self.active.as_deref()).is_some()
    }

    pub fn contains(&self, id: &str) -> bool {
        self.strip.iter().any(|tab| tab == id)
    }

    fn set_of(&self, id: Option<&str>) -> Option<usize> {
        let id = id?;
        self.sets.iter().position(|set| set.has(id))
    }

    /// Add a tab at the end and give it the keyboard; one already open is just shown.
    pub fn open(&mut self, id: &str) {
        if !self.contains(id) {
            self.strip.push(id.into());
        }
        self.show(id);
    }

    /// Give a tab the keyboard. Leaving a zoomed pane for another tab un-zooms.
    pub fn show(&mut self, id: &str) -> bool {
        if !self.contains(id) {
            return false;
        }
        if self.zoomed && self.active.as_deref() != Some(id) {
            self.zoomed = false;
        }
        self.active = Some(id.into());
        true
    }

    /// Show no tab (the start page), keeping the others open.
    pub fn hide(&mut self) {
        self.active = None;
        self.zoomed = false;
    }

    /// The tab at `index` (1 is first), or the last when there are fewer, as the web jumps;
    /// `None` is the last (`tabs.last`).
    pub fn jump(&mut self, index: Option<usize>) -> bool {
        let id = match index {
            Some(0) => None,
            Some(n) => self.strip.get(n.min(self.strip.len()).wrapping_sub(1)),
            None => self.strip.last(),
        };
        let id = id.cloned();
        id.is_some_and(|id| self.show(&id))
    }

    /// The next (`1`) or previous (`-1`) tab, wrapping.
    pub fn step(&mut self, by: isize) {
        let len = self.strip.len() as isize;
        if len == 0 {
            return;
        }
        let at = self
            .active
            .as_ref()
            .and_then(|a| self.strip.iter().position(|t| t == a))
            .map_or(-1, |at| at as isize);
        let to = (at + by).rem_euclid(len) as usize;
        let id = self.strip[to].clone();
        self.show(&id);
    }

    /// The preview tabs.
    pub fn previews(&self) -> &[String] {
        &self.previews
    }

    /// Whether tab `id` is a preview.
    pub fn is_preview(&self, id: &str) -> bool {
        self.previews.iter().any(|p| p == id)
    }

    /// Show `id` as a preview tab, as the web's `openFilePreview`: an open tab is just shown,
    /// preview or not; else it takes the slot of the preview `same_place` accepts (its
    /// workspace's) that is in no split, else it goes last. Returns the preview it replaced,
    /// whose tab is gone.
    pub fn open_preview(&mut self, id: &str, same_place: impl Fn(&str) -> bool) -> Option<String> {
        if self.contains(id) {
            self.show(id);
            return None;
        }
        let old = self
            .previews
            .iter()
            .find(|p| same_place(p) && !self.in_split(p))
            .cloned();
        self.previews.push(id.into());
        let Some(old) = old else {
            self.open(id);
            return None;
        };
        let at = self.strip.iter().position(|t| *t == old)?;
        self.strip[at] = id.into();
        self.previews.retain(|p| *p != old);
        self.show(id);
        Some(old)
    }

    /// A preview tab becomes a regular one (double-click, Enter, an edit, Keep open). Returns
    /// whether it was a preview.
    pub fn pin(&mut self, id: &str) -> bool {
        let was = self.is_preview(id);
        self.previews.retain(|p| p != id);
        was
    }

    /// Close a tab. If it had the keyboard, the next tab takes it, else the one before. Returns
    /// whether it was open.
    pub fn close(&mut self, id: &str) -> bool {
        let Some(at) = self.strip.iter().position(|tab| tab == id) else {
            return false;
        };
        self.strip.remove(at);
        self.leave(id);
        self.previews.retain(|p| p != id);
        if self.active.as_deref() == Some(id) {
            self.zoomed = false;
            self.active = self.strip.get(at).or_else(|| self.strip.last()).cloned();
        }
        true
    }

    /// Move a tab to a number in the strip (1 is first).
    pub fn move_tab(&mut self, id: &str, index: usize) -> bool {
        let Some(from) = self.strip.iter().position(|tab| tab == id) else {
            return false;
        };
        if index == 0 || index > self.strip.len() {
            return false;
        }
        let tab = self.strip.remove(from);
        self.strip.insert(index - 1, tab);
        true
    }

    /// Take a tab out of its split; a set left with one pane dissolves.
    fn leave(&mut self, id: &str) {
        let sets = std::mem::take(&mut self.sets);
        self.sets = sets
            .into_iter()
            .filter_map(|set| set.without(id))
            .filter(|set| matches!(set, Node::Split { .. }))
            .collect();
    }

    /// Take a tab out of its split and show it alone; the tab stays (`pane.unsplit`).
    pub fn unsplit(&mut self, id: &str) {
        self.leave(id);
        self.zoomed = false;
        self.show(id);
    }

    /// Whether the focused tab's split can take another pane.
    pub fn has_room(&self) -> bool {
        self.active().is_some()
            && self
                .set_of(self.active())
                .is_none_or(|i| self.sets[i].leaves().len() < MAX_SPLIT)
    }

    /// Put a new tab on `side` of the focused one, and give it the keyboard. `false` when there
    /// is no focused tab, the set is full, or the tab is already in this set.
    pub fn split(&mut self, new: &str, side: Side) -> bool {
        let Some(target) = self.active.clone() else {
            return false;
        };
        let home = self.set_of(Some(&target));
        let panes = home.map_or(1, |i| self.sets[i].leaves().len());
        if panes >= MAX_SPLIT || new == target || home.is_some_and(|i| self.sets[i].has(new)) {
            return false;
        }
        // A tab shows in one place: it leaves any other set first.
        self.leave(new);
        let home = self.set_of(Some(&target));
        let base = home.map_or(Node::Pane(target.clone()), |i| self.sets[i].clone());
        let made = base.insert_beside(&target, new, side);
        match home {
            Some(i) => self.sets[i] = made,
            None => self.sets.push(made),
        }
        if !self.contains(new) {
            self.strip.push(new.into());
        }
        self.zoomed = false;
        self.active = Some(new.into());
        true
    }

    /// Put `other` beside `anchor`, as the web's `joinSplit`: into `anchor`'s set if it has one
    /// (`other` leaves any set it was in), else `anchor` joins `other`'s set, else a new row of
    /// the two. The one joining goes at the end of the set's outermost row or column. `false`, and
    /// nothing changes, when either is not a tab, they are one tab or already together, or the set
    /// is full. Which tab has the keyboard does not change.
    pub fn join(&mut self, anchor: &str, other: &str) -> bool {
        if anchor == other || !self.contains(anchor) || !self.contains(other) {
            return false;
        }
        let home = self.set_of(Some(anchor));
        if home.is_some_and(|i| self.sets[i].has(other)) {
            return false;
        }
        let dest = home.or_else(|| self.set_of(Some(other)));
        if dest.is_some_and(|i| self.sets[i].leaves().len() >= MAX_SPLIT) {
            return false;
        }
        let (joiner, member) = if home.is_some() || dest.is_none() {
            (other, anchor)
        } else {
            (anchor, other)
        };
        let base = dest.map_or_else(|| Node::Pane(member.into()), |i| self.sets[i].clone());
        let grown = match base {
            Node::Pane(_) => Node::Split {
                dir: Dir::Row,
                kids: vec![base, Node::Pane(joiner.into())],
                sizes: vec![0.5, 0.5],
            },
            Node::Split { dir, mut kids, .. } => {
                kids.push(Node::Pane(joiner.into()));
                Node::Split {
                    dir,
                    sizes: equal(kids.len()),
                    kids,
                }
            }
        };
        if let Some(i) = dest {
            self.sets.remove(i);
        }
        self.leave(joiner);
        self.sets.push(grown);
        self.zoomed = false;
        true
    }

    /// Whether dropping `dragged` on the `side` of `target` can split (the web's `planDrop`): two
    /// tabs, and room in `target`'s set once `dragged` has left it.
    pub fn can_drop(&self, dragged: &str, target: &str) -> bool {
        self.beside(dragged, target).is_some()
    }

    /// The set `target`'s pane is in, with `dragged` out of it; `None` when the drop cannot be.
    fn beside(&self, dragged: &str, target: &str) -> Option<Node> {
        if dragged == target || !self.contains(dragged) || !self.contains(target) {
            return None;
        }
        let home = self.set_of(Some(target));
        let base = home.map_or_else(|| Node::Pane(target.into()), |i| self.sets[i].clone());
        let rest = base.without(dragged).unwrap_or(Node::Pane(target.into()));
        (rest.leaves().len() < MAX_SPLIT).then_some(rest)
    }

    /// Drop `dragged` on the `side` of `target`, as the web's `dropTab`: it joins (or starts)
    /// `target`'s set, leaving any other (`dropSplit`); a side across the set's direction nests.
    /// In the strip it goes just before `target` (left, up) or after it (right, down), so the
    /// strip's order is the panes'. The dropped tab gets the keyboard. `false`, and nothing
    /// changes, when it cannot be.
    pub fn drop_beside(&mut self, dragged: &str, target: &str, side: Side) -> bool {
        let Some(rest) = self.beside(dragged, target) else {
            return false;
        };
        if let Some(from) = self.strip.iter().position(|tab| tab == dragged) {
            let tab = self.strip.remove(from);
            let at = self.strip.iter().position(|t| t == target).unwrap_or(0);
            let after = matches!(side, Side::Right | Side::Down);
            self.strip.insert(at + usize::from(after), tab);
        }
        let made = rest.insert_beside(target, dragged, side);
        if let Some(i) = self.set_of(Some(target)) {
            self.sets.remove(i);
        }
        self.leave(dragged);
        self.sets.push(made);
        self.zoomed = false;
        self.active = Some(dragged.into());
        true
    }

    /// Dissolve the set `id` is in: every tab in it shows alone again (`separateAll`).
    pub fn untile(&mut self, id: &str) {
        self.sets.retain(|set| !set.has(id));
        self.zoomed = false;
    }

    /// Whether tab `id` is in a split.
    pub fn in_split(&self, id: &str) -> bool {
        self.set_of(Some(id)).is_some()
    }

    /// Whether the set tab `id` is in (or `id` alone) has room for another pane.
    pub fn room_beside(&self, id: &str) -> bool {
        self.set_of(Some(id))
            .is_none_or(|i| self.sets[i].leaves().len() < MAX_SPLIT)
    }

    /// Which of `among` (tabs, or sessions with no tab yet) [`Self::join`] can put beside `id`
    /// (the tab menu's `offered`), in that order: not `id` or in its set, and the set the two
    /// would make fits [`MAX_SPLIT`].
    pub fn offered(&self, id: &str, among: &[String]) -> Vec<String> {
        let home = self.set_of(Some(id));
        among
            .iter()
            .filter(|other| *other != id && !home.is_some_and(|i| self.sets[i].has(other)))
            .filter(|other| {
                let size = match home {
                    Some(i) => self.sets[i].leaves().len() + 1,
                    None => {
                        self.set_of(Some(other))
                            .map_or(1, |i| self.sets[i].leaves().len())
                            + 1
                    }
                };
                size <= MAX_SPLIT
            })
            .cloned()
            .collect()
    }

    /// What the area draws: the focused pane alone when zoomed or in no split, else its split.
    pub fn visible(&self) -> Option<Node> {
        let active = self.active.as_deref()?;
        if self.zoomed() {
            return Some(Node::Pane(active.into()));
        }
        Some(
            self.set_of(Some(active))
                .map_or_else(|| Node::Pane(active.into()), |i| self.sets[i].clone()),
        )
    }

    /// The panes drawn, in layout order.
    pub fn shown(&self) -> Vec<String> {
        self.visible()
            .map(|n| n.leaves().iter().map(|id| id.to_string()).collect())
            .unwrap_or_default()
    }

    /// Zoom the focused pane to fill the area, or restore (`panes.zoom`). Only a split zooms.
    pub fn zoom(&mut self) -> bool {
        if self.set_of(self.active.as_deref()).is_none() {
            return false;
        }
        self.zoomed = !self.zoomed;
        true
    }

    /// The pane next to the focused one on `side`, by the layout's geometry, nested splits
    /// included: the nearest one that overlaps it, the most overlapping on a tie.
    pub fn neighbor(&self, side: Side) -> Option<String> {
        let set = self.sets.get(self.set_of(self.active.as_deref())?)?;
        let active = self.active.as_deref()?;
        let mut panes = Vec::new();
        layout(
            set,
            Rect {
                x: 0.0,
                y: 0.0,
                w: 1.0,
                h: 1.0,
            },
            &mut panes,
        );
        let a = panes.iter().find(|(id, _)| id == active)?.1;
        let eps = 1e-6;
        let mut best: Option<(&str, f32, f32)> = None;
        for (id, r) in &panes {
            if id == active {
                continue;
            }
            let (gap, overlap) = match side {
                Side::Right => (r.x - (a.x + a.w), (a.y + a.h).min(r.y + r.h) - a.y.max(r.y)),
                Side::Left => (a.x - (r.x + r.w), (a.y + a.h).min(r.y + r.h) - a.y.max(r.y)),
                Side::Down => (r.y - (a.y + a.h), (a.x + a.w).min(r.x + r.w) - a.x.max(r.x)),
                Side::Up => (a.y - (r.y + r.h), (a.x + a.w).min(r.x + r.w) - a.x.max(r.x)),
            };
            if gap < -eps || overlap <= eps {
                continue;
            }
            let better = best
                .is_none_or(|(_, g, o)| gap < g - eps || ((gap - g).abs() <= eps && overlap > o));
            if better {
                best = Some((id, gap, overlap));
            }
        }
        best.map(|(id, _, _)| id.to_string())
    }

    /// Give the keyboard to the neighbour on `side` (`pane.go`).
    pub fn go(&mut self, side: Side) -> bool {
        match self.neighbor(side) {
            Some(id) => self.show(&id),
            None => false,
        }
    }

    /// The next or previous pane of the split, wrapping (`panes.next`, `panes.prev`).
    pub fn cycle(&mut self, by: isize) -> bool {
        let shown = self.shown();
        let Some(at) = shown
            .iter()
            .position(|id| Some(id.as_str()) == self.active())
        else {
            return false;
        };
        if shown.len() < 2 {
            return false;
        }
        let to = (at as isize + by).rem_euclid(shown.len() as isize) as usize;
        self.show(&shown[to].clone())
    }

    /// Swap the focused pane's place with another pane's (`pane.swap`). Focus stays with the tab.
    pub fn swap_with(&mut self, other: &str) -> bool {
        let Some(active) = self.active.clone() else {
            return false;
        };
        let Some(i) = self.set_of(Some(&active)) else {
            return false;
        };
        if !self.sets[i].has(other) || other == active {
            return false;
        }
        self.sets[i] = self.sets[i].swap(&active, other);
        true
    }

    /// Swap with the neighbour on `side`.
    pub fn swap_side(&mut self, side: Side) -> bool {
        match self.neighbor(side) {
            Some(id) => self.swap_with(&id),
            None => false,
        }
    }

    /// Grow (a positive `delta`) or shrink the focused pane by `delta` pixels, as the web's
    /// `resize`: in the innermost row or column holding it, against the next pane, or the one
    /// before for the last, and neither is left under [`MIN_PANE_PX`]. `width` and `height` are the
    /// split's on screen. `false` when nothing changed: no split, a zoomed pane, or no room.
    pub fn resize(&mut self, delta: f32, width: f32, height: f32) -> bool {
        let Some(active) = self.active.clone() else {
            return false;
        };
        let Some(i) = self.set_of(Some(&active)).filter(|_| !self.zoomed()) else {
            return false;
        };
        let rect = Rect {
            x: 0.0,
            y: 0.0,
            w: width,
            h: height,
        };
        resize_in(&mut self.sets[i], &active, delta, rect)
    }

    /// Swap with the next pane in layout order.
    pub fn swap_next(&mut self) -> bool {
        let shown = self.shown();
        let Some(at) = shown
            .iter()
            .position(|id| Some(id.as_str()) == self.active())
        else {
            return false;
        };
        if shown.len() < 2 {
            return false;
        }
        let next = shown[(at + 1) % shown.len()].clone();
        self.swap_with(&next)
    }
}

/// [`Tabs::resize`] in `node`, laid out in `rect`.
fn resize_in(node: &mut Node, id: &str, delta: f32, rect: Rect) -> bool {
    let Node::Split { dir, kids, sizes } = node else {
        return false;
    };
    if let Some(at) = kids
        .iter()
        .position(|kid| matches!(kid, Node::Pane(pane) if pane == id))
    {
        let extent = match dir {
            Dir::Row => rect.w,
            Dir::Col => rect.h,
        };
        if extent <= 0.0 || sizes.len() < 2 {
            return false;
        }
        let other = if at + 1 < sizes.len() { at + 1 } else { at - 1 };
        let min = MIN_PANE_PX / extent;
        let change = (delta / extent)
            .min(sizes[other] - min)
            .max(min - sizes[at]);
        sizes[at] += change;
        sizes[other] -= change;
        return change.abs() > f32::EPSILON;
    }
    let mut at = 0.0;
    for (kid, size) in kids.iter_mut().zip(sizes.iter()) {
        let r = match dir {
            Dir::Row => Rect {
                x: rect.x + rect.w * at,
                w: rect.w * size,
                ..rect
            },
            Dir::Col => Rect {
                y: rect.y + rect.h * at,
                h: rect.h * size,
                ..rect
            },
        };
        at += size;
        if kid.has(id) {
            return resize_in(kid, id, delta, r);
        }
    }
    false
}

/// Back and Forward over the tabs this window showed, as a browser's history (the web's
/// `NavHistory`): it moves by when a tab was shown, not by its place in the strip. Per window and
/// in memory only; it only shows tabs, never starts or ends anything.
#[derive(Clone, Debug, Default)]
pub struct History {
    places: Vec<String>,
    at: Option<usize>,
}

impl History {
    /// The place shown now.
    pub fn current(&self) -> Option<&str> {
        self.at
            .and_then(|at| self.places.get(at))
            .map(String::as_str)
    }

    /// `id` is shown: a visit, which drops the places ahead, as a browser does.
    pub fn record(&mut self, id: &str) {
        if self.current() == Some(id) {
            return;
        }
        self.places.truncate(self.at.map_or(0, |at| at + 1));
        self.places.push(id.into());
        if self.places.len() > MAX_PLACES {
            self.places.remove(0);
        }
        self.at = Some(self.places.len() - 1);
    }

    /// The nearest place back (`-1`) or forward (`1`) that still `exists`, which becomes the
    /// current one; places gone since are passed over.
    pub fn step(&mut self, by: isize, exists: impl Fn(&str) -> bool) -> Option<String> {
        let mut i = self.at? as isize;
        loop {
            i += by;
            let place = self.places.get(usize::try_from(i).ok()?)?;
            if exists(place) {
                self.at = Some(i as usize);
                return Some(place.clone());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// File tabs as the window names them: `<workspace>\n<path>`.
    fn in_workspace(workspace: &'static str) -> impl Fn(&str) -> bool {
        move |id| id.split_once('\n').is_some_and(|(w, _)| w == workspace)
    }

    #[test]
    fn a_click_replaces_the_preview_in_its_slot() {
        let mut t = tabs(&["s1"]);
        assert_eq!(t.open_preview("w\na.rs", in_workspace("w")), None);
        t.open("s2");
        assert_eq!(
            t.open_preview("w\nb.rs", in_workspace("w")),
            Some("w\na.rs".into())
        );
        assert_eq!(t.strip(), ["s1", "w\nb.rs", "s2"]);
        assert_eq!(t.active(), Some("w\nb.rs"));
        assert!(t.is_preview("w\nb.rs") && !t.is_preview("w\na.rs"));
        // Another workspace has its own preview.
        assert_eq!(t.open_preview("v\nc.rs", in_workspace("v")), None);
        assert_eq!(t.strip().len(), 4);
    }

    #[test]
    fn an_open_file_is_just_shown_preview_or_not() {
        let mut t = tabs(&["w\na.rs", "s1"]);
        t.show("s1");
        assert_eq!(t.open_preview("w\na.rs", in_workspace("w")), None);
        assert_eq!(t.active(), Some("w\na.rs"));
        assert!(!t.is_preview("w\na.rs"));
    }

    #[test]
    fn keep_open_promotes_and_a_kept_tab_is_never_replaced() {
        let mut t = Tabs::default();
        t.open_preview("w\na.rs", in_workspace("w"));
        assert!(t.pin("w\na.rs"));
        assert!(!t.pin("w\na.rs"));
        assert_eq!(t.open_preview("w\nb.rs", in_workspace("w")), None);
        assert_eq!(t.strip(), ["w\na.rs", "w\nb.rs"]);
    }

    #[test]
    fn a_preview_in_a_split_or_a_terminal_is_never_replaced() {
        let mut t = tabs(&["s1"]);
        t.open_preview("w\na.rs", in_workspace("w"));
        assert!(t.join("w\na.rs", "s1"));
        assert_eq!(t.open_preview("w\nb.rs", in_workspace("w")), None);
        assert_eq!(t.strip(), ["s1", "w\na.rs", "w\nb.rs"]);
        // Only previews are replaced: a session tab never is.
        let mut t = tabs(&["w\nterminal-like"]);
        assert_eq!(t.open_preview("w\nc.rs", in_workspace("w")), None);
        assert_eq!(t.strip().len(), 2);
    }

    #[test]
    fn a_closed_preview_is_forgotten_and_back_and_forward_include_file_tabs() {
        let mut t = Tabs::default();
        let mut h = History::default();
        t.open("s1");
        h.record("s1");
        t.open_preview("w\na.rs", in_workspace("w"));
        h.record("w\na.rs");
        let open = |id: &str| t.contains(id);
        assert_eq!(h.step(-1, open), Some("s1".into()));
        assert_eq!(h.step(1, open), Some("w\na.rs".into()));
        assert!(t.close("w\na.rs"));
        assert!(!t.is_preview("w\na.rs"));
    }

    #[test]
    fn resizing_moves_the_focused_pane_s_edge_and_keeps_a_minimum() {
        // A row of two in 1000 px: grow a by 60 px, against b.
        let mut t = tabs(&["a", "b"]);
        t.show("a");
        assert!(t.join("a", "b"));
        assert!(t.resize(60.0, 1000.0, 500.0));
        let sizes = |t: &Tabs| match t.visible() {
            Some(Node::Split { sizes, .. }) => sizes,
            other => panic!("{other:?}"),
        };
        assert!((sizes(&t)[0] - 0.56).abs() < 1e-4, "{:?}", sizes(&t));
        // The last pane resizes against the one before: b shrinks, a grows.
        t.show("b");
        assert!(t.resize(-60.0, 1000.0, 500.0));
        assert!((sizes(&t)[0] - 0.62).abs() < 1e-4, "{:?}", sizes(&t));
        // Never under the minimum, and at it nothing changes.
        for _ in 0..20 {
            t.resize(-60.0, 1000.0, 500.0);
        }
        assert!((sizes(&t)[1] - 0.054).abs() < 1e-4, "{:?}", sizes(&t));
        assert!(!t.resize(-60.0, 1000.0, 500.0));
        // A zoomed pane, or a tab in no split, does not resize.
        t.zoom();
        assert!(!t.resize(60.0, 1000.0, 500.0));
        let mut lone = tabs(&["c"]);
        assert!(!lone.resize(60.0, 1000.0, 500.0));
    }

    #[test]
    fn resizing_a_nested_pane_uses_its_own_column() {
        // a | (b over c): growing c moves the edge between b and c, in the column's 500 px.
        let mut t = tabs(&["a", "b", "c"]);
        t.show("a");
        assert!(t.join("a", "b"));
        t.show("b");
        assert!(t.split("c", Side::Down));
        assert!(t.resize(50.0, 1000.0, 500.0));
        match t.visible() {
            Some(Node::Split { sizes, kids, .. }) => {
                assert_eq!(sizes, vec![0.5, 0.5], "the row is untouched");
                let Node::Split { sizes, .. } = &kids[1] else {
                    panic!("{kids:?}")
                };
                assert!((sizes[1] - 0.6).abs() < 1e-4, "{sizes:?}");
            }
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn history_goes_back_and_forward_over_what_was_shown() {
        let mut h = History::default();
        assert_eq!(h.step(-1, |_| true), None);
        for id in ["a", "b", "b", "c"] {
            h.record(id);
        }
        assert_eq!(h.step(-1, |_| true).as_deref(), Some("b"));
        assert_eq!(h.step(-1, |_| true).as_deref(), Some("a"));
        assert_eq!(h.step(-1, |_| true), None, "nothing before the first");
        assert_eq!(h.step(1, |_| true).as_deref(), Some("b"));
        // A visit drops what was ahead; a place gone since is passed over.
        h.record("d");
        assert_eq!(h.step(1, |_| true), None);
        assert_eq!(h.step(-1, |id| id != "b").as_deref(), Some("a"));
        assert_eq!(h.current(), Some("a"));
        for i in 0..60 {
            h.record(&i.to_string());
        }
        assert_eq!(h.places.len(), MAX_PLACES);
    }

    fn tabs(ids: &[&str]) -> Tabs {
        let mut t = Tabs::default();
        for id in ids {
            t.open(id);
        }
        t
    }

    fn pane(id: &str) -> Node {
        Node::Pane(id.into())
    }

    fn split(dir: Dir, ids: &[&str]) -> Node {
        Node::Split {
            dir,
            kids: ids.iter().map(|id| pane(id)).collect(),
            sizes: equal(ids.len()),
        }
    }

    #[test]
    fn joining_follows_the_web_split_sets() {
        // Two lone tabs make a row, the anchor first; the keyboard stays where it was.
        let mut t = tabs(&["a", "b", "c", "d", "e"]);
        assert!(t.join("a", "b"));
        t.show("a");
        assert_eq!(t.visible(), Some(split(Dir::Row, &["a", "b"])));
        assert!(!t.join("a", "b"), "already together");
        assert!(!t.join("a", "a"));
        assert!(!t.join("a", "nope"));
        // A lone anchor joins the other's set, at its end.
        assert!(t.join("c", "a"));
        t.show("c");
        assert_eq!(t.visible(), Some(split(Dir::Row, &["a", "b", "c"])));
        assert_eq!(t.offered("c", &t.strip.clone()), ["d", "e"]);
        assert!(t.join("a", "d"));
        assert!(
            t.offered("a", &t.strip.clone()).is_empty(),
            "the set is full"
        );
        assert!(
            t.offered("e", &t.strip.clone()).is_empty(),
            "a set of five cannot be"
        );
        assert!(!t.join("a", "e"));
        assert!(!t.room_beside("b"));
        assert!(t.room_beside("e"));
        // Separating dissolves the set.
        assert!(t.in_split("b"));
        t.untile("b");
        assert!(!t.in_split("a"));
        assert_eq!(t.shown(), ["c"]);
    }

    #[test]
    fn a_drop_on_a_side_nests_across_the_set() {
        let mut t = tabs(&["a", "b", "c"]);
        assert!(t.drop_beside("b", "a", Side::Right));
        assert_eq!(t.active(), Some("b"), "the dropped tab has the keyboard");
        assert_eq!(t.visible(), Some(split(Dir::Row, &["a", "b"])));
        assert!(t.drop_beside("c", "b", Side::Down));
        assert_eq!(
            t.visible(),
            Some(Node::Split {
                dir: Dir::Row,
                kids: vec![pane("a"), split(Dir::Col, &["b", "c"])],
                sizes: vec![0.5, 0.5],
            })
        );
        // Moving a member within its own set: it leaves, then lands on the new side.
        assert!(t.drop_beside("a", "c", Side::Left));
        assert_eq!(t.shown(), ["b", "a", "c"]);
        // The strip follows: a drop on the left goes just before its target, on the right after.
        assert_eq!(t.strip(), ["b", "a", "c"]);
        assert!(t.drop_beside("b", "c", Side::Right));
        assert_eq!(t.strip(), ["a", "c", "b"]);
        assert!(!t.drop_beside("a", "a", Side::Left), "onto itself");
        assert!(!t.can_drop("a", "nope"));
        let before = t.clone();
        assert!(!t.drop_beside("a", "a", Side::Right));
        assert_eq!(t, before, "a drop that cannot be changes nothing");
    }

    #[test]
    fn opening_adds_a_tab_once_and_shows_it() {
        let mut t = tabs(&["a", "b"]);
        assert_eq!(t.strip(), ["a", "b"]);
        assert_eq!(t.active(), Some("b"));
        t.open("a");
        assert_eq!(t.strip(), ["a", "b"], "a tab already open is only shown");
        assert_eq!(t.active(), Some("a"));
        assert!(!t.show("nope"));
    }

    #[test]
    fn selecting_by_number_and_stepping_wrap() {
        let mut t = tabs(&["a", "b", "c"]);
        assert!(t.jump(Some(1)));
        assert_eq!(t.active(), Some("a"));
        assert!(!t.jump(Some(0)));
        assert_eq!(t.active(), Some("a"));
        assert!(t.jump(Some(4)), "past the end is the last");
        assert_eq!(t.active(), Some("c"));
        assert!(t.jump(Some(1)));
        assert!(t.jump(None));
        assert_eq!(t.active(), Some("c"));
        t.step(1);
        assert_eq!(t.active(), Some("a"));
        t.step(-1);
        assert_eq!(t.active(), Some("c"));
    }

    #[test]
    fn closing_the_shown_tab_shows_the_next_else_the_one_before() {
        let mut t = tabs(&["a", "b", "c"]);
        t.show("b");
        assert!(t.close("b"));
        assert_eq!(t.active(), Some("c"));
        assert!(t.close("c"));
        assert_eq!(t.active(), Some("a"));
        assert!(t.close("a"));
        assert_eq!(t.active(), None, "the last tab leaves an empty area");
        assert!(!t.close("a"));
        // Closing another tab leaves the shown one.
        let mut t = tabs(&["a", "b", "c"]);
        t.close("a");
        assert_eq!(t.active(), Some("c"));
    }

    #[test]
    fn a_tab_moves_to_a_number_in_the_strip() {
        let mut t = tabs(&["a", "b", "c"]);
        assert!(t.move_tab("c", 1));
        assert_eq!(t.strip(), ["c", "a", "b"]);
        assert!(!t.move_tab("c", 4));
        assert!(!t.move_tab("c", 0));
        assert!(!t.move_tab("x", 1));
    }

    #[test]
    fn splitting_puts_the_new_tab_beside_the_focused_one_and_focuses_it() {
        let mut t = tabs(&["a"]);
        assert!(t.split("b", Side::Right));
        assert_eq!(t.strip(), ["a", "b"]);
        assert_eq!(t.active(), Some("b"));
        assert_eq!(
            t.visible(),
            Some(Node::Split {
                dir: Dir::Row,
                kids: vec![pane("a"), pane("b")],
                sizes: vec![0.5, 0.5]
            })
        );
        // Down from b nests a column in the row.
        assert!(t.split("c", Side::Down));
        let Some(Node::Split { kids, .. }) = t.visible() else {
            panic!("a split")
        };
        assert_eq!(
            kids[1],
            Node::Split {
                dir: Dir::Col,
                kids: vec![pane("b"), pane("c")],
                sizes: vec![0.5, 0.5]
            }
        );
        // Left of c: a sibling in the column.
        assert!(t.split("d", Side::Up));
        assert_eq!(t.shown(), ["a", "b", "d", "c"].map(String::from));
    }

    #[test]
    fn a_split_holds_four_and_never_a_tab_twice() {
        let mut t = tabs(&["a"]);
        assert!(t.split("b", Side::Right));
        assert!(t.split("c", Side::Right));
        assert!(t.split("d", Side::Right));
        assert!(!t.split("e", Side::Right), "a fifth pane is refused");
        assert_eq!(t.shown().len(), 4);
        assert!(!t.split("a", Side::Right), "a pane already in it");
        // A tab in another set leaves it to join this one.
        let mut t = tabs(&["a", "b"]);
        t.show("a");
        assert!(t.split("c", Side::Right));
        t.show("b");
        assert!(t.split("d", Side::Right));
        t.show("a");
        assert!(t.split("d", Side::Down), "d moves from b's split to a's");
        assert_eq!(t.shown().len(), 3);
        t.show("b");
        assert_eq!(t.shown(), ["b"], "b is alone again");
    }

    #[test]
    fn closing_a_pane_collapses_the_split_around_it() {
        let mut t = tabs(&["a"]);
        t.split("b", Side::Right);
        t.split("c", Side::Down);
        t.close("c");
        assert_eq!(t.shown(), ["a", "b"].map(String::from));
        t.close("b");
        assert_eq!(t.visible(), Some(pane("a")), "one pane left is no split");
        assert_eq!(t.active(), Some("a"));
    }

    #[test]
    fn focus_moves_by_the_geometry_of_nested_splits() {
        // a | (b over c)
        let mut t = tabs(&["a"]);
        t.split("b", Side::Right);
        t.split("c", Side::Down);
        assert_eq!(t.active(), Some("c"));
        assert_eq!(t.neighbor(Side::Up).as_deref(), Some("b"));
        assert_eq!(t.neighbor(Side::Left).as_deref(), Some("a"));
        assert_eq!(t.neighbor(Side::Right), None);
        assert_eq!(t.neighbor(Side::Down), None);
        assert!(t.go(Side::Left));
        assert_eq!(t.active(), Some("a"));
        // From a, right is the pane that overlaps most: b and c tie, the nearest first wins.
        assert!(t.go(Side::Right));
        assert!(matches!(t.active(), Some("b" | "c")));
        // Alone, there is nowhere to go.
        let mut solo = tabs(&["a"]);
        assert!(!solo.go(Side::Left));
    }

    #[test]
    fn next_and_previous_pane_cycle_through_the_split() {
        let mut t = tabs(&["a"]);
        t.split("b", Side::Right);
        t.split("c", Side::Right);
        assert_eq!(t.active(), Some("c"));
        assert!(t.cycle(1));
        assert_eq!(t.active(), Some("a"));
        assert!(t.cycle(-1));
        assert_eq!(t.active(), Some("c"));
        assert!(!tabs(&["a"]).cycle(1));
    }

    #[test]
    fn zoom_fills_the_area_until_restored_or_another_tab_is_shown() {
        let mut t = tabs(&["a"]);
        assert!(!t.zoom(), "a lone pane has nothing to zoom out of");
        t.split("b", Side::Right);
        assert!(t.zoom());
        assert_eq!(t.visible(), Some(pane("b")));
        assert!(t.zoomed());
        assert!(t.zoom());
        assert_eq!(t.shown().len(), 2);
        t.zoom();
        t.show("a");
        assert!(!t.zoomed(), "showing another pane restores the split");
    }

    #[test]
    fn swap_exchanges_places_and_focus_stays_with_the_tab() {
        let mut t = tabs(&["a"]);
        t.split("b", Side::Right);
        assert!(t.swap_side(Side::Left));
        assert_eq!(t.shown(), ["b", "a"].map(String::from));
        assert_eq!(t.active(), Some("b"));
        assert!(t.swap_next());
        assert_eq!(t.shown(), ["a", "b"].map(String::from));
        assert!(!t.swap_side(Side::Up));
        assert!(!t.swap_with("nope"));
    }

    #[test]
    fn unsplit_keeps_the_tab_and_shows_it_alone() {
        let mut t = tabs(&["a"]);
        t.split("b", Side::Right);
        t.unsplit("b");
        assert_eq!(t.strip(), ["a", "b"]);
        assert_eq!(t.visible(), Some(pane("b")));
    }

    #[test]
    fn sides_are_the_web_words() {
        assert_eq!(Side::parse("below"), Some(Side::Down));
        assert_eq!(Side::parse("right"), Some(Side::Right));
        assert_eq!(Side::parse("diagonal"), None);
    }
}
