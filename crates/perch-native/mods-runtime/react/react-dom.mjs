//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
import { createPortal, reconciler } from "./renderer.mjs";

export { createPortal };
export const flushSync = (fn) => reconciler.flushSyncFromReconciler(fn);
export default { createPortal, flushSync };
