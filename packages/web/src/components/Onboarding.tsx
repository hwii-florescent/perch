/**
 * Onboarding.tsx: the first-run welcome (shown once, `onboarding.ts`). The screen is `stock:onboarding`
 * (`stock-ui/onboarding/main.tsx`) or the person's package chosen for it; this file binds Open Settings.
 */
import { usePerchStore } from "../store";
import Welcome from "../stock-ui/onboarding/main";
import { StockRoute } from "./mod-root";

export function Onboarding({ onDismiss }: { onDismiss: () => void }) {
  const props = { onDismiss, openSettings: () => usePerchStore.getState().setSettingsOpen(true) };
  return <StockRoute name="onboarding" props={props} stock={Welcome} />;
}
