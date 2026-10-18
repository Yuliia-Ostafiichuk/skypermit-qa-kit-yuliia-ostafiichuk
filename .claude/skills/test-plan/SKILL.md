---
name: test-plan
description: Generate a one-page test plan (scope, risks, manual vs. automated strategy, entry/exit criteria) from a SkyPermit doc file or directory.
argument-hint: <file-or-directory>
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Write
---

# One-page test plan

Generate a one-page test plan for the SkyPermit documentation given in `$ARGUMENTS`, and save it to `test-plans/`.

## 1. Resolve the input

- If `$ARGUMENTS` is empty, ask which file or directory to plan for, and stop.
- Resolve the path in this order: as given, then under `../skypermit/`, then under `../skypermit/docs/`. For example, `06-business-rules.md` resolves to `../skypermit/docs/06-business-rules.md`.
- If nothing matches, list the contents of `../skypermit/docs/` and ask the user to choose. Don't guess.

## 2. Gather the test basis

- **File input:** read the file. Also read `05-open-questions.md`, `07-clarifications.md` and any other docs the file references, but only for the parts that affect the file's scope.
- **Directory input:** read every document in it. The plan covers the whole directory.
- **Existing tests:** list `../skypermit/tests/` and grep the `describe`/`it`/`test` names to see which areas already have automated tests. Don't run the tests or any other scripts in `../skypermit`.

`../skypermit` is read-only. See `CLAUDE.md`.

## 3. Write the plan

Use the template below. Keep it to about one printed page (500–700 words).
- Use bullets, not prose.
- Every scope item, risk and strategy row cites its source as `doc-file §section`.
- Don't invent requirements. A gap, contradiction or unresolved open question goes in as a risk, citing its source.
- The strategy recommends what to automate. It never contains test code.

```markdown
# Test Plan: <scope name>

**Test basis:** <list of doc files> · **Existing tests reviewed:** <tests/ paths> · **Date:** <YYYY-MM-DD>

## 1. Scope
**In scope**
- <feature / rule / flow> — <source>

**Out of scope**
- <item> — <reason>

## 2. Risks
| ID | Risk | Likelihood | Impact | Mitigation | Source |
|----|------|------------|--------|------------|--------|
| R1 | ... | H/M/L | H/M/L | ... | 06-business-rules.md §... |

(5–7 rows, sorted by likelihood × impact, highest first)

## 3. Strategy
| Area | Approach | Rationale | Existing automated coverage |
|------|----------|-----------|-----------------------------|
| ... | Manual / Automated / Both | ... | tests/lib/... or "none" |

- **Manual focus:** <exploratory, UI/UX, ambiguous rules, end-to-end flows>
- **Automation gaps to close:** <areas with no existing tests that should be automated>

## 4. Entry criteria
- ...

## 5. Exit criteria
- ...
```

Unless the docs define them, entry and exit criteria are proposals. Mark them "(proposed)", e.g. "All High risks covered by executed tests; no open Critical/High defects (proposed)".

## 4. Save

- Save to `test-plans/<slug>-test-plan.md`. For a file, the slug is its name without the number prefix or extension (`06-business-rules.md` → `business-rules`). For a directory, it's the directory name (`docs` → `docs`).
- If the file already exists, ask whether to overwrite it or save a new copy with a date suffix.
- Finish with the file path and a 2–3 line summary: the main risks and the biggest automation gaps.
