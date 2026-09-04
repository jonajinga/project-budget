#!/usr/bin/env node
/* Breakpoint contract linter.
 *
 * tokens.css declares a canonical breakpoint scale and says "do not
 * introduce ad-hoc values". Nothing enforced that, so the codebase drifted
 * to 13 distinct viewport values. This script is the enforcement.
 *
 * It reads the contract from the tokens.css comment itself, so the comment
 * and the linter can never disagree.
 *
 * A min-width query must use a contract value exactly. A max-width query
 * must use (contract value - 1), so that min/max pairs tile the viewport
 * with no gap and no overlap: max-width:599px hands off to min-width:600px.
 *
 * Report-only until Phase 4c, then --strict makes it gate CI.
 *
 * Usage: node scripts/check-breakpoints.mjs [--strict]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PARTIALS = join(ROOT, "src/assets/css/partials");
const STRICT = process.argv.includes("--strict");

/* Strip block comments before scanning. Without this the scanner trips
   over prose in the tokens.css header ("@media queries -- the scale above")
   and over explanatory comments that mention @media in passing. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function readContract() {
  const tokens = readFileSync(join(PARTIALS, "tokens.css"), "utf8");
  const m = tokens.match(/Canonical breakpoints[^\n]*\n\s*([\d\s/]+)\n/);
  if (!m) {
    console.error("Could not find the canonical breakpoint list in tokens.css.");
    process.exit(2);
  }
  return m[1].split("/").map((s) => Number(s.trim())).filter(Boolean);
}

const contract = readContract();
const allowedMin = new Set(contract);
const allowedMax = new Set(contract.map((n) => n - 1));

/* Only match @media preludes -- the text between "@media" and the "{" that
   opens its block. Scanning raw declarations instead would flag every
   `min-width: 44px` touch target and `min-width: 220px` panel as a
   breakpoint violation. */
const MEDIA = /@media([^{]*)\{/g;
const WIDTH = /\((min|max)-width:\s*(\d+)px\)/g;

const violations = [];
const exempted = [];
const used = new Map();

/* Deliberate deviations, declared where they happen.
 *
 * Every one of the nine off-contract breakpoints in this codebase turned
 * out to be a reasoned decision with the reason written directly above
 * it -- "1024 inclusive, not 1023: it is iPad landscape and where the
 * sidebar first takes its 266px out of the page", "above 1250 the card
 * is 918px or wider so nothing ellipsizes that does not have to", and so
 * on. None was drift.
 *
 * With no way to say that, this check failed CI permanently, which makes
 * it noise: a gate that is always red stops being read, and the next
 * person's accidental 1120px lands in a list nobody looks at. The escape
 * hatch is what makes the gate mean something again.
 *
 * Put it on the line immediately above the @media, with a reason:
 *
 *   /* breakpoint-contract: allow -- 1024 inclusive, iPad landscape *​/
 *   @media (max-width: 1024px) { ... }
 *
 * A normal CSS block comment. The first version of this used `//`, to
 * survive stripComments() -- which it did, and then shipped straight
 * into the built stylesheet, where `//` is not valid CSS at all. A
 * browser reads it as a selector and swallows the @media block that
 * follows it, so the rule the pragma was defending would have been
 * silently deleted in production. allowedLines() reads the RAW file
 * before comments are stripped, so a block comment works and is safe.
 * Same-line also works.
 */
const ALLOW = /breakpoint-contract:\s*allow/;
function allowedLines(raw) {
  const out = new Set();
  const lines = raw.split("\n");
  lines.forEach((line, i) => {
    if (!ALLOW.test(line)) return;
    out.add(i + 1);      /* same line as the @media */
    out.add(i + 2);      /* the line below it */
  });
  return out;
}

for (const file of readdirSync(PARTIALS).filter((f) => f.endsWith(".css")).sort()) {
  const raw = readFileSync(join(PARTIALS, file), "utf8");
  const css = stripComments(raw);
  const allowed = allowedLines(raw);

  /* Line numbers must come from the ORIGINAL text, or every reported line
     is wrong by however many comment lines preceded it. Track the offset
     into the stripped text back to a line in the raw text by counting the
     newlines the stripper removed up to that point. */
  const lineOf = (idx) => {
    let rawIdx = 0, strippedSeen = 0;
    const re = /\/\*[\s\S]*?\*\//g;
    let m, last = 0;
    while ((m = re.exec(raw))) {
      const chunk = m.index - last;
      if (strippedSeen + chunk > idx) break;
      strippedSeen += chunk;
      last = m.index + m[0].length;
      rawIdx = last;
    }
    rawIdx += idx - strippedSeen;
    return raw.slice(0, rawIdx).split("\n").length;
  };

  let m;
  while ((m = MEDIA.exec(css))) {
    const prelude = m[1];
    let w;
    WIDTH.lastIndex = 0;
    while ((w = WIDTH.exec(prelude))) {
      const [, kind, valStr] = w;
      const val = Number(valStr);
      const key = `${kind}-${val}`;
      used.set(key, (used.get(key) || 0) + 1);
      const ok = kind === "min" ? allowedMin.has(val) : allowedMax.has(val);
      if (!ok && allowed.has(lineOf(m.index))) {
        exempted.push(`${file}:${lineOf(m.index)}  (${kind}-width: ${val}px)`);
        continue;
      }
      if (!ok) {
        const suggestion =
          kind === "min"
            ? nearest(val, contract)
            : nearest(val + 1, contract) - 1;
        violations.push({
          file,
          line: lineOf(m.index),
          text: `(${kind}-width: ${val}px)`,
          suggestion: `(${kind}-width: ${suggestion}px)`,
        });
      }
    }
  }
}

function nearest(val, list) {
  return list.reduce((a, b) => (Math.abs(b - val) < Math.abs(a - val) ? b : a));
}

console.log(`Breakpoint contract: ${contract.join(" / ")}`);
console.log(`Scanned ${readdirSync(PARTIALS).filter((f) => f.endsWith(".css")).length} partials.\n`);

const sorted = [...used.entries()].sort((a, b) => b[1] - a[1]);
console.log("Viewport values in use:");
for (const [key, count] of sorted) {
  const [kind, val] = key.split("-");
  const ok = kind === "min" ? allowedMin.has(+val) : allowedMax.has(+val);
  console.log(`  ${ok ? "ok " : "OFF"}  ${kind}-width: ${val}px  x${count}`);
}

if (exempted.length) {
  console.log(`\n${exempted.length} declared exception(s) -- reasoned deviations, not drift:`);
  for (const e of exempted) console.log(`  ${e}`);
}

if (violations.length) {
  console.log(`\n${violations.length} off-contract declaration(s):`);
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}  ${v.text}  ->  ${v.suggestion}`);
  }
} else {
  console.log("\nNo off-contract declarations.");
}

if (STRICT && violations.length) {
  console.error(`\nFAIL: ${violations.length} off-contract breakpoint(s).`);
  process.exit(1);
}
console.log(STRICT ? "\nPASS" : "\n(report-only; pass --strict to gate)");
