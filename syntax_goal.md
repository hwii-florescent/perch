# Syntax highlighting: goal, status and what is left

Goal: the file editor (`packages/web/src/components/CodeEditor.tsx`, CodeMirror 6)
colors code by meaning, and **inherits the app theme** (`themes.ts`), so every
theme, light or dark, recolors the editor with no new theme data.

Nothing below is committed yet. All of it is uncommitted work in the tree.

## Done (editor migration, the prerequisite)

- The textarea editor is replaced by CodeMirror 6. Lazy chunk, about 313 kB
  (about 102 kB gzipped); it loads when the first file opens.
- The store draft (`filesystemStore.ts`) is still the source of truth:
  `updateListener` calls `onChange`, and an effect applies external changes
  with `addToHistory(false)`, keeping the caret and skipping IME composition.
- Built in: find / replace / replace all (Cmd+F, Cmd+Option+F or Ctrl+H),
  go to line (Ctrl+G or the `Ln, Col` status button), Cmd/Ctrl+S save, Tab
  indent, undo/redo, bracket matching, selection-match highlight.
- `editorKeymap.ts` drops every CodeMirror default that collides with an app
  shortcut, on both platforms; `editorKeymap.test.ts` proves it.
- Verified: `tsc` clean; vitest 383 pass; Playwright (Chromium) 46 pass over
  `workspace-file-browser` (incl. 2 new editor tests), `workspace-files-durable`,
  `explorer-keyboard`, `mixed-tabs`, `keybindings`, `workspace-tabs`,
  `pane-splitting`, `theme`.

## Plan: how highlighting inherits the theme

`themes.ts` palettes are already derived from VS Code themes and `applyTheme()`
writes them as CSS variables; `resolveTheme()` already guarantees 4.5:1
contrast of `text`, `subtext0`, `overlay1`, `accent`, `mauve`, `green`,
`yellow`, `red`, `blue`, `teal`, `peach` on all four surfaces. So the editor
only needs a mapping from syntax tags to those variables:

| Syntax tag | CSS variable |
| --- | --- |
| keyword, control, operator keyword | `--mauve` |
| string, template | `--green` |
| number, boolean, null, constant | `--peach` |
| function / method name, property | `--blue` |
| type, class, namespace | `--yellow` |
| tag, regex, escape | `--teal` |
| comment, doc comment | `--overlay-1` (italic) |
| invalid | `--red` |
| everything else | `--text` |

Because it is plain CSS variables, switching theme recolors an open editor with
no re-render of the editor, exactly as the rest of the app does.

## What is left to implement

1. **Dependency:** add `@codemirror/language-data` (lazy per-language loaders) and
   `@lezer/highlight` (`tags`). Use `@codemirror/legacy-modes` through
   `StreamLanguage` for languages with no Lezer grammar (toml, shell, dockerfile).
   Commit `package-lock.json` only; `pnpm-lock.yaml` is stale and stays as is.
2. **Tag-to-variable theme:** in `CodeEditor.tsx` (or a small `editorSyntax.ts`),
   a `HighlightStyle.define([...])` with the table above, passed to
   `syntaxHighlighting()`. Use `var(--...)` values only, never hex, so it
   follows `applyTheme`.
3. **Language per file:** a `Compartment` for the language. On mount, pick the
   language with `LanguageDescription.matchFilename(languages, path)`, call
   `.load()`, then `reconfigure`. Pass the path into `CodeEditor` (it is already
   keyed by `selectedPath`). Start with ts/tsx/js/json/rust/python/markdown/css/
   html/yaml/toml/sh/go; an unknown extension stays plain, as today.
4. **Large files:** skip the language above a size threshold (suggest
   about 300 KB or about 5,000 lines) and fall back to plain text. Check the
   existing size/read-only caps from the server still apply.
5. **Light themes:** Tokyo Night Day and Solarized-type presets use a plain
   foreground instead of blue (see `docs/THEMES.md`). If a tag lands on a
   variable that equals the text color, accept it, or tune the mapping per theme
   only if it looks flat.
6. **Docs:** add a "Syntax colors" section to `docs/THEMES.md` with the table
   above; update the stale lines in `AGENTS.md` that still describe the file
   editor as a textarea.
7. **Optional, same mechanism, later:** highlight Git review diffs
   (`WorkspaceGitReview.tsx`) with the same `HighlightStyle` once the editor
   works.

## What is left to test and verify

Automated:

- Unit test: every variable the mapping uses exists as a key in `Palette` /
  `TOKEN_CSS_VARS`, so a renamed token fails the build.
- Unit test: for every theme in `THEMES`, each syntax color (after
  `resolveTheme`) meets 4.5:1 against `panelBg` and `surfaceDim` (copy the
  pattern of `themes.test.ts`).
- e2e (add to `workspace-file-browser.spec.ts`): open a `.ts` file and assert
  that a keyword's computed color equals `--mauve`; switch theme and assert it
  changes; open a `.txt` and assert no highlighting; open a file over the size
  cap and assert it stays plain and responsive.
- e2e: find matches (`.cm-searchMatch`) and the selection stay visible on top of
  syntax colors; replace-all and Tab still work with a language loaded.
- Re-run: `workspace-file-browser`, `workspace-files-durable`, `explorer-keyboard`,
  `mixed-tabs`, `keybindings`, `workspace-tabs`, `pane-splitting`, `theme`,
  plus `theme.spec.ts` under WebKit (`PERCH_E2E_WEBKIT=1`).
- Bundle: `npm run build`, confirm the main chunk did not grow and each language
  is its own lazy chunk; note the total precache size change.
- Memory: `node e2e/memory/memory.mjs` after the build (AGENTS.md requires it
  for terminal/memory-sensitive changes); open a large file and check heap.
- Refresh the `e2e/visual/visual.mjs` baselines: the editor header, gutter and
  find panel changed on purpose, so a visual diff is expected.

Manual (not yet done, and not covered by Chromium):

- Run `cargo run -p perch-desktop` (WebKit): Cmd+F opens CodeMirror's panel, not
  the web view's, Cmd+S saves, Tab indents, IME composition (for example
  Japanese input), caret and selection with a language loaded.
- Look at three themes by eye: perch (default), one light, one dark.

## Open decisions (need an answer before step 2)

1. **Default `perch` theme:** AGENTS.md says "monotone neutral greys, color only
   for status." Should highlighting be colored there too (muted palette, my
   recommendation), or stay grey in `perch` and color only in the other themes?
2. **Languages:** is the starter list in step 3 enough, or add/remove any?
3. **Diffs:** highlight Git review diffs in the same slice or later?

## Known issues and housekeeping (not part of highlighting)

- `workspace-visual-qa.spec.ts` fails on the original code too (it never gets a
  terminal after the leader chord); not caused by this work.
- `workspace-recovery.spec.ts` fails at its `perch.sessionId` check after a core
  kill, on the original code too; its CodeMirror draft-restore assertion
  (`expectDoc` after the kill) therefore never runs. The durable spec's reload
  test covers drafts. Fix the session-id failure, then confirm that assertion.
- A user override in Settings > Keyboard can land on a CodeMirror key; only the
  built-in shortcut defaults are checked (noted in `editorKeymap.ts`).
- The editor's keys are not listed in the `?` help or Settings > Keyboard.
  Consider adding find / replace / go to line / save entries (editor scope).
- Semgrep reports an "unencrypted HTTP" error on a localhost `fetch` in
  `e2e/visual/visual.mjs` (line about 1681). It was already there; ignore or
  suppress with a comment.
- Commit this slice locally once verified (one commit for the editor migration,
  one for highlighting), per AGENTS.md; do not push unless asked. Before any
  push, scan `git diff origin/main..main` for internal names.

## Suggested order for the next session

1. Answer the three open decisions.
2. Steps 1-4 (dependency, mapping, language compartment, size cap) in one slice.
3. Unit tests for the mapping and contrast; the `.ts` e2e.
4. Build, memory check, then the full re-run list above.
5. Manual WebKit pass in the desktop app; refresh visual baselines.
6. Docs (step 6), then commit.
