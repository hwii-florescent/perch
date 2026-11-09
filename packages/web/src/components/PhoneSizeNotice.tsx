/**
 * PhoneSizeNotice.tsx: over a desktop terminal whose size a phone holds. The screen is `stock:phone-size`
 * (`stock-ui/phone-size/main.tsx`) or the person's package chosen for it; taking the size back (the terminal's resize
 * lease) is bound by the caller. A phone keeps Perch's own.
 */
import type { PhoneSizeProps } from "@perch/sdk";
import { useIsMobileWidth } from "../responsive";
import PhoneSize from "../stock-ui/phone-size/main";
import { StockRoute } from "./mod-root";

export function PhoneSizeNotice(props: PhoneSizeProps) {
  return <StockRoute name="phone-size" props={props} stock={PhoneSize} exact={useIsMobileWidth()} />;
}
