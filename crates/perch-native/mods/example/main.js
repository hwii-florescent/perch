// A minimal native mod. Copy this folder to native-mods/<your-id>/ and edit it: the window
// redraws on save. render() describes elements; Rust draws them. There is no DOM.
import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";

export default class Example extends View {
  init(_props, _cx) {
    this.count = 0;
  }

  render(_cx) {
    return v_flex()
      .id("example")
      .size_full()
      .p(12)
      .gap(8)
      .text_size(13)
      .child(div().id("example-title").font_semibold().child("Native mods"))
      .child(
        h_flex()
          .id("example-counter")
          .gap(8)
          .items_center()
          .cursor_pointer()
          .on_click((_event, cx) => {
            this.count += 1;
            cx.notify();
          })
          .child(div().child(`Clicked ${this.count} times`)),
      );
  }
}
