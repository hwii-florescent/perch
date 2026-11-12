//! The bytes an attach sends, and what Ghostty's screen holds when it sends
//! them, written to `packages/web/src/terminalRepaint.fixtures.json` for the
//! xterm.js test beside it (`terminalRepaint.test.ts`), which feeds the bytes
//! to the emulator the web and phone clients run and compares.
//!
//! This test fails when the checked-in file no longer matches what `Screen`
//! produces. Regenerate it with
//! `PERCH_UPDATE_FIXTURES=1 cargo test -p perchd --test repaint_fixtures`
//! and review the diff: a change in the bytes is a change in what clients see.

use perchd::screen::Screen;
use serde_json::{json, Value};
use std::path::PathBuf;

/// The replayed tail of a stream, as a default attach sends it: the last
/// `len` bytes, starting at the next line or escape sequence so it doesn't
/// begin mid-sequence.
fn tail_of(stream: &[u8], len: usize) -> String {
    let mut start = stream.len().saturating_sub(len);
    if start > 0 {
        while start < stream.len() && !matches!(stream[start - 1], b'\n') && stream[start] != 0x1b {
            start += 1;
        }
    }
    String::from_utf8(stream[start..].to_vec()).expect("fixtures are plain UTF-8")
}

fn case(name: &str, cols: u16, rows: u16, stream: &str, tail_len: usize, extra: Value) -> Value {
    let mut screen = Screen::new(cols, rows);
    screen.process(stream.as_bytes());
    let repaint =
        String::from_utf8(screen.restore_bytes_within(perchd::proto::DEFAULT_REPLAY as usize))
            .expect("fixtures are plain UTF-8");
    let (cursor_row, cursor_col) = screen.cursor_position();
    let modes: serde_json::Map<String, Value> = [1, 7, 25, 1000, 1002, 1003, 1004, 1006, 2004]
        .into_iter()
        .map(|mode| (mode.to_string(), json!(screen.dec_mode(mode))))
        .collect();
    json!({
        "name": name,
        "cols": cols,
        "rows": rows,
        "tail": tail_of(stream.as_bytes(), tail_len),
        "repaint": repaint,
        "expect": {
            "alternate": screen.alternate_screen(),
            "cursor": [cursor_row, cursor_col],
            "scrollbackRows": screen.scrollback_rows(),
            "visible": screen.contents().split('\n').collect::<Vec<_>>(),
            "modes": modes,
            "extra": extra,
        },
    })
}

fn cases() -> Vec<Value> {
    // A TUI that painted once at startup and has redrawn one row ever since.
    let mut tui = String::from(
        "\x1b[?1049h\x1b[?25l\x1b[?1000h\x1b[?1006h\x1b[1;1H\x1b[1;44mHEADER\x1b[0m\x1b[20;1H> prompt\x1b[5;10H\x1b[38;5;203mred\x1b[0m",
    );
    for tick in 0..20_000 {
        tui += &format!("\x1b[30;1H\x1b[2Kstatus {tick}");
    }

    // A shell: more output than a screen, a prompt, bracketed paste on.
    let mut shell = String::from("\x1b]2;shell\x07");
    for line in 0..500 {
        shell += &format!("line {line} \x1b[3{}mcolour\x1b[0m\r\n", line % 8);
    }
    shell += "\x1b[?2004h$ ";

    // An app with mouse reporting, paste, focus and cursor keys set once.
    let input_modes =
        "\x1b[?1049h\x1b[?1000h\x1b[?1006h\x1b[?2004h\x1b[?1004h\x1b[?1h\x1b[?25l\x1b[1;1Hmenu";

    // Lines longer than the screen, one in scrollback and one on screen.
    let long: String = (0..70).map(|i| char::from(b'a' + (i % 26) as u8)).collect();
    let long_styled = format!("\x1b[31m{long}\x1b[0m");
    let mut wrapped = format!("{long}\r\n");
    for line in 0..6 {
        wrapped += &format!("{line}\r\n");
    }
    wrapped += &format!("{long_styled}\r\nend");

    vec![
        case("alternate_screen_tui", 100, 30, &tui, 8 * 1024, json!({})),
        case(
            "scrollback",
            80,
            24,
            &shell,
            2 * 1024,
            json!({ "lines": 500 }),
        ),
        case("input_modes", 100, 30, input_modes, 4096, json!({})),
        // A wide character that doesn't fit the last column wraps whole.
        case(
            "wide_character_at_a_wrap",
            10,
            4,
            "123456789世界abc\r\nafter",
            4096,
            json!({ "logical": ["123456789世界abc", "after"] }),
        ),
        // Combining marks and a text symbol with VS16 stay in one cell each.
        case(
            "grapheme_clusters",
            10,
            4,
            "e\u{301}x \u{270d}\u{fe0f}y\r\n123456\u{270d}\u{fe0f}z",
            4096,
            json!({}),
        ),
        case(
            "soft_wrapped_lines",
            20,
            5,
            &wrapped,
            4096,
            json!({ "long": long, "logical": [long, "0", "1", "2", "3", "4", "5", long, "end"] }),
        ),
    ]
}

fn fixture_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/web/src/terminalRepaint.fixtures.json")
}

#[test]
fn the_web_fixtures_are_what_the_screen_produces() {
    let path = fixture_path();
    let mut fresh = serde_json::to_string_pretty(&Value::Array(cases())).unwrap();
    fresh.push('\n');
    if std::env::var_os("PERCH_UPDATE_FIXTURES").is_some() {
        std::fs::write(&path, &fresh).unwrap();
        return;
    }
    let checked_in = std::fs::read_to_string(&path).unwrap_or_default();
    assert!(
        checked_in == fresh,
        "{} is stale; regenerate it with PERCH_UPDATE_FIXTURES=1 cargo test -p perchd --test repaint_fixtures and review the diff",
        path.display()
    );
}
