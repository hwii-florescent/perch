// The web app's stock review, unchanged (`review/` is the app's own export of `packages/web/src/stock-ui/review`), on
// the native React runtime: the window opens this mod as its `review` screen with `{ workspaceId }`. Its data and
// actions are the window's Git store (`useGitReview`: status, diff, comments, previews and the review packet through
// the core), and its diff is Perch's native diff view (`DiffView`, the `diff` engine), so no diff line is drawn by
// script. To change it, copy this folder from `<native-mods>/.stock/review/` to `<native-mods>/review/` and edit the
// plain JS there; it reloads on save. The runtime files beside this one are `mods/react-runtime/`, written into this
// folder by the mod host. `screen.js` first: it sets up the host the runtime reads when it loads.
import { screen } from "./screen.js";
import Review from "./review/main.js";

/** The box the review fills: the whole place it is shown in, on the panel's colour, as the web's tool pane. */
const PANE = { display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", position: "relative" };

export default screen("review", Review, { container: PANE, keyboard: "in-flow", props: (raw) => ({ workspaceId: String(raw.workspaceId ?? "") }) });
