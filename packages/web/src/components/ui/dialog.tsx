/**
 * dialog.tsx: the modal shell for forms and pickers. It is the stock screen `stock:dialog`
 * (`stock-ui/dialog/main.tsx`), or the person's package chosen for it (`perch mod use stock:dialog <id>`), given
 * the same props (`StockRoute`). Confirmations use `ConfirmDialog`; this is for anything with a body.
 */
import type { DialogProps } from "@perch/sdk";
import StockDialog from "../../stock-ui/dialog/main";
import { StockRoute } from "../mod-root";

export function Dialog(props: DialogProps) {
  return <StockRoute name="dialog" props={props} stock={StockDialog} />;
}
