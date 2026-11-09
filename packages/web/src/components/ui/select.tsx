/**
 * select.tsx: Perch's one dropdown. It is the stock screen `stock:select` (`stock-ui/select/main.tsx`), or the
 * person's package chosen for it (`perch mod use stock:select <id>`), given the same props (`StockRoute`).
 * Settings > Mods imports the stock source directly, so recovery never runs a person's copy.
 */
import type { SelectOption, SelectProps } from "@perch/sdk";
import StockSelect from "../../stock-ui/select/main";
import { StockRoute } from "../mod-root";

export type { SelectOption };

export function Select(props: SelectProps) {
  return <StockRoute name="select" props={props} stock={StockSelect} />;
}
