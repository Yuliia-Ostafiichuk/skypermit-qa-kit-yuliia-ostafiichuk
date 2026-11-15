---
name: test-plan
description: Generate a one-page test plan (scope, risks, manual vs. automated strategy, entry/exit criteria) from a SkyPermit Confluence doc page, or from the whole SkyPermit Docs space.
argument-hint: <page (e.g. 06) | all>
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Write, mcp__atlassian__getConfluencePage, mcp__atlassian__getPagesInConfluenceSpace, mcp__atlassian__searchConfluenceUsingCql
---

# One-page test plan

Generate a one-page test plan for the SkyPermit Confluence documentation given in `$ARGUMENTS`, and save it to `test-plans/`.

## 1. Resolve the input

- If `$ARGUMENTS` is empty, ask which page (or the whole space) to plan for, and stop.
- Resolve the input with the page table in `CLAUDE.md`: a number or title (`06`, `06 — Business Rules`, also the old file name `06-business-rules.md`) → that page; `all` / `docs` / `SD1` → every page in the space. Don't read `../skypermit/docs/`.
- If nothing matches, list the pages of the `SD1` space (`getPagesInConfluenceSpace`) and ask the user to choose. Don't guess.

## 2. Gather the test basis

- **Page input:** read the page (`getConfluencePage`). Also read `05 — Open Questions`, `07 — Clarifications` and any other pages it references, but only for the parts that affect the page's scope.
- **Whole-space input:** read every doc page (01–08). The plan covers the whole space.
- **Existing tests:** list `../skypermit/tests/` and grep the `describe`/`it`/`test` names to see which areas already have automated tests. Don't run the tests or any other scripts in `../skypermit`.

`../skypermit` is read-only. See `CLAUDE.md`.

## 3. Write the plan

Use the template below. Keep it to about one printed page (500–700 words).
- Use bullets, not prose.
- Every scope item, risk and strategy row cites its source as `<page title> §section`.
- Don't invent requirements. A gap, contradiction or unresolved open question goes in as a risk, citing its source.
- The strategy recommends what to automate. It never contains test code.

```markdown
# Test Plan: <scope name>

**Test basis:** <list of Confluence page titles> · **Existing tests reviewed:** <tests/ paths> · **Date:** <YYYY-MM-DD>

## 1. Scope
**In scope**
- <feature / rule / flow> — <source>

**Out of scope**
- <item> — <reason>

## 2. Risks
| ID | Risk | Likelihood | Impact | Mitigation | Source |
|----|------|------------|--------|------------|--------|
| R1 | ... | H/M/L | H/M/L | ... | 06 — Business Rules §... |

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

- Save to `test-plans/<slug>-test-plan.md`. For a page, the slug is its title without the number prefix, lowercased with spaces as `-` (`06 — Business Rules` → `business-rules`). For the whole space, the slug is `docs`.
- If the file already exists, ask whether to overwrite it or save a new copy with a date suffix.
- Finish with the file path and a 2–3 line summary: the main risks and the biggest automation gaps.
