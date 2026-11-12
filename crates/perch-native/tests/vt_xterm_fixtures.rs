//! The same recorded stress output fed to the two emulators a Perch session can be shown by, for
//! `packages/web/src/terminalVtParity.test.ts` to compare cell by cell.
//!
//! Each case is a byte stream (256 and true colour, styles, box drawing, CJK and emoji, scrollback,
//! an alternate-screen program, cursor and region control, a kitty image). It goes through
//! - the native client's `Vt`, directly, and again as the server's repaint (`Screen` ->
//!   `restore_bytes_within`, which is what an attach sends), and
//! - nothing else here: the test beside the fixture feeds the stream and the repaint to the xterm.js
//!   the web and phone clients run.
//!
//! The grids are written to `packages/web/src/terminalVtParity.fixtures.json`. This test fails when the
//! checked-in file no longer matches what the engines produce. Regenerate it with
//! `PERCH_UPDATE_FIXTURES=1 cargo test -p perch-native --test vt_xterm_fixtures` and review the diff.

use perch_native::terminal::graphics::install_png_decoder;
use perch_native::terminal::vt::{Cell, Rgb, Vt};
use perchd::screen::Screen;
use serde_json::{json, Value};
use std::path::PathBuf;

const COLS: u16 = 100;
const ROWS: u16 = 30;

fn hex(c: Rgb) -> String {
    format!("{:02x}{:02x}{:02x}", c.0, c.1, c.2)
}

fn flags(cell: &Cell) -> u32 {
    u32::from(cell.bold)
        | u32::from(cell.italic) << 1
        | u32::from(cell.faint) << 2
        | u32::from(cell.underline) << 3
        | u32::from(cell.strike) << 4
}

/// Between the cells of a row's `c`; a private-use character, so no cell's text contains it.
const CELL_SEPARATOR: &str = "\u{e000}";

/// One row as `{c: cells joined by CELL_SEPARATOR, a: attribute runs}`. A cell is its text: a blank is
/// " ", the tail of a wide character is "", and trailing blanks without a background are left out. A run is
/// `[column, fg, bg, flags]` and holds until the next one; a blank cell has no foreground.
fn row(cells: &[Cell]) -> Value {
    let mut tail = false;
    let mut text: Vec<String> = Vec::with_capacity(cells.len());
    for cell in cells {
        text.push(if tail {
            String::new()
        } else if cell.text.is_empty() {
            " ".into()
        } else {
            cell.text.clone()
        });
        tail = cell.wide;
    }
    let mut end = cells.len();
    while end > 0 && text[end - 1] == " " && cells[end - 1].bg.is_none() {
        end -= 1;
    }
    text.truncate(end);
    let mut runs: Vec<Value> = Vec::new();
    let mut last: Option<(String, String, u32)> = None;
    for (x, cell) in cells[..end].iter().enumerate() {
        let blank = text[x] == " ";
        let key = (
            if blank { String::new() } else { hex(cell.fg) },
            cell.bg.map(hex).unwrap_or_default(),
            flags(cell),
        );
        if last.as_ref() != Some(&key) {
            runs.push(json!([x, key.0, key.1, key.2]));
            last = Some(key);
        }
    }
    json!({ "c": text.join(CELL_SEPARATOR), "a": runs })
}

/// Everything the emulator holds, oldest line first: history, then the screen.
fn dump(vt: &mut Vt) -> Value {
    let alt = vt.alt_screen();
    let bar = vt.scrollbar();
    let (total, len) = (bar.total as usize, (bar.len as usize).max(1));
    let mut rows: Vec<Value> = Vec::with_capacity(total);
    let mut at = 0;
    while at < total {
        let start = at.min(total.saturating_sub(len));
        vt.scroll_to_row(start);
        let frame = vt.frame();
        for cells in frame.rows.iter().skip(at - start) {
            if rows.len() < total {
                rows.push(row(cells));
            }
        }
        at = start + len;
    }
    vt.scroll_to_bottom();
    let frame = vt.frame();
    let placements: Vec<Value> = vt
        .placements()
        .iter()
        .map(|p| json!({ "col": p.col, "row": p.row, "width": p.width, "height": p.height }))
        .collect();
    json!({
        "alternate": alt,
        "defaultFg": hex(frame.fg),
        "defaultBg": hex(frame.bg),
        "cursor": frame.cursor.map(|c| json!([c.y, c.x])),
        "history": total.saturating_sub(len),
        "rows": rows,
        "images": placements,
    })
}

fn case(name: &str, stream: &str) -> Value {
    let mut vt = Vt::new(COLS, ROWS);
    vt.write(stream.as_bytes());
    let from_stream = dump(&mut vt);

    let mut screen = Screen::new(COLS, ROWS);
    screen.process(stream.as_bytes());
    let repaint =
        String::from_utf8(screen.restore_bytes_within(perchd::proto::DEFAULT_REPLAY as usize))
            .expect("fixtures are plain UTF-8");
    let mut replayed = Vt::new(COLS, ROWS);
    replayed.write(repaint.as_bytes());
    let from_repaint = dump(&mut replayed);

    json!({
        "name": name,
        "cols": COLS,
        "rows": ROWS,
        "stream": stream,
        "repaint": repaint,
        // `null`: the repaint left the same screen as the stream did.
        "native": { "stream": from_stream, "repaint": if from_repaint == from_stream { Value::Null } else { from_repaint } },
    })
}

fn colours_and_styles() -> String {
    let mut s = String::from("\x1b[2J\x1b[H256 colours, background:\r\n");
    for row in 0..16 {
        for col in 0..16 {
            s += &format!("\x1b[48;5;{}m  ", row * 16 + col);
        }
        s += "\x1b[0m\r\n";
    }
    s += "256 colours, foreground:\r\n";
    for n in 0..256 {
        s += &format!("\x1b[38;5;{n}m#");
    }
    s += "\x1b[0m\r\ntrue colour:\r\n";
    for i in 0..64 {
        s += &format!("\x1b[48;2;{};{};{}m ", i * 4, 255 - i * 4, 128);
    }
    s += "\x1b[0m\r\n";
    for i in 0..64 {
        s += &format!("\x1b[38;2;{};{};{}m*", 255 - i * 4, i * 4, 90);
    }
    s += "\x1b[0m\r\nthe 16: ";
    for n in (30..=37).chain(90..=97) {
        s += &format!("\x1b[{n}m{n} ");
    }
    s += "\x1b[0m\r\n";
    for n in (40..=47).chain(100..=107) {
        s += &format!("\x1b[{n}m{n}\x1b[0m ");
    }
    s += "\r\nstyles: \x1b[1mbold\x1b[0m \x1b[2mdim\x1b[0m \x1b[3mitalic\x1b[0m \x1b[4munderline\x1b[0m \x1b[4:3mcurly\x1b[0m \
          \x1b[9mstrike\x1b[0m \x1b[7minverse\x1b[0m \x1b[8mhidden\x1b[0m \x1b[5mblink\x1b[0m \x1b[53moverline\x1b[0m\r\n";
    s += "combined: \x1b[1;3;4;38;2;250;100;50;48;5;17m bold italic underline orange on navy \x1b[0m \
          \x1b[7;31mreverse red\x1b[0m \x1b[1;38;5;196;48;5;21m bold 196 on 21 \x1b[0m\r\n";
    s += "inverse with defaults: \x1b[7m default fg and bg swapped \x1b[0m \x1b[7;48;5;22m on green \x1b[0m\r\n";
    s += "coloured underline: \x1b[4;58;2;255;0;0munderline red\x1b[0m end\r\n";
    s
}

fn box_drawing_and_symbols() -> String {
    let mut s = String::from("\x1b[2J\x1b[H");
    s += "┌──────────┬──────────┐\r\n│ light    │ box      │\r\n├──────────┼──────────┤\r\n└──────────┴──────────┘\r\n";
    s += "╔══════════╦══════════╗\r\n║ double   ║ box      ║\r\n╚══════════╩══════════╝\r\n";
    s += "╭──────╮ ╭──╮ ┏━━━━┓ ┃heavy┃ ┗━━━━┛\r\n╰──────╯ ╰──╯\r\n";
    s += "blocks: ▀▄█▌▐░▒▓ ▁▂▃▄▅▆▇█ ▏▎▍▌▋▊▉ ▖▗▘▙▚▛▜▝▞▟\r\n";
    s += "braille: ⠁⠃⠇⡇⣇⣧⣷⣿ ⢀⣀⣄⣤⣴⣶⣾\r\n";
    s += "powerline: \u{e0b0}\u{e0b1}\u{e0b2}\u{e0b3} \u{e0a0} \u{e0b4}\u{e0b6}\r\n";
    s += "arrows and maths: ←↑→↓↔↕ ∀∃∈∑∏√∞≈≠≤≥ ⟨⟩ ✓✗★☆♠♣♥♦\r\n";
    s += "\x1b[1;38;5;81m┏━━━━━━━━┓\x1b[0m \x1b[48;5;236m\x1b[38;5;220m▐▌ colour box ▐▌\x1b[0m\r\n";
    s
}

fn cjk_and_emoji() -> String {
    let mut s = String::from("\x1b[2J\x1b[H");
    s += "japanese: 日本語のテキスト、ひらがな カタカナ\r\n";
    s += "korean: 한국어 텍스트 \u{1100}\u{1161}\u{11a8}\r\n";
    s += "chinese: 中文文本，繁體字\r\n";
    s += "fullwidth: ＡＢＣ１２３ ｆｕｌｌ\r\n";
    s += "halfwidth kana: ｱｲｳｴｵ\r\n";
    s += "emoji: 😀 🎉 🚀 ✅ ❌ ⭐ 🔥\r\n";
    s += "zwj: 👨\u{200d}👩\u{200d}👧 👩\u{200d}💻 🏳\u{fe0f}\u{200d}🌈\r\n";
    s += "flags: 🇯🇵 🇺🇸 🇫🇷\r\n";
    s += "vs16 and keycaps: ❤\u{fe0f} ☺\u{fe0f} 1\u{fe0f}\u{20e3} #\u{fe0f}\u{20e3}\r\n";
    s += "skin tone: 👍🏽 👋🏿\r\n";
    s += "combining: e\u{301} a\u{308} n\u{303} \u{1e9b}\u{323} ก\u{e49}\u{e32}\r\n";
    s += "ambiguous: ±×÷°·§¶ αβγ ΩЖ\r\n";
    s += "arabic and hebrew: مرحبا שלום\r\n";
    s += "tabs:\ta\tb\tc\r\n";
    // A wide character that does not fit the last column wraps whole.
    s += &format!("{}世界\r\n", "x".repeat(COLS as usize - 1));
    s += &format!("{}😀e\u{301}\r\n", "y".repeat(COLS as usize - 1));
    s += "after\x1b[2;1H\x1b[0K\x1b[4;12H\x1b[2X";
    s
}

fn scrollback() -> String {
    let mut s = String::from("\x1b]2;shell\x07");
    for line in 0..600 {
        s += &format!(
            "line {line:03} \x1b[3{}mcolour\x1b[0m \x1b[1m日本\x1b[0m {}\r\n",
            line % 8,
            "·".repeat(line % 40)
        );
    }
    s += "\x1b[?2004h$ ";
    s
}

fn alternate_screen_tui() -> String {
    let mut s = String::from("before the program\r\nsecond line\r\n");
    s += "\x1b[?1049h\x1b[?25l\x1b[?1000h\x1b[?1006h\x1b[2J\x1b[H";
    s += "\x1b[1;44m  header: a full-screen program  \x1b[0m";
    for row in 3..28 {
        s += &format!(
            "\x1b[{row};1H\x1b[38;5;{}m│\x1b[0m item {row:02} \x1b[48;5;{}m  \x1b[0m",
            30 + row,
            232 + row % 24
        );
    }
    s += "\x1b[5;20H┌──────────────┐\x1b[6;20H│ 日本語 popup │\x1b[7;20H└──────────────┘";
    s += "\x1b[30;1H\x1b[7m status: 28 items \x1b[0m\x1b[5;22H";
    s
}

fn kitty_image() -> String {
    // A kitty image (raw pixels: red, green, blue, white) over 4x2 cells, between text.
    let mut s = String::from("\x1b[2J\x1b[Hbefore the image\r\n");
    s += "\x1b_Ga=T,f=32,s=2,v=2,i=1,c=4,r=2,C=1,q=2;/wAA/wD/AP8AAP///////w==\x1b\\";
    s += "\x1b[5;1Hafter the image\r\n";
    s
}

fn cursor_and_regions() -> String {
    let mut s = String::from("\x1b[2J\x1b[H");
    for line in 0..30 {
        s += &format!("\x1b[{};1Hrow {line:02} {}", line + 1, "=".repeat(60));
    }
    // A scroll region with output scrolling inside it, a reverse index at its top.
    s += "\x1b[5;12r\x1b[12;1H";
    for line in 0..6 {
        s += &format!("\r\nscrolled {line}");
    }
    s += "\x1b[5;1H\x1bM\x1bMreverse indexed\x1b[r";
    // Insert and delete characters and lines, erase, save and restore the cursor.
    s += "\x1b[20;10H\x1b[3@ins\x1b[3P\x1b[2L\x1b[1M\x1b7\x1b[25;1Hsaved\x1b8!";
    s += "\x1b[28;1H\x1b[1K\x1b[29;1H\x1b[2K\x1b[30;50Hbottom right";
    // A long soft-wrapped line and tab stops.
    s += &format!("\x1b[10;1H{}\r\n", "wrapped ".repeat(30));
    s += "\x1b[12;1H\x1b[3g\x1b[1;10H\x1bH\x1b[12;1H\tx\t\ty";
    s
}

/// What the native client draws for palette entries 0-15 (the theme's, not xterm's).
fn palette16() -> Vec<String> {
    let mut vt = Vt::new(COLS, ROWS);
    let probe: String = (0..16).map(|n| format!("\x1b[38;5;{n}mx")).collect();
    vt.write(probe.as_bytes());
    let frame = vt.frame();
    frame.rows[0].iter().take(16).map(|c| hex(c.fg)).collect()
}

fn cases() -> Vec<Value> {
    install_png_decoder();
    vec![
        case("colours_and_styles", &colours_and_styles()),
        case("box_drawing_and_symbols", &box_drawing_and_symbols()),
        case("cjk_and_emoji", &cjk_and_emoji()),
        case("scrollback", &scrollback()),
        case("alternate_screen_tui", &alternate_screen_tui()),
        case("kitty_image", &kitty_image()),
        case("cursor_and_regions", &cursor_and_regions()),
    ]
}

fn fixture_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/web/src/terminalVtParity.fixtures.json")
}

#[test]
fn the_web_fixtures_are_what_the_engines_produce() {
    let path = fixture_path();
    let fresh = json!({ "palette16": palette16(), "cases": cases() });
    if std::env::var_os("PERCH_UPDATE_FIXTURES").is_some() {
        let mut text = serde_json::to_string(&fresh).unwrap();
        text.push('\n');
        std::fs::write(&path, text).unwrap();
        return;
    }
    // Compared as values: key order depends on which crates share the build.
    let checked_in: Value = std::fs::read_to_string(&path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or(Value::Null);
    assert!(
        checked_in == fresh,
        "{} is stale; regenerate it with PERCH_UPDATE_FIXTURES=1 cargo test -p perch-native --test vt_xterm_fixtures and review the diff",
        path.display()
    );
}

#[test]
fn the_native_grid_holds_what_was_written() {
    install_png_decoder();
    let mut vt = Vt::new(COLS, ROWS);
    vt.write(cjk_and_emoji().as_bytes());
    let dumped = dump(&mut vt);
    let cells = |row: &Value| -> Vec<String> {
        row["c"]
            .as_str()
            .unwrap()
            .split(CELL_SEPARATOR)
            .map(String::from)
            .collect()
    };
    let rows = dumped["rows"].as_array().unwrap();
    assert_eq!(
        cells(&rows[0])[0],
        "j",
        "the first row starts with its first character"
    );
    // The wide character that did not fit the last column wrapped whole.
    let wrapped = rows
        .iter()
        .position(|r| cells(r).iter().any(|x| x == "世"))
        .expect("the wide character is on a row");
    let wide = cells(&rows[wrapped]);
    assert_eq!(wide[0], "世");
    assert_eq!(wide[1], "", "its tail cell is empty");
}
