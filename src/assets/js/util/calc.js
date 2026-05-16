/* YNAB-style amount calculator.
   Lets the user type expressions in any "amount" or "assigned" input
   instead of pre-computing in their head:
     12.50 + 8.99       -> 21.49
     100 - 25 * 2       -> 50
     (4.99 + 1.99) * 3  -> 20.94
     200 + 10%          -> 220
     -50 + 8            -> -42

   Pure tokenizer + shunting-yard + RPN eval — no `eval()` / `Function()`.
   That keeps the input safe to feed any user string into.

   evalExpression(str) → finite Number or NaN
   parseAmountCents(str) → integer cents or NaN
   formatExpressionPreview(str) → "= $X.XX" or "" (for the live hint)

   The module exposes itself on window.PBCalc so non-module inline
   scripts (the x-data blocks across pages/app/*.njk) can use it
   without import boilerplate. */

(function () {
  "use strict";

  /* ----- tokenizer ------------------------------------------------------ */
  /* Strips $, commas, and whitespace before scanning. Recognizes:
       NUM   - integer or decimal (3, 12.5, .5, 10%)
       OP    - + - * /
       LP RP - ( )
     Returns array of { type, value }. Throws on unknown chars. */
  function tokenize(input) {
    var s = String(input || "").replace(/[\s$,]/g, "");
    if (s === "") return [];
    var tokens = [];
    var i = 0;
    while (i < s.length) {
      var ch = s[i];
      if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
        tokens.push({ type: "op", value: ch });
        i++;
        continue;
      }
      if (ch === "(") { tokens.push({ type: "lp" }); i++; continue; }
      if (ch === ")") { tokens.push({ type: "rp" }); i++; continue; }
      if (ch === "." || (ch >= "0" && ch <= "9")) {
        var j = i;
        while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
        var raw = s.slice(i, j);
        var num = Number(raw);
        if (!isFinite(num)) return null;
        /* Percent suffix: convert "10%" → 0.10 of the running left
           operand. We rewrite as `* 0.10 / 100 * leftOperand`... but
           the safer approach: emit the raw number then a special
           "%mul" marker the eval step expands. Simpler: emit value
           as fraction and rewrite the preceding op. */
        if (s[j] === "%") {
          tokens.push({ type: "num", value: num, pct: true });
          j++;
        } else {
          tokens.push({ type: "num", value: num });
        }
        i = j;
        continue;
      }
      /* Unknown char — bail. */
      return null;
    }
    return tokens;
  }

  /* ----- percent rewrite ------------------------------------------------- */
  /* "A + B%"  →  A + (A * B/100)
     "A - B%"  →  A - (A * B/100)
     "A * B%"  →  A * (B/100)
     "A / B%"  →  A / (B/100)
     Only the immediate prior operand counts as A for the additive forms;
     that matches user intent for "100 + 10%" = 110. */
  function expandPercents(tokens) {
    var out = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.type === "num" && t.pct) {
        var prevOp = out[out.length - 1];
        var prevNum = out[out.length - 2];
        if (
          prevOp && prevOp.type === "op" &&
          (prevOp.value === "+" || prevOp.value === "-") &&
          prevNum && prevNum.type === "num"
        ) {
          /* A ± B%  →  A ± (A * B / 100) */
          out.push(
            { type: "lp" },
            { type: "num", value: prevNum.value },
            { type: "op", value: "*" },
            { type: "num", value: t.value / 100 },
            { type: "rp" }
          );
        } else {
          /* Standalone / mul-div context: just divide by 100. */
          out.push({ type: "num", value: t.value / 100 });
        }
      } else {
        out.push(t);
      }
    }
    return out;
  }

  /* ----- shunting-yard --------------------------------------------------- */
  /* Standard Dijkstra: infix → RPN. Handles unary minus by emitting a 0
     before a leading "-" or after another operator / open-paren. */
  function toRPN(tokens) {
    var out = [];
    var ops = [];
    var prec = { "+": 1, "-": 1, "*": 2, "/": 2 };
    var prev = null;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.type === "num") {
        out.push(t);
      } else if (t.type === "op") {
        /* Unary minus / plus detection */
        var isUnary = !prev || prev.type === "op" || prev.type === "lp";
        if (isUnary && (t.value === "-" || t.value === "+")) {
          if (t.value === "-") {
            out.push({ type: "num", value: 0 });
            while (ops.length && ops[ops.length - 1].type === "op" && prec[ops[ops.length - 1].value] >= prec["-"]) {
              out.push(ops.pop());
            }
            ops.push({ type: "op", value: "-" });
          }
          /* unary + : ignore */
        } else {
          while (ops.length && ops[ops.length - 1].type === "op" && prec[ops[ops.length - 1].value] >= prec[t.value]) {
            out.push(ops.pop());
          }
          ops.push(t);
        }
      } else if (t.type === "lp") {
        ops.push(t);
      } else if (t.type === "rp") {
        while (ops.length && ops[ops.length - 1].type !== "lp") {
          out.push(ops.pop());
        }
        if (!ops.length) return null; /* mismatched parens */
        ops.pop();
      }
      prev = t;
    }
    while (ops.length) {
      var top = ops.pop();
      if (top.type === "lp" || top.type === "rp") return null;
      out.push(top);
    }
    return out;
  }

  function evalRPN(rpn) {
    var stack = [];
    for (var i = 0; i < rpn.length; i++) {
      var t = rpn[i];
      if (t.type === "num") {
        stack.push(t.value);
      } else if (t.type === "op") {
        if (stack.length < 2) return NaN;
        var b = stack.pop();
        var a = stack.pop();
        var r;
        switch (t.value) {
          case "+": r = a + b; break;
          case "-": r = a - b; break;
          case "*": r = a * b; break;
          case "/": r = b === 0 ? NaN : a / b; break;
          default: return NaN;
        }
        stack.push(r);
      }
    }
    if (stack.length !== 1) return NaN;
    return stack[0];
  }

  function evalExpression(input) {
    if (input == null) return NaN;
    var clean = String(input).trim();
    if (clean === "") return NaN;
    /* Accept the YNAB-friendly (123.45) negative form once at the top. */
    if (/^\(.*\)$/.test(clean) && !/[+\-*/]/.test(clean.slice(1, -1))) {
      clean = "-" + clean.slice(1, -1);
    }
    var tokens = tokenize(clean);
    if (!tokens || !tokens.length) return NaN;
    tokens = expandPercents(tokens);
    var rpn = toRPN(tokens);
    if (!rpn) return NaN;
    var v = evalRPN(rpn);
    return isFinite(v) ? v : NaN;
  }

  function parseAmountCents(input) {
    var v = evalExpression(input);
    if (!isFinite(v)) return NaN;
    return Math.round(v * 100);
  }

  /* Returns "= $123.45" iff the input is a compound expression (i.e.
     contains an operator) AND evaluates cleanly. Used by the live
     preview hint under amount inputs so the user can confirm what
     will be saved before they hit Enter. */
  function formatExpressionPreview(input) {
    if (input == null) return "";
    var s = String(input).trim();
    if (!s) return "";
    /* Skip if there's no math going on at all. */
    if (!/[+\-*/]/.test(s.replace(/^[\s$,(-]+/, ""))) return "";
    var v = evalExpression(s);
    if (!isFinite(v)) return "";
    return "= " + v.toLocaleString("en-US", { style: "currency", currency: "USD" });
  }

  window.PBCalc = {
    evalExpression: evalExpression,
    parseAmountCents: parseAmountCents,
    formatExpressionPreview: formatExpressionPreview,
  };
})();
