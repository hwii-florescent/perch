/** Floating chrome (the phone's header, tab bar and key bar, and notices over a terminal):
 * borderless, rounded like the panes, a translucent surface over a blur. Buttons inside take
 * the pane radius too (`rounded-ui` follows `--radius`), so they read as part of one piece.
 * Use `button()` / `GHOST_BUTTON` for what goes inside; nothing here styles a control. */
export const glass =
  "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150";

/** For buttons on floating chrome, after `GHOST_BUTTON`: a finger leaves no hover, so a tapped
 * button would stay filled (`hover` is not gated to real pointers, tailwind.css); a press fills instead. */
export const TAP_BUTTON = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
