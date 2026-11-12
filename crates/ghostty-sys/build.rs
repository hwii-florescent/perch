//! Builds libghostty-vt from the `third_party/ghostty` submodule with Zig and
//! generates Rust bindings from its C headers.
//!
//! The submodule is pinned to a Ghostty commit whose build scripts only
//! compile with one Zig minor version (its `minimum_zig_version`). Newer minors
//! change the build API and fail deep inside Ghostty's `build.zig`, so this
//! script checks the version first and says what to install.

use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

/// `(major, minor, patch)` of a Zig version string such as `0.16.0` or
/// `0.16.0-dev.2471+abc123`.
fn parse_version(text: &str) -> Option<(u32, u32, u32)> {
    let core = text.trim().split(['-', '+']).next()?;
    let mut parts = core.split('.').map(|p| p.parse::<u32>());
    Some((
        parts.next()?.ok()?,
        parts.next()?.ok()?,
        parts.next()?.ok()?,
    ))
}

/// The `.minimum_zig_version = "x.y.z"` line of Ghostty's `build.zig.zon`.
fn required_zig(ghostty: &Path) -> (String, (u32, u32, u32)) {
    let manifest = ghostty.join("build.zig.zon");
    let text = std::fs::read_to_string(&manifest)
        .unwrap_or_else(|e| panic!("cannot read {}: {e}", manifest.display()));
    let version = text
        .lines()
        .find_map(|l| l.trim().strip_prefix(".minimum_zig_version"))
        .and_then(|l| l.split('"').nth(1))
        .unwrap_or_else(|| panic!("no minimum_zig_version in {}", manifest.display()));
    let parsed = parse_version(version)
        .unwrap_or_else(|| panic!("unreadable minimum_zig_version {version:?}"));
    (version.to_string(), parsed)
}

fn check_zig(zig: &str, ghostty: &Path) {
    let (required, (major, minor, patch)) = required_zig(ghostty);
    let hint = format!(
        "ghostty-sys needs Zig {major}.{minor}.x (at least {required}) to build libghostty-vt; \
         install it from https://ziglang.org/download/ and put it on PATH or set ZIG=/path/to/zig"
    );
    let output = Command::new(zig)
        .arg("version")
        .output()
        .unwrap_or_else(|e| panic!("cannot run `{zig} version`: {e}. {hint}"));
    assert!(output.status.success(), "`{zig} version` failed. {hint}");
    let found = String::from_utf8_lossy(&output.stdout).trim().to_string();
    // Ghostty's own check demands the same minor; a newer one cannot build it.
    match parse_version(&found) {
        Some((ma, mi, pa)) if ma == major && mi == minor && pa >= patch => {}
        _ => panic!("`{zig}` is Zig {found}. {hint}"),
    }
}

/// Zig compiles for the host's newest CPU unless told otherwise, which would
/// bake an instruction set into the archive that older machines lack. Name
/// the Rust target's architecture and OS instead.
fn zig_target() -> String {
    let var = |name| env::var(name).unwrap_or_default();
    let arch = match var("CARGO_CFG_TARGET_ARCH").as_str() {
        a @ ("aarch64" | "x86_64") => a.to_string(),
        other => panic!("ghostty-sys: no Zig target for architecture {other}"),
    };
    match var("CARGO_CFG_TARGET_OS").as_str() {
        "macos" => format!("{arch}-macos"),
        "linux" => match var("CARGO_CFG_TARGET_ENV").as_str() {
            "musl" => format!("{arch}-linux-musl"),
            _ => format!("{arch}-linux-gnu"),
        },
        other => panic!("ghostty-sys: no Zig target for OS {other}"),
    }
}

fn main() {
    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let ghostty = manifest.join("../../third_party/ghostty");
    assert!(
        ghostty.join("build.zig.zon").exists(),
        "third_party/ghostty is empty: run `git submodule update --init third_party/ghostty`"
    );
    let ghostty = ghostty.canonicalize().expect("third_party/ghostty path");
    let out = PathBuf::from(env::var("OUT_DIR").unwrap());
    for path in ["src", "include", "build.zig", "build.zig.zon", "pkg"] {
        println!("cargo:rerun-if-changed={}", ghostty.join(path).display());
    }
    println!("cargo:rerun-if-env-changed=ZIG");

    let zig = env::var("ZIG").unwrap_or_else(|_| "zig".into());
    check_zig(&zig, &ghostty);

    // Only the static library is wanted. Ghostty also builds its macOS
    // xcframework whenever it finds xcodebuild, which fails with only the
    // Command Line Tools installed.
    let status = Command::new(&zig)
        .current_dir(&ghostty)
        .args([
            "build",
            "-Demit-lib-vt",
            "-Demit-xcframework=false",
            "-Doptimize=ReleaseFast",
        ])
        .arg(format!("-Dtarget={}", zig_target()))
        .arg("--prefix")
        .arg(out.join("zig-out"))
        .arg("--cache-dir")
        .arg(out.join("zig-cache"))
        .status()
        .unwrap_or_else(|e| panic!("cannot run {zig}: {e}"));
    assert!(
        status.success(),
        "zig build of libghostty-vt failed: {status}"
    );

    // Put only the static archive on the search path so the linker cannot
    // pick the shared library Ghostty also installs.
    let lib = out.join("lib");
    std::fs::create_dir_all(&lib).unwrap();
    std::fs::copy(
        out.join("zig-out/lib/libghostty-vt.a"),
        lib.join("libghostty-vt.a"),
    )
    .expect("libghostty-vt.a missing from the zig build output");
    println!("cargo:rustc-link-search=native={}", lib.display());
    println!("cargo:rustc-link-lib=static=ghostty-vt");

    let include = ghostty.join("include");
    let mut bindings = bindgen::Builder::default()
        .header(include.join("ghostty/vt.h").to_string_lossy())
        .clang_arg(format!("-I{}", include.display()));
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        // libclang finds its own builtin headers but needs the SDK for libc's.
        if let Ok(sdk) = Command::new("xcrun").arg("--show-sdk-path").output() {
            let sdk = String::from_utf8_lossy(&sdk.stdout);
            bindings = bindings.clang_arg(format!("-isysroot{}", sdk.trim()));
        }
    }
    bindings
        .allowlist_function("ghostty_.*")
        .allowlist_type("Ghostty.*")
        .allowlist_var("GHOSTTY_.*")
        .prepend_enum_name(false)
        .derive_default(true)
        .layout_tests(false)
        .generate()
        .expect("bindgen failed on ghostty/vt.h")
        .write_to_file(out.join("bindings.rs"))
        .expect("writing bindings.rs");
}
