/**
 * markdownRepair.ts — Wave: jean chat-UI parity, item 7 ("streaming markdown
 * repair").
 *
 * `marked.parse()` runs on a growing, incomplete markdown string every time
 * a new streaming chunk arrives (see `views/Chat.tsx`'s `renderMarkdown`).
 * Until a construct closes, this can render visibly broken output for a
 * frame or two: an open code fence with no closing ``` swallows the rest of
 * the message as "code"; a lone inline backtick eats the remaining text as
 * `code`; a dangling `**` flips everything after it bold. `repairMarkdown`
 * is a cheap pre-pass — run only while a message is still streaming (see
 * the `message.streaming` check at the call site) — that closes those
 * constructs so the partial render looks stable instead of flickering
 * between styles as more text arrives. Once a message finishes streaming,
 * the final, complete text is rendered as-is without this pass.
 *
 * This is intentionally NOT a full markdown parser — just a few counting
 * heuristics good enough to avoid the worst mid-stream flicker:
 *   - odd number of ``` fence markers → append a closing fence
 *   - odd number of inline `backticks` (outside any fence) → append one
 *   - odd number of `**`/`__` bold markers (outside any fence) → append one
 *
 * Deliberately NOT handled: single `*`/`_` (italic) markers. Single `*`
 * doubles as a markdown list-bullet character ("* item") and single `_` is
 * common in plain prose/identifiers ("some_var"), so naively balancing them
 * would corrupt far more streams than it fixes. `**`/`__` runs are
 * unambiguous enough to be worth auto-closing; single-char emphasis isn't.
 *
 * The repo has no web unit-test runner (see CLAUDE.md), so test cases are
 * documented here instead of in a `.test.ts` file:
 *
 *   repairMarkdown("hello")
 *     → "hello"                                   (no-op, nothing open)
 *
 *   repairMarkdown("```js\nconst x = 1;")
 *     → "```js\nconst x = 1;\n```"                 (closes an open fence)
 *
 *   repairMarkdown("```js\nconst x = 1;\n```\nmore text")
 *     → unchanged                                  (fence already closed)
 *
 *   repairMarkdown("some `inline code")
 *     → "some `inline code`"                       (closes inline code)
 *
 *   repairMarkdown("**bold text")
 *     → "**bold text**"                            (closes bold)
 *
 *   repairMarkdown("__bold__ and __more")
 *     → "__bold__ and __more__"                    (closes the second pair,
 *                                                    leaves the first alone)
 *
 *   repairMarkdown("```js\nlet x = `template ${1}`;")
 *     → "```js\nlet x = `template ${1}`;\n```"     (only closes the outer
 *                                                    fence — backticks
 *                                                    *inside* an open fence
 *                                                    are literal code, not
 *                                                    inline-code markers, so
 *                                                    they're left alone)
 *
 *   repairMarkdown("a ** b ** c **d")
 *     → "a ** b ** c **d**"                        (only the trailing
 *                                                    dangling pair is
 *                                                    closed; the complete
 *                                                    pair before it is left
 *                                                    alone)
 */

/** Closes a dangling inline-code span and dangling `**`/`__` bold pairs in
 * text that is known not to be inside an open triple-backtick fence. */
function repairInlineMarks(text: string): string {
  let result = text;

  const backtickCount = (result.match(/`/g) ?? []).length;
  if (backtickCount % 2 === 1) {
    result += "`";
  }

  const boldStarCount = (result.match(/\*\*/g) ?? []).length;
  if (boldStarCount % 2 === 1) {
    result += "**";
  }

  const boldUnderscoreCount = (result.match(/__/g) ?? []).length;
  if (boldUnderscoreCount % 2 === 1) {
    result += "__";
  }

  return result;
}

/** Auto-closes unclosed markdown constructs in a partial (still-streaming)
 * markdown string. See module doc comment above for behavior and test
 * cases. Pure function — safe to call on every render. */
export function repairMarkdown(text: string): string {
  if (!text) return text;

  // Split on the triple-backtick fence marker. If the marker appears an odd
  // number of times, the text currently ends mid-fence (the last segment is
  // open code) — everything before that last segment alternates
  // outside/inside-a-completed-fence starting from "outside".
  const parts = text.split("```");
  const markerCount = parts.length - 1;
  const hasOpenFence = markerCount % 2 === 1;

  const repairedParts = parts.map((part, i) => {
    const isInsideFence = i % 2 === 1 || (hasOpenFence && i === parts.length - 1);
    // Even-indexed parts are "outside" any fence, EXCEPT when this is the
    // trailing part of an odd (unterminated) fence — that trailing part is
    // itself open code and must be left untouched.
    return isInsideFence ? part : repairInlineMarks(part);
  });

  let result = repairedParts.join("```");
  if (hasOpenFence) {
    result += "\n```";
  }
  return result;
}
