/**
 * editorSearchPanel.ts — the editor's find panel, with the replace row collapsed by default.
 *
 * `@codemirror/search`'s own panel always shows replace, and its class is not exported, so this is
 * the same panel rebuilt: same DOM names (`search`, `next`, `prev`, `replace`, `replaceAll`, `close`)
 * and the same commands, plus an arrow that unfolds the replace row. Cmd+Option+F / Cmd+Shift+F
 * (Ctrl+H elsewhere) open it already unfolded (`openReplace`).
 */
import { StateEffect } from "@codemirror/state";
import { EditorView, runScopeHandlers, type Panel, type ViewUpdate } from "@codemirror/view";
import {
  SearchQuery, closeSearchPanel, findNext, findPrevious, getSearchQuery, openSearchPanel, replaceAll,
  replaceNext, searchPanelOpen, selectMatches, setSearchQuery,
} from "@codemirror/search";

const unfold = StateEffect.define<null>();

type Props = Record<string, string | boolean | ((event: Event) => void)>;

function elt<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, children: (Node | string)[] = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (typeof value === "boolean") { if (value) node.setAttribute(key, ""); }
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

export function createSearchPanel(view: EditorView): Panel {
  let query = getSearchQuery(view.state);
  const readOnly = view.state.readOnly;
  const field = (name: string, placeholder: string, value: string, extra: Props = {}) =>
    elt("input", { name, value, placeholder, "aria-label": placeholder, class: "cm-textfield", form: "", onchange: commit, onkeyup: commit, ...extra });
  const check = (name: string, checked: boolean) => elt("input", { type: "checkbox", name, form: "", checked, onchange: commit });
  const button = (name: string, onclick: () => void, text: string) => elt("button", { class: "cm-button", name, type: "button", onclick }, [text]);

  const search = field("search", "Find", query.search, { "main-field": "true" });
  const replace = field("replace", "Replace", query.replace);
  const caseBox = check("case", query.caseSensitive);
  const reBox = check("re", query.regexp);
  const wordBox = check("word", query.wholeWord);
  const toggle = elt("button", { name: "toggleReplace", type: "button", "aria-label": "Toggle replace", "aria-expanded": "false", onclick: () => setFolded(replaceRow.hidden === false) }, ["▸"]);
  const replaceRow = elt("div", { class: "cm-search-row", hidden: true }, [
    replace,
    button("replace", () => replaceNext(view), "replace"),
    button("replaceAll", () => replaceAll(view), "replace all"),
  ]);

  function setFolded(folded: boolean) {
    replaceRow.hidden = folded;
    toggle.textContent = folded ? "▸" : "▾";
    toggle.setAttribute("aria-expanded", String(!folded));
  }

  function commit() {
    const next = new SearchQuery({ search: search.value, caseSensitive: caseBox.checked, regexp: reBox.checked, wholeWord: wordBox.checked, replace: replace.value });
    if (!next.eq(query)) {
      query = next;
      view.dispatch({ effects: setSearchQuery.of(next) });
    }
  }

  const dom = elt("div", {
    class: "cm-search",
    onkeydown: (event: Event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (runScopeHandlers(view, event, "search-panel")) event.preventDefault();
      else if (event.key === "Enter" && event.target === search) { event.preventDefault(); (event.shiftKey ? findPrevious : findNext)(view); }
      else if (event.key === "Enter" && event.target === replace) { event.preventDefault(); replaceNext(view); }
    },
  }, [
    elt("div", { class: "cm-search-row" }, [
      ...(readOnly ? [] : [toggle]),
      search,
      button("next", () => findNext(view), "next"),
      button("prev", () => findPrevious(view), "previous"),
      button("select", () => selectMatches(view), "all"),
    ]),
    elt("div", { class: "cm-search-row" }, [
      elt("label", {}, [caseBox, "match case"]),
      elt("label", {}, [reBox, "regexp"]),
      elt("label", {}, [wordBox, "by word"]),
    ]),
    ...(readOnly ? [] : [replaceRow]),
    elt("button", { name: "close", type: "button", "aria-label": "close", onclick: () => closeSearchPanel(view) }, ["×"]),
  ]);

  return {
    dom,
    top: true,
    mount: () => search.select(),
    update(update: ViewUpdate) {
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(unfold)) setFolded(false);
          if (effect.is(setSearchQuery) && !effect.value.eq(query)) {
            query = effect.value;
            search.value = query.search;
            replace.value = query.replace;
            caseBox.checked = query.caseSensitive;
            reBox.checked = query.regexp;
            wordBox.checked = query.wholeWord;
          }
        }
      }
    },
  };
}

/** Open the find panel with the replace row unfolded and its field focused. */
export function openReplace(view: EditorView): boolean {
  if (view.state.readOnly) return openSearchPanel(view);
  openSearchPanel(view);
  view.dispatch({ effects: unfold.of(null) });
  (view.dom.querySelector(".cm-search input[name=replace]") as HTMLInputElement | null)?.focus();
  return true;
}

/** Find next / previous only while the panel is open: Cmd+G never opens it. */
export const whenOpen = (command: (view: EditorView) => boolean) => (view: EditorView) => searchPanelOpen(view.state) && command(view);
