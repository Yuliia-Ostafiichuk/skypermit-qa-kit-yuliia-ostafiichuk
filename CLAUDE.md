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

All of this work is based on the documentation in `../skypermit/docs/`. That documentation is the test basis: every test condition, test case and defect should trace back to a specific document (and section) in `docs/`. If the docs are ambiguous, contradictory or missing something, record it as an open question or finding. Don't fill the gap with assumptions.

**Out of scope:** generating automated tests (test scripts, framework code, page objects, etc.). Don't produce automation code, even when asked to "implement" a test case. Write the test case in manual form instead.

## Directory structure

All QA folders live at the root of this repo (`skypermit-qa-kit-yuliia-ostafiichuk/`), never inside `../skypermit`.

```
skypermit-qa-kit-yuliia-ostafiichuk/
├── .claude/
│   ├── agents/
│   │   └── tc-verifier.md  # Read-only subagent: verifies a test case against docs + code
│   └── skills/         # Claude Code skills for the QA workflows above
│       ├── audit-permissions/  # /audit-permissions: read-only audit of permission rules in all settings files
│       ├── cover-gaps/ # /cover-gaps [--max N] [--gate G]: test cases for uncovered business rules, verified by tc-verifier
│       ├── test-case-creator/  # /test-case-creator <doc | doc §section | scenario>: atomic manual test cases
│       └── test-plan/  # /test-plan <file-or-dir>: one-page test plan
├── open-questions/     # Doc gaps found by /cover-gaps (NOTHING FOUND IN DOCUMENTATION) + per-run JSON summaries
├── scripts/
│   └── uncovered-rules.mjs  # Read-only: 06 §6 rules (per 07) with no test case, grouped by gate, as JSON
├── test-cases/         # Generated test cases
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
