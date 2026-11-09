import type { Terminal } from "@xterm/xterm";
import type { MobileKeysProps } from "@perch/sdk";
import { readClipboardText } from "../nativeApp";
import Keys from "../stock-ui/mobile-keys/main";
import { StockRoute } from "./mod-root";

/**
 * The phone's key bar under an agent terminal. The screen is `stock:mobile-keys` (`stock-ui/mobile-keys/`), or the
 * person's copy once turned on for this phone (`phoneMods.ts`). What a key types goes through `send`, the terminal
 * view's own input (it types only while that view may); Paste reads the clipboard here and pastes into the terminal
 * (in a browser this needs a secure page; elsewhere the read is refused and nothing is typed).
 */
export function MobileKeyBar({ term, send }: { term: Terminal | null; send: (data: string) => void }) {
  const props: MobileKeysProps = {
    send,
    paste: () => void readClipboardText().then((text) => { if (text) term?.paste(text); }, () => {}),
    appCursor: () => term?.modes.applicationCursorKeysMode ?? false,
  };
  return <StockRoute name="mobile-keys" props={props} stock={Keys} />;
}
