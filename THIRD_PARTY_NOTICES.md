# Third-party notices

## Orca agent catalog and launch metadata

The provider names, executable mappings, documentation links, and default
arguments in `crates/perch-core/src/agent_catalog.json` are adapted from
[stablyai/orca](https://github.com/stablyai/orca), commit
`9aa0f7e77d366c23a3cc8de2da32ae550d397dc0`:

- `src/renderer/src/lib/agent-catalog.tsx`
- `src/shared/tui-agent-config.ts`
- `src/shared/tui-agent-permissions.ts`

Perch launches Claude Agent Teams with Claude's native in-process team mode;
it does not depend on Orca's application-specific pane wrapper. Branding and
image assets are not included in this adaptation.

MIT License

Copyright (c) 2026 Lovecast Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
