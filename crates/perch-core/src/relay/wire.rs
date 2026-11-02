//! What the relay's two ends say to each other, and how it is sealed.
//!
//! The relay only forwards opaque binary frames between this computer (the
//! host) and each phone (a guest). Everything else here is end to end:
//!
//! * **Key**: 32 random bytes made on this computer and carried to the phone in
//!   the link's `#fragment`, which a browser never sends anywhere.
//! * **Seal**: AES-256-GCM, a random 12-byte IV in front of the ciphertext.
//! * **Session**: guest and host each contribute a fresh 16-byte nonce in a
//!   hello exchange. Every later frame's AAD binds both nonces, the direction
//!   and a per-direction counter, so the relay can neither replay a frame into
//!   another session nor drop, reorder or reflect one without the next open
//!   failing (which ends the session).
//!
//! `packages/web/src/relay/` is the other end; `wire.fixture.json` pins both to
//! the same bytes.

use aes_gcm::aead::{Aead, OsRng, Payload};
use aes_gcm::{AeadCore, Aes256Gcm, Key, KeyInit, Nonce};

pub const KEY_LEN: usize = 32;
pub const NONCE_LEN: usize = 16;
const IV_LEN: usize = 12;

pub const HELLO_GUEST: u8 = 0x10;
pub const HELLO_HOST: u8 = 0x11;
pub const REQ_HEAD: u8 = 1;
pub const REQ_BODY: u8 = 2;
pub const REQ_END: u8 = 3;
pub const RES_HEAD: u8 = 4;
pub const RES_BODY: u8 = 5;
pub const RES_END: u8 = 6;
pub const WS_OPEN: u8 = 7;
pub const WS_OPENED: u8 = 8;
pub const WS_TEXT: u8 = 9;
pub const WS_BIN: u8 = 10;
pub const WS_CLOSE: u8 = 11;

/// Relay → host: a frame from guest `gid` follows / guest `gid` left.
pub const ENV_DATA: u8 = 0;
pub const ENV_LEFT: u8 = 2;

pub type Key32 = [u8; KEY_LEN];
pub type Nonce16 = [u8; NONCE_LEN];

pub fn random_bytes<const N: usize>() -> [u8; N] {
    use aes_gcm::aead::rand_core::RngCore;
    let mut out = [0u8; N];
    OsRng.fill_bytes(&mut out);
    out
}

fn seal_with_iv(key: &Key32, iv: [u8; IV_LEN], aad: &[u8], plaintext: &[u8]) -> Vec<u8> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let mut out = iv.to_vec();
    out.extend(
        cipher
            .encrypt(
                Nonce::from_slice(&iv),
                Payload {
                    msg: plaintext,
                    aad,
                },
            )
            // Only fails past 2^36 bytes; a frame is capped far below that.
            .expect("AES-GCM seal"),
    );
    out
}

pub fn seal(key: &Key32, aad: &[u8], plaintext: &[u8]) -> Vec<u8> {
    let iv: [u8; IV_LEN] = Aes256Gcm::generate_nonce(&mut OsRng).into();
    seal_with_iv(key, iv, aad, plaintext)
}

pub fn open(key: &Key32, aad: &[u8], sealed: &[u8]) -> Option<Vec<u8>> {
    if sealed.len() < IV_LEN + 16 {
        return None;
    }
    let (iv, body) = sealed.split_at(IV_LEN);
    Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key))
        .decrypt(Nonce::from_slice(iv), Payload { msg: body, aad })
        .ok()
}

/// AAD of the two hello frames. The host's binds the guest's nonce so a
/// replayed answer cannot be accepted by a later guest.
pub fn hello_aad(from_host: bool, guest_nonce: Option<&Nonce16>) -> Vec<u8> {
    let mut aad = if from_host {
        b"perch-relay-v1/hello-host".to_vec()
    } else {
        b"perch-relay-v1/hello-guest".to_vec()
    };
    if let Some(nonce) = guest_nonce {
        aad.extend_from_slice(nonce);
    }
    aad
}

/// AAD of one data frame. `from_host` is the direction; `counter` counts the
/// frames already sent that way in this session.
pub fn data_aad(guest: &Nonce16, host: &Nonce16, from_host: bool, counter: u64) -> Vec<u8> {
    let mut aad = b"perch-relay-v1/data".to_vec();
    aad.extend_from_slice(guest);
    aad.extend_from_slice(host);
    aad.push(u8::from(from_host));
    aad.extend_from_slice(&counter.to_be_bytes());
    aad
}

/// `[kind][id u32 BE][payload]`, the plaintext inside every seal.
pub fn frame(kind: u8, id: u32, payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(5 + payload.len());
    out.push(kind);
    out.extend_from_slice(&id.to_be_bytes());
    out.extend_from_slice(payload);
    out
}

pub fn parse_frame(plain: &[u8]) -> Option<(u8, u32, &[u8])> {
    let (head, payload) = plain.split_at_checked(5)?;
    Some((
        head[0],
        u32::from_be_bytes(head[1..5].try_into().ok()?),
        payload,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("wire.fixture.json");

    fn hex(s: &str) -> Vec<u8> {
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
            .collect()
    }

    /// The same vector `packages/web/src/relay/wire.test.ts` opens: a change to
    /// either end that the other does not follow fails both suites.
    #[test]
    fn seals_to_the_bytes_the_browser_expects() {
        let v: serde_json::Value = serde_json::from_str(FIXTURE).unwrap();
        let key: Key32 = hex(v["key"].as_str().unwrap()).try_into().unwrap();
        let gn: Nonce16 = hex(v["guestNonce"].as_str().unwrap()).try_into().unwrap();
        let hn: Nonce16 = hex(v["hostNonce"].as_str().unwrap()).try_into().unwrap();
        let iv: [u8; IV_LEN] = hex(v["iv"].as_str().unwrap()).try_into().unwrap();
        let plain = frame(REQ_HEAD, 7, b"{\"method\":\"GET\"}");
        let aad = data_aad(&gn, &hn, false, 3);
        let sealed = seal_with_iv(&key, iv, &aad, &plain);
        assert_eq!(hex(v["sealed"].as_str().unwrap()), sealed);
        assert_eq!(open(&key, &aad, &sealed).unwrap(), plain);
    }

    #[test]
    fn any_change_to_the_session_context_fails_the_open() {
        let key = random_bytes::<KEY_LEN>();
        let (gn, hn) = (random_bytes::<NONCE_LEN>(), random_bytes::<NONCE_LEN>());
        let sealed = seal(&key, &data_aad(&gn, &hn, false, 0), b"hi");
        assert!(open(&key, &data_aad(&gn, &hn, false, 0), &sealed).is_some());
        // Replayed later in the stream, reflected back, or into another session.
        assert!(open(&key, &data_aad(&gn, &hn, false, 1), &sealed).is_none());
        assert!(open(&key, &data_aad(&gn, &hn, true, 0), &sealed).is_none());
        assert!(open(&key, &data_aad(&hn, &gn, false, 0), &sealed).is_none());
        let mut flipped = sealed.clone();
        *flipped.last_mut().unwrap() ^= 1;
        assert!(open(&key, &data_aad(&gn, &hn, false, 0), &flipped).is_none());
        assert!(open(&random_bytes(), &data_aad(&gn, &hn, false, 0), &sealed).is_none());
        assert!(open(&key, b"", &sealed[..10]).is_none());
    }

    #[test]
    fn frames_round_trip_and_reject_short_input() {
        let f = frame(WS_TEXT, 0xA1B2C3D4, b"abc");
        assert_eq!(parse_frame(&f), Some((WS_TEXT, 0xA1B2C3D4, &b"abc"[..])));
        assert_eq!(parse_frame(&f[..4]), None);
    }
}
