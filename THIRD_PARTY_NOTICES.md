# Third-party notices

Perch's original code is licensed under the GNU General Public License,
version 3 only (`GPL-3.0-only`); see [LICENSE](LICENSE). Third-party code,
dependencies, and assets retain their respective licenses and notices.

## Orca agent catalog and launch metadata

The provider names, executable mappings, documentation links, and default
arguments in `crates/perch-core/src/agent_catalog.json` are adapted from
[stablyai/orca](https://github.com/stablyai/orca), commit
`9aa0f7e77d366c23a3cc8de2da32ae550d397dc0`:

- `src/renderer/src/lib/agent-catalog.tsx`
- `src/shared/tui-agent-config.ts`
- `src/shared/tui-agent-permissions.ts`

Perch launches Claude Agent Teams with Claude's native in-process team mode;
it does not depend on Orca's application-specific pane wrapper.

## Orca harness and terminal icons

`packages/web/src/components/AgentIcon.tsx` and
`packages/web/src/assets/agent-icons/` adapt the SVG marks, generic terminal
icon and bundled favicons from Orca commit
`564f135248874ca3a710e3932c2395f5cbff0203`:

- `src/renderer/src/lib/agent-icon-glyphs.tsx`
- `src/renderer/src/components/status-bar/icons.tsx`
- `src/renderer/src/components/tab-bar/shell-icons.tsx`
- `src/shared/agent-icons/`
- `resources/openclaude-logo.png`

Brand marks remain the property of their respective owners. The Orca-derived
code and assets above are distributed under the following MIT notice.

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

## PDF.js

PDF previews use [Mozilla PDF.js](https://github.com/mozilla/pdf.js), distributed
as `pdfjs-dist` under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
Copyright Mozilla Foundation and PDF.js contributors. The dependency retains
its copyright/license headers and includes the full license in its `LICENSE` file.
