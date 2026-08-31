/* One guard for every money field in the app.
 *
 * There are 18 `inputmode="decimal"` inputs across 8 templates -- the budget
 * Assigned cell, Move Money, goals, the register amount + splits + transfer +
 * reconcile, scheduled amounts, the calendar quick-add, the FAB, account
 * balances. Wiring @beforeinput onto each one by hand would mean 18 chances
 * to miss one, and the 19th would ship unguarded, because a template author
 * adding a money field has no reason to know the handler exists.
 *
 * So this is delegated from the document instead: any input that declares
 * itself a decimal field is covered, including ones inside modals that have
 * not been rendered yet and ones added by future work. The router swaps views
 * by replacing innerHTML, which would drop per-element listeners anyway -- a
 * document-level listener survives navigation for free.
 *
 * `type="number"` inputs are deliberately NOT touched: the browser already
 * refuses non-numeric input there, and interfering would break the spinner
 * and the negative-value fields (the register's bulk day-shift takes -3).
 *
 * WHY NOT DIGITS ONLY. parseDollars routes through PBCalc, so "100+25" in a
 * money field really does enter 125, and the Move Money dialog advertises it
 * ("0.00 · or 40+10"). Blocking operators would satisfy a literal reading of
 * "no non-numerical characters" by deleting a working feature. What actually
 * gets refused is what a person means by that: letters, %, ^, emoji, stray
 * punctuation -- anything the parser cannot turn into an amount.
 *
 * beforeinput rather than keydown, because keydown catches typing only and
 * misses the two ways junk usually arrives: paste and drag-drop. It also
 * fires for IME commits, and preventDefault leaves the caret position and the
 * browser's own undo stack intact.
 */

(function () {
  /* Digits, both decimal separators, currency and grouping the parser
     tolerates, the calculator operators, and space. */
  var ALLOWED = /^[0-9.,$+\-*/() ]*$/;

  /* Input types that are text-like enough for beforeinput to carry data.
     A decimal inputmode on anything else is a template mistake, not ours. */
  function isGuarded(el) {
    if (!el || el.tagName !== "INPUT") return false;
    if (el.type === "number") return false; /* the browser handles these */
    return el.getAttribute("inputmode") === "decimal" || el.hasAttribute("data-numeric");
  }

  document.addEventListener(
    "beforeinput",
    function (e) {
      var el = e.target;
      if (!isGuarded(el)) return;

      var type = e.inputType || "";
      /* Never interfere with removal or with the browser's own history --
         blocking those makes a field feel stuck rather than strict. */
      if (type.indexOf("delete") === 0 || type === "historyUndo" || type === "historyRedo") return;

      var text = e.data;
      /* Paste and drag-drop carry their payload on dataTransfer, not data.
         Reading only e.data is the usual reason a "guarded" field still
         accepts pasted junk. */
      if (text == null && e.dataTransfer) text = e.dataTransfer.getData("text");
      if (text == null) return;

      if (!ALLOWED.test(text)) e.preventDefault();
    },
    true /* capture: run before any per-field handler that might stopPropagation */
  );
})();
