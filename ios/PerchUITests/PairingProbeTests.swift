import XCTest

/// Live probe, skipped unless pointed at a running core: pair by typing the
/// address and code, then see the desktop's own phone UI load in the web view.
/// `TEST_RUNNER_PERCH_ADDRESS` / `TEST_RUNNER_PERCH_CODE` (xcodebuild strips
/// the prefix) — see docs/TESTING.md.
final class PairingProbeTests: XCTestCase {
    func testPairWithCode() throws {
        let env = ProcessInfo.processInfo.environment
        guard let address = env["PERCH_ADDRESS"], let code = env["PERCH_CODE"] else {
            throw XCTSkip("set TEST_RUNNER_PERCH_ADDRESS and TEST_RUNNER_PERCH_CODE")
        }
        let app = XCUIApplication()
        app.launch()

        let field = app.textFields["connect-address"]
        XCTAssertTrue(field.waitForExistence(timeout: 10), "a fresh install shows the Connect screen")
        field.tap()
        field.typeText(address)
        app.textFields["connect-code"].tap()
        app.textFields["connect-code"].typeText(code)
        app.buttons["Connect"].tap()

        // The desktop's mobile header (MobileHeader.tsx) means pairing succeeded and the UI loaded.
        XCTAssertTrue(app.webViews.buttons["Settings"].waitForExistence(timeout: 30), "the paired phone UI loads")
        XCTAssertFalse(app.webViews.staticTexts["Connect to your laptop"].exists, "no pairing gate left")
        add(XCTAttachment(screenshot: app.screenshot()))

        // A relaunch opens the saved computer directly, still paired.
        app.terminate()
        app.launch()
        XCTAssertTrue(app.webViews.buttons["Settings"].waitForExistence(timeout: 30), "the saved link and token survive a relaunch")

        // Change computer (web Settings → native bridge) returns to the Connect screen.
        let welcome = app.webViews.buttons["Got it"] // a fresh desktop's first-run dialog
        if welcome.exists { welcome.tap() }
        app.webViews.buttons["Settings"].tap()
        app.webViews.buttons["Change computer"].tap()
        XCTAssertTrue(app.textFields["connect-address"].waitForExistence(timeout: 10))
    }
}
