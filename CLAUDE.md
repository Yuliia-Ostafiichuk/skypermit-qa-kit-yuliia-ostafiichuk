# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This repository is a QA kit for the **SkyPermit** project. The SkyPermit project lives in `../skypermit` and is **read-only** (see below).

Claude is used here for manual QA work only:
- **Test analysis**: analyze requirements, describe the test basis, and derive test conditions
- **Test case generation**
- **Test plans**
- **Defect reports**
- **Test reports**

All of this work is based on the SkyPermit documentation in **Confluence**. That documentation is the test basis: every test condition, test case and defect should trace back to a specific page (and section) there. If the docs are ambiguous, contradictory or missing something, record it as an open question or finding. Don't fill the gap with assumptions.

## Documentation source: Confluence

- Site `dragan1925.atlassian.net` (cloudId `fda6a7bd-b624-41c9-b57a-3bf22663b4ab`), space **SkyPermit Docs** (key `SD1`, space id `393220`).
- Read pages with the Atlassian MCP read tools only: `getConfluencePage`, `getPagesInConfluenceSpace`, `searchConfluenceUsingCql` (e.g. `space = SD1 AND text ~ "curfew"`).
- Confluence is read-only for this kit, like `../skypermit`: never create, update or comment on pages. Report doc problems as findings instead.

| # | Page title | Page id |
|---|---|---|
| 01 | 01 — Data Model | 458753 |
| 02 | 02 — State Machine | 131074 |
| 03 | 03 — API Contract | 65822 |
| 04 | 04 — Frontend Spec | 393438 |
| 05 | 05 — Open Questions | 98576 |
| 06 | 06 — Business Rules | 491521 |
| 07 | 07 — Clarifications | 524289 |
| 08 | 08 — UML Diagrams | 327682 |

Short names (`06`, `06 §1.4`) refer to these pages. Page URL: `https://dragan1925.atlassian.net/wiki/spaces/SD1/pages/<page id>`.

**What still comes from `../skypermit` (local, read-only):**
- **Code:** `app/`, `components/`, `lib/`, `supabase/`, `tests/`. `data-testid` selectors are always looked up in the code (`app/`, `components/`), not in Confluence.
- **Exception: `scripts/uncovered-rules.mjs`** reads `../skypermit/docs/06-business-rules.md` and `07-clarifications.md` locally because a Node script can't call MCP. So `/cover-gaps` builds its rule list from the local copies. If those differ from Confluence, Confluence wins, and the difference is recorded as a finding.

**Out of scope:** generating automated tests (test scripts, framework code, page objects, etc.). Don't produce automation code, even when asked to "implement" a test case. Write the test case in manual form instead.

**Exception: API automation through Postman.** Only two skills may do this. `/postman-collection-builder` turns API cases from `test-cases/` into a **new** Postman collection and environment (workspace `SkyPermit`, id `35768908-4935-42f4-a37e-63d2d4de4e90`). `/postman-cli-run` runs a collection with Postman CLI after the user's explicit «запускай». Rules for both:
- Never change or delete existing Postman collections or environments.
- Secrets live only in environment variables of type `secret` with no stored value. Pass them to the CLI as `--env-var "<var>=$SKYPERMIT_<NAME>"` from the user's shell, and never print them.
- Run logs go to `api-automation/runs/` with secrets removed. Raw CLI reports stay in the scratchpad (`*.raw.json` is gitignored).
- Never fix a test, a collection or data just to make a run pass. Report the failure instead.

This exception doesn't cover code-based frameworks (Playwright, Vitest, etc.). Those stay out of scope.

## Directory structure

All QA folders live at the root of this repo (`skypermit-qa-kit-yuliia-ostafiichuk/`), never inside `../skypermit`.

```
skypermit-qa-kit-yuliia-ostafiichuk/
├── .claude/
│   ├── agents/
│   │   ├── implementation-check.md  # Read-only subagent: jira-intake JSON → per-AC implemented/partial/not_found with file:line
│   │   └── tc-verifier.md  # Read-only subagent: verifies a test case against docs + code
│   └── skills/         # Claude Code skills for the QA workflows above
│       ├── api-test-case-creator/  # /api-test-case-creator <rule JSON | scenario>: API cases for ONE business rule → test-cases/api/API-OP-NNN.md (BV/EP via validate, state-transition chains)
│       ├── audit-permissions/  # /audit-permissions: read-only audit of permission rules in all settings files
│       ├── cover-gaps/ # /cover-gaps [--max N] [--gate G]: API test cases for uncovered business rules via api-test-case-creator, verified by tc-verifier
│       ├── postman-collection-builder/  # /postman-collection-builder <JSON>: API cases + openapi.yaml → NEW Postman collection + environment via Postman MCP; stops for review, runs nothing
│       ├── postman-cli-run/  # /postman-cli-run <JSON>: runs one collection via Postman CLI after explicit «запускай»; redacted log → api-automation/runs/, per-case results for testomat-sync report
│       ├── jira-intake/  # /jira-intake <JIRA-KEY>: read-only, one Jira issue → JSON (key, title, check_type, AC, confluence_url, notes)
│       ├── testomat-sync/  # /testomat-sync upsert|run|report: the only place that writes to Testomat.io (shared by UI and API orchestrators)
│       ├── story-doc-check/  # /story-doc-check <jira-intake JSON | file | empty>: read-only check of a story's acceptance criteria against Confluence
│       ├── story-to-api-tests/  # /story-to-api-tests <KEY>: API story → intake, doc + code check (stop), API cases + tc-verifier (mode: api), approval gate, testomat-sync upsert + run «<KEY> · API», Postman collection (review stop), postman-cli-run after «запускай», testomat-sync report
│       ├── story-to-tests/  # /story-to-tests <KEY>: UI story → intake, doc + code check (stop), UI cases + tc-verifier, approval gate, testomat-sync upsert + run
│       ├── ui-test-case-creator/  # /ui-test-case-creator <doc | doc §section | scenario>: atomic manual UI/E2E test cases (EP, BV, state transition)
│       └── test-plan/  # /test-plan <file-or-dir>: one-page test plan
├── api-automation/
│   └── runs/           # Redacted Postman CLI run logs from /postman-cli-run (no bodies, headers or secrets)
├── open-questions/     # Doc gaps found by /cover-gaps (NOTHING FOUND IN DOCUMENTATION) + per-run JSON summaries
├── scripts/
│   └── uncovered-rules.mjs  # Read-only: 06 §6 rules (per 07) with no test case, grouped by gate, as JSON
├── test-cases/         # Generated test cases (ui/ = TC-UI-*, api/ = API-OP-*)
├── test-plans/         # Generated test plans (/test-plan)
├── CLAUDE.md
└── README.md
```

Folders for defect reports and test reports aren't set up yet and will be added later. Until then, ask where these outputs should go rather than creating new top-level folders.

## Rules for `../skypermit` (read-only)

You may only **read** files in `../skypermit` (open, search, list). The following are forbidden:
- Creating, editing, deleting, moving or renaming any file or directory inside `../skypermit`, including docs, code, configs and generated files
- Running formatters, linters with auto-fix, code generators, package installs (`npm install`, `pip install`, etc.), builds or scripts inside `../skypermit`, since these can write files there
- Any git operation that changes `../skypermit`'s state: commit, checkout, switch, reset, stash, branch, merge, rebase, pull, push, clean, tag
- Writing QA artifacts (test cases, plans, reports, notes) into `../skypermit`. They belong in this repo, outside `../skypermit`

If a task seems to require changing `../skypermit` (for example, a doc error you found), don't make the change. Report it as a finding or defect instead.
