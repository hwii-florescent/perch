# iOS spike result: the native client's GPUI on the iOS simulator

Branch `nm/ios-spike`, crate `spikes/ios-gpui/` (its own workspace and lockfile; the desktop's GPUI pin, `vendor/`
and `crates/` are untouched). Simulator: `perch-ios-spike`, iOS 27.0, aarch64-apple-ios-sim, run headless through
`xcrun simctl` (no Simulator.app window, no focus taken).

**Verdict: go.** GPUI 0.3.13's iOS backend, the soft keyboard, libghostty-vt and the gpui-shell QuickJS engine
(interpreter only) all build and run on the simulator, and the stock sidebar's React tree paints. The blank sidebar
was not an iOS or engine fault: the web hides its stock sidebar at a phone width (see "Why the sidebar was blank").
The next step is the GPUI 0.3.8 → 0.3.13 bump on desktop, on its own branch.

| Step | Result | Evidence |
|------|--------|----------|
| 1. Window, text, tap, keyboard | Pass | `assets/ios-spike-1-tap-keyboard.png` |
| 2. Mod engine runs a stock screen | Pass | `assets/ios-spike-2-example-mod.png`, `assets/ios-spike-2-phone-sidebar.png`, `assets/ios-spike-2-sidebar-1024.png` |
| 3. ghostty-sys renders a Vt | Pass | `assets/ios-spike-3-vt.png` |
| 4. Isolated core, sign-in, projects | Not attempted | Out of the spike's scope; the fixture stands in for the core |

## How to run

```sh
cd spikes/ios-gpui
./step.sh                  # prepares gpui-kit and quickjs-jit-sys for iOS, builds, counts errors
./build-app.sh             # builds, bundles PerchSpike.app with mods, installs on the booted sim (target/udid)
xcrun simctl launch --console-pty "$(cat target/udid)" dev.perch.ios-gpui-spike [""|vt|mod <phone-sidebar|sidebar|example|phone-size>]
xcrun simctl io "$(cat target/udid)" screenshot shot.png
```

The build needs `RUSTC_BOOTSTRAP=1 -Zbuild-std=std,panic_abort` (no prebuilt std for the current toolchain on
aarch64-apple-ios-sim) and Zig 0.16 for Ghostty. `uitest/` is a small XCUITest driver that taps and types
on the simulator without bringing it forward.

## What worked

1. **GPUI.** `gpui-pre 0.3.13` + `gpui-pre-platform` + `gpui-pre-ios` open a full-screen window, draw text, take a
   tap (`SPIKE tap 1`) and receive soft-keyboard text through `EntityInputHandler` (`SPIKE input None "h"` …
   "hi perch"). The keyboard shows when a focused element has an input handler.
2. **Ghostty.** `ghostty-sys` (a copy of the desktop's build script with an iOS target mapping) builds libghostty-vt
   with Zig for the simulator. perch-native's `Vt` code, compiled unchanged, renders SGR colours, italic, underline,
   inverse, 256-colour and truecolour backgrounds, and wide CJK and emoji cells.
3. **Mod engine.** gpui-shell (vendored gpui-kit, ported to 0.3.13) runs on the QuickJS interpreter with the
   Cranelift `compiler` feature off. The `example` mod draws and its state works. The stock `sidebar` mod
   (react-runtime + the web's sidebar export, unchanged) loads in about 250 ms in a debug build. React mounts,
   reads the fixture through stub `perch` modules, and produces a full 50 KB `perch-native-description/1` tree.
   perch-native's `react_host.rs` compiles unchanged via `#[path]`.

## What broke or did not port

- **quickjs-jit-sys has no iOS bindings.** `step.sh` copies the crate and reuses the `aarch64-apple-darwin`
  bindings under the iOS names (same C ABI). A real port should generate them or upstream them.
- **Cranelift JIT is off.** iOS forbids writable+executable memory for apps, so mods run interpreted. Startup is
  fine in debug. Large-screen frame cost is unmeasured until the sidebar paints.
- **gpui-kit on 0.3.13** (`spikes/ios-gpui/gpui-kit.patch`, 47 files, +61/−266; every workaround is marked
  `PERCH spike`):
  - `Path<Pixels>` became the opaque `Path`. Plot paths can no longer be translated after building, so plots draw
    unmoved (`base/src/plot/path_cache.rs`).
  - `IntoElement` is now blanket-implemented for `Element`. Ten manual `impl IntoElement` blocks are deleted.
  - `Modifiers::secondary()` became `secondary(cx)`, and the `secondary-enter` binding became `cmd-enter`.
  - `Window::paint_layer(bounds, f)` became `paint_layer(f)`.
  - `window.text_system()` is now `Rc`, not `Arc`, so a text cache keeps a pointer identity instead of a `Weak`.
  - `KeyBinding::new` takes `&'static str`. The spike leaks the keystroke string.
  - The `gpui-fast` feature and its crates are removed: they pin 0.3.8.
  - herdr-app's API is missing upstream: `AssetSource::image_resource` (the mod image-size limit is skipped) and
    `Application::with_activation_policy` / `ActivationPolicy::Prohibited`. These are exactly the three items that
    today's `PERCH:` patches in `vendor/gpui-pre` and `vendor/gpui-pre-macos` add to 0.3.8.

## Why the sidebar was blank (solved)

The web's stock sidebar hides itself on a phone-width window: its `<aside>` has `max-[700px]:hidden`
(`packages/web/src/stock-ui/sidebar/main.tsx`, whose header says so). The spike's fixture gives the phone's
viewport (402 × 874), so the runtime describes the `<aside>` (node `n98`) as `display: hidden`, and GPUI rightly lays
out and paints nothing. Nothing else was wrong: React, the description, the translator, text, fonts and SVG icons all
work on iOS.

Evidence, all on the simulator through `simctl` (bundle copies of `screen.js` edited in place, no rebuild):

1. The screen's own wrapper paints (a red box and a green square around the described tree), so the view, layout
   size and window are fine.
2. The same description's "New session" row (`n7`), drawn alone through `describeToGpui`, paints its text, its
   SVG icon and its shortcut hint, with and without device-pixel snapping.
3. A dump of the description's top levels, drawn as text on screen, shows `div n98 {"display":"hidden", ...}` right
   under the root (`assets/ios-spike-2-sidebar-description-hidden.png`).
4. The unchanged stock sidebar with only the fixture's viewport width set to 1024 paints in full
   (`assets/ios-spike-2-sidebar-1024.png`).

The fix is what the web itself does on a phone: its switcher (`components/MobileSwitcher.tsx`) draws the sidebar's
body, `<SidebarContent compact />`, instead of the stock sidebar. The spike's `mods/phone-sidebar/main.js` mounts that
body from the stock sidebar's unchanged export (`sidebar/content.js`) at the phone's 402 px width, and it paints with
the phone's own rules (`assets/ios-spike-2-phone-sidebar.png`). The desktop headless harness was not needed: the
cause showed up on the simulator itself.

For the iOS app this means the phone route draws the web's phone screens (switcher, phone layout), not the desktop
window's sidebar region. Not checked: perch-native's desktop `viewport` is the window's size, so a desktop window
narrower than 701 logical pixels presumably hides its stock sidebar the same way.

## Size of the desktop bump (0.3.8 → 0.3.13)

- **gpui-kit:** the patch above. It is mechanical except for plot translation (it needs a re-build-at-offset
  instead of a translate) and the two herdr-only APIs.
- **`PERCH:` patches:** 21 markers in 10 files (`vendor/gpui-pre`: Cargo.toml, window.rs, platform.rs, assets.rs,
  app.rs, headless_app_context.rs; `vendor/gpui-pre-macos`: Cargo.toml, platform.rs, display_link.rs, window.rs).
  They must be re-applied to 0.3.13 copies, or the three herdr APIs upstreamed.
- **perch-native itself:** only `text_system()` is affected among the APIs that changed (12 uses), and those are
  call sites that keep compiling unless they store the `Arc`. No `secondary()`, `Path<Pixels>`, `paint_layer`,
  `KeyBinding::new(&…)` or activation-policy uses. Expect a small diff, but it is not compiled against 0.3.13 yet.
- **Release binary size:** not measured. The debug simulator binary is 226 MB, which says nothing about release.

## Unresolved questions

1. Should the bump land on desktop first (recommended) with the three herdr APIs re-patched, or upstreamed?
2. Frame cost of a full sidebar on the QuickJS interpreter in a release build is still unmeasured.
