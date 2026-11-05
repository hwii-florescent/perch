//! Spending one banked Codex rate-limit reset (`account/rateLimitResetCredit/consume`
//! over `codex app-server`). Irreversible and paid, so: only the computer's own
//! clients may ask (the dispatcher refuses device tokens), one attempt per
//! account at a time, and a lost reply is retried with the same idempotency
//! key for 10 minutes so it can never spend twice. Ported from Vorssaint
//! (GPL-3.0-or-later) `AgentCodexServer.redeem`.

use super::cli::{with_deadline, Conversation, Failure};
use super::*;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

const REDEEM_DEADLINE: Duration = Duration::from_secs(30);
const RETRY_WINDOW: Duration = Duration::from_secs(600);

/// Accounts whose consume was sent without a readable reply: account id ->
/// (idempotency key, when). Cleared by any reply that is a result.
static PENDING: OnceLock<Mutex<HashMap<String, (String, Instant)>>> = OnceLock::new();
static IN_FLIGHT: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

struct InFlight(String);

impl InFlight {
    fn start(account_id: &str) -> Option<Self> {
        let mut set = IN_FLIGHT.get_or_init(Default::default).lock().ok()?;
        set.insert(account_id.to_string())
            .then(|| Self(account_id.to_string()))
    }
}

impl Drop for InFlight {
    fn drop(&mut self) {
        if let Ok(mut set) = IN_FLIGHT.get_or_init(Default::default).lock() {
            set.remove(&self.0);
        }
    }
}

/// The key of a still-fresh unanswered attempt, if any.
fn reusable_key(
    pending: &HashMap<String, (String, Instant)>,
    account_id: &str,
    now: Instant,
) -> Option<String> {
    let (key, at) = pending.get(account_id)?;
    (now.duration_since(*at) < RETRY_WINDOW).then(|| key.clone())
}

/// The available, unexpired credit expiring soonest (no expiry sorts last).
fn pick_credit(limits: &Value, now: f64) -> Option<String> {
    limits["rateLimitResetCredits"]["credits"]
        .as_array()?
        .iter()
        .filter(|c| {
            c["status"].as_str().unwrap_or("available") == "available"
                && c["expiresAt"].as_f64().is_none_or(|at| at > now)
        })
        .filter_map(|c| Some((c["id"].as_str().filter(|id| !id.is_empty())?, c)))
        .min_by(|(_, a), (_, b)| {
            let at = |c: &Value| c["expiresAt"].as_f64().unwrap_or(f64::INFINITY);
            at(a).total_cmp(&at(b))
        })
        .map(|(id, _)| id.to_string())
}

fn consume_outcome(result: &Value) -> Option<&'static str> {
    ["reset", "nothingToReset", "noCredit", "alreadyRedeemed"]
        .into_iter()
        .find(|known| result["outcome"] == *known)
}

/// initialize -> rateLimits/read -> consume. `noCredit` without calling
/// consume when no credit is redeemable.
async fn consume_one(
    command: Command,
    account_id: &str,
    key: &str,
) -> Result<&'static str, Failure> {
    let mut chat = Conversation::spawn(command)?;
    codex_handshake(&mut chat).await?;
    let limits = codex_rpc(&mut chat, 2, "account/rateLimits/read", None).await?;
    let Some(credit_id) = pick_credit(&limits, now_secs()) else {
        return Ok("noCredit");
    };
    // Recorded before the request leaves: a lost reply keeps the key.
    PENDING
        .get_or_init(Default::default)
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .insert(account_id.to_string(), (key.to_string(), Instant::now()));
    let params = json!({"idempotencyKey": key, "creditId": credit_id});
    let result = codex_rpc(
        &mut chat,
        3,
        "account/rateLimitResetCredit/consume",
        Some(params),
    )
    .await?;
    PENDING
        .get_or_init(Default::default)
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .remove(account_id);
    consume_outcome(&result).ok_or(Failure::Unreachable)
}

fn failure_message(failure: Failure) -> Option<String> {
    match failure {
        Failure::Missing => Some("Codex is not installed."),
        Failure::SignedOut => Some("Codex is signed out. Run codex login."),
        Failure::Outdated => Some("This Codex version cannot redeem resets. Update Codex."),
        Failure::Unreachable | Failure::Stale => None,
    }
    .map(Into::into)
}

/// `(outcome, message)`: `reset | nothingToReset | noCredit | alreadyRedeemed`,
/// else `error` with an optional explanation. A non-error outcome drops the
/// usage cache so the next read shows the new limits.
pub async fn redeem_reset(account_id: &str) -> (&'static str, Option<String>) {
    let Some(account) = accounts()
        .into_iter()
        .find(|a| a.provider == "codex" && super::account_id(a) == account_id)
    else {
        return ("error", Some("Unknown Codex account.".into()));
    };
    let Some(_guard) = InFlight::start(account_id) else {
        return ("error", Some("A reset is already in progress.".into()));
    };
    let key = {
        let pending = PENDING
            .get_or_init(Default::default)
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        reusable_key(&pending, account_id, Instant::now())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string())
    };
    match with_deadline(
        REDEEM_DEADLINE,
        consume_one(codex_command(&account), account_id, &key),
    )
    .await
    {
        Ok(outcome) => {
            invalidate_cache().await;
            (outcome, None)
        }
        Err(failure) => ("error", failure_message(failure)),
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    fn credits() -> Value {
        json!({"rateLimitResetCredits": {"availableCount": 3, "credits": [
            {"id": "used", "status": "used", "expiresAt": 1000},
            {"id": "expired", "status": "available", "expiresAt": 50},
            {"id": "late", "status": "available", "expiresAt": 900},
            {"id": "soon", "status": "available", "expiresAt": 300},
            {"id": "", "status": "available", "expiresAt": 200},
            {"id": "open-ended", "status": "available"}
        ]}})
    }

    #[test]
    fn picks_the_soonest_expiring_redeemable_credit() {
        assert_eq!(pick_credit(&credits(), 100.0).as_deref(), Some("soon"));
        assert_eq!(pick_credit(&credits(), 400.0).as_deref(), Some("late"));
        assert_eq!(
            pick_credit(&credits(), 950.0).as_deref(),
            Some("open-ended")
        );
        assert_eq!(
            pick_credit(&json!({"rateLimitResetCredits": {}}), 0.0),
            None
        );
        assert_eq!(pick_credit(&json!({}), 0.0), None);
    }

    #[test]
    fn maps_only_known_consume_outcomes() {
        for known in ["reset", "nothingToReset", "noCredit", "alreadyRedeemed"] {
            assert_eq!(consume_outcome(&json!({"outcome": known})), Some(known));
        }
        assert_eq!(consume_outcome(&json!({"outcome": "bogus"})), None);
        assert_eq!(consume_outcome(&json!({})), None);
    }

    #[test]
    fn an_unanswered_attempt_keeps_its_key_for_ten_minutes() {
        let at = Instant::now();
        let pending = HashMap::from([("codex:a".to_string(), ("key-1".to_string(), at))]);
        let later = |secs| at + Duration::from_secs(secs);
        assert_eq!(
            reusable_key(&pending, "codex:a", later(599)).as_deref(),
            Some("key-1")
        );
        assert_eq!(reusable_key(&pending, "codex:a", later(600)), None);
        assert_eq!(reusable_key(&pending, "codex:b", later(1)), None);
    }

    /// A fake `sh` stands in for `codex app-server`: it logs every request it
    /// receives and answers like the real protocol. The real binary is never run.
    #[tokio::test]
    async fn consume_conversation_sends_the_credit_and_key_and_parses_the_outcome() {
        let log = std::env::temp_dir().join(format!("perch-redeem-{}", uuid::Uuid::new_v4()));
        let script = format!(
            "read a; echo \"$a\" >> '{log}'; echo '{{\"id\":1,\"result\":{{}}}}'; \
             read b; echo \"$b\" >> '{log}'; \
             read c; echo \"$c\" >> '{log}'; \
             echo '{{\"id\":2,\"result\":{{\"rateLimitResetCredits\":{{\"credits\":[\
             {{\"id\":\"late\",\"status\":\"available\",\"expiresAt\":4102444800}},\
             {{\"id\":\"soon\",\"status\":\"available\",\"expiresAt\":4102444700}}]}}}}}}'; \
             read d; echo \"$d\" >> '{log}'; \
             echo '{{\"id\":3,\"result\":{{\"outcome\":\"reset\"}}}}'",
            log = log.display()
        );
        let mut command = Command::new("sh");
        command.args(["-c", &script]);
        let account = "codex:fake";
        let outcome = with_deadline(
            Duration::from_secs(5),
            consume_one(command, account, "key-123"),
        )
        .await;
        assert_eq!(outcome, Ok("reset"));
        let lines: Vec<Value> = std::fs::read_to_string(&log)
            .unwrap()
            .lines()
            .map(|l| serde_json::from_str(l).unwrap())
            .collect();
        std::fs::remove_file(&log).unwrap();
        assert_eq!(lines.len(), 4);
        assert_eq!(lines[0]["method"], "initialize");
        assert_eq!(lines[1]["method"], "initialized");
        assert_eq!(lines[2]["method"], "account/rateLimits/read");
        assert_eq!(lines[3]["method"], "account/rateLimitResetCredit/consume");
        assert_eq!(
            lines[3]["params"],
            json!({"idempotencyKey": "key-123", "creditId": "soon"})
        );
        // A reply was read, so nothing is left pending.
        let pending = PENDING.get_or_init(Default::default).lock().unwrap();
        assert!(!pending.contains_key(account));
    }
}
