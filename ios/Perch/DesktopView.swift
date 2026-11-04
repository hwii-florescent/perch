import SwiftUI
import WebKit

/// The desktop's web UI, edge to edge (the page lays itself out with
/// `env(safe-area-inset-*)` and follows the keyboard via `visualViewport`).
/// When the page cannot load at all, the desktop is unreachable: say so and
/// offer Retry or Change desktop. A connection lost later is the web app's own
/// "Reconnecting…" state, not this.
struct DesktopView: View {
    let url: URL
    @ObservedObject var model: AppModel
    @State private var failure: String?
    @State private var attempt = 0

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            WebView(url: url, failure: $failure, onDisconnect: model.disconnect)
                .id(attempt)
                .ignoresSafeArea()
            if let failure {
                VStack(spacing: 14) {
                    Text("Can’t reach your computer").font(.headline)
                    Text(failure).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    Text("""
                        Check that Perch is running with Phone access or Remote access on, that this phone \
                        is on the same Wi-Fi or Tailscale, and that Perch may use the Local Network \
                        (iPhone Settings → Perch).
                        """)
                        .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    Button("Try again") { self.failure = nil; attempt += 1 }
                        .buttonStyle(.borderedProminent)
                    Button("Change computer", role: .destructive) { model.disconnect() }
                }
                .padding(24)
                .frame(maxWidth: 360)
            }
        }
    }
}

private struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var failure: String?
    let onDisconnect: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.userContentController.addScriptMessageHandler(
            context.coordinator, contentWorld: .page, name: "perchApp"
        )
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        view.isOpaque = false
        view.backgroundColor = .black
        view.scrollView.backgroundColor = .black
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.scrollView.bounces = false
        view.allowsBackForwardNavigationGestures = false
        #if DEBUG
        view.isInspectable = true // Safari → Develop → this device
        #endif
        view.load(URLRequest(url: url))
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}

    static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) {
        view.configuration.userContentController.removeScriptMessageHandler(forName: "perchApp", contentWorld: .page)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply {
        let parent: WebView
        init(_ parent: WebView) { self.parent = parent }

        /// The page's native bridge (`packages/web/src/nativeApp.ts`).
        func userContentController(
            _ controller: WKUserContentController,
            didReceive message: WKScriptMessage
        ) async -> (Any?, String?) {
            switch message.body as? String {
            case "paste": return (UIPasteboard.general.string ?? "", nil)
            case "disconnect": await MainActor.run { parent.onDisconnect() }; return (nil, nil)
            default: return (nil, "unknown message")
            }
        }

        func webView(
            _ view: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            if (error as NSError).code == NSURLErrorCancelled { return }
            parent.failure = error.localizedDescription
        }

        func webView(_ view: WKWebView, didFinish navigation: WKNavigation!) {
            parent.failure = nil
        }

        /// iOS may kill a backgrounded page's process; reload rather than show a blank screen.
        func webViewWebContentProcessDidTerminate(_ view: WKWebView) {
            view.reload()
        }

        /// The desktop's own pages stay here; any other site opens in Safari.
        /// Subframes (previews) load wherever they point.
        func webView(
            _ view: WKWebView,
            decidePolicyFor action: WKNavigationAction
        ) async -> WKNavigationActionPolicy {
            guard let target = action.request.url, action.targetFrame?.isMainFrame != false else { return .allow }
            if ["about", "blob", "data"].contains(target.scheme) || PairLink.sameOrigin(target, as: parent.url) {
                return .allow
            }
            await UIApplication.shared.open(target)
            return .cancel
        }

        /// `window.open` / `target=_blank`: open in Safari instead of a second web view.
        func webView(
            _ view: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for action: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let target = action.request.url { UIApplication.shared.open(target) }
            return nil
        }
    }
}
