#!/usr/bin/env node
// SessionEnd hook: summarizes token usage of a Claude Code session and writes
// reports/ws2/<date>-<session_id>.md.
//
// Transcript structure (verified on real transcripts, 2026-10-25):
// - JSONL, one record per line, kind in `type`.
// - Usage lives in `type: "assistant"` records: message.model, message.id, message.usage.
// - One API response is split into several assistant records (one per content block),
//   each carrying usage; output_tokens grows across them. => dedupe by message.id, keep the LAST.
// - Subagents are separate files: <transcript without .jsonl>/subagents/agent-<id>.jsonl
//   plus agent-<id>.meta.json (agentType, description, ...). Their usage is NOT in the main file.
// - Compact: NOT observed in any local transcript. Detection below uses the documented markers
//   (type "system" + subtype "compact_boundary", user records with isCompactSummary) and is unverified.

import fs from 'node:fs';
import path from 'node:path';

// $ per 1M tokens, from the course slide "Cost". Cache read ≈ 1/10 of input (slide).
const PRICES = {
  'claude-haiku-5-5': { input: 0.10, output: 0.50 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
};
const CACHE_READ_MULT = 0.1;
// Not on the slide: cache writes are priced at the plain input price. Change here if needed.
const CACHE_WRITE_MULT = 1.0;

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function readJsonl(file) {
  const records = [];
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return records;
  }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // a partially written last line is possible; skip it
    }
  }
  return records;
}

function emptyUsage() {
  return { requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
}

function addUsage(acc, u) {
  acc.requests += u.requests;
  acc.input += u.input;
  acc.output += u.output;
  acc.cacheRead += u.cacheRead;
  acc.cacheWrite5m += u.cacheWrite5m;
  acc.cacheWrite1h += u.cacheWrite1h;
}

// Returns Map<model, usage> for one transcript file, deduplicated by message.id.
function usageByModel(records) {
  const lastById = new Map();
  for (const r of records) {
    if (r.type !== 'assistant' || !r.message?.usage) continue;
    const key = r.message.id ?? r.requestId ?? r.uuid;
    lastById.set(key, r.message);
  }
  const byModel = new Map();
  for (const m of lastById.values()) {
    const u = m.usage;
    const model = m.model ?? 'unknown';
    if (!byModel.has(model)) byModel.set(model, emptyUsage());
    const cc = u.cache_creation;
    const write5m = cc ? cc.ephemeral_5m_input_tokens ?? 0 : u.cache_creation_input_tokens ?? 0;
    const write1h = cc ? cc.ephemeral_1h_input_tokens ?? 0 : 0;
    addUsage(byModel.get(model), {
      requests: 1,
      input: u.input_tokens ?? 0,
      output: u.output_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheWrite5m: write5m,
      cacheWrite1h: write1h,
    });
  }
  return byModel;
}

function cost(model, u) {
  const p = PRICES[model];
  if (!p) return null;
  const write = u.cacheWrite5m + u.cacheWrite1h;
  return (
    (u.input * p.input +
      u.output * p.output +
      u.cacheRead * p.input * CACHE_READ_MULT +
      write * p.input * CACHE_WRITE_MULT) /
    1e6
  );
}

function findCompacts(records) {
  const events = [];
  for (const r of records) {
    if (r.type === 'system' && r.subtype === 'compact_boundary') {
      events.push({
        timestamp: r.timestamp ?? '',
        trigger: r.compactMetadata?.trigger ?? '',
        preTokens: r.compactMetadata?.preTokens ?? '',
      });
    }
  }
  const summaries = records.filter((r) => r.type === 'user' && r.isCompactSummary).length;
  return { events, summaries };
}

function loadSubagents(transcriptPath) {
  const dir = path.join(transcriptPath.replace(/\.jsonl$/, ''), 'subagents');
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => /^agent-.+\.jsonl$/.test(f));
  } catch {
    return [];
  }
  return files.map((f) => {
    const agentId = f.replace(/^agent-/, '').replace(/\.jsonl$/, '');
    let meta = {};
    try {
      meta = JSON.parse(fs.readFileSync(path.join(dir, `agent-${agentId}.meta.json`), 'utf8'));
    } catch {
      // meta file is optional
    }
    const records = readJsonl(path.join(dir, f));
    return { agentId, meta, byModel: usageByModel(records), compacts: findCompacts(records) };
  });
}

const fmt = (n) => n.toLocaleString('en-US');
const usd = (c) => (c === null ? 'n/a (no price)' : `$${c.toFixed(4)}`);

function sumCost(byModel) {
  let total = 0;
  let unpriced = false;
  for (const [model, u] of byModel) {
    const c = cost(model, u);
    if (c === null) unpriced = true;
    else total += c;
  }
  return { total, unpriced };
}

function modelTable(byModel) {
  const rows = [
    '| Model | Requests | Input | Output | Cache read | Cache write 5m | Cache write 1h | Cost |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const [model, u] of [...byModel].sort()) {
    rows.push(
      `| ${model} | ${u.requests} | ${fmt(u.input)} | ${fmt(u.output)} | ${fmt(u.cacheRead)} | ` +
        `${fmt(u.cacheWrite5m)} | ${fmt(u.cacheWrite1h)} | ${usd(cost(model, u))} |`,
    );
  }
  if (byModel.size === 0) rows.push('| — | 0 | 0 | 0 | 0 | 0 | 0 | $0.0000 |');
  return rows.join('\n');
}

function buildReport({ input, date, main, subagents, compacts }) {
  const total = new Map();
  const merge = (byModel) => {
    for (const [model, u] of byModel) {
      if (!total.has(model)) total.set(model, emptyUsage());
      addUsage(total.get(model), u);
    }
  };
  merge(main);
  for (const s of subagents) merge(s.byModel);

  const t = sumCost(total);
  const lines = [
    `# Usage report: ${input.session_id}`,
    '',
    `- Date: ${date}`,
    `- End reason: ${input.reason ?? 'n/a'}`,
    `- Transcript: \`${input.transcript_path}\``,
    `- Total cost: **${usd(t.total)}**${t.unpriced ? ' (excluding models without a price)' : ''}`,
    '',
    '## Total by model (main session + subagents)',
    '',
    modelTable(total),
    '',
    '## Main session',
    '',
    modelTable(main),
    '',
    `## Subagents (${subagents.length})`,
    '',
  ];

  if (subagents.length === 0) {
    lines.push('No subagents.');
  } else {
    lines.push('| Agent ID | Type | Description | Models | Requests | Cost |', '|---|---|---|---|---:|---:|');
    for (const s of subagents) {
      const c = sumCost(s.byModel);
      const requests = [...s.byModel.values()].reduce((a, u) => a + u.requests, 0);
      lines.push(
        `| ${s.agentId} | ${s.meta.agentType ?? 'n/a'} | ${(s.meta.description ?? '').replace(/\|/g, '\\|')} | ` +
          `${[...s.byModel.keys()].join(', ')} | ${requests} | ${usd(c.total)} |`,
      );
    }
  }

  const allEvents = [
    ...compacts.events.map((e) => ({ ...e, where: 'main' })),
    ...subagents.flatMap((s) => s.compacts.events.map((e) => ({ ...e, where: s.agentId }))),
  ];
  const summaryCount = compacts.summaries + subagents.reduce((a, s) => a + s.compacts.summaries, 0);
  lines.push('', `## Compact (${allEvents.length})`, '');
  if (allEvents.length === 0) {
    lines.push(`No compact boundaries found (compact summaries: ${summaryCount}).`);
  } else {
    lines.push('| Where | Timestamp | Trigger | Tokens before |', '|---|---|---|---:|');
    for (const e of allEvents) lines.push(`| ${e.where} | ${e.timestamp} | ${e.trigger} | ${e.preTokens} |`);
    lines.push('', `Compact summaries: ${summaryCount}.`);
  }

  lines.push(
    '',
    '## Notes',
    '',
    '- Prices are from the course slide "Cost" ($ per 1M tokens); cache read = 1/10 of input.',
    `- Cache writes are priced at ${CACHE_WRITE_MULT}× input price: this is an assumption, the slide gives no cache-write price.`,
    '- Usage is deduplicated by message.id (one API response spans several transcript records).',
    '- Compact detection uses documented markers and has not been verified on a real compacted transcript.',
    '',
  );
  return lines.join('\n');
}

function main() {
  const raw = readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.stderr.write('usage-report: stdin is not JSON, skipping\n');
    return;
  }
  if (!input.transcript_path || !input.session_id) {
    process.stderr.write('usage-report: transcript_path or session_id missing, skipping\n');
    return;
  }

  const records = readJsonl(input.transcript_path);
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const report = buildReport({
    input,
    date,
    main: usageByModel(records),
    subagents: loadSubagents(input.transcript_path),
    compacts: findCompacts(records),
  });

  const outDir = path.join(projectDir, 'reports', 'ws2');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${date}-${input.session_id}.md`), report);
}

try {
  main();
} catch (err) {
  // never break session shutdown because of the report
  process.stderr.write(`usage-report: ${err?.stack ?? err}\n`);
}
process.exit(0);
