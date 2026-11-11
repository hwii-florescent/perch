# `@perch/sdk`: the package API

`@perch/sdk` is the one public API for Perch screens written as packages. Three
kinds of code use it, and only it:

- Perch's own **stock screens** (`stock:<id>`), as shipped;
- a person's **clones** of them, made with `perch mod clone stock:<id>`;
- **community packages** installed with `perch mod install`.

The contract is the types file `packages/web/src/perch-sdk.d.ts`. Every stock
package and every clone of one carries a copy as `perch-sdk.d.ts`. The decision
behind it is in [DECISIONS](DECISIONS.md), 2026-11-09. Single-file mods with
`(el, api) => cleanup?` keep the older `api` object (`perch mod api`), which
this page does not replace.

## What a package may import

| Import | What it is |
|---|---|
| `react`, `react/jsx-runtime` | the React the page itself runs (one copy, so hooks and context work) |
| `react-dom`, `react-dom/client` | the same, for `createPortal` and friends |
| `@perch/sdk` | this API |
| `./file.js`, `../dir/file.js`, `./data.json` | the package's own files |
| `import "./look.css"` | allowed and does nothing more: every `.css` file of the package is on the page while it shows (see "Styles") |

An asset is not imported. Its URL comes from `assetUrl("art/logo.svg")`.

Nothing else. In particular, nothing of Perch's source is importable: not the
store, the socket, `keybinds.ts`, `components/ui/*` or any other app module.
Those are **internal**. They change in any release without notice and are not
part of any version promise. If a screen needs something they do, it belongs in
the SDK first (see "Growing the SDK").

Plain JS only, with no build step. The files you edit are the files that run. A
stock package's JS was generated from TSX, so elements read as
`_jsx("div", { … })` calls. You can write JSX-free code the same way, or use
`createElement` from `react`.

## Package shape

```text
mods/my-keys/
  mod.json         {"name", "description", "version", "api": "^1", "format": "esm",
                    "entry": "main.js", "place": "layout", "origin", "clonedFrom"}
  main.js          default export: a React component
  parts/row.js     any other module, imported relatively
  perch-sdk.d.ts   the SDK types (for your editor; not loaded)
```

- `format: "esm"` marks a package. Without it, the folder is a single-file mod.
- `entry` is the module whose `default` export is the component (default `main.js`).
- `api` is the SDK range the package works with (see "Versions").
- `version` is the package's own version. Stock screens always have one.
- `place`:
  - `layout` means the package shows only where Perch or a layout block puts it.
    It is never docked, overlaid or run hidden by itself. Stock screens and
    their clones use this.
  - `dock`, `overlay` and `none` behave as they do for any mod.
- `origin` and `clonedFrom` are written by Perch. `origin` is `"stock"` for a
  shipped screen and `"clone"` for a copy. `clonedFrom` is `{id, revision,
  version}` of the source.
- `id` and `publisher` are optional. `id` is the package's own name, used as the
  folder name on install, and must be a plain id. `publisher` is who ships it.
- `installedFrom` is written by `perch mod install`: `{kind, location, commit,
  digest}`. `kind` is `git` or `folder`, `commit` is the git commit installed,
  and `digest` is `sha256:` over the installed files. A clone drops `id`,
  `publisher` and `installedFrom`, because it is yours.

The core serves only `.js .mjs .css .json .svg .png .jpg .webp .woff2 .woff`
files. A package's revision is the SHA-256 of those files, so any edit is a new
revision and the page reloads the package by itself. The page's module loader
keeps every revision it ran until the page itself reloads (it has no eviction):
while you edit, memory grows by one copy of the package's files per saved
revision, and its stylesheets and view stay one. After many edits, reload the
page (measured: 100 edits of a three-file package, 3 to 303 modules, back to the
newest revision's after a reload).

## The component

A package's default export is a React component. It receives:

- `api`: the same object single-file mods get. It is not part of this SDK's
  version promise.
- every prop its host gives it:
  - **A layout block** `{"type": "block", "content": "mod:<id>", "props": {…}}`
    passes its JSON `props`.
  - **A stock screen's own place in Perch** passes that screen's props.
    `stock:keybind-help` gets `{open: true, onClose}`, `stock:pane-header`
    gets `{id}` (the pane's tab id) or `{id, corner: true}` (a split file's
    corner controls), `stock:review` and `stock:browser` get `{workspaceId}`,
    `stock:files` gets `{workspaceId, layout: "explorer", onOpenFile}` (the
    drawer) or `{workspaceId, layout: "editor", initialPath}` (a file tab),
    `stock:chat` gets `{sessionId, providerId, terminalProviderId}`, and
    `stock:status`, `stock:tabs` and `stock:sidebar` get none.
  - **A dialog or menu Perch opens** passes what its opener knows and Perch's
    actions for it, typed in `perch-sdk.d.ts` (1.7): `DialogProps`,
    `SelectProps`, `TabMenuScreenProps`, `PaneMenuScreenProps`,
    `FileMenuScreenProps`, `NewSessionScreenProps`, `LauncherProps`,
    `NavigatorScreenProps`, `FolderBrowserProps`, `WorktreeScreenProps`,
    `InstructionsScreenProps`, `MemoryScreenProps`, `CloseGuardProps`,
    `TabDragProps`, `OnboardingProps` and `ContextBridgeScreenProps`. The data
    comes in props and each action is a function in `actions` (or an `on…`
    callback), so a copy shows the same things and does the same things, and
    what an action means (a save, a stop, a send) stays Perch's.
  - **A Settings page** (1.8) gets the saved settings and Perch's actions for it:
    `GeneralSettingsProps`, `AppearanceSettingsProps`, `AgentsSettingsProps`,
    `KeyboardSettingsProps`, `TerminalSettingsProps`,
    `NotificationsSettingsProps`, `HostsSettingsProps`, `DevicesSettingsProps`
    and `PermissionsSettingsProps`. A change is saved only through
    `actions.updateSettings` (or the page's named action, such as `addHost`);
    what is being typed is kept with `useResourceState`, so it survives a swap.
  - **The last desktop screens** (1.9): `StartScreenProps` (`stock:start`),
    `EditorMenuProps`, `TerminalSearchProps`, `SlashPopoverProps`,
    `SessionSplitProps` and `PhoneSizeProps`, the same way: data in props,
    Perch's actions as functions.
  - **Terminal and dock chrome, the browser toolbar and the phone** (1.10):
    `TerminalToolbarProps`, `AgentControlProps`, `DockTabProps`,
    `DockActionsProps`, `BrowserToolbarProps`, and the phone's
    `MobileHeaderProps`, `MobileSwitcherProps`, `MobilePanesProps`,
    `MobileFilesProps` and `MobileKeysProps`.

A clone keeps the stock screen's props interface, so it can be put in a layout
block with the same props (`"props": {"open": true}` for the keybind help), or
take the stock screen's place everywhere Perch shows it (see "Using your copy in
Perch's place").

A package that fails to load or throws while rendering is reported (`perch mod
check <id>`). If an earlier revision of it was working, that revision stays on
screen.

## Copies and updates

Each place a package is shown runs its own **copy** (an instance). Perch keys it
by where it is: `layout:<layout>:<node id>`, `pane:<tab>`, `dock:<panel>`,
`overlay:<id>`, `hidden:<id>` for a `place: "none"` package, `stock:<id>`.

- A copy in a layout block with an `id` is **parked**, not ended, when its block
  is hidden (another tab of its stack, a collapsed column). Its timers,
  subscriptions, commands and `useInstanceState` values stay. It ends when the
  layout drops the node or the person switches layouts. A block without an `id`
  is a new copy each time it is shown.
- Other copies end with their view (a closed tab or panel).
- One copy runs at a time. A second view of the same copy on one screen shows an
  error instead of running the module twice.
- A key binding a package registers (`api.command`) goes to the newest copy that
  is on screen. A parked copy gets none. A `place: "none"` copy has no view and
  counts as on screen.
- A command's `keys` is only what it asks for. A key that another command already
  has, that Perch reserves or that has no modifier is not taken from anyone: the
  command is registered without a key, and Settings > Keyboard lists it under
  Package commands as "Not set" with the reason (`commands()` gives it as
  `conflict`). The person can give it any key there; that key is theirs, kept in
  their settings. When the package (or the copy that registered it) goes, its
  commands leave Settings > Keyboard and the key help.
- An edit is a new revision. Perch imports it first, then disposes the old
  revision's `api` (commands, subscriptions, watchers, overlays) before React
  unmounts the old tree, and only then mounts the new one. The old and new trees
  never run side by side. A result the old `api` asked for that arrives after
  this is dropped: the promise never settles. A cleanup that throws is reported
  as `disposal`: an `api` cleanup, and the cleanup of a `useEffect`,
  `useLayoutEffect` or `useInsertionEffect` from the `react` a package imports.
  Neither ever takes Perch's window down (a class component's
  `componentWillUnmount` is not covered: write packages with hooks).
- A revision that fails to load (a missing or malformed file, a `url(...)` naming
  no file of the package) keeps the last working view, its draft and its
  styles, and says why, naming the file. Saving the working files again shows
  them with no error. When the files could not be had for now (Perch
  restarting, a dropped relay, or a revision the core no longer keeps: it keeps
  the newest 4), the copy loads again on the next mods list, which the page asks
  for at once for a revision no longer kept and after every reconnect. A lazy
  `import()` from a revision the core no longer keeps rejects with
  `<file>: this revision is no longer kept; it loads again from the newest`.
- While a copy has work marked with `useInstance().trackOperation(...)`, a new
  revision waits, up to 10 s, before it replaces the copy. The view says so
  meanwhile. Past 10 s it is shown anyway and `perch mod check` reports a `swap`
  warning.

## Checking a package

`perch mod check <id>` lists every copy on every connected screen (each screen
is a **viewer**, numbered by the core per connection):

```text
  viewer 3  instance layout:main:keys  ok
  viewer 3  instance pane:t7  error in render: x is not defined
```

The command fails when any copy of the current revision failed.

- The phase says where it failed: `load` (a file did not load or the SDK range
  does not match), `render`, `callback` (a function the package gave to `api`
  threw later) or `disposal`. `swap` is a warning only.
- `--viewer <v>` and `--instance <i>` narrow `check` and `dom` to one screen or
  one copy. Only that screen's answer counts. `perch mod do <command> [json]
  --viewer <v>` runs a command on one screen. Without a target, `dom` and `do`
  take the first screen that answers.
- The core keeps the last 256 reports and 16 open questions. Past that it drops
  the oldest. A screen's reports go when it disconnects.

## API reference (1.10)

The full signatures and field docs are in `perch-sdk.d.ts`; this lists what each
export is for.

### `version: string`

This page's SDK version, as semver (`"1.10.2"`). 1.1 added `assetUrl`,
`useInstance` and `useInstanceState`; 1.2 the status bar, tab strip and pane
header surface; 1.3 navigation (the sidebar); 1.4 resources (the Git review,
`useResourceState`, and the terminal, layout and focus queries); 1.5 files, the
native chat, the drawer's browser, the fixed Markdown components and `Layout`;
1.6 durable data (`useModData`), `fetchTerminal`, the confirmation
(`ConfirmProps`) and the notifications (`useNotifications`, `iconButton`); 1.7
the app's dialogs and menus as screens (their props types), `useAgentChoices`,
`shortcutFor` and `menuDividerClass`; 1.8 the Settings pages (their props
types) and their parts (`SettingsGroup`, `SettingRow`, `Switch`, `ModeSwitch`,
`QrCode`, `settingsClass`, `useSettingsQuery`); 1.9 the last desktop screens
(their props types) and `SlashPopover`; 1.10 the terminal and dock chrome, the
browser toolbar and the phone's own screens (their props types), `glassClass`,
`tapButtonClass`, `GearIcon`, `PlusIcon` and `EllipsisIcon`; 1.10.1 makes `useTerminals` draw again when a
pin or this device's order changes (`terminal.pin`, `terminal.order`), so a copy can group and order by them; 1.10.2 reshapes the phone's
screens' props, with no export added: the header gets `onOpenTools`, the switcher `chatMode`, `onChatMode` and `onOpenSettings`, the
panes `session` (`content` is now the drawer's tool), and the files screen is always given its `explorer`.

### `useKeybindings(): KeybindEntry[]`

A React hook that returns every key binding as the person has it now. Their
overrides are applied and keys are written in this platform's key names. It
updates when a binding changes in Settings > Keyboard.

```ts
type KeybindGroup = "global" | "tabs" | "nests" | "panes" | "terminal"
  | "leader" | "resize" | "editor" | "navigator" | "directory";
interface KeybindEntry { keys: string; description: string; group: KeybindGroup }
```

Ranges such as "jump to tab 1…8" are one entry until the person rebinds one of
their members.

### `CloseIcon(props: { size?: number; className?: string })`

Perch's close (×) icon. It is `size` px square (default 14) and drawn in
`currentColor`.

### `assetUrl(path: string): string`

The URL of one of the package's own files, by its path from the package folder
(`"art/logo.svg"`). Use it for `<img src>`, `new Audio()`, a `FontFace` and the
like. It is this revision's copy of the file and works on a paired phone. It
throws for a path that is not a file of the package. Import it from
`@perch/sdk` in the package's own modules: each revision gets its own binding.

### `useInstance(): PackageInstance`

A React hook that returns the copy this component runs in: `{key, revision,
trackOperation}`.

- `key` and `revision` are as `perch mod check` shows them.
- `trackOperation(work)` takes a promise, or a function that starts one, and
  returns the same result. While it is pending, a new revision waits (see
  "Copies and updates"). Use it for a send, a save or a confirmed delete, so
  the work is not started twice or lost midway.

### `useInstanceState<T>(name: string, initial: T)`

Like `useState`, but the copy holds the value, not the component. It survives
an edit of the package and a parked copy, and goes when the copy ends. `name`
tells one copy's values apart. Values are kept in memory only.

### The status bar (1.2)

- `useStatusLine()`: the focused session's host (`hostId`, `hostName`,
  `hostState`), folder, branch, context tokens and cost; the page's own
  `connected`. A host is online when it is `local` and connected, or its
  `hostState` is `"connected"`.
- `usePlanUsage({keepFresh?})`: `{usage, updatedAt, spend, redeemResult}`. With
  `keepFresh` it asks the core on connect and every 3 min while mounted.
- `refreshUsage()` asks once for fresh usage; it is done when `updatedAt` moves.
  None may come, so time out yourself (stock gives up after 30 s).
- `redeemUsageReset(accountId)` spends one banked reset, once. The answer is
  `redeemResult` with that `accountId`; ask the person to confirm first.
- `useZoom()`, `resetZoom()`, `keyLabel("cmd+0")`, `isMac`.

### Tabs and panes (1.2)

- `useWorkspaceTabs()`: the shown workspace's strip, `{hostId, cwd, workspace,
  activeId, tabs, tabShape, draggingId}`. Each `TabInfo` has an `id`, `kind`
  (`session`, `file`, `review`, `browser`, `mod`), `label`, `state` (`focused`,
  `visible` in a split, `hidden`), and per kind the agent (`provider`,
  `activity`), unsaved changes (`dirty`), `preview`, a page's `url`/`icon`.
- `runCommand(command, args)` runs a typed app command (`perch mod commands`),
  the same path keys and `perch mod do` use. A strip or a pane acts on one tab
  by id, shown or not: `tab.select`, `tab.close` (a session through the same
  guard as its ×), `tab.pin`, `tab.rename`, `tab.move`, `tab.menu {id, x, y}`,
  `pane.unsplit`, `pane.close`, `pane.focus {pane}`. A missing tab throws; it
  never acts on another one.
- `beginTabDrag(event, id, label)` starts Perch's tab drag (reorder, or split a
  pane by dropping on its side). Tabs must carry `data-tab-entry={id}` inside an
  element with `data-testid="tab-bar"`.
- `useNewTabRequest(listener)` runs on Cmd+T. `startSession(hostId, cwd, agent)`,
  `openBrowserTab(workspaceId)`, `openFileTab(workspaceId, path)` open things.
- `usePaneLook()`: where the layout puts pane headers.
- Drawn by Perch, for now: `TabMenu` (the open tab menu), `TabDragLayer` (where a
  dragged tab lands), `NewSessionMenu` (the agent launcher), `NewFilePrompt`.
  Render each once where your screen wants it. Their insides are not yet part of
  a package.
- Look: `AgentIcon`, `PageIcon`, `agentStateColor(state)`, `tabStateClass`,
  `segmentClass()`, `cn`, `ghostButton`, `menuPanel`, `anchoredPopoverStyle`,
  `useDismissOnOutsideClick`.
- `Slot`: a stock screen keeps its legacy slots (`status-bar`, `tab`,
  `pane-header`) so single-file mods drawing over them keep working.

### Navigation (1.3)

What `stock:sidebar` is built on: hosts, projects, workspaces and sessions with
Perch's rules already applied, so a clone rearranges the same data instead of
carrying the rules. Arrangement is the screen's: grouping, folding, sorting
within what it is given, drag, menus and look.

- `useHosts()`: `{activeId, active, list, local, connected, canCreate,
  workspaces}`. `list` is this computer, then every configured host with its
  `state` (`connected`, `connecting`, `error`, `disabled`), `error`, `detail`,
  `address`, `direct` and Settings switch `enabled`. `workspaces` says whether
  the active host keeps projects.
- `useNavigation({showTerminals?, sortByAttention?})`: the active host's
  `projects` (favourites first, then the order the core keeps; Quickchat apart
  as `quickchat`), each with its workspace tree, hidden worktrees, worktree
  jobs, sessions and most urgent section (`top`); every listed `session`
  newest first; `status`, the sessions by section (`needs`, `done`, `working`,
  `idle`, or one `offline`) split by project; `needsYou`; `reachable`,
  `loading`, `error`, `reorderable`; the active workspace and session; and
  `shortcuts` while the workspace keys' modifiers are held. A session's
  `section` already holds a chat in Done while it is read. A plain terminal is
  listed only with `showTerminals`.
- `nestSessions(list)` puts each sub-session after its lead.
- `useSessionFolders()`: for a host without projects, its sessions by folder.
- `useAddProject()` registers a folder (`add(path, name?, hostId?)`, `status`,
  `error`); `useAddProjectRequest(listener)` runs when Perch asks for the Add
  project dialog, also just before the screen mounted. `pickFolder` is the
  desktop app's folder dialog, null in a browser.
- Actions are typed commands that name their target: `session.open`,
  `session.request_close` (the close guard, as a ×), `session.close`,
  `session.move {id, target, after, siblings}`, `project.move {id, target,
  after}`, `project.rename`, `project.close {id, confirmed: true}`,
  `workspace.open`, `workspace.focus`, `workspace.rename`, `workspace.pin`,
  `workspace.hide`, `workspace.restore`, `workspace.files`, `workspace.git`,
  `worktree.remove`, `worktree.cancel`, `worktree.retry`, `worktree.dismiss`,
  `host.select`, `host.enable`, `host.refresh`, `folder.select`,
  `quickchat.new`, plus `sessions.new`, `global.needsYou` and `app.settings`.
  The core keeps the order a move writes, so every screen shows it.
- `beginReorderDrag(event, options)`: Perch's list drag (the item follows the
  pointer, the others slide aside); write the order in `onEnd`.
- Drawn by Perch, for now: `SessionMenu` (a session's tab menu, with your extra
  rows), `WorktreeMenu`, `InstructionsDialog`, `MemoryDialog`, `FolderBrowser`,
  and `NewSessionMenu` with `projects` (the agent, then the folder). Their
  insides are not yet part of a package.
- Look: `SessionDot`, `HostStateDot`, `Dialog`, `ConfirmDialog`, `Select`,
  `menuItemClass()`, `rowActionClass()`, `buttonClass()`.

### Resources (1.4)

What `stock:review` is built on, and what any screen needs to keep a person's
unsent work.

- `useResourceState(key, initial)`: like `useState`, but Perch keeps the value
  under `key` for the resource, not for one copy. Every copy of every screen
  that names the same key shares it, and it survives an edit or swap of the
  screen's code (a clone chosen with `perch mod use`), a released hidden copy
  and the phone and desktop layouts trading places. Use it for unsent text, a
  prepared operation and its id, and a send in flight, so a second copy never
  sends it again. Name the key after the resource
  (`review:<workspaceId>:commitMessage`). It is kept in memory: a page reload
  starts empty. `useInstanceState` is the per-copy alternative.
- `newId()`: a new random id, for an operation id that a retry must reuse.
- `useGitReview(workspaceId)`: the workspace's review as Perch keeps it, one per
  workspace for every screen that shows it. `ready` is false until the host
  offers Git. It carries `status`, `diff` (with the core's `sourceRevision`),
  `comments` (each with the core's `version`), `refs`, `batchDelivery`,
  `lastAgentTurn`, `sessions` (packet targets) and `actions`. Discard and
  commit run in two steps: the preview, then the action named by its
  `previewId`. `askAgent(source)` opens Context Bridge's own preview and
  explicit send; it is absent where the host offers none. The screen never
  derives paths, line numbers, revisions or anchors itself.
- `FileIcon`, `GitMarker`: Perch's file icon and Git state mark. `Select` takes
  `freeText` and `placeholder`.
- `terminals()` and the hook `useTerminals()`: every session's terminal on
  every computer this page knows, agents, sub-sessions (`parentSessionId`) and
  hidden ones included. `target` is `<host>/<session>`. `terminalId` is the
  terminal this page types into, or null. `shown` and `open` say whether it is
  on screen, or open here at all. `state` is `running`, `exited`, `unknown`
  (no evidence, never read it as exited) or `host-unavailable`.
- `readTerminal(target, lines?)` and `sendToTerminal(target, text)` act on a
  terminal by target, on screen or kept off screen by this page. A bare session
  id that two computers share, an unopened or exited terminal, and an unknown
  target throw with the reason. Nothing is ever started, restarted or run
  locally instead.
- `layoutTree()`: the shown layout as a tree with the person's hides and stack
  choices applied (`path`, `id`, `type`, `content`, `hidden`, `active`).
  `focus()`: the focused host, workspace, session, its terminal here, and the
  panes on screen.

Legacy single-file mods get the same answers: `api.terminalRecords()`,
`api.layoutTree()`, `api.focus()`, and `api.readTerminal`/`api.sendText`
accept the same targets.

### Files, chat, browser and composition (1.5)

What `stock:files`, `stock:chat` and `stock:browser` are built on. In each, the
data, the unsent work and the engines are Perch's; a screen draws them and asks
for actions.

- `useWorkspaceFiles(workspaceId, { git? })`: a workspace's tree, documents
  (drafts with their saved version and conflicts), previews and search, as
  `filesystemStore` keeps them, with bound actions (`requestTree`, `openFile`,
  `edit`, `save`, `reload`, …) and Git decorations. A draft survives a clone
  swap, a reload and the phone; a screen never writes a file itself.
  `askAgent(source)` opens Context Bridge's preview and explicit send.
- `CodeEditor`, `FileAsset` (images, media, PDF), `MarkdownPreview`,
  `FileEntryMenu`, `Chevron`, `assetKind`, `shortcutLabel`: the editor and
  viewers are Perch's engines; place them, do not rebuild them.
- `useNativeChat({ sessionId, providerId, terminalProviderId, … })`: one native
  chat as Perch keeps it: the transcript, the draft and its operation id, the
  outbox (a send in flight, or one whose outcome is unknown), requests and their
  answers, control of the terminal, history, find and the menus. `send()` is
  deduplicated by operation id: a second copy, a swapped clone or a Retry after
  a reload never sends twice, and an uncertain send is shown as unconfirmed,
  never retried by itself.
- `Markdown({ text, streaming?, fileLinks? })` and `MarkdownPreview`: the only
  way a screen draws agent or file Markdown. Both are fixed parts of Perch, not
  package source, and a clone cannot change them: scripts, event handlers,
  `javascript:`/`vbscript:`/`data:` links, SVG scripts, frames, embeds and
  forms are removed, `perch-ui` blocks are parsed as data and drawn as text, and
  a click on a link never navigates Perch (`sanitizers.test.tsx` holds the
  attack inputs). `CopyButton` copies text.
- `useBrowserPages(workspaceId)` and `BrowserPage({ pageId, initialUrl, active?,
  onUrl? })`: the drawer's pages (kept across reloads) and one page, a native
  webview in the desktop app.
- `Layout({ node })`: the window layout's nodes inside your own view, so a live
  terminal can sit beside your UI. Blocks are `mod:<id>` (with `props`),
  `terminal:<session>` (its shell), `session:<session>` (the session's own
  view: its agent's terminal or chat), `agent:focused`, `files`, `git` and the
  rest; looks, floats and backgrounds are ignored. A terminal already on screen
  moves in (the same xterm, connection, input and size owner) and goes back when
  the `Layout` unmounts. Nothing here starts an agent, and unmounting never
  stops a process. An invalid node shows why instead of drawing.
- Terminal records carry `order`: the place in the order set on this device
  with `runCommand("terminal.order", { ids })` (null when not in it), beside
  `pinned` (`terminal.pin`). Both are this device's, for a screen's own list;
  Perch's views do not order by them.
- Presentation commands, through `runCommand`: `terminal.show` and
  `terminal.keep` go to the session's tab (`keep` also puts its peek away);
  `terminal.peek` shows the session's own view over the app without going there
  (its terminal moves in and back; a click outside, `terminal.park` or
  `terminal.peek` again closes it); `terminal.park` (`terminal.unkeep`) puts a
  peek away and refuses when there is none. None of them starts, stops or
  restarts a process.

Legacy single-file mods get layout content in their floating surfaces:
`api.overlay({ layout, width?, height? })`, `api.popup(anchor, { layout })` and
`api.window(options, { layout })` take the same nodes as `Layout`, and every
surface gives the keyboard back where it was when it closes.

A window with a `key` remembers where it was put and how big (dragged by its
title bar, sized by its corner) on this device, across restarts, and opening the
same key again replaces the open one. Up to 64 keys are kept, the least recently
used dropped first, in one value written whole (`perch.modWindows`). A value this
build cannot read is left as it is and named in Settings > Mods > Window layout,
with a Reset; until then windows are remembered for the run only. `keep: true`
(with a key, layout content and a frame) keeps the window itself: it belongs to
the layout shown when it opened, reopens with that layout after a restart, closes
while another layout is shown, and stays open when its package is replaced or
removed. Its × (or the returned close) forgets it. A kept window holds only its
checked layout content and its title, never the package's own data.

### Data, terminals, confirmation and notifications (1.6)

- `useModData(): ModData` (legacy mods: `api.data`): this package's own durable
  data, as JSON values under keys (1-120 of `A-Z a-z 0-9 . _ -`, not starting
  with a dot; at most 1 MiB each and 1000 keys). It lives in the core's
  `mod-data/<id>/` folder, outside the package: a clone starts with none, an edit
  or a reinstall keeps it, and it is never copied. `read(key)` gives `{ value,
  revision }` or null; `write(key, value, expected?)` writes only if the key is
  still at `expected` (a revision, `null` for "absent", omitted for any) and
  otherwise throws an error with `code: "conflict"` and the current `revision`;
  `remove(key, expected?)`, `list()` and `watch(listener)` (a change by this page
  at once, by another window within 2 seconds). A file that is not JSON throws
  `code: "corrupt"`; the next write keeps the old bytes in `mod-data/<id>/.corrupt/`
  first. A copy of a stock screen keeps its data under its own id; stock screens
  use `@stock-<name>`. Agents cannot reach it (`POST /mods/data` takes a person's
  or a paired device's token only), and it goes through a phone's relay tunnel.
- `fetchTerminal(id, lines?)`: a terminal's last lines even when this page never
  opened it. The page's own view answers when it has one; otherwise the core
  reads the daemon (`POST /terminal/read`, target `<host>/<session>`). A remote
  host's terminal not on this page is refused, never read through a guess, and
  over a phone's relay only open terminals can be read.
- `ConfirmDialog(props: ConfirmProps)`: every confirmation Perch asks, and yours.
  The screen is `stock:confirm`; `perch mod use stock:confirm <id>` makes every
  opener, Perch's and every package's, show your copy with the same props.
  `onConfirm`/`onCancel` and `busy` belong to the caller.
- `useNotifications(): { items, open, dismiss }` and `iconButton`: what
  `stock:toast` draws. The list, the wording of each item and what opening one
  does are Perch's; how long a card stays (`timeout`, paused on hover/focus) and
  how it looks are the screen's.

### Dialogs and menus (1.7)

Every dialog and menu Perch opens is a stock screen, and the SDK's components of
the same name open it, so a package's `Dialog` or `TabMenu` is the person's
chosen copy too.

- `Dialog(props: DialogProps)` and `Select(props: SelectProps)`: the modal shell
  (`stock:dialog`) and the dropdown (`stock:select`) of every form in Perch. A
  copy chosen for either is used inside every other screen, stock or copied.
- `TabMenu`, `SessionMenu`, `NewSessionMenu`, `NewFilePrompt`, `FileEntryMenu`,
  `FolderBrowser`, `WorktreeMenu`, `InstructionsDialog`, `MemoryDialog` and
  `TabDragLayer`: the screens of the same names, with the props their openers
  give.
- `useAgentChoices(hostId)`: the agents a new session can start with on a host,
  its loading state and error, the last one chosen (`rememberChoice` keeps it)
  and `manage()` to open the agent catalog.
- `shortcutFor(event, scope?)`: the binding a key event matches as the person
  has it now (`{id, scope}`), or null. A screen uses it instead of reading keys
  itself, so a rebound key works in a copy too.
- `menuDividerClass`: the line between menu groups.

Nested owners: a screen never chooses the screens it contains. A copy of
`stock:instructions` shows its body in whatever `stock:dialog` is chosen, Perch's
own or a copy, exactly as Perch's own Instructions does.

What stays Perch's whatever copy shows:

- Context Bridge sends only when the person presses Send. One capture is sent at
  most once, with one operation id; a second send, from the same copy or another
  one swapped in, is refused ([CONTEXT-BRIDGE.md](CONTEXT-BRIDGE.md)).
- Settings > Mods > Screens always uses Perch's own dropdown, compiled in, so a
  broken `stock:select` copy can always be put back, on a phone too.
- The sanitizers (`markdown.ts`, `SafeHtml.tsx`, `uiBlocks.ts`) are not screens.

### Settings pages (1.8)

Each Settings page but Mods is a stock screen: `settings-general`,
`settings-appearance`, `settings-agents`, `settings-keyboard`,
`settings-terminal`, `settings-notifications`, `settings-hosts`,
`settings-devices` and `settings-permissions` (macOS desktop only). Perch keeps
the frame (the list of pages, search and close) and Settings > Mods, which is the
way back from any copy.

- `SettingsGroup`, `SettingRow`, `Switch`, `ModeSwitch`, `QrCode` and
  `settingsClass`: the parts the pages are drawn with. A `SettingRow` hides
  itself when the frame's search does not match its title or description;
  `useSettingsQuery()` gives that search for anything else that should hide.
- The settings themselves, and every engine behind a page (the machine check and
  install over ssh, pairing, the relay, notification permission, the keyboard
  recorder), are Perch's. A page gets their state and actions in props, so a copy
  saves exactly what Perch's own page saves.
- What a page is typing (a new host, a default folder, a scrollback) is kept in
  `useResourceState` under `settings:<page>:<field>`, so it survives a swap to a
  copy and back, and is not saved until the page saves it.
- A phone shows Perch's own pages, whatever is chosen.

### The last desktop screens (1.9)

The start screen, the editor's right-click menu, the terminal's find bar, the
composer's slash popover, a docked pane group's Split with session picker and
the phone-size notice are stock screens: `stock:start`, `stock:editor-menu`,
`stock:terminal-search`, `stock:slash-popover`, `stock:session-split` and
`stock:phone-size`.

- `SlashPopover(props: SlashPopoverProps)`: the composer's autocomplete list,
  as the chat draws it. It is the route, so a copy of `stock:chat` uses the
  person's chosen popover too.
- What each does stays Perch's whatever copy shows:
  - **Start** (`kind`: `connecting`, `home`, `workspace`, `cli`): a session
    starts on the right host, in the chosen place or this session resumed in
    place. The chosen place is Perch's (`targetKey`, `actions.choose`), so it
    survives a swap; Add project from a picker selects the project it creates.
  - **Editor menu**: each action is a CodeMirror transaction on Perch's editor
    (the draft follows), closes the menu and gives the editor its focus back.
  - **Terminal find**: the search runs in Perch's terminal; `close` clears the
    highlight and gives the terminal its focus back. The bar's input is its own
    and the bar never writes to the terminal; the terminal's keys (find, clear,
    scroll) stay in Perch's terminal.
  - **Slash popover**: the composer keeps its focus and owns the arrow, Enter,
    Tab and Escape keys, naming the active row by `optionId(index)`; a row's
    mouse press must not take focus. A pick rewrites the draft only.
  - **Split with session**: `onPick` splits the session in beside the group (an
    open one is shown, never duplicated); `beginDrag` puts it on a row's drag.
  - **Phone size**: taking the size back is the terminal's resize lease.
- A phone shows Perch's own, whatever is chosen.

### Terminal and dock chrome, the browser toolbar and the phone (1.10)

`stock:terminal-toolbar` (the row over a shell pane), `stock:agent-control`
(over an agent's terminal), `stock:dock-tab` and `stock:dock-actions` (a docked
pane's tab and its group's buttons) and `stock:browser-toolbar` (the row over a
browser page, a tab's or the drawer's) are stock screens, and so are the
phone's own: `stock:mobile-header`, `stock:mobile-switcher`,
`stock:mobile-panes`, `stock:mobile-files` and `stock:mobile-keys`.

- `glassClass` and `tapButtonClass` are the classes of Perch's glass panels
  and of a button sized for a finger; `GearIcon`, `PlusIcon` and `EllipsisIcon`
  are Perch's icons.
- What each does stays Perch's whatever copy shows:
  - **Shell toolbar**: New shell opens one (a tab of the group when docked),
    Close shell ends the shown shell's process; the shells, their input and size
    are the terminal's.
  - **Agent control** is drawn twice: `part: "top"` is the chip (how this view
    stands, with Take control or Fit here, which move the input or resize lease,
    or Retry CLI), `part: "bottom"` the agent's error line and, once its process
    ended, the banner (Restart CLI or Resume agent, Close session). `state`
    gives the facts (`controlling`, `shared`, `writable`, `phone`) for a copy
    that words the chip itself.
  - **Dock tab**: `defaultTab` is dockview's own tab (title and close), which a
    copy may keep, wrap or replace; `onClose` and `onMenu` close the panel and
    open Perch's pane menu. The strip, drag and drop are dockview's.
  - **Dock actions**: the group's +, Split with session and its menu go to
    Perch's dock.
  - **Browser toolbar**: the page is Perch's engine (the desktop's native
    webview, or a sandboxed frame); the address is Perch's draft (it survives a
    swap), its suggestions and their keys (`address.onKeyDown`) are Perch's.
    Back and Forward need the desktop app (`native`).
  - **Phone screens**: the header's switcher and settings, the switcher's body
    and usage, the panes' content (chat, files, Git), the files pane's explorer
    and editor (`explorer`, `editor`: Perch's own parts) and the keys (`send`
    types through the terminal's own input, `paste` reads the clipboard).
- A phone runs a person's copy of these five only (see "On a paired phone").

## Styles

A package's `.css` files are part of it. While a copy shows a revision, all its
`.css` files (sorted by path) are on the page as one `<style
data-mod-package="<id>" data-mod-revision="<rev>">`. When the last copy of that
revision stops showing it, the style leaves the page.

- `url(...)` in a package's CSS names a file of the package, relative to the CSS
  file. Perch rewrites it to that revision's copy of the file. `data:`, `blob:`,
  `http(s):` and `#fragment` URLs stay as they are. A URL that names no file of
  the package, and any `@import`, stop the revision from loading with the reason.
  A CSS tokenizer reads the file, so comments and strings are not mistaken for
  URLs.
- A revision's file URLs live while any copy, or the last good version kept to
  fall back on, still uses that revision.
- Styles are global, not scoped. Prefix your class names (`.my-keys-row`).

Perch's own classes and tokens (`bg-panel-bg`, `text-fg`, `rounded-ui` and
others) and Tailwind utility classes work too, with one limit: **Tailwind is not
compiled per package.** Perch's build generates CSS only for the utility
classes its own sources use. So:

- a class a stock screen already uses keeps working in a clone;
- a **new** utility class may have no CSS. Write it in the package's `.css`
  file instead;
- inline `style={{…}}` and the theme's CSS variables (`var(--accent)`, …) always
  work.

## On a paired phone

A phone (a phone-width page, or any page reached through a relay) keeps its own
screens and never runs the computer's packages: no copy of a desktop screen, no
layout, no docked, hidden or overlay package. It runs a person's copy only for
one of its own screens (`stock:mobile-*`), and only once "Phone screens from my
packages" is turned on in that phone's Settings > Mods. The choice is the
phone's own (its storage): another phone, or this one paired again, starts with
it off, and turning it off shows Perch's own at once. A relay phone keeps its
pairing key in the page's storage, where page code can read it, which is why
this is off by default.

A package's files come through the relay's sealed tunnel, never as plain
requests to the relay. The loader fetches at most 8 files at a time, because the
computer takes 16 pending requests per phone and the page's own traffic needs
the rest. A file whose type does not match its extension (a `.js` not served as
JavaScript, an image that is not an image) is refused, as the browser's
`nosniff` would.

## Versions

- The SDK follows semver. Adding an export, or an optional field or parameter,
  keeps the major version. Removing or renaming an export, or changing what one
  returns or accepts in an incompatible way, raises it.
- A package's `mod.json` `api` names the versions it works with. The page
  understands these ranges and refuses any other form rather than guessing:

  | Range | Matches |
  |---|---|
  | `*` | any version |
  | `^1`, `^1.2`, `^1.2.3` | same major, at least that version |
  | `~1.2` | same major and minor |
  | `1`, `1.x` | same major |
  | `1.2.3` | that exact version |

- A package whose range excludes this page's version is not loaded. It shows
  "This package needs @perch/sdk <range>; this Perch has <version>." (`perch mod
  check` reports the same). Its files are left alone.
- Clones are independent copies. Perch never updates or merges them. When Perch
  ships a new major, an old clone keeps working only while its range still
  matches. Otherwise, clone the stock screen again and redo the change, or widen
  `api` after checking the code against the new types.
- `sdk.test.ts` pins the exact list of exports to `SDK_VERSION`, so the surface
  cannot change by accident.
- The page and the core can be different builds (a relay phone's page comes from
  the relay's copy of the web app; an updated app meets an older core). The page
  checks each copy's range against its own SDK, so a copy written for a newer SDK
  shows Perch's own with the reason instead of running. Settings > Mods names the
  newer stock version when Perch ships one ("Perch now ships stock:status 1.1.0;
  your copy is unchanged"); the copy is never changed.

## Cloning a stock screen

```sh
perch mod guide                                     # this loop, step by step
perch mod examples                                  # lists stock:<id> screens too
perch mod clone stock:keybind-help --as my-keys     # copy into mods/my-keys
```

The copy holds the whole package, ready to edit. Its id must be a plain id
(letters, digits, `-`, `_`). It can never be a `stock:` id, so a copy is never
mistaken for stock. Show it with a layout block (`mod:my-keys`), or in the stock
screen's place (below), and check it after each edit with `perch mod check
my-keys` and `perch mod dom my-keys`.

### Using your copy in Perch's place

```sh
perch mod use stock:tabs my-tabs      # Perch shows my-tabs wherever it shows its tabs
perch mod use stock:tabs stock        # Perch's own again
```

The choice is the core's (`use` in `layout-state.json`, beside the chosen
layout), so every window of this computer follows it, in the stock window and in
every layout's `sidebar`/`tabs`/`status` block, every pane header and Perch's own
openers. A layout block `mod:stock:<id>` always shows the stock screen itself.
Only a stock screen of this build can be replaced, and only by a package of
yours that loads. One that is off or broken is not shown; the stock screen is.
With mods off, stock shows and the choice waits until mods are on. A phone
follows it only for its own screens, and only once turned on there (see "On a
paired phone"); Settings > Mods says on each device where a choice applies.

Stock screens now: `keybind-help`, `status`, `tabs`, `pane-header`,
`sidebar`, `review`, `files`, `chat`, `browser`, `confirm`, `toast`, `dialog`,
`select`, `tab-menu`, `pane-menu`, `file-menu`, `new-session`, `launcher`,
`navigator`, `folder-browser`, `worktree`, `instructions`, `memory`,
`close-guard`, `tab-drag`, `onboarding`, `context-bridge`, the Settings
pages (`settings-general` … `settings-permissions`, above), `start`,
`editor-menu`, `terminal-search`, `slash-popover`, `session-split`,
`phone-size`, `terminal-toolbar`, `agent-control`, `dock-tab`, `dock-actions`,
`browser-toolbar`, and the phone's `mobile-header`, `mobile-switcher`,
`mobile-panes`, `mobile-files` and `mobile-keys`. What Perch keeps for itself,
and why, is listed in docs/DECISIONS.md (2026-11-09, "Terminal and dock chrome,
the browser toolbar and the phone's screens"). The dialogs and
menus (from `confirm` on) are compiled into the page from the same source as
their packages, so a dialog never waits for a load; a copy chosen in their place
runs from its own files. Settings > Mods > Screens chooses a copy for each
screen, or makes one ("Make my copy"), on the computer and on a paired phone. On
a phone the sidebar's body in the switcher, the chat, the files parts and the
Git pane are Perch's own, built into the app, so a clone of those changes the
computer only. A review clone shows in the Files/Git
drawer, a review tab and a docked review panel. A
screen that draws into a portal, as the keybind help does, shows under `perch mod
dom app` instead.

Stock screens come from the web app Perch serves on this computer. A headless
core, or a remote host, has none to list or clone.

With mods off (`PERCH_MODS=off`, the Settings switch or ctrl+alt+shift+Escape),
stock screens still run, because they are Perch as shipped. Clones and every
other mod do not. Settings > Mods says so when the core was started with
`PERCH_MODS=off`. A page on an older core (without mods) says in Settings > Mods
that the computer's Perch is older, and shows Perch's own screens.

### Perch's window as a layout

Perch's own window is the layout `stock:main`: a column of the window row (the
parts `window:sidebar`, `window:main` and `window:drawer`) over the `status`
bar. Settings > Mods > Window layout > Make my copy (or `perch mod clone
stock:main --as my-window`) writes it to `layouts/my-window.json`, records
`clonedFrom`, and uses it. Edit the file and the window follows at once: move
the parts, wrap them in other rows and columns, add blocks beside them. The
drawer's tab and the sidebar's and drawer's widths stay the window's own, wherever
the parts are.

- `perch mod layout stock:main` (or `stock`) is Perch as shipped, drawn by a
  recovery shell from the same parts, so a broken copy never leaves you without
  a window: a copy that stops parsing is shown in Settings with its error, and
  Perch as shipped is drawn meanwhile.
- The older block names (`sidebar`, `tabs`, `canvas`, `files`, `git`, `status`)
  still work in every layout. A layout's clicks (hidden nodes, sizes, stack
  picks) are kept per layout content, as before.
- Switching layouts keeps every open file's unsaved draft: drafts are Perch's,
  not the layout's.

### When a copy cannot run

- A copy chosen in Perch's place that fails to load or throws while drawing
  gives way to Perch's own screen with a notice naming it and the error. Its
  folder and the choice stay; the next edit (a new revision) is tried again.
- A copy that stops the page while it starts (an endless loop, a crash) is
  turned off the next time the page loads: Perch marks each of your packages in
  this device's storage before starting it and clears the mark once it has drawn.
  A mark left over means that page never got that far, so that package is turned
  off (as Settings > Mods > Turn off), Perch's own screen shows, and a
  notification says which one. `perch mod enable <id>` or Turn on tries again.
  Stock screens are never marked or turned off. A page left normally while a
  copy was still starting (a reload mid-load) clears its marks first, so that
  copy is not turned off.
- ctrl+alt+shift+Escape (or `PERCH_MODS=off`) turns every mod off; stock still
  runs.

## Not a sandbox

A package is trusted code running in Perch's own page, with the person's full
access, like every mod. The import rules above define what is supported, not
what is possible. Code that reaches around the SDK through browser globals still
runs, and it breaks without notice when internals change. The sanitizers that
render untrusted content (`markdown.ts`, `SafeHtml.tsx`, `uiBlocks.ts`) are
fixed built-ins and are not cloneable.

## For Perch contributors

### Stock screen sources

- A stock screen is a folder `packages/web/src/stock-ui/<id>/` with:
  - a `mod.json` (`name`, `description`, `version`, `api`, optional `entry`,
    default `main.tsx`);
  - its TSX, whose default export is the component.
- It may import only the modules in the table above. The exporter
  (`packages/web/scripts/export-stock-ui.mjs`) stops the build and names the file
  and the reason if a screen:
  - imports anything outside its folder (a store, the socket, the bootstrap,
    `components/ui/*`);
  - imports another npm package (including a second React);
  - uses a Vite-only form (`import.meta.glob`, `import.meta.env`, `?url`/`?raw`
    imports, CSS modules);
  - uses `require` or a computed `import()`.
- CSS and assets go into the package:
  - `import "./look.css"` copies the stylesheet, plus every file its `url(...)`s
    name, which must be in the screen's folder;
  - `import logo from "./art/logo.svg"` copies the file and becomes `const logo
    = assetUrl("art/logo.svg")`;
  - any other form of either import is refused.
- The exporter runs inside `npm run build` (the `perch-stock-ui` plugin in
  `packages/web/vite.config.ts`), so its files are part of the web build and
  the service worker precaches them with the shell: a cached shell runs the
  stock screens of its own build, and a newer build replaces both together. A
  person's packages are never precached (`mods/package` is served `no-store`).
  Its output is `dist/stock-ui/<id>/` and `dist/stock-ui/catalog.json` (`{id,
  name, version, api, entry, files, revision}`).
- Two checks cover it:
  - `node --test packages/web/scripts/export-stock-ui.test.mjs` covers the
    exporter;
  - `node packages/web/scripts/export-stock-ui.mjs --check` fails if `dist/`
    differs from the sources.
- The same sources always export the same bytes. Comments and `//!` headers are
  kept. The revision equals the core's package digest, and both test suites pin
  the same value.
- A screen compiled into the page (the dialogs and menus) is part of an import
  cycle: its source imports `@perch/sdk`, and `sdk.ts` imports the screens'
  host routes. So a stock source never calls an SDK function at module top
  level (`const ACTION = button(...)`); it calls it while rendering, or wraps it
  in a function (`const action = () => button(...)`). A top-level call is
  `undefined` or a TDZ error while the cycle loads.
- Perch renders a stock screen with `StockView` (`components/mod-root.tsx`),
  mounted only while the screen is shown. Its files are fetched from the page's
  own origin, never through the core or the relay tunnel. On a paired phone they
  come from the relay Worker, which serves the same build.

### Growing the SDK

Move a screen only when everything it needs is in the SDK. When it needs more:

1. Add the smallest export that wraps an existing service, store selector or
   `components/ui` primitive. The SDK owns no state and no second
   implementation.
2. Declare it in `perch-sdk.d.ts`, document it here, update the export list in
   `sdk.test.ts` and bump `SDK_VERSION` (minor for an addition).
3. Export only what a migrated screen uses. Do not add an export because a
   screen might need it later.
