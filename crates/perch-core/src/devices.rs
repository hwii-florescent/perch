//! Paired-device store and pairing codes (`~/.perch/devices.json`).
//!
//! perch binds `0.0.0.0`, so on a devpod or a home LAN anything that can reach
//! the port can drive real agents on the machine. Pairing is the gate: a phone
//! gets a long random token, the host keeps only its SHA-256, and every WS/
//! upload request from a non-loopback address must present one.
//!
//! Three deliberate choices:
//!
//! * **Tokens are never stored in the clear.** A stolen `devices.json` cannot
//!   be replayed; revoking is deleting a row.
//! * **A pairing code is one-shot, short-lived and rate-limited in memory.**
//!   It never touches disk, so a code cannot outlive the process that showed
//!   it, and a brute-force attempt burns the code rather than the clock.
//! * **Loopback is always allowed** (see `server::mod`), so the desktop shell
//!   and local development never need a token and this file stays empty until
//!   someone actually pairs a phone.
//!
//! On-disk shape (camelCase, like the other stores):
//! ```json
//! { "devices": [ { "id": "uuid", "name": "phone",
//!                  "tokenHash": "<sha256 hex>",
//!                  "createdAt": 0, "lastSeenAt": 0 } ] }
//! ```

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

/// How long a pairing code stays valid. Long enough to walk to the phone,
/// short enough that a code left on screen is not a standing invitation.
pub const CODE_TTL: Duration = Duration::from_secs(5 * 60);
/// Wrong guesses before the code is burned. The code is 8 characters from a
/// 32-symbol alphabet (40 bits), so this is belt and braces.
const MAX_ATTEMPTS: u8 = 5;
/// Excludes I, L, O, U and digits that look like them: a pairing code is read
/// off one screen and typed into another.
const ALPHABET: &[u8] = b"23456789ABCDEFGHJKMNPQRSTVWXYZ";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase")]
pub struct DeviceRecord {
    pub id: String,
    pub name: String,
    /// SHA-256 of the bearer token, hex. The token itself is shown once, to
    /// the device that paired.
    pub token_hash: String,
    pub created_at: i64,
    pub last_seen_at: i64,
}

impl Default for DeviceRecord {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: String::new(),
            token_hash: String::new(),
            created_at: 0,
            last_seen_at: 0,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct DevicesConfig {
    pub devices: Vec<DeviceRecord>,
}

struct PendingCode {
    code: String,
    issued: Instant,
    attempts: u8,
}

pub struct DeviceStore {
    path: PathBuf,
    inner: Mutex<DevicesConfig>,
    /// At most one code is offered at a time: a second "Pair a device" click
    /// replaces the first, so an abandoned code cannot stay usable.
    pending: Mutex<Option<PendingCode>>,
}

/// What a successful claim hands back to the device.
pub struct PairedDevice {
    pub record: DeviceRecord,
    pub token: String,
}

impl DeviceStore {
    pub fn load(path: impl Into<PathBuf>) -> Self {
        let path = path.into();
        let inner = Self::read_from_disk(&path).unwrap_or_default();
        Self {
            path,
            inner: Mutex::new(inner),
            pending: Mutex::new(None),
        }
    }

    pub fn load_default() -> Self {
        let path = default_devices_path().unwrap_or_else(|| PathBuf::from(".perch/devices.json"));
        Self::load(path)
    }

    fn read_from_disk(path: &Path) -> Option<DevicesConfig> {
        let text = std::fs::read_to_string(path).ok()?;
        match serde_json::from_str::<DevicesConfig>(&text) {
            Ok(config) => Some(config),
            Err(error) => {
                tracing::warn!("~/.perch/devices.json parse error (using empty): {error}");
                None
            }
        }
    }

    pub fn list(&self) -> Vec<DeviceRecord> {
        self.inner.lock().unwrap().devices.clone()
    }

    /// Issue (or replace) the pairing code a device must present.
    pub fn start_pairing(&self, now: Instant) -> String {
        let code = random_code();
        *self.pending.lock().unwrap() = Some(PendingCode {
            code: code.clone(),
            issued: now,
            attempts: 0,
        });
        code
    }

    pub fn cancel_pairing(&self) {
        *self.pending.lock().unwrap() = None;
    }

    /// Whether a code is currently on offer, and how long it has left.
    pub fn pairing_remaining(&self, now: Instant) -> Option<Duration> {
        let pending = self.pending.lock().unwrap();
        let pending = pending.as_ref()?;
        CODE_TTL.checked_sub(now.duration_since(pending.issued))
    }

    /// Exchange a pairing code for a device token. The code is consumed on
    /// success and burned after `MAX_ATTEMPTS` failures; an expired code is
    /// indistinguishable from a wrong one to the caller.
    pub fn claim(
        &self,
        code: &str,
        name: &str,
        now: Instant,
        now_ms: i64,
    ) -> anyhow::Result<PairedDevice> {
        {
            let mut pending = self.pending.lock().unwrap();
            let Some(current) = pending.as_mut() else {
                anyhow::bail!("no pairing is in progress");
            };
            if now.duration_since(current.issued) > CODE_TTL {
                *pending = None;
                anyhow::bail!("that pairing code has expired");
            }
            // Compared case-insensitively because the code is typed by hand;
            // the entropy is in the 40 bits, not in the letter case.
            if !code.trim().eq_ignore_ascii_case(&current.code) {
                current.attempts += 1;
                if current.attempts >= MAX_ATTEMPTS {
                    *pending = None;
                }
                anyhow::bail!("that pairing code is not valid");
            }
            *pending = None;
        }
        let token = random_token();
        let record = DeviceRecord {
            id: Uuid::new_v4().to_string(),
            name: sanitize_name(name),
            token_hash: hash_token(&token),
            created_at: now_ms,
            last_seen_at: now_ms,
        };
        let snapshot = {
            let mut guard = self.inner.lock().unwrap();
            guard.devices.push(record.clone());
            guard.devices.clone()
        };
        self.write_to_disk(&snapshot)?;
        Ok(PairedDevice { record, token })
    }

    /// Resolve a bearer token to its device, refreshing `last_seen_at`.
    /// Comparison is over the stored hashes, so an unknown token costs the
    /// same work as a known one.
    pub fn authenticate(&self, token: &str, now_ms: i64) -> Option<DeviceRecord> {
        let hash = hash_token(token);
        let (record, snapshot) = {
            let mut guard = self.inner.lock().unwrap();
            let device = guard
                .devices
                .iter_mut()
                .find(|device| device.token_hash == hash)?;
            device.last_seen_at = now_ms;
            (device.clone(), guard.devices.clone())
        };
        // A failed write only loses a timestamp; the device stays paired.
        if let Err(error) = self.write_to_disk(&snapshot) {
            tracing::warn!(%error, "could not persist device last-seen time");
        }
        Some(record)
    }

    pub fn revoke(&self, id: &str) -> anyhow::Result<Vec<DeviceRecord>> {
        let snapshot = {
            let mut guard = self.inner.lock().unwrap();
            guard.devices.retain(|device| device.id != id);
            guard.devices.clone()
        };
        self.write_to_disk(&snapshot)?;
        Ok(snapshot)
    }

    fn write_to_disk(&self, devices: &[DeviceRecord]) -> anyhow::Result<()> {
        let config = DevicesConfig {
            devices: devices.to_vec(),
        };
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let tmp_path = self.path.with_extension("json.tmp");
        std::fs::write(&tmp_path, serde_json::to_string_pretty(&config)?)?;
        std::fs::rename(&tmp_path, &self.path)?;
        Ok(())
    }
}

fn sanitize_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|character| !character.is_control())
        .take(64)
        .collect();
    let cleaned = cleaned.trim().to_string();
    if cleaned.is_empty() {
        "Paired device".to_string()
    } else {
        cleaned
    }
}

pub fn hash_token(token: &str) -> String {
    Sha256::digest(token.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// 8 characters of CSPRNG randomness. `Uuid::new_v4` is backed by the OS
/// generator, which is the same source a dedicated rand dependency would use.
fn random_code() -> String {
    Uuid::new_v4()
        .as_bytes()
        .iter()
        .take(8)
        .map(|byte| ALPHABET[usize::from(*byte) % ALPHABET.len()] as char)
        .collect()
}

/// 244 bits, hex. Two v4 UUIDs rather than a new dependency for one call.
fn random_token() -> String {
    format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple())
}

pub fn default_devices_path() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".perch/devices.json"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> DeviceStore {
        let dir = std::env::temp_dir().join(format!("perch-devices-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        DeviceStore::load(dir.join("devices.json"))
    }

    /// The whole point of the gate: a token works until it is revoked, a wrong
    /// code never yields one, a code is single-use, and nothing on disk can be
    /// replayed as a token.
    #[test]
    fn pairing_issues_one_token_per_code_and_revoking_ends_access() {
        let store = store();
        let now = Instant::now();
        assert!(
            store.claim("ABCD2345", "phone", now, 1).is_err(),
            "no code issued yet"
        );

        let code = store.start_pairing(now);
        assert!(store.claim("WRONGCOD", "phone", now, 1).is_err());
        let paired = store
            .claim(&code.to_lowercase(), "  My Phone  ", now, 2)
            .unwrap();
        assert_eq!(paired.record.name, "My Phone");
        assert_eq!(
            store
                .claim(&code, "second", now, 3)
                .err()
                .map(|error| error.to_string()),
            Some("no pairing is in progress".to_string()),
            "a code is single use"
        );

        assert_eq!(
            store.authenticate(&paired.token, 4).map(|device| device.id),
            Some(paired.record.id.clone())
        );
        assert!(store.authenticate("not-a-token", 5).is_none());
        assert!(
            !std::fs::read_to_string(&store.path)
                .unwrap()
                .contains(&paired.token),
            "the raw token must never reach disk"
        );

        store.revoke(&paired.record.id).unwrap();
        assert!(
            store.authenticate(&paired.token, 6).is_none(),
            "revoked tokens stop working"
        );
    }

    #[test]
    fn a_code_expires_and_burns_after_repeated_guesses() {
        let store = store();
        let now = Instant::now();
        let code = store.start_pairing(now);
        let expired = now + CODE_TTL + Duration::from_secs(1);
        assert!(store.claim(&code, "phone", expired, 1).is_err(), "expired");
        assert!(store.pairing_remaining(expired).is_none());

        let code = store.start_pairing(now);
        for _ in 0..MAX_ATTEMPTS {
            assert!(store.claim("22222222", "phone", now, 1).is_err());
        }
        assert!(
            store.claim(&code, "phone", now, 1).is_err(),
            "burned after repeated guesses"
        );
    }
}
