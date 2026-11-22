#!/usr/bin/env node
// Renders <name>.design.json (output of the test-design skill) into <name>.coverage.html next to it.
// No AI, no dependencies: plain Node (>= 18).
//
// Usage: node render-coverage.mjs <path/to/name.design.json>
//
// The page has four parts:
//   1. a number line per numeric parameter: EP classes, boundaries (inclusive / exclusive / unknown) and BV points;
//   2. the state × action table;
//   3. quote → element → test traceability table;
//   4. unknowns, plus a list of structural problems (uncovered ids, dangling references, matrix gaps).

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node render-coverage.mjs <path/to/name.design.json>');
  process.exit(2);
}
if (!input.endsWith('.design.json')) {
  console.error(`Expected a *.design.json file, got: ${input}`);
  process.exit(2);
}

let d;
try {
  d = JSON.parse(readFileSync(input, 'utf8'));
} catch (e) {
  console.error(`Cannot read ${input}: ${e.message}`);
  process.exit(1);
}

const EP = Array.isArray(d.equivalence_classes) ? d.equivalence_classes : [];
const BV = Array.isArray(d.boundary_values) ? d.boundary_values : [];
const ST = d.state_transitions && typeof d.state_transitions === 'object' ? d.state_transitions : {};
const MATRIX = Array.isArray(ST.matrix) ? ST.matrix : [];
const TESTS = Array.isArray(d.tests) ? d.tests : [];
const UNKNOWNS = Array.isArray(d.unknowns) ? d.unknowns : [];

// ---------- helpers ----------

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// All numbers in a string; unicode minus is treated as a sign.
function numbers(s) {
  const out = [];
  const re = /([−-]|\+)?\s?(\d+(?:[.,]\d+)?)/g;
  let m;
  const str = String(s ?? '');
  while ((m = re.exec(str))) {
    // "TSD-4" style references: a dash glued to a letter is not a sign
    const prev = str[m.index - 1];
    const sign = m[1] === '−' || (m[1] === '-' && !(prev && /[\p{L}\d]/u.test(prev))) ? -1 : 1;
    out.push(sign * parseFloat(m[2].replace(',', '.')));
  }
  return out;
}
const firstNumber = (s) => {
  const n = numbers(s);
  return n.length ? n[0] : null;
};

// Normalised parameter name for matching EP to BV ("x (умова …)" ≈ "x").
const normParam = (p) =>
  String(p ?? '')
    .replace(/`/g, '')
    .replace(/\s*\([^()]*\)\s*$/, '')
    .trim()
    .toLowerCase();

// Unit = boundary text without its number, e.g. "15 хв" → "хв".
const unitOf = (s) =>
  String(s ?? '')
    .replace(/[−+-]?\s?\d+(?:[.,]\d+)?/, '')
    .trim();

const fmt = (n) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(3)));

// EP class text → {lo, hi} on the number line (null = unbounded). null if not understood.
function parseClass(text) {
  const t = String(text ?? '').toLowerCase();
  const ns = [...new Set(numbers(t))];
  if (ns.length >= 2) {
    const [a, b] = ns.slice(0, 2).sort((x, y) => x - y);
    return { lo: a, hi: b };
  }
  if (ns.length !== 1) return null;
  const n = ns[0];
  const above = /(не менше|не менш|щонайменше|at least|≥|>=|>|більше|понад|above|more than|over|after|після|пізніше)/;
  const below = /(не більше|≤|<=|<|менше|менш|до\s|up to|у межах|в межах|within|below|less than|under|before|раніше|ближче|closer)/;
  // "не менше" must win over "менше", so test "above" first
  if (above.test(t)) return { lo: n, hi: null };
  if (below.test(t)) return { lo: null, hi: n };
  return null;
}

// ---------- coverage index ----------

const allIds = new Map(); // id -> {kind, el}
for (const e of EP) allIds.set(e.id, { kind: 'EP', el: e });
for (const b of BV) allIds.set(b.id, { kind: 'BV', el: b });
for (const c of MATRIX) allIds.set(c.id, { kind: 'ST', el: c });

const coveredBy = new Map(); // element id -> [test ids]
for (const t of TESTS) for (const id of t.covers ?? []) {
  if (!coveredBy.has(id)) coveredBy.set(id, []);
  coveredBy.get(id).push(t.id);
}
const unknownsFor = new Map(); // element id -> [U ids]
for (const u of UNKNOWNS) for (const id of u.affects ?? []) {
  if (!unknownsFor.has(id)) unknownsFor.set(id, []);
  unknownsFor.get(id).push(u.id);
}

// ---------- structural checks ----------

const problems = [];
for (const [id] of allIds) if (!coveredBy.has(id)) problems.push(`${id} не входить у <code>covers</code> жодного тесту`);
for (const t of TESTS) for (const id of t.covers ?? [])
  if (!allIds.has(id)) problems.push(`${esc(t.id)} покриває неіснуючий ${esc(id)}`);
for (const u of UNKNOWNS) for (const id of u.affects ?? [])
  if (!allIds.has(id)) problems.push(`${esc(u.id)} посилається на неіснуючий ${esc(id)}`);
for (const b of BV) {
  if (!Array.isArray(b.values) || b.values.length !== 3) problems.push(`${esc(b.id)}: значень BV не три`);
  if (b.inclusive === null && !unknownsFor.has(b.id)) problems.push(`${esc(b.id)}: <code>inclusive: null</code>, але немає питання в unknowns`);
}
const states = Array.isArray(ST.states) ? ST.states : [];
const actions = Array.isArray(ST.actions) ? ST.actions : [];
const cellIndex = new Map();
for (const c of MATRIX) {
  const k = `${c.from}\u0000${c.action}`;
  if (cellIndex.has(k)) problems.push(`Дубль клітинки ${esc(c.from)} × ${esc(c.action)} (${esc(cellIndex.get(k).id)}, ${esc(c.id)})`);
  else cellIndex.set(k, c);
  if (!states.includes(c.from)) problems.push(`${esc(c.id)}: стану «${esc(c.from)}» немає в <code>states</code>`);
  if (!actions.includes(c.action)) problems.push(`${esc(c.id)}: дії «${esc(c.action)}» немає в <code>actions</code>`);
}
if (!ST.not_applicable && states.length && actions.length && MATRIX.length !== states.length * actions.length)
  problems.push(`У matrix ${MATRIX.length} клітинок, а станів × дій = ${states.length * actions.length}`);
for (const c of MATRIX)
  if (c.result === 'unknown' && !unknownsFor.has(c.id)) problems.push(`${esc(c.id)}: <code>unknown</code> без питання в unknowns`);

// ---------- 1. number lines ----------

const params = new Map(); // norm -> {name, bvs, eps}
for (const b of BV) {
  if (firstNumber(b.boundary) === null) continue;
  const k = normParam(b.parameter);
  if (!params.has(k)) params.set(k, { name: b.parameter, bvs: [], eps: [] });
  params.get(k).bvs.push(b);
}
const epOnLine = new Set();
for (const e of EP) {
  const p = params.get(normParam(e.parameter));
  if (p) {
    p.eps.push(e);
    epOnLine.add(e.id);
  }
}

const chip = (id) => {
  const k = allIds.get(id)?.kind ?? (String(id).startsWith('T-') ? 'T' : String(id).startsWith('U-') ? 'U' : 'X');
  return `<a class="chip chip-${k}" href="#${esc(id)}">${esc(id)}</a>`;
};
const expClass = (x) => (x === 'valid' ? 'ok' : x === 'invalid' ? 'bad' : 'unk');

function numberLine(p) {
  const bvs = p.bvs.map((b) => ({ b, at: firstNumber(b.boundary), pts: (b.values ?? []).map((v) => ({ ...v, n: firstNumber(v.value) })) }));
  const eps = p.eps.map((e) => ({ e, range: parseClass(e.class), rep: firstNumber(e.representative) }));
  const unit = unitOf(p.bvs[0].boundary);

  const xs = [];
  for (const { at, pts } of bvs) {
    xs.push(at);
    for (const v of pts) if (v.n !== null) xs.push(v.n);
  }
  for (const { range, rep } of eps) {
    if (range?.lo != null) xs.push(range.lo);
    if (range?.hi != null) xs.push(range.hi);
    if (rep !== null) xs.push(rep);
  }
  let min = Math.min(...xs);
  let max = Math.max(...xs);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12;
  min -= pad; max += pad;

  const W = 760, L = 86, R = 20;
  const X = (n) => L + ((n - min) / (max - min)) * (W - L - R);
  const lane = 26;
  const drawn = eps.filter((x) => x.range);
  const top = 10;
  const axisY = top + drawn.length * lane + 18;
  const H = axisY + 56;

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Числова лінія: ${esc(p.name)}">`;
  // boundary guide lines
  for (const { b, at } of bvs)
    svg += `<line class="guide" x1="${X(at)}" x2="${X(at)}" y1="${top - 4}" y2="${axisY}"><title>${esc(b.id)}</title></line>`;
  // EP lanes
  drawn.forEach(({ e, range, rep }, i) => {
    const y = top + i * lane;
    const x1 = range.lo == null ? L : X(range.lo);
    const x2 = range.hi == null ? W - R : X(range.hi);
    const cls = e.valid ? 'ok' : 'bad';
    svg += `<a href="#${esc(e.id)}"><g class="ep ${cls}" id="${esc(e.id)}"><title>${esc(e.id)} · ${esc(e.class)} · ${e.valid ? 'valid' : 'invalid'}</title>`;
    svg += `<rect x="${x1}" y="${y}" width="${Math.max(2, x2 - x1)}" height="${lane - 8}" rx="4"/>`;
    if (range.lo == null) svg += `<path d="M${x1 + 8} ${y + 2} L${x1} ${y + (lane - 8) / 2} L${x1 + 8} ${y + lane - 10}" class="arrow"/>`;
    if (range.hi == null) svg += `<path d="M${x2 - 8} ${y + 2} L${x2} ${y + (lane - 8) / 2} L${x2 - 8} ${y + lane - 10}" class="arrow"/>`;
    if (rep !== null) svg += `<path class="rep" d="M${X(rep)} ${y + 2} l6 7 l-6 7 l-6 -7 z"><title>representative: ${esc(e.representative)}</title></path>`;
    svg += `</g></a>`;
    svg += `<text class="lab" x="${L - 8}" y="${y + 13}" text-anchor="end">${esc(e.id)}</text>`;
  });
  // axis
  svg += `<line class="axis" x1="${L}" x2="${W - R}" y1="${axisY}" y2="${axisY}"/>`;
  // BV point ticks on axis
  for (const { b, pts } of bvs)
    for (const v of pts)
      if (v.n !== null)
        svg += `<line class="tick ${expClass(v.expected)}" x1="${X(v.n)}" x2="${X(v.n)}" y1="${axisY - 6}" y2="${axisY + 6}"><title>${esc(b.id)}: ${esc(v.value)} → ${esc(v.expected)}</title></line>`;
  // boundary markers
  const placed = [];
  for (const { b, at } of bvs) {
    const x = X(at);
    const mark = b.inclusive === true ? 'incl' : b.inclusive === false ? 'excl' : 'unkn';
    svg += `<a href="#${esc(b.id)}"><circle class="bmark ${mark}" cx="${x}" cy="${axisY}" r="6"><title>${esc(b.id)} · межа ${esc(b.boundary)} · ${mark === 'incl' ? 'включна' : mark === 'excl' ? 'не включна' : 'включність невідома'}</title></circle>`;
    if (mark === 'unkn') svg += `<text class="q" x="${x}" y="${axisY + 4}" text-anchor="middle">?</text>`;
    svg += `</a>`;
    const row = placed.filter((px) => Math.abs(px - x) < 60).length;
    placed.push(x);
    svg += `<text class="blab" x="${x}" y="${axisY + 24 + row * 14}" text-anchor="middle">${esc(fmt(at))}${unit ? ' ' + esc(unit) : ''} · ${esc(b.id)}</text>`;
  }
  svg += `<text class="lab" x="${L - 8}" y="${axisY + 4}" text-anchor="end">${esc(unit || 'вісь')}</text>`;
  svg += `</svg>`;

  // zoomed BV strips: three points per boundary at readable scale
  const zooms = bvs
    .map(({ b, at, pts }) => {
      const ns = pts.map((v) => v.n).filter((n) => n !== null);
      const w = 230, l = 18, r = 18, y = 30;
      let zs = `<svg viewBox="0 0 ${w} 74" class="zoom" aria-hidden="true">`;
      if (ns.length) {
        const lo = Math.min(...ns, at), hi = Math.max(...ns, at);
        const span = hi - lo || 1;
        const zx = (n) => l + ((n - lo + span * 0.25) / (span * 1.5)) * (w - l - r);
        zs += `<line class="axis" x1="${l}" x2="${w - r}" y1="${y}" y2="${y}"/>`;
        zs += `<line class="guide" x1="${zx(at)}" x2="${zx(at)}" y1="6" y2="${y}"/>`;
        pts.forEach((v) => {
          if (v.n === null) return;
          const cx = zx(v.n);
          zs += `<circle class="pt ${expClass(v.expected)}" cx="${cx}" cy="${y}" r="7"><title>${esc(v.value)} → ${esc(v.expected)}</title></circle>`;
          zs += `<text class="plab" x="${cx}" y="${y + 24}" text-anchor="middle">${esc(fmt(v.n))}</text>`;
          zs += `<text class="pexp ${expClass(v.expected)}" x="${cx}" y="${y + 38}" text-anchor="middle">${esc(v.expected)}</text>`;
        });
      }
      zs += `</svg>`;
      const incl = b.inclusive === true ? 'включна' : b.inclusive === false ? 'не включна' : 'включність невідома';
      return `<figure class="zcard" id="${esc(b.id)}">
        <figcaption><b>${esc(b.id)}</b> · межа <b>${esc(b.boundary)}</b> · крок ${esc(b.step)} · <span class="incl ${b.inclusive == null ? 'unk' : ''}">${incl}</span></figcaption>
        ${zs}
        <ul class="vals">${pts.map((v) => `<li><span class="dot ${expClass(v.expected)}"></span>${esc(v.value)} → ${esc(v.expected)}</li>`).join('')}</ul>
        <div class="meta">тести: ${(coveredBy.get(b.id) ?? []).map(chip).join(' ') || '<span class="warn">немає</span>'}${unknownsFor.has(b.id) ? ' · питання: ' + unknownsFor.get(b.id).map(chip).join(' ') : ''}</div>
      </figure>`;
    })
    .join('');

  const offLine = eps.filter((x) => !x.range);
  const off = offLine.length
    ? `<p class="note">Не нанесено на лінію (текст класу не містить числового діапазону): ${offLine.map(({ e }) => `<span id="${esc(e.id)}">${chip(e.id)} ${esc(e.class)}</span>`).join('; ')}</p>`
    : '';

  return `<section class="param">
    <h3>${esc(p.name)}</h3>
    <div class="chart">${svg}</div>
    ${off}
    <div class="zooms">${zooms}</div>
  </section>`;
}

const otherEP = EP.filter((e) => !epOnLine.has(e.id));
const linesHtml = params.size
  ? [...params.values()].map(numberLine).join('')
  : '<p class="empty">Числових параметрів з граничними значеннями немає.</p>';
const otherEpHtml = otherEP.length
  ? `<h3>Інші класи еквівалентності (нечислові параметри)</h3>
     <table class="grid"><thead><tr><th>Id</th><th>Параметр</th><th>Клас</th><th>Valid</th><th>Representative</th><th>Тести</th></tr></thead><tbody>
     ${otherEP
       .map(
         (e) => `<tr id="${esc(e.id)}"><td>${chip(e.id)}</td><td>${esc(e.parameter)}</td><td>${esc(e.class)}</td>
         <td><span class="dot ${e.valid ? 'ok' : 'bad'}"></span>${e.valid ? 'valid' : 'invalid'}</td><td>${esc(e.representative)}</td>
         <td>${(coveredBy.get(e.id) ?? []).map(chip).join(' ') || '<span class="warn">немає</span>'}</td></tr>`
       )
       .join('')}
     </tbody></table>`
  : '';

// ---------- 2. state × action ----------

let stHtml;
if (ST.not_applicable) {
  stHtml = `<p class="empty">Не застосовується: ${esc(ST.not_applicable)}</p>`;
} else if (!states.length || !actions.length) {
  stHtml = '<p class="empty">Станів або дій у дизайні немає.</p>';
} else {
  const head = `<tr><th class="corner">стан \\ дія</th>${actions.map((a) => `<th>${esc(a)}</th>`).join('')}</tr>`;
  const rows = states
    .map((s) => {
      const cells = actions
        .map((a) => {
          const c = cellIndex.get(`${s}\u0000${a}`);
          if (!c) return `<td class="cell missing" title="Клітинки немає в matrix">—</td>`;
          const body =
            c.result === 'legal' ? `→ ${esc(c.to)}` : c.result === 'illegal' ? '✕' : '?';
          const tests = coveredBy.get(c.id) ?? [];
          const tip = `${c.id} · ${c.result}${c.response ? ' · ' + c.response.value : ''}\nрядок ${c.quote?.line}: ${c.quote?.text ?? ''}`;
          return `<td id="${esc(c.id)}" class="cell ${esc(c.result)}${tests.length ? '' : ' uncovered'}" title="${esc(tip)}">
            <div class="cbody">${body}</div>
            <div class="cid">${esc(c.id)}${c.response ? ` · ${esc(c.response.value)}` : ''}</div>
            <div class="ctests">${tests.map(chip).join(' ') || '<span class="warn">без тесту</span>'}</div>
          </td>`;
        })
        .join('');
      return `<tr><th>${esc(s)}</th>${cells}</tr>`;
    })
    .join('');
  const count = (r) => MATRIX.filter((c) => c.result === r).length;
  stHtml = `<p class="legend"><span class="sw legal"></span>legal ${count('legal')} <span class="sw illegal"></span>illegal ${count('illegal')} <span class="sw unknown"></span>unknown ${count('unknown')} · наведіть на клітинку, щоб побачити цитату</p>
    <div class="scroll"><table class="st">${head}${rows}</table></div>`;
}

// ---------- 3. quote → element → test ----------

const quoteRows = new Map(); // key -> {line, text, items: [{id, role}]}
const addQuote = (q, id, role) => {
  if (!q || q.line == null) return;
  const k = `${q.line}\u0000${q.text}`;
  if (!quoteRows.has(k)) quoteRows.set(k, { line: q.line, text: q.text, items: [] });
  quoteRows.get(k).items.push({ id, role });
};
for (const [id, { el }] of allIds) {
  addQuote(el.quote, id, 'element');
  if (el.response) addQuote(el.response.quote, id, 'response');
}
const noQuote = [...allIds.keys()].filter((id) => !allIds.get(id).el.quote);
if (noQuote.length) problems.push(`Без цитати: ${noQuote.map(esc).join(', ')}`);

const traceRows = [...quoteRows.values()]
  .sort((a, b) => a.line - b.line || String(a.text).localeCompare(String(b.text)))
  .map((r) => {
    const els = r.items
      .map(({ id, role }) => `${chip(id)}${role === 'response' ? '<span class="role">відповідь</span>' : ''}${unknownsFor.has(id) ? '<span class="role q">?</span>' : ''}`)
      .join(' ');
    const tests = [...new Set(r.items.flatMap(({ id }) => coveredBy.get(id) ?? []))];
    const uncovered = r.items.filter(({ id }) => !coveredBy.has(id)).map(({ id }) => id);
    return `<tr><td class="num">${esc(r.line)}</td><td><q>${esc(r.text)}</q></td><td class="chips">${els}</td>
      <td class="chips">${tests.map(chip).join(' ')}${uncovered.length ? ` <span class="warn">без тесту: ${uncovered.map(esc).join(', ')}</span>` : ''}</td></tr>`;
  })
  .join('');

const testsList = TESTS.map(
  (t) => `<li id="${esc(t.id)}">${chip(t.id)} → ${(t.covers ?? []).map(chip).join(' ')}</li>`
).join('');

// ---------- 4. unknowns ----------

const unknownsHtml = UNKNOWNS.length
  ? `<ol class="unknowns">${UNKNOWNS.map(
      (u) => `<li id="${esc(u.id)}"><b>${esc(u.id)}</b> ${esc(u.question)}<div class="meta">зачіпає: ${(u.affects ?? []).map(chip).join(' ') || '—'}</div></li>`
    ).join('')}</ol>`
  : '<p class="empty">Відкритих питань немає.</p>';

// ---------- page ----------

const covered = [...allIds.keys()].filter((id) => coveredBy.has(id)).length;
const name = basename(input, '.design.json');
const out = join(dirname(input), `${name}.coverage.html`);

const html = `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} · покриття</title>
<style>
:root{--bg:#fbfbf9;--fg:#1d1d1b;--muted:#6b6b66;--line:#d9d8d2;--card:#ffffff;
--ok:#2f7d4f;--ok-bg:#dcefe2;--bad:#b23b3b;--bad-bg:#f6dede;--unk:#a66a00;--unk-bg:#fbebc8;
--ep:#2f6fb0;--bv:#7a4bb0;--st:#2c7f86;--t:#555;--u:#a66a00}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#17181a;--fg:#e9e8e3;--muted:#9a9a94;--line:#34363a;--card:#1f2124;
--ok:#6cc78f;--ok-bg:#1e3a29;--bad:#ef8a8a;--bad-bg:#432323;--unk:#f0b851;--unk-bg:#40321a;--ep:#7fb2ea;--bv:#b996e6;--st:#6cc3ca;--t:#bbb;--u:#f0b851}}
:root[data-theme="dark"]{--bg:#17181a;--fg:#e9e8e3;--muted:#9a9a94;--line:#34363a;--card:#1f2124;
--ok:#6cc78f;--ok-bg:#1e3a29;--bad:#ef8a8a;--bad-bg:#432323;--unk:#f0b851;--unk-bg:#40321a;--ep:#7fb2ea;--bv:#b996e6;--st:#6cc3ca;--t:#bbb;--u:#f0b851}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:40px 0 12px;padding-top:8px;border-top:1px solid var(--line)}
h3{font-size:15px;margin:20px 0 8px}
.sub{color:var(--muted);font-size:13px;word-break:break-all}
.stats{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 12px;min-width:92px}
.stat b{display:block;font-size:20px}.stat span{color:var(--muted);font-size:12px}
.problems{background:var(--bad-bg);border-radius:8px;padding:10px 14px 10px 32px;margin:12px 0}
.okmsg{background:var(--ok-bg);border-radius:8px;padding:10px 14px;margin:12px 0}
.param{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:14px 0}
.param h3{margin-top:4px}
.chart svg{width:100%;height:auto;display:block}
svg text{fill:var(--fg);font-size:12px}
.lab{fill:var(--muted)!important;font-size:11px!important}
.guide{stroke:var(--line);stroke-dasharray:3 3}
.axis{stroke:var(--fg);stroke-width:1.5}
.ep rect{stroke-width:1.5}
.ep.ok rect{fill:var(--ok-bg);stroke:var(--ok)}.ep.bad rect{fill:var(--bad-bg);stroke:var(--bad)}
.ep.ok .arrow{stroke:var(--ok);fill:none;stroke-width:2}.ep.bad .arrow{stroke:var(--bad);fill:none;stroke-width:2}
.rep{fill:var(--fg);opacity:.7}
.tick{stroke-width:2}.tick.ok{stroke:var(--ok)}.tick.bad{stroke:var(--bad)}.tick.unk{stroke:var(--unk)}
.bmark{stroke:var(--fg);stroke-width:2}.bmark.incl{fill:var(--fg)}.bmark.excl{fill:var(--card)}
.bmark.unkn{fill:var(--unk-bg);stroke:var(--unk);stroke-dasharray:2 2}
text.q{fill:var(--unk)!important;font-weight:700;font-size:10px!important}
.blab{font-size:11px!important}
.zooms{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin-top:10px}
.zcard{margin:0;border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--bg)}
.zcard figcaption{font-size:13px}
.zoom{width:100%;height:auto;display:block;margin:4px 0}
.pt{stroke-width:2}.pt.ok{fill:var(--ok-bg);stroke:var(--ok)}.pt.bad{fill:var(--bad-bg);stroke:var(--bad)}.pt.unk{fill:var(--unk-bg);stroke:var(--unk)}
.plab{font-size:12px!important;font-weight:600}
.pexp{font-size:11px!important}.pexp.ok{fill:var(--ok)!important}.pexp.bad{fill:var(--bad)!important}.pexp.unk{fill:var(--unk)!important}
.vals{list-style:none;margin:4px 0;padding:0;font-size:13px}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:middle}
.dot.ok{background:var(--ok)}.dot.bad{background:var(--bad)}.dot.unk{background:var(--unk)}
.incl.unk{color:var(--unk);font-weight:600}
.meta{color:var(--muted);font-size:12px;margin-top:4px}
.note,.empty{color:var(--muted);font-size:13px}
.warn{color:var(--bad);font-size:12px;font-weight:600}
.chip{display:inline-block;font:600 11px/1.6 ui-monospace,Menlo,monospace;padding:0 6px;border-radius:10px;text-decoration:none;border:1px solid currentColor;white-space:nowrap;margin:1px 0}
.chip-EP{color:var(--ep)}.chip-BV{color:var(--bv)}.chip-ST{color:var(--st)}.chip-T{color:var(--t)}.chip-U{color:var(--u)}.chip-X{color:var(--bad)}
.role{font-size:10px;color:var(--muted);margin:0 4px 0 2px}.role.q{color:var(--unk);font-weight:700}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{border:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:left}
thead th,.st tr:first-child th{background:var(--card);position:sticky;top:0}
.st th{white-space:nowrap}.st .corner{color:var(--muted);font-weight:400}
.cell{min-width:96px}
.cell.legal{background:var(--ok-bg)}.cell.illegal{background:var(--bad-bg)}.cell.unknown{background:var(--unk-bg)}
.cell.missing{color:var(--bad);text-align:center;font-weight:700;outline:2px dashed var(--bad);outline-offset:-3px}
.cell.uncovered{outline:2px dashed var(--bad);outline-offset:-3px}
.cbody{font-weight:600}.cid{font-size:11px;color:var(--muted)}
.legend{font-size:13px;color:var(--muted)}
.sw{display:inline-block;width:12px;height:12px;border-radius:3px;margin:0 4px 0 10px;vertical-align:middle;border:1px solid var(--line)}
.sw.legal{background:var(--ok-bg)}.sw.illegal{background:var(--bad-bg)}.sw.unknown{background:var(--unk-bg)}
td.num{font-variant-numeric:tabular-nums;color:var(--muted);width:48px}
td q{font-family:ui-monospace,Menlo,monospace;font-size:12px;word-break:break-word}
td.chips{max-width:320px}
.tests{columns:2 260px;font-size:13px;padding-left:18px}
.unknowns li{margin-bottom:10px}
:target{scroll-margin-top:16px;box-shadow:0 0 0 3px var(--unk)}
@media (max-width:600px){td.chips{max-width:none}.trace td:nth-child(1){width:auto}}
</style>
</head>
<body>
<main>
<h1>Покриття тест-дизайну: ${esc(name)}</h1>
<div class="sub">${esc(d.spec ?? '')}${d.focus ? ` · focus: ${esc(d.focus)}` : ''}</div>
<div class="stats">
  <div class="stat"><b>${EP.length}</b><span>EP</span></div>
  <div class="stat"><b>${BV.length}</b><span>BV</span></div>
  <div class="stat"><b>${MATRIX.length}</b><span>ST-клітинок</span></div>
  <div class="stat"><b>${TESTS.length}</b><span>тестів</span></div>
  <div class="stat"><b>${covered}/${allIds.size}</b><span>елементів покрито</span></div>
  <div class="stat"><b>${UNKNOWNS.length}</b><span>unknowns</span></div>
</div>
${problems.length ? `<ul class="problems">${problems.map((p) => `<li>${p}</li>`).join('')}</ul>` : '<div class="okmsg">Структурних проблем не знайдено: кожен EP, BV і ST покритий тестом, усі посилання існують.</div>'}

<h2>1. Числові параметри: класи, межі, точки BV</h2>
<p class="note">Смуги — класи EP (зелена valid, червона invalid, ромб — representative). На осі: ● включна межа, ○ не включна, ? — включність невідома. Під лінією — кожна межа крупно з трьома точками BV.</p>
${linesHtml}
${otherEpHtml}

<h2>2. Таблиця стан × дія</h2>
${stHtml}

<h2>3. Цитата → елемент → тест</h2>
<div class="scroll"><table class="trace"><thead><tr><th>Рядок</th><th>Цитата</th><th>Елементи</th><th>Тести</th></tr></thead><tbody>${traceRows}</tbody></table></div>
<h3>Тести</h3>
<ul class="tests">${testsList}</ul>

<h2>4. Unknowns</h2>
${unknownsHtml}
</main>
</body>
</html>
`;

writeFileSync(out, html);
console.log(out);
