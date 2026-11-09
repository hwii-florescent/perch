/**
 * ConfirmDialog.tsx: the confirmation every caller in Perch opens before a destructive or disruptive action. It is
 * the stock screen `stock:confirm` (`stock-ui/confirm/main.tsx`), or the person's package chosen for it with
 * `perch mod use stock:confirm <id>` / Settings > Mods, given the same props (`StockRoute`). Callers render it at
 * their own call site, as before; the decision and its action stay the caller's.
 */
import type { ConfirmProps } from "@perch/sdk";
import Confirm from "../stock-ui/confirm/main";
import { StockRoute } from "./mod-root";

export type ConfirmDialogProps = ConfirmProps;

export function ConfirmDialog(props: ConfirmDialogProps) {
  return <StockRoute name="confirm" props={props} stock={Confirm} />;
}
