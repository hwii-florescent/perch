// main.tsx of Perch's stock screen "stock:terminal-search", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const BTN = "h-[1.4rem] w-[1.4rem] shrink-0 rounded-ui bg-surface-1 leading-none text-subtext-0 [font-family:inherit] hover:bg-overlay-0 hover:text-fg";
export default function TerminalSearch({ query, setQuery, findNext, findPrevious, close }) {
    return (_jsxs("div", {
        className: "absolute top-2 right-3 z-20 flex items-center gap-[0.3rem] rounded-ui bg-surface-1 px-[0.4rem] py-[0.3rem] shadow-[0_2px_8px_rgba(0,0,0,0.35)]",
        "data-testid": "term-search",
        children: [
            _jsx("input", {
                type: "text",
                autoFocus: true,
                className: "w-[11rem] rounded-ui bg-surface-0 px-[0.45rem] py-[0.2rem] text-[0.8rem] text-fg [font-family:inherit] focus:[outline:1px_solid_var(--accent)]",
                "data-testid": "term-search-input",
                placeholder: "Find\u2026",
                value: query,
                onChange: (e) => setQuery(e.target.value),
                onKeyDown: (e) => {
                    // An input method's Enter or Escape belongs to the composition.
                    if (e.nativeEvent.isComposing)
                        return;
                    if (e.key === "Enter") {
                        e.preventDefault();
                        if (e.shiftKey)
                            findPrevious();
                        else
                            findNext();
                    }
                    else if (e.key === "Escape") {
                        e.preventDefault();
                        close();
                    }
                }
            }),
            _jsx("button", {
                type: "button",
                className: `${BTN} text-[0.75rem]`,
                title: "Previous (Shift+Enter)",
                onClick: findPrevious,
                children: "\u2191"
            }),
            _jsx("button", {
                type: "button",
                className: `${BTN} text-[0.75rem]`,
                title: "Next (Enter)",
                onClick: findNext,
                children: "\u2193"
            }),
            _jsx("button", {
                type: "button",
                className: `${BTN} text-[0.95rem]`,
                title: "Close (Escape)",
                onClick: close,
                children: "\u00D7"
            })
        ]
    }));
}
