import Foundation
import Security

/// The one saved desktop link, in the Keychain: a relay link carries the
/// end-to-end key in its fragment, so it is a secret, not a preference.
enum LinkStore {
    private static let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "dev.hwii.perch.desktop-link",
        kSecAttrAccount as String: "desktop"
    ]

    static func load() -> URL? {
        var lookup = query
        lookup[kSecReturnData as String] = true
        var item: CFTypeRef?
        guard SecItemCopyMatching(lookup as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data, let text = String(data: data, encoding: .utf8)
        else { return nil }
        return URL(string: text)
    }

    static func save(_ url: URL) {
        clear()
        var item = query
        item[kSecValueData as String] = Data(url.absoluteString.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }

    static func clear() {
        SecItemDelete(query as CFDictionary)
    }
}
