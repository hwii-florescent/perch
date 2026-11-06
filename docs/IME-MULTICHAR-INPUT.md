# Terminal input: multi-character key events (Vietnamese IMEs)

Status: **fixed in Perch (unverified with a real IME).** `createPerchTerminal`
(`packages/web/src/xtermSetup.ts`) now forwards the part of a multi-character
`insertText` that xterm's keypress path did not send; regression test in
`xtermSetup.test.ts`. Confirm with the repro below on a real event-tap IME.
The IME-side workaround remains harmless.
Found while using Perch with a custom Vietnamese input method
([`vietnativekey`](https://github.com/hwii-florescent/vietnativekey), a fork of
Gõ Nhanh). Cause is a reading of xterm.js behaviour and is **not yet verified
inside Perch**; confirm with the repro below before changing code.

## Symptom

With a Vietnamese IME that converts Telex as you type, normal Vietnamese works
(`dd` → `đ`, `daas` → `ấ`), but the IME's *English auto-restore* breaks in
Perch's terminal. Typing `text␣` first shows `tẽt`; on the space the IME should
turn it back into `text `, and in Perch the word comes out wrong or truncated.
Terminal.app is fine with the same IME and the same words.

## Likely cause

Such IMEs (Gõ Nhanh family, event-tap based) cannot edit text in place. To
replace a word they post synthetic key events: N Backspaces, then the new text
as **one key event carrying a multi-character Unicode string**
(`CGEventKeyboardSetUnicodeString`, up to 20 UTF-16 units, virtual key 0).

Single characters (`đ`, `ấ`) arrive as an ordinary key event and work. A
multi-character string (`text`, `restore`) is what breaks. xterm.js builds
`onData` from a hidden `<textarea>`; its keydown path only forwards a printable
key when `event.key.length === 1`, and its keypress fallback uses a single
`charCode`, so only the first character of a longer string is expected to
survive. (To confirm in the pinned `@xterm/xterm` 6.1.0-beta.304.)

## Scope

Probably any xterm.js surface fed by such an IME, not only Perch: VS Code and
Cursor integrated terminals, Hyper, Tabby. Terminals that read the whole string
(Terminal.app) are unaffected. Plain `<textarea>`/`<input>` elsewhere in Perch
(editor, composer) were not checked.

## Current workaround (IME side)

`vietnativekey` sends text one key event per character for the bundle id
`dev.hwii.perch` (also `co.zeit.hyper`, `org.tabby`): see the `char:xterm.js`
branch in `platforms/macos/RustBridge.swift`. That makes Perch work only with
that IME build and costs ~8 ms per restored letter.

## Possible fix in Perch

Make the terminal accept a multi-character insertion regardless of IME:
listen for the textarea `input` event (`inputType: "insertText"`, `data` longer
than one character) in or next to `createPerchTerminal`
(`packages/web/src/xtermSetup.ts`) and forward the full `data` to the terminal's
input path, while not double-sending what xterm already handled. Keep native
input and the `onTerminalInput` user-input classification intact (see
`AGENTS.md`). Mind IME composition (`isComposing`) and the Ctrl+Enter textarea
handling already in that file.

## Repro

1. Install an event-tap Vietnamese IME with English auto-restore on (or the
   `vietnativekey` build with Perch removed from its xterm.js list).
2. Enable Vietnamese typing for Perch, open a shell pane.
3. Type `text `, `user `, `restore ` (each followed by a space).
4. Expected: the same words. Bug: truncated or garbled words.
5. Compare with Terminal.app, and optionally log the textarea's
   `keydown`/`keypress`/`input` events to see what arrives for a 4-char string.
