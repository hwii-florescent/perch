import Foundation

/// The link the desktop's Settings → Devices shows, as the web app reads it
/// (`packages/web/src/pairing.ts`, `PhoneAccess.tsx`): the address, with the
/// pairing code in its `#fragment` as `pair=CODE`. A relay address also carries
/// its end-to-end key in the fragment (`r=`), so the fragment is kept whole
/// apart from the one-time code.
enum PairLink {
    /// The URL to open first, from what the user scanned or typed. The code is
    /// optional when the address is a whole link that already carries one;
    /// without any, the desktop's own pairing screen asks for it.
    static func make(address: String, code: String = "") -> URL? {
        var text = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        if !text.contains("://") { text = "http://" + text }
        guard var parts = URLComponents(string: text),
              let scheme = parts.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = parts.host, !host.isEmpty
        else { return nil }
        if parts.path.isEmpty { parts.path = "/" }
        let cleaned = code.filter { $0.isLetter || $0.isNumber }.uppercased()
        if !cleaned.isEmpty {
            let rest = fragmentItems(parts.fragment).filter { !$0.hasPrefix("pair=") }
            parts.fragment = (rest + ["pair=\(cleaned)"]).joined(separator: "&")
        }
        return parts.url
    }

    /// What to remember: the link without its one-time code, so a later launch
    /// opens the desktop instead of trying to pair with a spent code.
    static func saved(_ url: URL) -> URL {
        guard var parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
        let rest = fragmentItems(parts.fragment).filter { !$0.hasPrefix("pair=") }
        parts.fragment = rest.isEmpty ? nil : rest.joined(separator: "&")
        let query = parts.queryItems?.filter { $0.name != "pair" }
        parts.queryItems = query?.isEmpty == false ? query : nil
        return parts.url ?? url
    }

    /// Whether `url` is on the desktop's own origin (so it stays in the app).
    static func sameOrigin(_ url: URL, as base: URL) -> Bool {
        url.scheme?.lowercased() == base.scheme?.lowercased()
            && url.host?.lowercased() == base.host?.lowercased()
            && url.port == base.port
    }

    private static func fragmentItems(_ fragment: String?) -> [String] {
        (fragment ?? "").split(separator: "&").map(String.init)
    }
}
