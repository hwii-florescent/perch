//! What a native mod reads from `perch.navigation()` and `perch.hosts()` is what the web's
//! `useNavigation` and `useHosts` derive from the same store: for each parity fixture state, the
//! fixture is fed to the sidebar's reducer as the core's messages and the module's answers are
//! compared, field for field, with what the web reference wrote
//! (`e2e/native-parity/fixtures/sdk/`, from `extract-sdk.mjs`). No core, no window.

#[path = "common/parity.rs"]
mod parity;

use gpui_shell::{HostArguments, HostValue};
use perch_native::mods::perch::{from_host, to_host, Perch};
use serde_json::{json, Value};

/// Every path where `native` differs from `web`.
fn diff(path: &str, web: &Value, native: &Value, out: &mut Vec<String>) {
    match (web, native) {
        (Value::Object(a), Value::Object(b)) => {
            for key in a.keys().chain(b.keys().filter(|k| !a.contains_key(*k))) {
                let (x, y) = (
                    a.get(key).unwrap_or(&Value::Null),
                    b.get(key).unwrap_or(&Value::Null),
                );
                if !a.contains_key(key) || !b.contains_key(key) {
                    out.push(format!("{path}.{key}: web {x} / native {y}"));
                } else {
                    diff(&format!("{path}.{key}"), x, y, out);
                }
            }
        }
        (Value::Array(a), Value::Array(b)) if a.len() == b.len() => {
            for (i, (x, y)) in a.iter().zip(b).enumerate() {
                diff(&format!("{path}[{i}]"), x, y, out);
            }
        }
        (Value::Array(a), Value::Array(b)) => {
            let ids = |list: &Vec<Value>| -> Vec<Value> {
                list.iter()
                    .map(|v| v.get("id").cloned().unwrap_or(v.clone()))
                    .collect()
            };
            out.push(format!(
                "{path}: web {} items {:?} / native {} items {:?}",
                a.len(),
                ids(a),
                b.len(),
                ids(b)
            ));
        }
        _ if web != native => out.push(format!("{path}: web {web} / native {native}")),
        _ => {}
    }
}

#[test]
fn navigation_and_hosts_match_the_web_for_every_fixture_state() {
    let fixture = parity::Fixture::load(&parity::fixture_path("sidebar"));
    let states = fixture.states();
    assert_eq!(states.len(), 5, "the sidebar fixture's five states");
    let mut failures = Vec::new();
    for state in &states {
        let expected_path = parity::parity_dir()
            .join("fixtures/sdk")
            .join(format!("sidebar.{state}.json"));
        let expected: Value =
            serde_json::from_str(&std::fs::read_to_string(&expected_path).unwrap()).unwrap();
        let perch = Perch::new();
        parity::publish(&perch, &fixture, state);
        let module = perch.module("parity");
        let view = perch.sidebar();
        let options = to_host(&json!({
            "showTerminals": view.show_terminals,
            "sortByAttention": view.sort_by_attention,
        }));
        let call = |name: &str, args: Vec<HostValue>| {
            from_host(
                &module
                    .call(name, &HostArguments::new(args))
                    .unwrap_or_else(|e| panic!("{name}: {}", e.message())),
            )
        };
        let native = json!({
            "navigation": call("navigation", vec![options]),
            "hosts": call("hosts", vec![]),
        });
        let mut differences = Vec::new();
        diff(state, &expected, &native, &mut differences);
        if !differences.is_empty() {
            failures.push(format!("{state}:\n  {}", differences.join("\n  ")));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}
