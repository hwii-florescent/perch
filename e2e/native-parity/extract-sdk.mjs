#!/usr/bin/env node
//! extract-sdk.mjs: copies what the web's `@perch/sdk` derived for each parity state (the `sdk` section of the web
//! reference JSON) into `fixtures/sdk/<screen>.<state>.json`, where the native client's `perch` module is checked
//! against it (`crates/perch-native/tests/mods_navigation_parity.rs`). What a section holds depends on the screen: the
//! sidebar's `navigation` and `hosts`; `workspaceTabs` (tabs, pane-header), `statusLine`, `planUsage` and `zoom`
//! (status), `notifications` (toast), `agentChoices` (new-session), `paneLook` (pane-header). A screen that takes
//! props (navigator, pane-menu, confirm, dialog, new-session, pane-header) also has them under `props`, and a state
//! that types or presses something on the way (`steps` in its fixture) lists those under `steps`.
//!
//!   node native-parity/extract-sdk.mjs [--web <dir>]     (default: artifacts-native-parity/web, after `npm run parity:web`)
//!
//! The derived objects do not depend on the theme; the script refuses to write when the dark and light files disagree.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const webAt = args.indexOf("--web");
const web = webAt >= 0 ? path.resolve(args[webAt + 1]) : path.join(here, "..", "artifacts-native-parity", "web");
const out = path.join(here, "fixtures", "sdk");

const files = fs.readdirSync(web).filter((name) => name.endsWith(".dark.json"));
if (files.length === 0) {
  console.error(`no web reference JSON in ${web}; run \`npm run parity:web\` first`);
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });
for (const file of files.sort()) {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(web, name), "utf8"));
  const dark = read(file);
  const lightName = file.replace(/\.dark\.json$/, ".light.json");
  if (fs.existsSync(path.join(web, lightName)) && !isDeepStrictEqual(dark.sdk, read(lightName).sdk)) {
    console.error(`${file} and ${lightName} derive different sdk objects`);
    process.exit(1);
  }
  if (!dark.sdk) continue;
  const target = path.join(out, `${dark.screen}.${dark.state}.json`);
  fs.writeFileSync(target, `${JSON.stringify(dark.sdk, null, 2)}\n`);
  console.log(path.relative(process.cwd(), target));
}
