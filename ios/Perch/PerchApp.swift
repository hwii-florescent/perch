import SwiftUI
import WebKit

/// The Perch iPhone app: a Connect screen until a desktop is known, then that
/// desktop's own web UI full screen (`DesktopView`). The UI always comes from
/// the paired desktop, so it never drifts from the desktop's protocol.
@main
struct PerchApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            Group {
                if let url = model.url {
                    DesktopView(url: url, model: model)
                } else {
                    ConnectView { model.connect($0) }
                }
            }
            .preferredColorScheme(.dark)
        }
    }
}

@MainActor
final class AppModel: ObservableObject {
    /// What the web view opens: the saved link, or the just-scanned one with its code.
    @Published private(set) var url: URL?

    init() {
        // The Keychain outlives an uninstall but the device token cookie does not: a reinstall
        // starts at Connect rather than at a desktop that no longer knows this phone.
        if !UserDefaults.standard.bool(forKey: "installed") {
            LinkStore.clear()
            UserDefaults.standard.set(true, forKey: "installed")
        }
        url = LinkStore.load()
    }

    func connect(_ link: URL) {
        LinkStore.save(PairLink.saved(link))
        url = link
    }

    /// Forget this desktop: its link and the device token cookie it set.
    func disconnect() {
        LinkStore.clear()
        url = nil
        let store = WKWebsiteDataStore.default()
        store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) {}
    }
}
