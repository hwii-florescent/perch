import XCTest
@testable import Perch

final class PairLinkTests: XCTestCase {
    func testTypedAddressAndCode() {
        XCTAssertEqual(PairLink.make(address: " 192.168.1.20:7788 ", code: "ab 12-cd")?.absoluteString,
                       "http://192.168.1.20:7788/#pair=AB12CD")
        XCTAssertEqual(PairLink.make(address: "https://box.tail1.ts.net/perch/", code: "X1")?.absoluteString,
                       "https://box.tail1.ts.net/perch/#pair=X1")
    }

    func testRejectsWhatIsNotADesktop() {
        XCTAssertNil(PairLink.make(address: ""))
        XCTAssertNil(PairLink.make(address: "ftp://host/"))
        XCTAssertNil(PairLink.make(address: "http://"))
    }

    /// A relay link keeps its end-to-end key beside the code, and only the code is forgotten.
    func testRelayLinkKeepsItsKey() {
        let scanned = PairLink.make(address: "https://relay.example/#r=room.key&pair=OLD")!
        XCTAssertEqual(scanned.absoluteString, "https://relay.example/#r=room.key&pair=OLD")
        XCTAssertEqual(PairLink.make(address: scanned.absoluteString, code: "new")?.absoluteString,
                       "https://relay.example/#r=room.key&pair=NEW")
        XCTAssertEqual(PairLink.saved(scanned).absoluteString, "https://relay.example/#r=room.key")
    }

    func testSavedDropsTheCodeEverywhere() {
        XCTAssertEqual(PairLink.saved(URL(string: "http://10.0.0.2:7788/?pair=A&x=1#pair=A")!).absoluteString,
                       "http://10.0.0.2:7788/?x=1")
    }

    func testSameOrigin() {
        let base = URL(string: "http://10.0.0.2:7788/#pair=A")!
        XCTAssertTrue(PairLink.sameOrigin(URL(string: "http://10.0.0.2:7788/ws")!, as: base))
        XCTAssertFalse(PairLink.sameOrigin(URL(string: "http://10.0.0.2:3000/")!, as: base))
        XCTAssertFalse(PairLink.sameOrigin(URL(string: "https://github.com/")!, as: base))
    }
}
