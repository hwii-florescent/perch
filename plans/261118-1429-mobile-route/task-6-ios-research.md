# iOS app on the native client: feasibility (task 6)

Date: 2026-11-18. Read-only research; no source edited. Evidence is `file:line` on `main`, the local cargo
registry, or the upstream links at the end.

## Recommendation

**Option (a): run perch-native's GPUI client on iOS, with the same stock screens, after a short spike.**
GPUI already has a UIKit backend. Zed's `gpui_ios` crate is published as `gpui-pre-ios 0.3.12`, a snapshot of
zed@d2a4fb6, and it is already in the local registry. The mod engine already runs the QuickJS interpreter
with no JIT. libghostty-vt is pure Zig, and third-party iOS terminals ship on libghostty. The real work is
three things: bumping GPUI from the pinned 0.3.8 to 0.3.12, splitting perch-native's macOS-only and
core-linked code out of the library, and porting the phone side of pairing and the relay to Rust.
Keep the web build as the phone's fallback renderer (option d) until the native phone path passes the same
mobile acceptance checks.

## 1. Can perch-native's UI run on iOS?

Yes, through a GPUI version bump.

- **The pinned version has no iOS backend.** Perch pins `gpui-pre =0.3.8` and `gpui-pre-platform =0.3.8`
  (`crates/perch-native/Cargo.toml`, the `gpui` and `gpui_platform` lines). `gpui-pre-platform 0.3.8` has
  no `ios` arm. The workspace also patches `gpui-pre` and `gpui-pre-macos` with vendored 0.3.8 copies
  (`Cargo.toml:49-53`, marked `PERCH:`), and vendored gpui-kit pins its GPUI requirements on purpose
  (`vendor/gpui-kit/Cargo.toml:30-34`).
- **0.3.12 has one.** `gpui-pre-platform 0.3.12` selects `gpui_ios::current_platform` when
  `target_os = "ios"` (`src/gpui_platform.rs:64`; its Cargo.toml has a `[target.'cfg(target_os = "ios")']`
  dependency on `gpui-pre-ios =0.3.12`, and `runtime_shaders` forwards to it). The crate metadata says it
  is Zed's own `gpui_ios` crate (`zed-crate = "gpui_ios"`, rev d2a4fb6). It builds as both `staticlib` and
  `rlib`, so an Xcode app can link it.
- **Maturity.** The backend is small (about 3,700 lines) but it is not a stub. The following is in
  `gpui-pre-ios-0.3.12/src/ios/`:
  - Metal through a `CAMetalLayer` view (shared `gpui_apple` renderer).
  - Touches: `touchesBegan`/`Moved`/`Ended`/`Cancelled` (`window.rs:170-187`), pan scrolling
    (`:191`, `:552`), and an edge-swipe back gesture (`:197`, `:564`).
  - Safe areas and display corner radii (`window.rs:655-695`).
  - Keyboard frame tracking (`UIKeyboardWillChangeFrame`/`WillHide`, `:479-516`), `show_keyboard` and
    `hide_keyboard` (`:716-720`), and tap-to-dismiss (`:600`).
  - Text input as a real `UITextInput` with marked text, so IME and dictation work
    (`text_input.rs:196-261`). There is a `tests/text_input.rs`.
  - Clipboard, Keychain credentials, appearance, the status bar style, lifecycle, memory and thermal
    events (`platform.rs:371-472`).
  - No `todo!` or `unimplemented!` anywhere in the crate.
- **What is missing or untested for Perch:**
  - No keyboard input accessory view. The Esc, Ctrl, Tab and arrow row would be a GPUI element above
    the keyboard inset (the web's `mobile-keys` screen already draws one).
  - Hardware-keyboard modifiers are probably minimal (`modifiers()` at `window.rs:886`; not checked).
  - Menus, the dock, cursors and file pickers are no-ops (`platform.rs:309-415`). Perch does not need them
    on a phone.
  - One window per scene. Perch's floating windows (`mods/` floating screens) need a fallback to overlays.
  - Upstream maturity is unknown. A third-party `gpui-mobile` crate exists and cites Zed PR #43655. This
    snapshot is the first published one. Treat it as preview quality until the spike runs.

## 2. Which parts are UI-free and portable

| Part | Where | iOS status | Cost |
| --- | --- | --- | --- |
| Core client (WS, requests, login) | `crates/perch-native/src/client.rs` (2,938 lines; tokio + tokio-tungstenite) | Portable Rust. Two problems. `Core::discover` reads `core.json` through `perchd::agent_cli` (`client.rs:133`). `login()` spends a desktop **local** sign-in code for the `perch_local` cookie (`client.rs:100-128`), not a phone pairing token. A phone needs the `device.pair` flow and a bearer token for the LAN listener (`crates/perch-core/src/server/phone_access.rs:7-10`). | S–M |
| Protocol types | Uses `perch_core::protocol`, `agent_fleet`, `review`, `source_control`, `shared_tabs` and others (about 65 references) | perch-native links all of **perch-core** (axum, rusqlite bundled, portable-pty, zip and tar) and **perchd** just for types and a few helpers (`perch-core/Cargo.toml:16-52`). That does not belong in an iOS app, and portable-pty on iOS is unverified. Split a `perch-protocol` crate, or put the server parts behind a feature. | M |
| Mod engine / stock screens | vendored `gpui-shell` on `quickjs-jit` (`vendor/gpui-kit/crates/shell/Cargo.toml`) | **Already interpreter-only at runtime.** `new_isolated_with_components_and_dependency_store` calls `JitRuntime::builder().build_interpreter()` (`engine/quickjs/mod.rs:1675-1690`, marked `HERDR:`), and `docs/NATIVE.md` says "QuickJS has no JIT". But the `quickjs` feature still compiles in the Cranelift `compiler` feature, and its executable-memory code is gated only for linux, macos and windows (`quickjs-jit/jit/src/compiler/baseline.rs:2279-2330`). It will not compile for iOS until the `compiler` feature is turned off for `target_os = "ios"`. A small vendored change. | S |
| Ghostty VT | `crates/ghostty-sys` (Zig-built `libghostty-vt.a` + bindgen) | `zig_target()` panics for any OS other than macOS or Linux (`build.rs:80-89`), and the SDK sysroot is only the macOS one. Add `aarch64-ios` and `aarch64-ios-simulator` targets and pass `xcrun --sdk iphoneos`/`iphonesimulator` to bindgen. libghostty-vt has no OS layer. Third-party iOS apps already ship on libghostty (gterm on TestFlight, VVTerm, Geistty, the `libghostty-spm` XCFramework for iOS 16+). The pinned submodule (291fd050b) has no Ghostty iOS app sources, which does not matter for the VT library. | S |
| macOS-only app code | `notify.rs`, `handoff.rs`, `sound.rs`, `keymap.rs`, `browser/*` (wry + AppKit), `files/quick_look.rs`, `files/media.rs`, `editor/host.rs`, parts of `terminal/` and `workspace` (19 files use objc2/AppKit or `cfg(macos)`), `main.rs` (`perchd::server::default_dir`) | Needs `cfg` stubs or iOS versions. Browser panes: wry supports iOS (WKWebView), but the AppKit child-view code does not port. Notifications use `UNUserNotificationCenter`, which also exists on iOS. | M |
| perch-native app layer | 52,800 lines of Rust, mostly GPUI views | GPUI code is platform-neutral. Hover, drag and keyboard-first paths need touch equivalents. | M–L (ongoing) |

Linking from Swift is a small job. Build `perch_native` as a `staticlib` for `aarch64-apple-ios` and
`aarch64-apple-ios-sim`. Wrap the two slices in an XCFramework. Expose one `extern "C" fn perch_ios_main()`
that runs `gpui::Application::new().run(...)`, the pattern in `gpui-pre-ios-0.3.12/examples/ios.rs`.
The Swift side then keeps only `@main`, the pairing QR scan (`ios/Perch/ConnectView.swift`) and the
Keychain store (`LinkStore.swift`). Rough guess for build plumbing: 2–4 days, most of it Zig/bindgen
sysroots and Xcode signing.

## 3. Options

| | What | Size | Risk | Phone loses | Phone gains |
| --- | --- | --- | --- | --- | --- |
| **a** | GPUI on iOS running perch-native and the same stock screens (incl. the web's `mobile-*` screens exported like the others) | L (spike S, port M–L) | GPUI 0.3.8→0.3.12 bump re-vendors the `PERCH:` patches and must keep gpui-kit compiling; the iOS backend is new upstream | Browser-only access (no app needed) once the web build goes; WebKit text niceties (selection handles, link long-press) until rebuilt | One renderer for desktop and phone; native Ghostty terminal at desktop fidelity; native keyboard and IME; screens fixed once fix both; no web build to keep in sync |
| b | Rust client + mod engine as a library, Swift/UIKit draws the screens' output | XL | The engine's output *is* gpui-kit elements (`describe` → `gpui.mjs` → gpui-kit, `docs/NATIVE.md:12-16`); a second renderer re-implements gpui-kit's layout, CSS cascade and components in UIKit | Desktop parity forever lagging | Fully native controls |
| c | libghostty or SwiftTerm terminal + hand-written SwiftUI screens on the core protocol | L, then grows with every screen | Two codebases; protocol drift (`protocol.rs` ↔ a third copy in Swift); mods do not apply on the phone, breaking the "hot-swappable stock mods" bar | Mods, shared screen source | Most iOS-idiomatic UI; smallest first milestone (terminal + switcher) |
| d | Keep the web build only as the phone's renderer (today's `ios/` WKWebView shell) | S | Owner says the web build will go stale and be removed; React web must keep building and passing mobile e2e | Nothing today | Works now; also serves browser-only phones and the relay |

Why (a) and not (c): (c) is quicker to a first demo, but it builds a third UI that the mod system cannot
reach. (a) keeps one UI codebase and one protocol client, and the expensive parts (backend, VT, interpreter)
already exist.

## 4. Relay and LAN access if `packages/web` is removed

- **The core serves the web build** to LAN and Tailscale phones from `PERCH_WEB_DIST`,
  `Contents/Resources/web-dist` or `packages/web/dist` (`crates/perch-core/src/boot.rs:216-230`;
  `ServeDir` at `server/mod.rs:996`). Without it, a phone *browser* on Wi-Fi gets nothing. A native phone
  app is unaffected, because it speaks WS plus the pairing token to the same listener.
- **The relay serves the page and also carries the tunnel.** `relay/wrangler.toml:8-9` serves assets from
  `../packages/web/dist`, and the Durable Object on `/r/*` forwards sealed frames. If the web build goes,
  the Worker becomes a pure pipe: drop `[assets]` and keep `/r/*`. The phone side of the tunnel exists
  **only in TypeScript** (`packages/web/src/relay/{tunnel,transport,wire}.ts`, about 640 lines). The core
  side is Rust (`crates/perch-core/src/relay/{host,wire}.rs`), and `wire.rs` already has the AES-GCM
  sealing plus a shared fixture (`wire.fixture.json`). A native phone needs a Rust port of the phone role,
  which should reuse `wire.rs`.
- **The trust model gets better.** Today the relay operator serves the page that holds the key
  (`relay/README.md`, "Trust"). With a native app the key never meets operator-served code.
- **Stock screens still come from `packages/web`.** Their source is `packages/web/src/stock-ui/<id>/`,
  exported by `npm run build` / `scripts/export-stock-ui.mjs` into `crates/perch-native/mods/`
  (`docs/NATIVE.md:12-16`; `packages/web/package.json` `check:stock-ui`). "Remove the web build" can only
  mean removing the React web *app* shell. The stock-ui sources, the React runtime build and the export
  step must stay or move.

## Phased path to TestFlight

0. **Spike (S, 2–3 days, throwaway branch).**
   - Build `gpui-pre-ios`'s `examples/ios.rs` on the simulator and on a cabled phone (free personal team).
   - Build `ghostty-sys` for `aarch64-apple-ios-sim`.
   - Run one stock screen (e.g. `phone-size` or `mobile-switcher`) through gpui-shell with the JIT
     `compiler` feature off.
   - Exit criterion: a GPUI window on the device draws a stock screen and one VT grid.
1. **Bump GPUI to 0.3.12 on desktop first (M).**
   - Re-apply the `PERCH:` patches in `vendor/gpui-pre*`, re-check vendored gpui-kit, and run the
     perch-native suites.
   - This is worth doing whatever the phone decides, and it is the riskiest step.
2. **Make the library portable (M).**
   - Create a `perch-protocol` crate, or put perch-core's server behind a feature, and remove `perchd` from
     the client.
   - `cfg(target_os = "ios")` stubs for browser, Quick Look, handoff, sound and notifications.
   - iOS targets in ghostty-sys; the jit `compiler` feature off on iOS.
3. **Phone auth in Rust (S–M).**
   - Pair with a QR code or pasted link (keep the Swift `ConnectView` and Keychain).
   - Connect with a device token over LAN/Tailscale, then port the relay tunnel's phone role on
     `relay/wire.rs`.
   - Tests: the existing `wire.fixture.json` round-trip plus an isolated-core pairing probe like the
     phase-2 one.
4. **Phone layout (M–L).**
   - Export the web's `mobile-header`, `mobile-switcher`, `mobile-panes`, `mobile-files` and `mobile-keys`
     stock screens to native.
   - Draw the shared tab row (decision D) and a key row above the GPUI keyboard inset.
   - Touch for terminal scroll and selection.
5. **Device build (S).**
   - `ios/project.yml` links `PerchNative.xcframework` instead of the WKWebView; `xcodegen`; run on a
     cabled phone with the free team (7-day provisioning).
6. **TestFlight (S, needs the paid account).**
   - Set the bundle ID and signing, archive, and upload with `xcodebuild -exportArchive` or Xcode.
   - Internal testers only. Export compliance: the app uses standard HTTPS/TLS and AES-GCM, so declare
     exempt standard encryption.

Until step 4 passes the mobile acceptance checks, keep shipping the WKWebView shell and keep the relay's
`[assets]`. After that, retire the phone's web path, and drop `ServeDir`/`[assets]` only if browser-only
phone access is also given up (an owner decision).

## Unresolved questions

1. Is browser-only phone access (no app) still a goal? If yes, the web build stays for it, and so do the
   relay's assets.
2. How much bump risk is acceptable? GPUI 0.3.8 → 0.3.12 touches the whole desktop client. Should the
   bump land on desktop before any phone work (recommended)?
3. Should the phone have a pared-down layout (terminal, switcher, files, review) or all desktop screens
   at phone size?
4. Not verified: portable-pty, rusqlite and axum compiling for iOS (avoidable through the crate split);
   gpui-shell's other deps (`reqwest`, `cap-std`, `fs2`) on iOS; gpui_ios's hardware-keyboard modifier
   handling.

## Sources

- `gpui-pre-ios 0.3.12` and `gpui-pre-platform 0.3.12` in `~/.cargo/registry/src/index.crates.io-*/`
  (crate metadata: Zed `gpui_ios`, rev d2a4fb6)
- [gpui-mobile 0.1.0 (third-party iOS/Android GPUI platform; cites Zed PR #43655)](https://docs.rs/crate/gpui-mobile/0.1.0)
- [Glass-HQ GPUI fork with an iOS host shell](https://github.com/Glass-HQ/gpui)
- [gterm: Ghostty SSH on iOS (TestFlight beta)](https://madeye.github.io/gterm/)
- [libghostty-spm (XCFramework, iOS 16+)](https://lakr233.github.io/libghostty-spm/)
- [awesome-libghostty (VVTerm, Geistty, Glassdeck, Echo)](https://github.com/Uzaaft/awesome-libghostty)
