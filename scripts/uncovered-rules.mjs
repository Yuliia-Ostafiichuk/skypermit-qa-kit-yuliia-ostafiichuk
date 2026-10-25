#!/usr/bin/env node
// Lists SkyPermit business rules (06-business-rules.md §6, corrected per
// 07-clarifications.md) that no test case in test-cases/ covers yet.
//
// Usage: node scripts/uncovered-rules.mjs [--gate <GATE>] [--max <N>]
//   --gate  PILOT | AIRCRAFT | ZONE | TIME_WINDOW | REGISTRATION (default: all)
//   --max   cap on the number of uncovered rules returned (default: no cap)
//
// A rule is covered when one test case file contains both
// `failing_gate: "<GATE>"` and `rule_reference: "<ref>"`. REGISTRATION is not a
// gate, so its rule is covered by `rule_reference: "OH-1 §3"` in a file with no
// `failing_gate` at all.
//
// Reads ../skypermit/docs only; never writes anything. Prints JSON to stdout.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = resolve(ROOT, "../skypermit/docs");
const TEST_CASES = join(ROOT, "test-cases");

const GATE_ORDER = ["PILOT", "AIRCRAFT", "ZONE", "TIME_WINDOW", "REGISTRATION"];

// Section of 06 that defines each gate's pass/fail logic, handed to
// test-case-creator as the test basis.
const GATE_SECTION = {
  PILOT: "06-business-rules.md §1.1",
  AIRCRAFT: "06-business-rules.md §1.2",
  ZONE: "06-business-rules.md §1.3",
  TIME_WINDOW: "06-business-rules.md §1.4",
  REGISTRATION: "06-business-rules.md §3",
};

// Corrections from 07-clarifications.md. 07 governs where it disagrees with 06,
// so these are applied on top of whatever 06 §6 says. `marker` must still be
// present in 07, otherwise the correction is reported as stale.
const CLARIFICATIONS = [
  {
    item: "07 §1",
    marker: "What fails the `AIRCRAFT` gate?",
    match: (r) => /weight band/i.test(r.condition),
    apply: (r) => ({ ...r, gate: "AIRCRAFT" }),
  },
  {
    item: "07 §4",
    marker: "Zone `active` flag → still unattributed",
    match: (r) => /zone inactive/i.test(r.condition),
    apply: (r) => ({
      ...r,
      citation_unconfirmed: true,
      note: "citation unconfirmed — 05 §2",
    }),
  },
];

function parseArgs(argv) {
  const args = { gate: null, max: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--gate") args.gate = (argv[++i] ?? "").toUpperCase();
    else if (a === "--max") args.max = Number(argv[++i]);
    else fail(`unknown argument: ${a}`);
  }
  if (args.gate && !GATE_ORDER.includes(args.gate)) {
    fail(`--gate must be one of ${GATE_ORDER.join(", ")}`);
  }
  if (args.max !== null && !(Number.isInteger(args.max) && args.max > 0)) {
    fail("--max must be a positive integer");
  }
  return args;
}

function fail(message) {
  console.error(`uncovered-rules: ${message}`);
  process.exit(2);
}

function readDoc(name) {
  const path = join(DOCS, name);
  if (!existsSync(path)) fail(`missing ${path}`);
  return readFileSync(path, "utf8");
}

// Strip backticks and trailing italic notes: "`ZC-2026.1 §2` *(shared…)*" → "ZC-2026.1 §2".
function cleanRef(cell) {
  const m = cell.match(/`([^`]+)`/);
  return (m ? m[1] : cell).trim();
}

function parseRuleTable(md) {
  const start = md.search(/^## 6\. `rule_reference` values/m);
  if (start < 0) fail("06-business-rules.md: section '## 6. `rule_reference` values' not found");
  const section = md.slice(start).split(/^## (?!6\.)/m)[0];

  const rules = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length !== 3) continue;
    const [gateCell, condition, refCell] = cells;
    if (gateCell === "Gate" || /^-+$/.test(gateCell)) continue;

    const gateMatch = gateCell.match(/`([A-Z_]+)`/);
    const gate = gateMatch ? gateMatch[1] : /registration/i.test(gateCell) ? "REGISTRATION" : null;
    if (!gate) fail(`06 §6: can't read gate from row "${line}"`);

    rules.push({
      gate,
      condition: condition.replace(/`/g, ""),
      rule_reference: cleanRef(refCell),
      doc_section: GATE_SECTION[gate],
      citation_unconfirmed: false,
      note: null,
    });
  }
  if (rules.length === 0) fail("06 §6: no rule rows parsed");
  return rules;
}

function applyClarifications(rules, clarificationsMd, warnings) {
  for (const c of CLARIFICATIONS) {
    if (!clarificationsMd.includes(c.marker)) {
      warnings.push(`${c.item}: marker "${c.marker}" no longer in 07-clarifications.md — correction may be stale`);
    }
    const hits = rules.filter(c.match);
    if (hits.length === 0) warnings.push(`${c.item}: no matching row in 06 §6`);
  }
  return rules.map((r) => CLARIFICATIONS.reduce((acc, c) => (c.match(acc) ? c.apply(acc) : acc), r));
}

function listMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listMarkdown(path);
    return name.endsWith(".md") ? [path] : [];
  });
}

function scanTestCases() {
  return listMarkdown(TEST_CASES).map((path) => {
    const text = readFileSync(path, "utf8");
    const values = (key) => [...text.matchAll(new RegExp(`${key}:\\s*"([^"]+)"`, "g"))].map((m) => m[1]);
    return {
      file: relative(ROOT, path),
      gates: new Set(values("failing_gate")),
      refs: new Set(values("rule_reference")),
    };
  });
}

function coveringFiles(rule, testCases) {
  return testCases
    .filter((tc) =>
      rule.gate === "REGISTRATION"
        ? tc.gates.size === 0 && tc.refs.has(rule.rule_reference)
        : tc.gates.has(rule.gate) && tc.refs.has(rule.rule_reference),
    )
    .map((tc) => tc.file);
}

const args = parseArgs(process.argv.slice(2));
const warnings = [];
const rules = applyClarifications(
  parseRuleTable(readDoc("06-business-rules.md")),
  readDoc("07-clarifications.md"),
  warnings,
);
const testCases = scanTestCases();

const withCoverage = rules.map((r) => ({ ...r, covered_by: coveringFiles(r, testCases) }));
const uncoveredAll = withCoverage
  .filter((r) => r.covered_by.length === 0)
  .filter((r) => !args.gate || r.gate === args.gate)
  .sort((a, b) => GATE_ORDER.indexOf(a.gate) - GATE_ORDER.indexOf(b.gate));
const selected = args.max ? uncoveredAll.slice(0, args.max) : uncoveredAll;

const groups = {};
for (const gate of GATE_ORDER) {
  const inGate = selected.filter((r) => r.gate === gate).map(({ covered_by, ...r }) => r);
  if (inGate.length) groups[gate] = inGate;
}

console.log(
  JSON.stringify(
    {
      args,
      total_rules: rules.length,
      covered_rules: withCoverage.filter((r) => r.covered_by.length).length,
      uncovered_matching: uncoveredAll.length,
      selected: selected.length,
      groups,
      warnings,
    },
    null,
    2,
  ),
);
