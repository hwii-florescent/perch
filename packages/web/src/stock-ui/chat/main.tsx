//! Chat, the stock screen `stock:chat`: an agent session's native chat over its real CLI, where the person chose the
//! chat view (`AgentPane`). Perch shows one copy per pane with `sessionId`, `providerId` (the agent shown) and
//! `terminalProviderId` (what owns its terminal, when that differs); the phone renders this source compiled in. The
//! chat's state and every action are Perch's (`useNativeChat`), and agent text is drawn only through Perch's fixed
//! `Markdown`, so a clone changes how the chat looks and is used, never how a message is sent or kept.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs
//! and `perch mod clone stock:chat` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { NativeCliChat } from "./chat";

export default function Chat(props: { sessionId: string; providerId: string; terminalProviderId?: string }) {
  return <NativeCliChat {...props} />;
}
