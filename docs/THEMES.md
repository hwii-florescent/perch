# App theme palettes

`packages/web/src/themes.ts` owns the app's 19 palettes: perch and Herdr's
18 built-ins. Settings persists the theme **name**, not a copied palette.
Terminal colors/fonts still come from the server's terminal profile; choosing
an app theme must not recolor a running CLI.

## Sources

Reviewed against original palette/VS Code sources, not marketplace screenshots:

| Themes | Source |
| --- | --- |
| perch | The neutral UI palette in `docs/UI-UX-DIRECTION.md` |
| All 18 named presets / semantic roles | [Herdr Palette](https://github.com/herdrdev/herdr/blob/2563803/src/app/state.rs) and [configuration](https://github.com/herdrdev/herdr/blob/2563803/src/config/theme.rs) |
| Catppuccin Mocha, Latte | [Catppuccin palette](https://github.com/catppuccin/palette/blob/main/palette.json) |
| Tokyo Night | [Tokyo Night palette](https://github.com/folke/tokyonight.nvim/blob/main/lua/tokyonight/colors/night.lua) |
| Tokyo Night Day (light preset) | [Tokyo Night VS Code Light](https://github.com/enkia/tokyo-night-vscode-theme/blob/master/themes/tokyo-night-light-color-theme.json) |
| Dracula | [Official VS Code theme](https://github.com/dracula/visual-studio-code/blob/master/src/dracula.yml) |
| Nord | [Official VS Code theme](https://github.com/nordtheme/visual-studio-code/blob/develop/themes/nord-color-theme.json) |
| Gruvbox Dark, Light | [VS Code palette](https://github.com/jdinhify/vscode-theme-gruvbox/blob/main/src/shared.ts) |
| One Dark, Light | [One Dark](https://github.com/akamud/vscode-theme-onedark/blob/master/themes/OneDark.json), [One Light](https://github.com/akamud/vscode-theme-onelight/blob/master/themes/OneLight.json) |
| Solarized Dark, Light | VS Code's [dark](https://github.com/microsoft/vscode/blob/main/extensions/theme-solarized-dark/themes/solarized-dark-color-theme.json) and [light](https://github.com/microsoft/vscode/blob/main/extensions/theme-solarized-light/themes/solarized-light-color-theme.json) presets |
| Kanagawa Wave, Lotus | [Original Kanagawa palette](https://github.com/rebelot/kanagawa.nvim/blob/master/lua/kanagawa/colors.lua) |
| Rosé Pine, Dawn | Official VS Code [main](https://github.com/rose-pine/vscode/blob/main/themes/rose-pine-color-theme.json) and [Dawn](https://github.com/rose-pine/vscode/blob/main/themes/rose-pine-dawn-color-theme.json) |
| Vesper | [Original VS Code theme](https://github.com/raunofreiberg/vesper/blob/main/themes/Vesper-dark-color-theme.json) |
| Terminal | Herdr's ANSI roles with an xterm-compatible web fallback (black background); it cannot inherit terminal `Reset` colors in CSS |

[Oh My Zsh themes](https://github.com/ohmyzsh/ohmyzsh/blob/master/themes/terminalparty.zsh-theme)
choose prompt layout and ANSI foreground names. They do not define a canonical
RGB app palette: the terminal emulator resolves those colors.

## Web role mapping

- `panelBg`, `surfaceDim`, `surface0`, `surface1` are **backgrounds**. A comment
  gray or blue is not a hover surface. For example, Dracula uses `#343746` /
  `#44475a` (UI surface / selection), not comment blue `#6272a4`; Solarized's
  surfaces stay in the background family instead of using foreground grays.
- Named accents remain in `THEMES`. Vesper's canvas is `#101010`, Rosé Pine's
  rose is `#ebbcba`, Dawn's text is `#575279`, and Tokyo Night's light preset
  uses VS Code's dark blue-gray foreground rather than blue syntax text.
- Original palettes can have intentionally subdued comments or syntax colors.
  Those are not always readable as 11–14px controls. `resolveTheme()` keeps a
  foreground unchanged if it meets **4.5:1 on all four app surfaces**; otherwise
  it moves it toward black (light themes) or white (dark themes) in 1% steps,
  stopping at the first passing shade. This is a deliberate web accessibility
  adaptation, not a claim that every resulting CSS value is verbatim upstream.
  It changes no background and never mutates the source palette.
- The same contrast pair works in reverse: `panel-bg` labels on accent/red/green
  filled buttons stay readable. Hover must not replace that label with the
  fill color or `text-fg`.
- `overlay0` is a separator/border token, not a control background. Menus hover
  on `surface0`. Operational muted labels use `subtext0` / `overlay1`.
- Status badges use a stable `panel-bg` backing for the harness mark and a
  status-colored border. Focus/selection is an outside **neutral text-colored
  outline**, not a bright overlay fill obscuring the icon. The 32px hit target
  and tight 18px badge are unchanged. Claude keeps its orange and OMP its
  gradient, with a small dark backing behind those transparent marks so their
  original colors stay legible in light themes. Naturally monochrome marks
  (Codex, pi, etc.) follow the theme foreground.
- `applyTheme()` sets native `color-scheme` as well as the color tokens, so
  light themes get light selects, form controls, and browser-managed chrome.

The neutral CSS defaults and `PERCH_DEFAULT` must agree. Unknown names,
including inherited object keys, fall back to perch and reset dark appearance.

## Syntax colors

The file editor (`CodeEditor.tsx`, CodeMirror 6) colors code with the theme's own
CSS variables, so every theme recolors an open editor with no new theme data.
`editorSyntax.ts` maps lezer tags to variables; never hex. `resolveTheme()`
already guarantees 4.5:1 for each of them on the editor surfaces.

| Syntax tag | CSS variable |
| --- | --- |
| keyword, control, operator keyword | `--mauve` |
| string, template | `--green` |
| number, boolean, null, constant | `--peach` |
| function / method name, property | `--blue` |
| type, class, namespace | `--yellow` |
| tag, regex, escape, link | `--teal` |
| comment, doc comment | `--overlay-1` (italic) |
| invalid | `--red` |
| everything else | `--text` |

The language comes from the filename (ts/tsx/js/jsx/json/rust/python/markdown/
css/html/yaml/toml/shell/go/dockerfile); anything else stays plain. Past
`MAX_HIGHLIGHT_CHARS` (300,000) the file is plain too. Themes whose foreground
replaces blue (Tokyo Night Day, Solarized) show those tags in plain text; that
is accepted. `perch` is colored as well (muted palette).

## Checks

```sh
npm run test -w @perch/web -- src/themes.test.ts src/editorSyntax.test.ts src/components/WorkspaceNavigation.test.tsx
npm run build
cd e2e && PERCH_E2E_WEBKIT=1 npx playwright test theme.spec.ts
```

The unit check covers every foreground/surface pair in every preset, source
immutability, filled controls, native appearance, and fallback/default parity.
The browser check exercises real CSS on selected, hovered, and keyboard-focused
harness badges across all presets, on desktop and phone-sized layouts.
