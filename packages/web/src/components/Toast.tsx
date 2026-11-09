/**
 * Toast.tsx: Perch's in-app notifications where the app draws them. They are the stock screen `stock:toast`
 * (`stock-ui/toast/main.tsx`), or the person's package chosen for it (`perch mod use stock:toast <id>` / Settings >
 * Mods), drawing the same list and actions from `useNotifications` (`sdk.ts`). Driven by `usePerchStore().toasts`;
 * an unfocused window escalates to a system notification instead (notifications.ts).
 */
import Notifications from "../stock-ui/toast/main";
import { StockRoute } from "./mod-root";

export function Toast() {
  return <StockRoute name="toast" props={{}} stock={Notifications} />;
}
