/**
 * SlashPopover.tsx: the composer's autocomplete list, as the SDK's `SlashPopover` opens it from the native chat (stock
 * or a copy). The screen is `stock:slash-popover` (`stock-ui/slash-popover/main.tsx`) or the person's package chosen
 * for it, with the chat's own items and callbacks; the composer keeps its focus and keys. A phone keeps Perch's own.
 */
import type { SlashPopoverProps } from "@perch/sdk";
import { useIsMobileWidth } from "../responsive";
import StockSlashPopover from "../stock-ui/slash-popover/main";
import { StockRoute } from "./mod-root";

export function SlashPopover(props: SlashPopoverProps) {
  return <StockRoute name="slash-popover" props={props} stock={StockSlashPopover} exact={useIsMobileWidth()} />;
}
