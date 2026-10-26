# Browser integration plan

## Status and objective

**Planning only. No implementation, signing changes, entitlement applications or
live account probes are authorized by creating this document.** Start Phase 1
only after the owner asks to proceed. All implementation phases below remain
unchecked; source inspection is not runtime verification.

Improve Perch's existing browser tabs and drawer pages into a more capable
embedded browser, prioritizing the reported sign-in failure: selecting a passkey
returns an error instead of presenting the operating system's Touch ID UI.
Add useful everyday browser features incrementally without disrupting terminals,
agents, files, workspace restoration or remote execution.

Keep the existing native engine and pane architecture first. This is not a
promise of Safari/Chrome parity or guaranteed Google sign-in. Product and safety
contracts in [DECISIONS](docs/DECISIONS.md), [ARCHITECTURE](docs/ARCHITECTURE.md)
and [TESTING](docs/TESTING.md) continue to apply.

## Starting point and uncertainties

- Desktop pages use Tauri/Wry native child webviews; macOS uses `WKWebView`.
  Native rendering, JavaScript, cookies and navigation already exist. Both tabs
  and drawer pages use the shared `WorkspaceBrowser` path.
- The initial inspection found no browser-passkey entitlement or associated-domain
  setup. Source configuration does not establish the installed app's effective
  entitlements, provisioning or passkey authorization state.
- The inspected new-window handler navigates the original page and denies the
  new window. This can break flows that require a popup and its opener.
- The non-desktop fallback is a sandboxed iframe. Framing, storage and API
  restrictions prevent treating it as a full browser. Do not promise parity.
- The exact passkey error and affected macOS/app versions have not been captured.
  Missing authorization is a structural concern, not a reproduced diagnosis.
- Google may reject embedded browsers independently of passkey support. Reaching
  the passkey button does not prove the eventual authentication flow is allowed.
- The working tree contains unrelated changes, including browser/shortcut work.
  Re-read current code and callers before implementation; reuse work that exists
  by then rather than treating this document's observations as a frozen baseline.

## Non-negotiable boundaries

1. Keep `perch-core` and `perchd` ownership unchanged. No terminal relaunches,
   altered PTY input/resize authority, agent changes or local execution fallback.
2. Keep untrusted pages and popup windows outside privileged Perch DOM/IPC.
   Main-view-only capabilities must remain main-view-only, including after
   redirects or navigation to loopback addresses. Never broaden capability
   webview selectors or remote-URL scopes to grant pane/popup origins access.
3. Preserve tab identities, layouts, drafts, close behavior and restoration.
   Do not change the main UI's loopback origin, app identity or browser data store
   incidentally; these changes can lose access to saved state or log users out.
4. Reuse Tauri/WebKit facilities before adding dependencies or native wrappers.
   Keep platform/browser logic in the desktop layer and presentation in React.
5. Do not weaken TLS validation, spoof credential origins, inject an arbitrary
   credential bridge or copy cookies from another browser to make login work.
6. Do not make Perch the default browser, register new URL behavior, change
   signing/distribution, or impose a sandbox without a reviewed owner decision.
7. Unsupported capabilities need an honest fallback. Preserve **Open externally**;
   signing in externally does not transfer that browser's session into a pane.
8. Ship and verify small reversible slices. Do not mix unrelated working-tree
   changes into browser commits. No deployment, reinstall, push or publication
   without authorization.

## Phase 1 — Diagnose the passkey failure

**Goal:** distinguish WebAuthn availability/authorization, provider policy,
credential conditions and popup/navigation problems before selecting a fix.

- [ ] Obtain the exact error text or a redacted screenshot, macOS version, Perch
      build/version and whether failure happens immediately or after an OS prompt.
- [ ] Ask the owner to compare the same step in Safari. Do not inspect or operate
      their account or credential manager without explicit authorization.
- [ ] Determine whether Google rejects the embedded browser generally. If the
      owner chooses to try another sign-in method, record whether it works; do
      not require a password/2FA attempt or store any account details.
- [ ] Inspect the built app's actual code signature, entitlements and provisioning
      locally. Compare them with the source configuration.
- [ ] Use an isolated controlled WebAuthn test page to check secure-context/API
      availability, platform-authenticator availability and relevant rejection
      names. Use test credentials and a valid relying-party origin; an API being
      present or an availability check returning true is not successful sign-in.
- [ ] Separate errors from Google policy, missing native authorization, user
      denial/cancellation, unavailable credentials, and navigation/popup behavior.
      A generic `NotAllowedError` does not identify the cause by itself.
- [ ] Record only minimal redacted diagnostics. Exclude credentials, tokens,
      challenges, assertion payloads, account identifiers and sensitive URL queries.

**Exit:** a short evidence-backed diagnosis, remaining unknowns and the next
permitted step. If Google blocks the browsing environment, do not pursue
entitlements as a claimed fix for that policy. General passkey work requires a
separate usefulness decision; popup and basic browser improvements can continue.

## Phase 2 — Prove native passkey feasibility

**Goal:** demonstrate the real system authentication UI in an isolated signed
build before modifying the production browser path.

### External approval gate

For an app's own service, Apple's ordinary passkey route uses an associated
`webcredentials` domain with website cooperation. Adding `google.com` to Perch's
configuration alone cannot authorize Google credentials.

For arbitrary websites, Apple's documented browser route uses the managed
`com.apple.developer.web-browser.public-key-credential` entitlement. It requires
an organization's Apple Developer Account Holder to apply and Apple to approve
browser eligibility. Requirements include HTTP/HTTPS scheme handling and a
browser entry/search/bookmark experience on launch. **Perch's eligibility and
supported distribution/provisioning path are not established.**

- [ ] Confirm account eligibility, Apple approval requirements and whether the
      intended Developer ID distribution can carry the approved capability.
- [ ] Decide whether meeting browser requirements fits Perch's terminal-led
      product. Do not reshape Perch to masquerade as a browser for approval.
- [ ] Review any HTTP/HTTPS registration and incoming-URL routing explicitly.
      Registering handlers is not permission to become the default browser or
      steal links; never turn an incoming URL into arbitrary local execution.
- [ ] Verify OS availability. The documented macOS browser-passkey entitlement
      and credential-manager APIs start at macOS 13.3. Gate supported features;
      do not automatically raise the minimum OS for the entire application.

### Isolated proof, only if the gate passes

- [ ] Use a correctly provisioned test identity. A separate probe App ID needs
      its own permitted entitlement/profile; do not assume production approval
      automatically covers a different bundle ID.
- [ ] Isolate native browser storage as well as Perch's four scratch state paths.
      Do not reuse the installed app's cookies, settings or keychain test records.
- [ ] Follow Apple's browser passkey access authorization flow. With a permitted
      configuration, let `WKWebView` handle page WebAuthn and system UI; do not
      build a custom passkey selector or forward arbitrary page challenges over IPC.
- [ ] Verify supported Touch ID/local verification, cross-device QR, cancellation,
      denied permission and unavailable-credential cases with test credentials.
- [ ] Keep QR under the same feasibility gate: cross-device passkeys are another
      WebAuthn transport, not an entitlement bypass.
- [ ] After controlled success, obtain owner-driven verification on the target
      Google flow. A controlled relying party passing does not certify Gmail.

**Exit:** proven supported OS/build/signing combinations and an explicit
integration decision. If approval, distribution or provider acceptance fails,
stop the embedded-passkey promise and document the limitation. Do not silently
switch engines or redirect a login.

**Fallback:** Open externally for ordinary browsing. For a future authentication
feature that Perch itself owns, evaluate a supported browser-based OAuth flow,
such as `ASWebAuthenticationSession`, with its own registered callbacks. This is
not a generic way to sign arbitrary pane websites into the system browser's
session, and it does not create a logged-in Gmail session in the pane.

## Phase 3 — Integrate proven authentication and correct popup behavior

These are separate slices. Popup support is useful independently and need not
wait for Apple approval. Passkey integration depends on successful Phase 2 proof.

### 3A. Native passkeys, conditional

- [ ] Integrate the proven native authorization/configuration into browser pages
      only, using the fewest existing files and helpers possible.
- [ ] Handle unsupported OS, denied access and cancellation without credential
      leakage, repeated consent prompts or destructive browser-state changes.
- [ ] Preserve existing cookies/data, application identity and shell/agent launch
      behavior across any signing/package changes; verify the packaged build.
- [ ] Describe the actual supported platforms/sites rather than claiming universal
      passkey compatibility.

### 3B. Native popups and sign-in windows

- [ ] Replace forced same-tab navigation where a real popup is required, using
      Tauri's existing new-window support. Initially prefer bounded native popup
      windows over a tab-system redesign.
- [ ] Preserve the platform-provided WebKit configuration, intended cookie store,
      opener relationship and legitimate `postMessage`/close behavior.
- [ ] Define user-gesture/initiator policy, nested popup limits, lifecycle cleanup
      and safe handling of unsupported URL schemes. Do not allow arbitrary native
      app launches from web content.
- [ ] Give popup content no Perch IPC authority. Audit redirects, loopback
      destinations, focus routing and shortcut ownership.
- [ ] Test successful and cancelled popup authentication, opener communication,
      parent close, repeated requests and ordinary `target=_blank` navigation.

**Exit:** focused regressions and applicable native verification pass for each
slice. No site-specific workaround is treated as generic authentication support.

## Phase 4 — Practical browser features, one approved slice at a time

This is a prioritized roadmap, not one implementation batch. Recheck inherited
WebKit/Wry behavior first: native capabilities such as upload dialogs may already
exist and should not be rebuilt. UI details follow the approved quiet Perch
conventions and existing shared components.

| Order | Slice | Acceptance and safety boundary |
|---|---|---|
| 1 | Loading, titles, navigation failures and retry | Follow the real page lifecycle; identify failed loads without replacing unrelated tabs or falsely claiming a secure connection. Bound any page-process recovery and never resubmit sensitive actions automatically. |
| 2 | Find in page and page-specific zoom | Browser-scoped controls/shortcuts must not resize terminal text, change whole-app zoom or consume terminal input. |
| 3 | Downloads | Reuse native/Tauri download hooks and save UI. Show completion/failure; sanitize filenames, prevent path traversal, support cancellation and require explicit overwrite consent. Verify macOS quarantine (`com.apple.quarantine`) is preserved or applied as appropriate. Never auto-run or auto-open downloaded content. |
| 4 | Site/security information | Show only verified origin/connection facts and useful TLS errors. No decorative security claims or certificate-validation bypass. |
| 5 | Site permissions | Review camera/mic and other supported capabilities individually. Add OS usage descriptions and enforce per-origin grant/revoke behavior natively; no blanket grants. Gate features if the installed API cannot enforce the policy safely. |
| 6 | Browser-only site-data controls and private browsing | Clear only intended browser data, never main-app local storage, drafts or layout. Verify shared-store boundaries first; no unreviewed profile migration or logout of unrelated sites. Private browsing is not anonymity. |
| 7 | Print, history and bookmarks | Optional, separately approved scope. Define privacy/retention and persistence before adding UI; no dead controls or browsing-history capture without a decision. |

Named persistent WKWebView data-store identifiers require newer OS support
(Tauri documents macOS 14+); nonpersistent stores are a different mechanism.
Do not assume one cross-platform profile API or silently move existing data.

Defer browser extensions, a custom password vault, broad credential-manager UI,
a browser-engine replacement and full Safari/Chrome parity. Basic password/
AutoFill behavior should be measured, but new integration requires a separate
feasibility and security review rather than collection of users' passwords.

## Phase 5 — Verification and staged delivery

Apply this gate to **every implementation slice**, not only at the end.

- [ ] Leave a focused runnable regression for nontrivial behavior. Use controlled
      local pages/fixtures before external sites; no paid agent turns are needed.
- [ ] Run relevant Rust/frontend checks and changed-path diagnostics. Include
      browser state and error/cancellation coverage, not only successful loads.
- [ ] Extend the existing native close-shortcut probe where appropriate. Use
      hidden/unfocused windows for automated tests; native menu-event tests are
      not proof of real hardware keyboard dispatch or biometric presentation.
- [ ] Verify tabs and drawer pages, splits, resizing, drag-over behavior, overlays,
      close/rebind behavior, restored layouts and terminal keyboard input.
- [ ] Verify browser pages/popups cannot invoke app commands, including after
      redirects, opening loopback content or closing the initiating page.
- [ ] Check shell/agent continuity and packaging effects without changing runtime
      ownership or treating unknown execution state as exit.
- [ ] Follow [TESTING](docs/TESTING.md): isolate `PERCH_DB`, `PERCH_HOSTS`,
      `PERCHD_DIR`, `PERCH_SETTINGS` and native webview storage. The four environment
      variables alone do not isolate WKWebView cookies. Clean up only owned test
      processes and state; never use the installed app's daemon or reinstall it.
- [ ] Keep actual Touch ID/phone QR verification owner-driven and separately
      authorized. Record OS/build/provider versions and redacted outcomes; do
      not claim that a headless assertion certifies successful biometric UI.
- [ ] Re-read and preserve unrelated concurrent changes before each commit.
      Commit only the verified browser slice locally; no push/tag/publication.
- [ ] Preserve Open externally and a code-level rollback path. Avoid blanket
      feature flags or new frameworks when ordinary small commits suffice.

**Completion evidence:** each slice names the candidate revision, tested OS and
build, checks performed, results, retained non-sensitive evidence, remaining
limitations and rollback implications. Unsupported/unverified stays explicit.

## Intended implementation footprint

Start with `crates/perch-desktop/src/browser.rs` and its existing callers,
`packages/web/src/components/WorkspaceBrowser.tsx`, `browserNative.ts`,
`DrawerBrowser.tsx`, and focused tests. Native authorization may require a small
platform-specific helper. Packaging may touch `Entitlements.plist`, `Info.plist`
and Tauri configuration only after the approval/signing gate.

Do not pre-emptively add abstractions, dependencies, protocol families or database
migrations. If shared settings/persistence genuinely becomes necessary, keep
domain ownership in Rust and preserve Rust/TypeScript protocol compatibility.

## First authorized step when implementation resumes

Request the redacted passkey error and macOS/Perch build details, then perform
Phase 1 diagnosis. The recommended first implementation scope is proven passkey
integration if feasible, plus separately verified popup behavior. Loading/error
feedback, find and downloads follow as independent slices. Broader features wait
for their own approval and feasibility checks.

## References

- [Apple: Supporting passkeys](https://developer.apple.com/documentation/authenticationservices/supporting-passkeys)
- [Apple: Passkey use in web browsers](https://developer.apple.com/documentation/authenticationservices/passkey-use-in-web-browsers)
- [Apple: Browser public-key credential entitlement and eligibility](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.web-browser.public-key-credential)
- [Apple: Browser passkey credential manager](https://developer.apple.com/documentation/authenticationservices/asauthorizationwebbrowserpublickeycredentialmanager)
- [Apple: Web authentication sessions](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession)
- [Google: Sign in with a supported browser](https://support.google.com/accounts/answer/7675428?hl=en)
- [Google: OAuth secure-browser policy](https://developers.google.com/identity/protocols/oauth2/policies#use-secure-browsers)
- [Tauri: Webview versions](https://v2.tauri.app/reference/webview-versions/)
- [Tauri: WebviewBuilder APIs](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewBuilder.html)

External policies and API availability can change. Reconfirm them when their
phase begins; references and this plan are not approval or runtime evidence.
