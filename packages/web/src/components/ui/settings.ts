/** Ghost button of the agent catalog; also the "Manage agents" button in the settings list, the CLI start panel and the agent picker. */
export const CATALOG_TOGGLE = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]";
export const CATALOG_ACTION = `flex items-center gap-2 ${CATALOG_TOGGLE}`;

/** Settings-modal chrome shared by `SettingsModal` and `AgentCatalog`.
 * `settings-modal__*` tokens that e2e selects on (`host-row`, `agent-block`,
 * `model-row`, `body`, `backdrop`) are kept as unstyled hooks at the use site. */
export const SECTION = "border-b border-b-overlay-0 px-4 py-3 last:[border-bottom:none]";
export const SECTION_TITLE = "m-0 mb-[0.6rem] text-[0.88rem] font-semibold tracking-[0.04em] text-fg uppercase";
export const MUTED = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0";
export const EMPTY = "m-0 mb-2 text-[0.82rem] text-subtext-0";
/** `settings-modal__field-row` stays: composer.css zeroes `.mode-switch`'s auto margin inside it. */
export const FIELD_ROW = "settings-modal__field-row flex items-center gap-[0.6rem] text-[0.82rem]";
export const CHECKBOX_ROW = "mb-[0.6rem] flex cursor-pointer items-center gap-2 text-[0.82rem] text-fg";

const FIELD = "rounded-ui border border-overlay-0 bg-surface-1 text-fg [font-family:inherit]";
export const SELECT = `${FIELD} px-2 py-[0.3rem] text-[0.8rem] focus:border-accent focus:[outline:none]`;
export const SELECT_HOST = `${SELECT} min-w-[5.5rem] shrink-0`;
const INPUT_BASE = `${FIELD} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] focus:[outline:1px_solid_var(--accent)]`;
export const INPUT = `${INPUT_BASE} flex-1`;
export const INPUT_PORT = `${INPUT_BASE} flex-[0_0_5rem]`;
export const INPUT_WIDE = `${INPUT_BASE} flex-[1_1_100%]`;
export const ADD_ROW = "flex flex-wrap items-center gap-[0.4rem]";

export const LIST = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0";
const ROW = "flex items-center gap-2 rounded-ui border border-overlay-0 bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]";
export const HOST_ROW = `settings-modal__host-row ${ROW}`;
export const MODEL_ROW = `settings-modal__model-row ${ROW}`;
export const NAME = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg";
export const ADDR = "min-w-0 flex-1 overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0";

const BTN = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]";
export const BTN_PRIMARY = `${BTN} bg-accent`;
export const BTN_DANGER = `${BTN} ml-auto bg-red`;
