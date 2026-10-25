---
name: cover-gaps
description: Close SkyPermit business-rule coverage gaps. Lists the rules from 06-business-rules.md §6 (corrected per 07-clarifications.md) that no test case covers yet, generates one negative test case per rule with test-case-creator, verifies each with the tc-verifier subagent, keeps only verified cases, and returns a JSON summary.
argument-hint: [--max N] [--gate PILOT|AIRCRAFT|ZONE|TIME_WINDOW|REGISTRATION]
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Write, Skill, Agent, Bash(node scripts/uncovered-rules.mjs*), Bash(rm test-cases/*), Bash(mkdir -p open-questions)
---

# Cover business-rule gaps

Find the business rules that have no test case yet, write one for each, and keep only the ones that `tc-verifier` confirms against the docs.

Why only verified cases stay: a test case with a wrong or invented expected result produces false defects. A gap that stays open is visible in the next run of the script. A bad test case that looks like coverage isn't.

## 1. Parse arguments

`$ARGUMENTS` may contain:
- `--max N`: how many rules to process in this run. Default `3`. Each rule costs a generation and a verification, so keep runs small.
- `--gate G`: only rules of one gate: `PILOT`, `AIRCRAFT`, `ZONE`, `TIME_WINDOW` or `REGISTRATION` (the aircraft weight ceiling at registration, 06 §3, which isn't a gate). Default: all, in evaluation order.

If an argument is unknown or invalid, say so and stop. Don't guess what was meant.

## 2. List the gaps

Run:

```
node scripts/uncovered-rules.mjs --max <N> [--gate <G>]
```

The script reads `../skypermit/docs/06-business-rules.md` §6 and applies the corrections from `07-clarifications.md` (the weight-band check belongs to `AIRCRAFT`; the zone-inactive citation is unconfirmed). It counts a rule as covered when one file in `test-cases/` contains both `failing_gate: "<GATE>"` and `rule_reference: "<ref>"`. The gate is part of the key because `ZC-2026.1 §2` is shared by `AIRCRAFT` and `ZONE`.

- If the script exits non-zero, report its stderr and stop. It means 06 or 07 changed shape, and the rule list can't be trusted.
- If `warnings` isn't empty, carry it into the summary. A stale 07 correction is a finding in its own right.
- If `selected` is `0`, skip to step 6 with an empty `results` list.

Note the time now as `<run-id>` in the form `YYYYMMDD-HHMM`. It names this run's files in step 5.

## 3. Generate one test case per rule

Process the rules **one at a time**, in the order the script returned them. Don't run them in parallel: test-case-creator picks the next free ID in an area, and parallel runs would collide.

For each rule:
1. List `test-cases/**/*.md` (Glob) before the call.
2. Invoke the `test-case-creator` skill with a **scenario** argument. A scenario makes it write exactly one test case. Build it from the script's fields:

   > One negative test case for the `<gate>` rule "<condition>" from `<doc_section>` (rule table 06 §6): the request fails only this condition, all other gates pass, and the expected result is `422` with `failing_gate: "<gate>"` and `rule_reference: "<rule_reference>"`.

   - For `REGISTRATION`, describe the `POST /api/v1/aircraft` write instead: `422` with `rule_reference: "OH-1 §3"` and **no** `failing_gate`.
   - If `citation_unconfirmed` is `true`, add: "Mark the citation `(citation unconfirmed — 05 §2)`."
3. List `test-cases/**/*.md` again. The new file is the difference.
   - No new file: test-case-creator skipped the rule. Record `outcome: "skipped"` with its stated reason and go on to the next rule.
   - A file appeared but doesn't contain the expected `failing_gate`/`rule_reference` pair: it doesn't close the gap. Delete it and record `outcome: "deleted"` with reason "generated case doesn't target the rule".
   - More than one new file: keep all of them for verification, and say so in the summary.

Only files created in this run may be deleted later. Never touch a test case that existed before step 3.

## 4. Verify each new test case

When all rules are generated, launch one `tc-verifier` subagent per new test case, all in the same message so they run in parallel. Pass only the path, e.g. `test-cases/zone-gate/TC-ZONE-001.md`. Wait for every verifier to report back before going on.

Read the overall status from the verifier's heading `## <ID> — <STATUS>`, then act on it:

| Verdict | What happens to the file | `outcome` |
|---|---|---|
| `CORRESPONDS TO SPECS` | Stays in `test-cases/`. | `kept` |
| `DOES NOT CORRESPOND TO SPECS` | Delete it right away with `rm`, no regeneration. | `deleted` |
| `NOTHING FOUND IN DOCUMENTATION` | Delete it, and add the open question to `open-questions/` (step 5). | `open_question` |

If the reply has no readable status, run the verifier once more for that file. If it's still unreadable, treat the case as unverified: delete it and record `outcome: "deleted"` with reason "verifier returned no status".

For every verdict, copy the verifier's **Code discrepancies** (if not "none") into the result. A doc-vs-code difference on a kept case may be a product defect.

## 5. Write the open questions and the JSON

`open-questions/` sits at the repo root, never inside `../skypermit`. Create it if needed (`mkdir -p open-questions`).

If any case got `NOTHING FOUND IN DOCUMENTATION`, write `open-questions/cover-gaps-<run-id>.md`, one section per rule:

```markdown
# Open questions — cover-gaps <run-id>

## <gate> — <condition> (`<rule_reference>`)

**Source:** <doc_section>
**Removed test case:** <ID> (was <path>)
**What the docs don't say:** <each item the verifier marked NOTHING FOUND, with its step/fact number>
**Hint from code:** <what the verifier saw in the code, or "none">. Code isn't a spec.
```

Always save the JSON from step 6 to `open-questions/cover-gaps-<run-id>.json`, even when there are no open questions, so each run leaves a trace.

## 6. Return the JSON summary

End with the JSON in one ```json block, with exactly this shape:

```json
{
  "run_id": "20261025-1430",
  "args": { "max": 3, "gate": null },
  "gaps_before": 13,
  "processed": 3,
  "results": [
    {
      "gate": "PILOT",
      "condition": "Rating doesn't cover zone class",
      "rule_reference": "OH-1 §2.1",
      "test_case": "TC-PLT-001",
      "file": "test-cases/pilot-gate/TC-PLT-001.md",
      "verdict": "CORRESPONDS TO SPECS",
      "outcome": "kept",
      "reason": null,
      "code_discrepancies": null
    }
  ],
  "totals": { "kept": 1, "deleted": 0, "open_question": 0, "skipped": 0 },
  "open_questions_file": null,
  "gaps_after": 12,
  "warnings": []
}
```

- `gaps_before` is the script's `uncovered_matching` from step 2. For `gaps_after`, run the script again with the same `--gate` and no `--max`, and take its `uncovered_matching`. It shows whether the run actually closed what it claims.
- `test_case`, `file` and `verdict` are `null` for a skipped rule. `reason` is required for every outcome except `kept`.
- `open_questions_file` is the path from step 5, or `null` if there were no open questions.

## Rules

- `../skypermit` is read-only (see `CLAUDE.md`). The script only reads it, and nothing in this skill writes there.
- Manual test cases only. No automation code.
- Don't edit a test case to make it pass verification. The verdict decides what happens to it, as set out in step 4.
