//! Odd terminal output, sizes and repaints never panic the daemon's screen.
//!
//! The screen is used under a session's lock, so a panic there once poisoned
//! the lock and wedged every later request. Seeded and deterministic; raise
//! `PERCHD_FUZZ_SEEDS` (default 60) for a longer run.

use perchd::screen::Screen;
use std::panic::{catch_unwind, AssertUnwindSafe};

/// xorshift64: reproducible from the seed a failure names.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn below(&mut self, n: u64) -> u64 {
        self.next() % n.max(1)
    }
}

/// Fragments that steer the parser into its corners: unfinished sequences and
/// characters, mode switches, size reports, huge parameters, wide and
/// combining text, scroll regions, images.
const PIECES: &[&[u8]] = &[
    b"\x1b[",
    b"\x1b]",
    b"\x1bP",
    b"\x07",
    b"\x1b\\",
    b";",
    b"?",
    b"h",
    b"l",
    b"m",
    b"H",
    b"J",
    b"K",
    b"r",
    b"t",
    b"u",
    b"\x1b[?1049h",
    b"\x1b[?1049l",
    b"\x1b[?47h",
    b"\x1b[?7l",
    b"\x1b[?2026h",
    b"\x1b[>1u",
    b"\x1b[<u",
    b"\x1b[=5;1u",
    b"\x1b[8;",
    b"999",
    b"0",
    b"65535",
    b"4294967296",
    b"\r\n",
    b"\n",
    b"\r",
    b"\t",
    b"\x08",
    "中".as_bytes(),
    "😀".as_bytes(),
    "\u{200d}".as_bytes(),
    "\u{301}".as_bytes(),
    b"\xf0",
    b"\x80",
    b"\xff",
    b"x",
    b"long text that wraps around the screen ",
    b"\x1b[7m",
    b"\x1b[48;5;238m",
    b"\x1b]8;;http://a\x1b\\",
    b"\x1b]0;title\x07",
    b"\x1b[2X",
    b"\x1b[@",
    b"\x1b[L",
    b"\x1b[M",
    b"\x1b[S",
    b"\x1b[T",
    b"\x1bc",
    b"\x1b#8",
    b"\x1b[3;5r",
    b"\x1b[?6h",
    b"\x1b[?69h",
    b"\x1b[2;10s",
    b"\x1b_Gf=24;AAAA\x1b\\",
    b"\x1b[b",
    b"\x1b[1000b",
    b"\x1b[200~",
    b"\x1b[?1h",
];

fn exercise(seed: u64) {
    let mut rng = Rng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1);
    let dims = [0u16, 1, 2, 3, 5, 80, 200, 1000, u16::MAX];
    let mut screen = Screen::new(
        dims[rng.below(dims.len() as u64) as usize],
        dims[rng.below(dims.len() as u64) as usize],
    )
    .expect("a screen");
    for _ in 0..200 {
        match rng.below(20) {
            0 => screen.set_size(rng.below(300) as u16, rng.below(100) as u16),
            1 => {
                let _ = screen.restore_bytes_within(rng.below(200_000) as usize);
            }
            2 => {
                let _ = (
                    screen.contents(),
                    screen.title(),
                    screen.cursor_position(),
                    screen.alternate_screen(),
                );
            }
            _ => {
                let mut bytes = Vec::new();
                for _ in 0..rng.below(30) {
                    if rng.below(4) == 0 {
                        bytes.push(rng.next() as u8);
                    } else {
                        bytes.extend_from_slice(PIECES[rng.below(PIECES.len() as u64) as usize]);
                    }
                }
                // Split anywhere, as PTY reads do.
                let cut = rng.below(bytes.len() as u64 + 1) as usize;
                screen.process(&bytes[..cut]);
                screen.process(&bytes[cut..]);
            }
        }
    }
    let _ = screen.restore_bytes_within(1 << 20);
}

#[test]
fn odd_output_sizes_and_repaints_never_panic() {
    let seeds: u64 = std::env::var("PERCHD_FUZZ_SEEDS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(60);
    let failed: Vec<u64> = (1..=seeds)
        .filter(|&seed| catch_unwind(AssertUnwindSafe(|| exercise(seed))).is_err())
        .collect();
    assert!(failed.is_empty(), "panicking seeds: {failed:?}");
}
