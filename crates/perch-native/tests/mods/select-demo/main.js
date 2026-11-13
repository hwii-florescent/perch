// A test-only mod (not a stock one): the SDK's `Select` the way the parity harness draws it (`SelectDemo` in
// `e2e/native-parity/harness/main.tsx`): the value held as a caller holds it, the field placed at `props.at` in the
// window. `mods_floating_gate` puts this folder in a user mods folder in a floating screen's slot.
import { screen } from "./screen.js";
import { jsx } from "react/jsx-runtime";
import { useState } from "react";
import { Select } from "@perch/sdk";

function SelectDemo({ at, viewport: _viewport, ...props }) {
  const [value, setValue] = useState(String(props.value));
  return jsx("div", {
    style: { position: "absolute", left: at.x, top: at.y, width: at.width },
    children: jsx(Select, { ...props, value, onChange: (next) => setValue(next) }),
  });
}

export default screen("select", SelectDemo, { container: { width: "100%", height: "100%" }, keyboard: true, props: (raw) => raw });
