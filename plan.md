**Context.** I'm working on Perch (`/Users/hwiii/Github/perch`), a terminal-led workspace with real shells and agent CLIs beside files, Git and previews. Read `AGENTS.md` first, then `docs/ROADMAP.md`. The section to read is "Perch's version of Claude Projects and sub-sessions (design notes)", committed as `fe07822`.

**Goal of this chat: planning only, no building yet.** Turn those notes into an organised plan. Help me settle the open decisions one at a time and end with an ordered, scoped build plan. Ask me with `ask_user_question` when a choice is mine. Don't write product code.

**What I want.** Perch's own version of Anthropic's Claude Code Projects and sub-sessions. These are cross-provider: Claude, Codex, Pi and OMP. They are built on ordinary Perch sessions, not on Anthropic's cloud or structured/RPC chat.
- **Projects:** shared instructions and context, plus threads (child sessions) and an Overview of what is running, what needs me and what finished.
- **Sub-sessions:** agents that can spawn children and message each other through a `perch` CLI plus an installed skill. There is no `perch` CLI yet.

**Already decided**
- Threads share the Nest by default. A worktree is opt-in via `perch spawn --worktree`.
- Perch hosts no model: no Perch-run coordinator, scheduler or planner.
- The first build step is a feasibility spike, run with zero tokens:
  - Check that Claude, Codex, Pi and OMP each find an installed skill.
  - Check that an agent can call an authenticated `perch whoami` and `perch report`.

**Open, to settle in this chat.** These are the ten items under "Open: decide before the step that needs it" in the roadmap section:
1. Who coordinates: a normal lead session I pick (leaning yes), or a Perch-run coordinator chat.
2. What a Project holds: instructions only, or also reference files, shared memory and a library.
3. Naming: "Project" already means a repository (Birdhouse) in the sidebar.
4. The Overview's form, and whether a lead can ask me questions.
5. Reports are claims, not proof.
6. Message authority and delivery.
7. Credentials.
8. Limits enforced before dispatch.
9. Phone and remote.
10. Provider terms.

**What I want back at the end**
- Each open decision with a recommendation and its trade-off.
- A final slice order, with a validation plan for each slice.
- A short list of what to probe live first.
- The roadmap and `docs/DECISIONS.md` updated, and committed locally without pushing.

**Constraints**
- Domain logic goes in Rust with a unit test, and React stays thin.
- One slice at a time, verified live with cheap models only (`claude-haiku-4-5`, `gpt-5.6-luna`).
- Probe the real CLIs before claiming a gap.
- Don't push.
- Leave `crates/perch-core/src/relay/host.rs` alone. It is an uncommitted change that isn't part of this work.

**Useful background**
- `docs/NATIVE-UI-PARITY.md`: what the CLI-backed chat already does.
- `docs/CONTEXT-BRIDGE.md` and `crates/perch-core/src/server/context_bridge.rs`: the existing core-originated send, Claude only.
- `crates/perch-core/src/native_ui/`, `agent_fleet.rs`, `provider_environment.rs`: the native bridge, provider manifests, and how launch environment is built.
