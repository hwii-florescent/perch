//! Usage alerts: a plan window crossing the user's threshold, the window
//! renewing, and API-equivalent spend passing a daily budget. Ported from
//! Vorssaint (GPL-3.0-or-later) `AgentLimitSupport` / `checkBudget`.
//!
//! `check` is pure; the global state lives in memory only (ponytail: it resets
//! on core restart, and the first reading after that records history silently,
//! so a restart never replays old alerts). It is fed from `usage.get`, so the
//! alerts follow the clients' polling; several clients cannot double-alert
//! because the state is shared.
//!
//! - A window alerts once when `used >= limit`; it is "warned" until it
//!   renews: used fell by more than a point, `resets_at` moved by over a
//!   minute, or `resets_at` passed. A renewal below the threshold emits a
//!   `reset`; one still at/over it alerts again. A window past its
//!   `resets_at` counts as 0% (providers can serve stale readings).
//! - A window never seen before, and every window after the threshold or
//!   budget setting changed, is recorded silently: no retroactive alerts.
//! - Budget: once per local day when today's cost reaches the budget.

use super::spend::{self, SpendSummary};
use super::AccountUsage;
use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};

const RENEWAL_SHIFT_SECS: f64 = 60.0;
const RENEWAL_DROP_POINTS: f64 = 1.0;

#[derive(Debug, Clone, PartialEq)]
pub struct UsageAlert {
    /// `limit`, `reset` or `budget`.
    pub kind: &'static str,
    pub title: String,
    pub body: String,
}

#[derive(Debug, Default)]
pub struct AlertState {
    seeded: bool,
    limit: u8,
    budget: f64,
    seen: HashSet<String>,
    warned: HashMap<String, Warned>,
    budget_day: Option<i64>,
}

#[derive(Debug)]
struct Warned {
    name: String,
    /// Last reading while warned.
    used: f64,
    resets: Option<f64>,
}

struct Reading {
    name: String,
    detail: String,
    used: f64,
    resets: Option<f64>,
}

fn readings(accounts: &[AccountUsage], now: f64) -> HashMap<String, Reading> {
    let mut out = HashMap::new();
    for account in accounts {
        let provider = {
            let mut chars = account.provider.chars();
            chars
                .next()
                .map(|c| c.to_uppercase().chain(chars).collect::<String>())
                .unwrap_or_default()
        };
        for w in &account.windows {
            let scope = w.scope.as_deref();
            let key = format!(
                "{}|{}|{}|{}",
                account.provider,
                account.label.as_deref().unwrap_or(""),
                w.label,
                scope.unwrap_or("")
            );
            let resets = w.resets_at.as_ref().and_then(spend::timestamp);
            let ended = resets.is_some_and(|r| r <= now);
            let name = match scope {
                Some(scope) => format!("{provider} {} {scope}", w.label),
                None => format!("{provider} {}", w.label),
            };
            let mut detail = account.label.clone().unwrap_or_default();
            if let Some(r) = resets.filter(|r| *r > now) {
                if !detail.is_empty() {
                    detail.push_str(" · ");
                }
                detail.push_str(&format!("Resets in {}", until(r - now)));
            }
            out.insert(
                key,
                Reading {
                    name,
                    detail,
                    used: if ended { 0.0 } else { w.used_percent },
                    resets,
                },
            );
        }
    }
    out
}

fn until(seconds: f64) -> String {
    let minutes = (seconds / 60.0).ceil() as u64;
    if minutes >= 1440 {
        format!("{}d {}h", minutes / 1440, minutes % 1440 / 60)
    } else if minutes >= 60 {
        format!("{}h {}m", minutes / 60, minutes % 60)
    } else {
        format!("{minutes}m")
    }
}

fn dollars(amount: f64) -> String {
    if amount.fract() == 0.0 {
        format!("${amount:.0}")
    } else {
        format!("${amount:.2}")
    }
}

/// `today` is the local day number of `now` (`spend::local_day`); `today_cost`
/// is the 1-day spend, `None` when spend is unavailable.
pub fn check(
    state: &mut AlertState,
    accounts: &[AccountUsage],
    today_cost: Option<f64>,
    limit: u8,
    budget: f64,
    now: f64,
    today: i64,
) -> Vec<UsageAlert> {
    let mut alerts = vec![];
    let first = !state.seeded;
    let reseed = first || state.limit != limit;
    let current = readings(accounts, now);
    let threshold = f64::from(limit);
    if limit == 0 {
        state.warned.clear();
    } else {
        if reseed {
            state.warned.clear();
        }
        let warned_keys: Vec<String> = state.warned.keys().cloned().collect();
        for key in warned_keys {
            let warned = &state.warned[&key];
            let reading = current.get(&key);
            let ended = warned.resets.is_some_and(|r| r <= now);
            let renewed = match reading {
                None => ended,
                Some(r) => {
                    ended
                        || r.used + RENEWAL_DROP_POINTS < warned.used
                        || matches!((warned.resets, r.resets), (Some(was), Some(is)) if (is - was).abs() > RENEWAL_SHIFT_SECS)
                }
            };
            if !renewed {
                if let Some(r) = reading {
                    let warned = state.warned.get_mut(&key).expect("key came from the map");
                    warned.used = r.used;
                    warned.resets = r.resets;
                }
                continue;
            }
            let warned = state.warned.remove(&key).expect("key came from the map");
            if reading.is_none_or(|r| r.used < threshold) {
                alerts.push(UsageAlert {
                    kind: "reset",
                    title: format!("{} window reset", warned.name),
                    body: String::new(),
                });
            }
        }
        for (key, r) in &current {
            if r.used >= threshold && !state.warned.contains_key(key) {
                state.warned.insert(
                    key.clone(),
                    Warned {
                        name: r.name.clone(),
                        used: r.used,
                        resets: r.resets,
                    },
                );
                if !reseed && state.seen.contains(key) {
                    alerts.push(UsageAlert {
                        kind: "limit",
                        title: format!("{} limit at {}%", r.name, r.used.round()),
                        body: r.detail.clone(),
                    });
                }
            }
        }
    }
    state.seen.extend(current.into_keys());
    state.limit = limit;

    let budget_changed = state.budget != budget;
    state.budget = budget;
    match today_cost {
        Some(cost) if budget > 0.0 => {
            if first || budget_changed {
                // Recorded, not announced: what was already spent is history.
                state.budget_day = (cost >= budget).then_some(today);
            } else if cost >= budget && state.budget_day != Some(today) {
                state.budget_day = Some(today);
                alerts.push(UsageAlert {
                    kind: "budget",
                    title: format!("Daily spend passed {}", dollars(budget)),
                    body: format!("${cost:.2} API-equivalent today"),
                });
            }
        }
        _ => {}
    }
    state.seeded = true;
    alerts
}

static STATE: OnceLock<Mutex<AlertState>> = OnceLock::new();

/// `check` against the process-wide state with the current clock.
pub fn check_now(
    accounts: &[AccountUsage],
    spend: &SpendSummary,
    limit: u8,
    budget: f64,
) -> Vec<UsageAlert> {
    let now = super::now_secs();
    let today_cost = spend
        .periods
        .iter()
        .find(|p| p.days == 1)
        .map(|p| p.cost_usd);
    let mut state = STATE
        .get_or_init(Default::default)
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    check(
        &mut state,
        accounts,
        today_cost,
        limit,
        budget,
        now,
        spend::local_day(now),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::usage::UsageWindow;
    use serde_json::json;

    const NOW: f64 = 1_800_000_000.0;
    const RESET: f64 = NOW + 3.0 * 3600.0;

    fn account(used: f64, resets: f64) -> Vec<AccountUsage> {
        vec![AccountUsage {
            provider: "claude".into(),
            windows: vec![UsageWindow {
                label: "5h".into(),
                used_percent: used,
                window_minutes: 300,
                resets_at: Some(json!(resets)),
                scope: None,
            }],
            ..Default::default()
        }]
    }

    fn run(state: &mut AlertState, used: f64, resets: f64, now: f64) -> Vec<UsageAlert> {
        check(state, &account(used, resets), None, 80, 0.0, now, 0)
    }

    fn kinds(alerts: &[UsageAlert]) -> Vec<&str> {
        alerts.iter().map(|a| a.kind).collect()
    }

    #[test]
    fn limit_alerts_once_per_window_and_again_after_renewal() {
        let mut state = AlertState::default();
        // The first reading is history, even above the threshold.
        assert!(run(&mut state, 90.0, RESET, NOW).is_empty());
        assert!(run(&mut state, 91.0, RESET, NOW + 60.0).is_empty());
        // Renewed by a drop: below the threshold announces the reset.
        let alerts = run(&mut state, 10.0, RESET, NOW + 120.0);
        assert_eq!(kinds(&alerts), ["reset"]);
        assert_eq!(alerts[0].title, "Claude 5h window reset");
        // Crossing alerts once, with the reset time in the body.
        assert!(run(&mut state, 79.0, RESET, NOW + 180.0).is_empty());
        let alerts = run(&mut state, 82.0, RESET, NOW + 240.0);
        assert_eq!(kinds(&alerts), ["limit"]);
        assert_eq!(alerts[0].title, "Claude 5h limit at 82%");
        assert_eq!(alerts[0].body, "Resets in 2h 56m");
        assert!(run(&mut state, 85.0, RESET, NOW + 300.0).is_empty());
        // The reset time moving (a new window) renews: still over, so it re-alerts.
        let next = RESET + 5.0 * 3600.0;
        assert_eq!(kinds(&run(&mut state, 83.0, next, NOW + 360.0)), ["limit"]);
        // Its reset time passing renews it; a stale reading counts as 0%.
        assert_eq!(kinds(&run(&mut state, 83.0, next, next + 1.0)), ["reset"]);
        assert!(run(&mut state, 83.0, next, next + 2.0).is_empty());
    }

    #[test]
    fn changing_the_threshold_or_turning_it_off_never_alerts_retroactively() {
        let mut state = AlertState::default();
        let at = |state: &mut AlertState, limit, used| {
            check(state, &account(used, RESET), None, limit, 0.0, NOW, 0)
        };
        assert!(at(&mut state, 90, 85.0).is_empty());
        assert!(at(&mut state, 80, 85.0).is_empty());
        assert!(at(&mut state, 0, 95.0).is_empty());
        assert!(at(&mut state, 80, 95.0).is_empty());
        assert!(at(&mut state, 90, 40.0).is_empty());
        assert_eq!(kinds(&at(&mut state, 90, 91.0)), ["limit"]);
    }

    #[test]
    fn budget_alerts_once_per_local_day_and_never_for_history() {
        let mut state = AlertState::default();
        let at = |state: &mut AlertState, cost, budget, today| {
            check(state, &[], Some(cost), 80, budget, NOW, today)
        };
        assert!(at(&mut state, 30.0, 25.0, 7).is_empty());
        assert!(at(&mut state, 40.0, 25.0, 7).is_empty());
        // The next day starts under budget, then passes it.
        assert!(at(&mut state, 3.0, 25.0, 8).is_empty());
        let alerts = at(&mut state, 27.4, 25.0, 8);
        assert_eq!(kinds(&alerts), ["budget"]);
        assert_eq!(alerts[0].title, "Daily spend passed $25");
        assert_eq!(alerts[0].body, "$27.40 API-equivalent today");
        assert!(at(&mut state, 30.0, 25.0, 8).is_empty());
        assert!(at(&mut state, 1.0, 25.0, 9).is_empty());
        assert_eq!(kinds(&at(&mut state, 26.0, 25.0, 9)), ["budget"]);
        // Budget 0 is off, and a changed budget re-seeds silently.
        assert!(at(&mut state, 500.0, 0.0, 9).is_empty());
        assert!(at(&mut state, 500.0, 100.0, 9).is_empty());
        assert!(at(&mut state, 60.0, 50.0, 10).is_empty());
    }
}
