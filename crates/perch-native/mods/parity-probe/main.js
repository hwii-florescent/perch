// The smallest mod the parity helper draws: two named elements from perch.navigation(), so a
// test can see the helper's PNG and JSON carry what the mod read. Ids are `name` or `name:key`.
import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import * as perch from "perch";

export default class ParityProbe extends View {
  render(_cx) {
    const nav = perch.navigation();
    const tokens = perch.theme();
    const first = nav.projects[0];
    return v_flex()
      .id("probe-root")
      .size_full()
      .p(8)
      .gap(4)
      .bg(tokens["panel-bg"])
      .text_color(tokens.text)
      .text_size(13)
      .child(div().id("probe-host").h(20).child(nav.hostId))
      .child(
        div()
          .id(`probe-project:${first ? first.id : "none"}`)
          .h(24)
          .bg(tokens.accent)
          .child(first ? first.name : "No projects"),
      );
  }
}
