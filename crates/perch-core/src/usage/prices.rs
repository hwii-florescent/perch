//! The API price list behind "API-equivalent spend": per-model rates, model-id
//! matching, the cost formula, display names and the subscription plan table.
//!
//! Ported from Vorssaint (GPL-3.0-or-later), `AgentPricing.swift`. The bundled
//! `agent-prices.json` is Vorssaint's `Resources/agent-prices.json`, copied
//! verbatim.
//!
//! ponytail: no network refresh. Upstream publishes updates; refresh by
//! re-copying that file here, or drop a newer one at `~/.perch/agent-prices.json`
//! (used iff it validates and its `updated` is not older than the bundled one).
//! A list that breaks any rule is refused as a whole.

use serde_json::Value;
use std::collections::HashSet;
use std::sync::{Arc, OnceLock};

const BUNDLED: &str = include_str!("agent-prices.json");
const MAX_LIST_BYTES: usize = 256 << 10;
/// Words that make a variant a model of its own, with its own price.
const SIBLINGS: [&str; 12] = [
    "mini",
    "nano",
    "pro",
    "lite",
    "research",
    "search",
    "audio",
    "realtime",
    "transcribe",
    "tts",
    "cyber",
    "image",
];

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Tokens {
    pub input: u64,
    pub cache_write: u64,
    pub cache_read: u64,
    pub output: u64,
    /// Informational: Claude/Codex report it beside `output`, never billed apart.
    pub reasoning: u64,
}

impl Tokens {
    /// Reasoning is not part of the total.
    pub fn total(&self) -> u64 {
        self.input + self.cache_write + self.cache_read + self.output
    }

    fn prompt(&self) -> u64 {
        self.input + self.cache_write + self.cache_read
    }

    /// Codex `input` includes the cached part; split it so nothing counts twice.
    pub fn codex(input: u64, cached: u64, written: u64, output: u64, reasoning: u64) -> Self {
        let cache_read = input.min(cached);
        let cache_write = (input - cache_read).min(written);
        Tokens {
            input: input - cache_read - cache_write,
            cache_write,
            cache_read,
            output,
            reasoning,
        }
    }
}

/// What one response bills, beyond its model.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Billable {
    pub tokens: Tokens,
    /// The part of `tokens.cache_write` kept for an hour.
    pub long_cache_write: u64,
    pub fast: bool,
    /// Inference pinned to the United States.
    pub domestic: bool,
    pub web_searches: u64,
    /// Session totals hide individual prompt sizes: no long-context pricing.
    pub is_aggregate: bool,
}

/// US dollars per million tokens.
#[derive(Debug, Clone, PartialEq)]
pub struct Price {
    input: f64,
    output: f64,
    cache_read: f64,
    cache_write: f64,
    cache_write_long: f64,
    fast_multiplier: f64,
    long_context: Option<LongContext>,
}

#[derive(Debug, Clone, PartialEq)]
struct LongContext {
    above: u64,
    input: f64,
    output: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Plan {
    pub name: String,
    /// US dollars a month, when the list knows it.
    pub monthly: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
struct PlanEntry {
    matcher: String,
    plan: Plan,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Cost {
    pub usd: f64,
    /// Dollars the cache reads avoided versus plain input rates.
    pub saved: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PriceList {
    /// `YYYY-MM-DD`, zero padded so strings compare as dates.
    pub updated: String,
    claude: Vec<(String, Price)>,
    codex: Vec<(String, Price)>,
    claude_plans: Vec<PlanEntry>,
    codex_plans: Vec<PlanEntry>,
    web_search: f64,
    us_only_multiplier: f64,
}

/// A finite number inside the range; JSON booleans and strings are not numbers.
fn number(value: Option<&Value>, lo: f64, hi: f64) -> Option<f64> {
    let n = value?.as_f64()?;
    (n.is_finite() && (lo..=hi).contains(&n)).then_some(n)
}

/// Lowercase letters, digits, dots, dashes and underscores.
fn identifier(text: &str, max: usize) -> bool {
    (1..=max).contains(&text.len())
        && text.bytes().all(|b| {
            b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'.' | b'-' | b'_')
        })
}

fn day(text: &str) -> Option<String> {
    let parts: Vec<u32> = text
        .split('-')
        .map(|p| p.parse().ok())
        .collect::<Option<_>>()?;
    let [year, month, day] = parts[..] else {
        return None;
    };
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let last = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return None,
    };
    ((2024..=2100).contains(&year) && (1..=last).contains(&day))
        .then(|| format!("{year:04}-{month:02}-{day:02}"))
}

fn models(value: Option<&Value>, claude: bool) -> Option<Vec<(String, Price)>> {
    let entries = value?.as_array()?;
    if !(1..=500).contains(&entries.len()) {
        return None;
    }
    let mut seen = HashSet::new();
    let mut out = vec![];
    for entry in entries {
        let entry = entry.as_object()?;
        let id = entry.get("id")?.as_str()?;
        if !identifier(id, 64) || !seen.insert(id) || id.starts_with("claude-") != claude {
            return None;
        }
        let input = number(entry.get("input"), 0.0, 1000.0)?;
        let output = number(entry.get("output"), 0.0, 1000.0)?;
        let cache_read = number(entry.get("cacheRead"), 0.0, 1000.0)?;
        // Fields left out fall back to plain input pricing.
        let rate = |key: &str, fallback: f64| match entry.get(key) {
            None => Some(fallback),
            some => number(some, 0.0, 1000.0),
        };
        let cache_write = rate("cacheWrite", input)?;
        let cache_write_long = rate("cacheWriteLong", cache_write)?;
        let fast_multiplier = match entry.get("fastMultiplier") {
            None => 1.0,
            some => number(some, 1.0, 10.0)?,
        };
        let long_context = match entry.get("longContext") {
            None => None,
            Some(v) => {
                let v = v.as_object()?;
                Some(LongContext {
                    above: number(v.get("above"), 1000.0, 10_000_000.0)? as u64,
                    input: number(v.get("inputMultiplier"), 1.0, 10.0)?,
                    output: number(v.get("outputMultiplier"), 1.0, 10.0)?,
                })
            }
        };
        out.push((
            id.to_string(),
            Price {
                input,
                output,
                cache_read,
                cache_write,
                cache_write_long,
                fast_multiplier,
                long_context,
            },
        ));
    }
    Some(out)
}

fn plans(value: Option<&Value>) -> Option<Vec<PlanEntry>> {
    let entries = value?.as_array()?;
    if entries.len() > 50 {
        return None;
    }
    entries
        .iter()
        .map(|entry| {
            let entry = entry.as_object()?;
            let matcher = entry.get("match")?.as_str()?;
            let name = entry.get("name")?.as_str()?.trim();
            let monthly = match entry.get("monthly") {
                None => None,
                some => Some(number(some, 0.0, 100_000.0)?),
            };
            (identifier(matcher, 40) && (1..=24).contains(&name.chars().count())).then(|| {
                PlanEntry {
                    matcher: matcher.to_string(),
                    plan: Plan {
                        name: name.to_string(),
                        monthly,
                    },
                }
            })
        })
        .collect()
}

impl PriceList {
    /// `None` when the text breaks any rule of the price list schema.
    pub fn parse(raw: &str) -> Option<PriceList> {
        if raw.len() > MAX_LIST_BYTES {
            return None;
        }
        let json: Value = serde_json::from_str(raw).ok()?;
        let (claude, codex) = (json.get("claude")?, json.get("codex")?);
        if number(json.get("schema"), 1.0, 1000.0)? != 1.0 {
            return None;
        }
        Some(PriceList {
            updated: day(json.get("updated")?.as_str()?)?,
            claude: models(claude.get("models"), true)?,
            codex: models(codex.get("models"), false)?,
            claude_plans: plans(claude.get("plans"))?,
            codex_plans: plans(codex.get("plans"))?,
            web_search: number(claude.get("webSearch"), 0.0, 1.0)?,
            us_only_multiplier: number(claude.get("usOnlyMultiplier"), 1.0, 3.0)?,
        })
    }

    /// The bundled list, replaced by `override_raw` when that validates and is
    /// not older (same day: the override wins, it may carry a correction).
    fn load(bundled: &PriceList, override_raw: Option<&str>) -> Arc<PriceList> {
        match override_raw.and_then(PriceList::parse) {
            Some(list) if list.updated >= bundled.updated => Arc::new(list),
            _ => Arc::new(bundled.clone()),
        }
    }

    /// Provider prefixes, snapshot dates and context tags vary by where the
    /// model runs; the family name in the middle does not.
    pub fn normalized(model: &str) -> String {
        let mut id = model.trim().to_lowercase();
        if let Some(at) = id.find("claude-") {
            id = id.split_off(at);
        }
        // Copilot writes "4.5" where Anthropic's logs and this list say "4-5".
        if id.starts_with("claude-") {
            id = id.replace('.', "-");
        }
        if let Some(slash) = id.rfind('/') {
            id = id.split_off(slash + 1);
        }
        if let Some(cut) = id.find(['@', '[']) {
            id.truncate(cut);
        }
        id
    }

    /// A family matches at a word boundary: "gpt-5" is not "gpt-5.1", and a
    /// short number after it names another version ("claude-opus-5" is not
    /// "claude-opus-5-6"); a snapshot date (4+ digits) is the same model.
    fn matches(id: &str, family: &str) -> bool {
        let Some(rest) = id.strip_prefix(family) else {
            return false;
        };
        let mut chars = rest.chars();
        match chars.next() {
            None => true,
            Some('-' | '_' | ':') => {
                let digits = chars.take_while(char::is_ascii_digit).count();
                digits == 0 || digits >= 4
            }
            Some(_) => false,
        }
    }

    /// The longest matching family wins. A sibling the list does not name
    /// (mini, pro, ...) is priced very differently: no figure beats a wrong one.
    pub fn price(&self, model: &str) -> Option<&Price> {
        let id = Self::normalized(model);
        let table = if id.starts_with("claude-") {
            &self.claude
        } else {
            &self.codex
        };
        let (family, price) = table
            .iter()
            .filter(|(family, _)| Self::matches(&id, family))
            .max_by_key(|(family, _)| family.len())?;
        let rest = &id[family.len()..];
        (!SIBLINGS.iter().any(|s| rest.contains(s))).then_some(price)
    }

    /// `None` for an unpriced model.
    pub fn cost(&self, billable: &Billable, model: &str) -> Option<Cost> {
        self.cost_with(self.price(model), billable)
    }

    /// `cost` for a price already looked up (aggregation caches it per model).
    pub fn cost_with(&self, price: Option<&Price>, billable: &Billable) -> Option<Cost> {
        let t = &billable.tokens;
        if billable.is_aggregate && t.total() == 0 {
            return Some(Cost {
                usd: 0.0,
                saved: 0.0,
            });
        }
        let price = price?;
        let long = billable.long_cache_write.min(t.cache_write);
        let mut multiplier = if billable.fast {
            price.fast_multiplier
        } else {
            1.0
        };
        if billable.domestic {
            multiplier *= self.us_only_multiplier;
        }
        let (mut in_rate, mut out_rate) = (multiplier, multiplier);
        if let Some(l) = price
            .long_context
            .as_ref()
            .filter(|_| !billable.is_aggregate)
        {
            if t.prompt() > l.above {
                in_rate *= l.input;
                out_rate *= l.output;
            }
        }
        let usd = (t.input as f64 * price.input * in_rate
            + (t.cache_write - long) as f64 * price.cache_write * in_rate
            + long as f64 * price.cache_write_long * in_rate
            + t.cache_read as f64 * price.cache_read * in_rate
            + t.output as f64 * price.output * out_rate)
            / 1e6
            + billable.web_searches as f64 * self.web_search;
        let saved = t.cache_read as f64 * (price.input - price.cache_read).max(0.0) * in_rate / 1e6;
        Some(Cost { usd, saved })
    }

    /// "claude-opus-5-5" reads "Opus 5.5", "gpt-6-astra" reads "GPT-6 Astra";
    /// built from the name, so a model no list knows yet still reads well.
    pub fn display_name(model: &str) -> String {
        let id = Self::normalized(model);
        let numeric = |s: &str| !s.is_empty() && s.chars().all(|c| c.is_ascii_digit());
        let capitalized = |s: &str| {
            let mut chars = s.chars();
            chars.next().map_or(String::new(), |c| {
                c.to_uppercase()
                    .chain(chars.flat_map(char::to_lowercase))
                    .collect()
            })
        };
        if let Some(rest) = id.strip_prefix("claude-") {
            // A router's tag after a colon (":thinking") is a mode of the same model.
            let family = rest.split(':').next().unwrap_or(rest);
            let parts: Vec<&str> = family
                .split('-')
                .filter(|p| !p.is_empty())
                .filter(|p| !(p.len() >= 6 && numeric(p)))
                .filter(|p| {
                    !(p.starts_with('v')
                        && p[1..].chars().next().is_some_and(|c| c.is_ascii_digit()))
                })
                .filter(|p| *p != "latest")
                .collect();
            let is_version = |p: &&str| p.chars().all(|c| c.is_ascii_digit() || c == '.');
            let words: Vec<&str> = parts.iter().copied().filter(|p| !is_version(p)).collect();
            let version = parts
                .iter()
                .filter(|p| is_version(p))
                .copied()
                .collect::<Vec<_>>()
                .join(".");
            return [capitalized(words.first().unwrap_or(&"")), version]
                .into_iter()
                .chain(words.iter().skip(1).map(|w| capitalized(w)))
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
                .join(" ");
        }
        let Some(rest) = id.strip_prefix("gpt-") else {
            return id;
        };
        // An alias names whatever it points to today; a dated snapshot is the same model.
        let mut parts: Vec<&str> = rest
            .split('-')
            .filter(|p| !p.is_empty() && *p != "latest")
            .filter(|p| !(p.len() >= 6 && numeric(p)))
            .collect();
        let n = parts.len();
        if n >= 4
            && parts[n - 3]
                .parse::<u32>()
                .is_ok_and(|y| (2000..=2100).contains(&y))
            && parts[n - 2..].iter().all(|p| p.len() == 2 && numeric(p))
        {
            parts.truncate(n - 3);
        }
        let Some(first) = parts.first() else {
            return "GPT".into();
        };
        let head = if first.starts_with(|c: char| c.is_ascii_digit()) {
            format!("GPT-{first}")
        } else {
            format!("GPT {}", capitalized(first))
        };
        std::iter::once(head)
            .chain(parts.iter().skip(1).map(|p| capitalized(p)))
            .collect::<Vec<_>>()
            .join(" ")
    }

    /// First plan (list order) whose match is inside "tier type", lowercased.
    pub fn claude_plan(&self, tier: Option<&str>, org_type: Option<&str>) -> Option<Plan> {
        let recorded = format!("{} {}", tier.unwrap_or(""), org_type.unwrap_or("")).to_lowercase();
        self.claude_plans
            .iter()
            .find(|p| recorded.contains(&p.matcher))
            .map(|p| p.plan.clone())
    }

    /// Exact match on the lowercased, trimmed plan type.
    pub fn codex_plan(&self, plan_type: &str) -> Option<Plan> {
        let raw = plan_type.trim().to_lowercase();
        self.codex_plans
            .iter()
            .find(|p| p.matcher == raw)
            .map(|p| p.plan.clone())
    }
}

/// The list prices come from: bundled, or `~/.perch/agent-prices.json` when
/// it is at least as new. The override is re-read per call (small, rare).
pub fn current() -> Arc<PriceList> {
    static BUNDLED_LIST: OnceLock<PriceList> = OnceLock::new();
    let bundled = BUNDLED_LIST.get_or_init(|| {
        PriceList::parse(BUNDLED).expect("bundled agent-prices.json is valid (tested)")
    });
    let raw = super::home()
        .and_then(|home| std::fs::read_to_string(home.join(".perch/agent-prices.json")).ok());
    PriceList::load(bundled, raw.as_deref())
}

/// What a Codex turn cost at API list prices; `input` includes `cached`.
pub fn codex_turn_cost(model: &str, input: u64, cached: u64, output: u64) -> Option<f64> {
    let billable = Billable {
        tokens: Tokens::codex(input, cached, 0, output, 0),
        ..Default::default()
    };
    current().cost(&billable, model).map(|c| c.usd)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Small list with hand-computable rates.
    const MINI: &str = r#"{"schema":1,"updated":"2026-10-09",
      "claude":{"webSearch":0.01,"usOnlyMultiplier":1.1,"models":[
        {"id":"claude-sonnet-4-5","input":3,"output":15,"cacheRead":0.3,"cacheWrite":3.75,"cacheWriteLong":6,
         "fastMultiplier":2,"longContext":{"above":200000,"inputMultiplier":2,"outputMultiplier":1.5}},
        {"id":"claude-opus-5","input":5,"output":25,"cacheRead":0.5},
        {"id":"claude-opus-5-5","input":4,"output":20,"cacheRead":0.4}],
       "plans":[{"match":"max_20x","name":"Max 20×","monthly":200},{"match":"max_5x","name":"Max 5×","monthly":100},
                {"match":"max","name":"Max"},{"match":"pro","name":"Pro","monthly":20}]},
      "codex":{"models":[{"id":"gpt-5.5","input":5,"output":30,"cacheRead":0.5},
        {"id":"gpt-5","input":1,"output":8,"cacheRead":0.1},
        {"id":"gpt-5.5-pro","input":30,"output":180,"cacheRead":30}],
       "plans":[{"match":"plus","name":"Plus","monthly":20},{"match":"pro","name":"Pro"}]}}"#;

    fn mini() -> PriceList {
        PriceList::parse(MINI).expect("mini list is valid")
    }

    fn bill(input: u64, cache_write: u64, cache_read: u64, output: u64) -> Billable {
        Billable {
            tokens: Tokens {
                input,
                cache_write,
                cache_read,
                output,
                reasoning: 0,
            },
            ..Default::default()
        }
    }

    fn assert_close(actual: f64, expected: f64) {
        assert!((actual - expected).abs() < 1e-9, "{actual} != {expected}");
    }

    #[test]
    fn model_ids_normalize_and_match_the_longest_family_at_a_word_boundary() {
        assert_eq!(
            PriceList::normalized(" anthropic/Claude-Sonnet-4.5@20250929 "),
            "claude-sonnet-4-5"
        );
        assert_eq!(PriceList::normalized("openai/gpt-5.5[1m]"), "gpt-5.5");
        let list = mini();
        let input = |model: &str| list.price(model).map(|p| p.input);
        assert_eq!(input("claude-sonnet-4.5"), Some(3.0));
        assert_eq!(input("vertex/claude-sonnet-4-5@20250929"), Some(3.0));
        // "-6" is another version, "-20250101" a snapshot, longest family wins.
        assert_eq!(input("claude-opus-5-6"), None);
        assert_eq!(input("claude-opus-5-20250101"), Some(5.0));
        assert_eq!(input("claude-opus-5-5"), Some(4.0));
        assert_eq!(input("claude-opus-5-5-20250101"), Some(4.0));
        assert_eq!(input("claude-opus-5:thinking"), Some(5.0));
        assert_eq!(input("gpt-5.5-2026-10-01"), Some(5.0));
        assert_eq!(input("gpt-5.1"), None);
        // A named sibling has its own entry; an unnamed one is unpriced.
        assert_eq!(input("gpt-5.5-pro"), Some(30.0));
        assert_eq!(input("gpt-5-mini"), None);
        assert_eq!(input("gpt-5.5-mini"), None);
        assert_eq!(input("some-local-model"), None);
        assert_eq!(input(""), None);
    }

    #[test]
    fn cost_follows_cache_tier_long_context_fast_region_and_search_rules() {
        let list = mini();
        // 1h cache write at cacheWriteLong; the rest at cacheWrite; flat search fee.
        let mut b = bill(1000, 10_000, 50_000, 2000);
        b.long_cache_write = 4000;
        b.web_searches = 2;
        let c = list.cost(&b, "claude-sonnet-4-5").unwrap();
        assert_close(
            c.usd,
            (3000.0 + 22_500.0 + 24_000.0 + 15_000.0 + 30_000.0) / 1e6 + 0.02,
        );
        assert_close(c.saved, 50_000.0 * 2.7 / 1e6);
        // Prompt over the threshold: input and cache x2, output x1.5.
        let c = list
            .cost(&bill(50_000, 0, 200_000, 1000), "claude-sonnet-4-5")
            .unwrap();
        assert_close(c.usd, (300_000.0 + 120_000.0 + 22_500.0) / 1e6);
        assert_close(c.saved, 200_000.0 * 2.7 * 2.0 / 1e6);
        // The same prompt as an aggregate is priced at base rates.
        let mut aggregate = bill(50_000, 0, 200_000, 1000);
        aggregate.is_aggregate = true;
        let c = list.cost(&aggregate, "claude-sonnet-4-5").unwrap();
        assert_close(c.usd, (150_000.0 + 60_000.0 + 15_000.0) / 1e6);
        // Fast x2 and US-only x1.1 apply to every class.
        let mut b = bill(1000, 0, 0, 1000);
        b.fast = true;
        b.domestic = true;
        assert_close(
            list.cost(&b, "claude-sonnet-4-5").unwrap().usd,
            18_000.0 * 2.2 / 1e6,
        );
        // Missing cacheWrite = input rate; unpriced stays None; empty aggregate is free.
        assert_close(
            list.cost(&bill(0, 1000, 0, 0), "claude-opus-5")
                .unwrap()
                .usd,
            5000.0 / 1e6,
        );
        assert!(list.cost(&bill(1, 0, 0, 0), "mystery").is_none());
        let empty = Billable {
            is_aggregate: true,
            ..Default::default()
        };
        assert_eq!(list.cost(&empty, "mystery").unwrap().usd, 0.0);
    }

    #[test]
    fn codex_tokens_split_cached_and_written_out_of_input() {
        let t = Tokens::codex(22_763, 11_008, 0, 344, 179);
        assert_eq!((t.input, t.cache_read, t.cache_write), (11_755, 11_008, 0));
        let t = Tokens::codex(100, 30, 50, 5, 0);
        assert_eq!((t.input, t.cache_read, t.cache_write), (20, 30, 50));
        // Over-reported cache counts cannot go negative.
        let t = Tokens::codex(10, 99, 99, 0, 0);
        assert_eq!((t.input, t.cache_read, t.cache_write), (0, 10, 0));
    }

    #[test]
    fn bundled_list_validates_and_a_broken_list_is_rejected() {
        let list = PriceList::parse(BUNDLED).expect("bundled list validates");
        assert!(list.price("claude-sonnet-4-5").is_some());
        let broken = |from: &str, to: &str| PriceList::parse(&MINI.replace(from, to)).is_none();
        assert!(!broken("\"schema\":1", "\"schema\":1"));
        assert!(broken("\"schema\":1", "\"schema\":2"));
        assert!(broken("2026-10-09", "2026-02-30"));
        assert!(broken("\"input\":3,", "\"input\":true,"));
        assert!(broken("\"input\":3,", "\"input\":1001,"));
        assert!(broken(
            "\"id\":\"claude-opus-5\"",
            "\"id\":\"Claude-Opus-5\""
        ));
        assert!(
            broken("\"id\":\"claude-opus-5\"", "\"id\":\"claude-opus-5-5\""),
            "duplicate id"
        );
        assert!(
            broken("\"id\":\"gpt-5\"", "\"id\":\"claude-gpt-5\""),
            "codex claude- prefix"
        );
        assert!(broken(
            "\"usOnlyMultiplier\":1.1",
            "\"usOnlyMultiplier\":0.5"
        ));
        assert!(broken("\"above\":200000", "\"above\":5"));
        assert!(broken("\"monthly\":200", "\"monthly\":-1"));
        assert!(PriceList::parse(&" ".repeat(MAX_LIST_BYTES + 1)).is_none());
        // An override is used only when it validates and is not older.
        let bundled = mini();
        let newer = MINI
            .replace("2026-10-09", "2026-10-10")
            .replace("\"input\":5,\"output\":25", "\"input\":6,\"output\":25");
        let older = MINI.replace("2026-10-09", "2026-10-08");
        let input = |l: &PriceList| l.price("claude-opus-5").map(|p| p.input);
        assert_eq!(input(&PriceList::load(&bundled, Some(&newer))), Some(6.0));
        assert_eq!(input(&PriceList::load(&bundled, Some(&older))), Some(5.0));
        assert_eq!(input(&PriceList::load(&bundled, Some("{}"))), Some(5.0));
        assert_eq!(input(&PriceList::load(&bundled, None)), Some(5.0));
    }

    #[test]
    fn display_names_read_well_for_known_and_unknown_models() {
        for (model, name) in [
            ("claude-opus-5-5", "Opus 5.5"),
            ("claude-sonnet-4-5-20250929", "Sonnet 4.5"),
            ("anthropic/claude-sonnet-4.5", "Sonnet 4.5"),
            ("claude-3-5-haiku-latest", "Haiku 3.5"),
            ("claude-opus-5:thinking", "Opus 5"),
            ("gpt-6-astra", "GPT-6 Astra"),
            ("gpt-5.5-2026-10-01", "GPT-5.5"),
            ("gpt-5.4-mini", "GPT-5.4 Mini"),
            ("gpt-4o-20241120", "GPT-4o"),
            ("gpt-latest", "GPT"),
            ("kimi-k2", "kimi-k2"),
            ("", ""),
        ] {
            assert_eq!(PriceList::display_name(model), name, "{model}");
        }
    }

    #[test]
    fn plans_come_from_the_list_in_order() {
        let list = mini();
        let plan = |tier, org| list.claude_plan(tier, org).map(|p| (p.name, p.monthly));
        assert_eq!(
            plan(Some("default_claude_max_5x"), Some("claude_max")),
            Some(("Max 5×".into(), Some(100.0)))
        );
        assert_eq!(plan(None, Some("claude_max")), Some(("Max".into(), None)));
        assert_eq!(
            plan(Some("default_claude_ai"), Some("claude_pro")),
            Some(("Pro".into(), Some(20.0)))
        );
        assert_eq!(plan(None, Some("claude_team")), None);
        assert_eq!(
            list.codex_plan(" Plus ").map(|p| p.monthly),
            Some(Some(20.0))
        );
        assert_eq!(list.codex_plan("proplus"), None);
        let bundled = PriceList::parse(BUNDLED).unwrap();
        assert_eq!(
            bundled
                .claude_plan(Some("default_claude_max_5x"), Some("claude_max"))
                .map(|p| (p.name, p.monthly)),
            Some(("Max 5×".into(), Some(100.0)))
        );
        assert_eq!(
            bundled.codex_plan("plus").and_then(|p| p.monthly),
            Some(20.0)
        );
    }
}
