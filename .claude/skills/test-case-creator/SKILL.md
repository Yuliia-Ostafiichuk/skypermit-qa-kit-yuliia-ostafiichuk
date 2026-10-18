---
name: test-case-creator
description: Generate atomic, low-level manual test cases (one check per scenario) for SkyPermit from ../skypermit/docs, saved as one markdown file per test case in test-cases/<area>/ with ID, doc ref, preconditions, steps and expected result. Input is a doc file, a doc section (e.g. "06-business-rules.md §1.4"), or a single described scenario. Use this skill whenever the user asks to write, generate, derive or add test cases, test scenarios or checks for any SkyPermit requirement, rule, endpoint, state transition or screen, even if they don't say "test case" explicitly (e.g. "cover the curfew rule", "what should we check for cancel?").
argument-hint: <doc | doc §section | "scenario description">
allowed-tools: Read, Grep, Glob, Write
---

# Atomic test cases

Write manual test cases for SkyPermit from `$ARGUMENTS`. Each test case checks **one thing in one scenario** and goes in its own markdown file under `test-cases/`.

Why atomic: when a test case fails, its ID alone should tell you what's broken. A defect report can link to exactly one test case, and a re-test after a fix runs exactly that check. A test case that checks "lead time and duration" or "5 and 6 hours" hides which part failed.

## 1. Understand the input

`$ARGUMENTS` is one of these:
- **A doc or section** (`06-business-rules.md`, `06 §1.4`, `03-api-contract.md Reviewer`): generate a **set** of test cases covering that scope.
- **A scenario description** (`"window ends exactly at curfew start in KBP-CTR-3"`): generate **exactly one** test case.
- **Empty or unclear:** ask what to cover. List `../skypermit/docs/` to help.

Look up short names in `../skypermit/docs/` (`06` → `06-business-rules.md`). Every input, even a scenario, needs a source in the docs. If you can't find one, say so and don't write a test case. A test case that doesn't come from a requirement can't be judged pass or fail.

## 2. Read the test basis

- Read the target doc or section, plus any docs it references.
- Always check `05-open-questions.md` and `07-clarifications.md` for the same topic. `07` overrides `06` where they disagree. `05` says what is still open.
- `../skypermit` is read-only (see `CLAUDE.md`). Don't run anything there.

## 3. Derive test conditions (doc/section input)

Before writing files, list the test conditions. Use the technique that fits the rule:
- **Boundary values** for numeric and time limits. Test exactly at the limit and one unit past it on each side that matters: e.g. 6 h 00 m passes, 5 h 59 m fails; 900 g → C0, 901 g → C1.
- **Equivalence classes** for enums and categories: e.g. each rating × zone class.
- **State transitions:** each legal transition, plus representative illegal ones (`409`).
- **Decision rules / ordering:** e.g. which gate is reported when two would fail.
- **Negative inputs** where the doc defines the response: missing fields, wrong role, another operator's resource.

One condition = one test case. If the scope produces more than ~25 conditions, show the list grouped by topic and ask whether to generate all of them or a subset. Mass-producing test cases nobody asked for makes review harder.

Skip conditions that can't be judged:
- **Open items:** anything listed as open in `05`, e.g. the `SUSPENDED` operator response.
- **Unresolved conflicts:** two docs disagree and neither `07` nor `05` settles it.

List skipped conditions with the reason in the final summary. Don't guess an expected result. A test case built on a guessed result produces false defects.

## 4. Check for duplicates and pick IDs

- Grep `test-cases/` for test cases with the same doc ref and scenario. Don't duplicate them. Mention them in the summary instead.
- IDs are `TC-<AREA>-<NNN>`. Continue from the highest existing number in that area (start at `001`).

| Area | Code | Folder | Typical source |
|---|---|---|---|
| Auth & ownership | `AUTH` | `auth/` | 03 §Authentication |
| Registry (operators, pilots, aircraft) | `REG` | `registry/` | 03 §Registry, 01 |
| Zone reference data | `ZREF` | `zone-reference/` | 03 §Reference data, 06 §4 |
| `PILOT` gate | `PLT` | `pilot-gate/` | 06 §1.1, §2 |
| `AIRCRAFT` gate | `ACF` | `aircraft-gate/` | 06 §1.2, §3 |
| `ZONE` gate | `ZONE` | `zone-gate/` | 06 §1.3 |
| `TIME_WINDOW` gate | `TW` | `time-window/` | 06 §1.4 |
| Gate pipeline & `validate` | `PIPE` | `gate-pipeline/` | 06 Evaluation order, 03 §Gate pipeline |
| State machine & cancellation | `SM` | `state-machine/` | 02, 06 §5 |
| Reviewer actions | `REV` | `reviewer/` | 03 §Reviewer |
| Audit log | `AUD` | `audit/` | 01 §AuditLog |
| Data model constraints | `DM` | `data-model/` | 01 |
| Frontend | `UI` | `ui/` | 04 |

If nothing fits, propose a new area code and folder and ask before using it.

## 5. Write each test case

Read `templates/test-case.md` and copy it for each test case. Replace every `<placeholder>`, keep the headings and field order unchanged, and save it as `test-cases/<folder>/<ID>.md`. The template keeps every test case the same shape, so they're easy to review side by side and to link from defect reports.

What goes into each placeholder:
- `<ID>`: the ID chosen in step 4, used in both the heading and the **ID** field.
- `<title>`: one line naming the single check.
- `<doc ref>`: `<doc file> §<section>`, plus the governing source in parentheses if the doc cites one, e.g. `06-business-rules.md §1.4 (TSD-4 §4)`.
- `<precondition>`: one numbered item per piece of setup that must exist before step 1, with concrete data.
- `<step>`: one numbered item per action, with exact values.
- `<expected result>`: the single observable outcome.

Write at the lowest level a tester can execute without interpretation:
- **Choose the interface per requirement.** For API contracts and business rules (01, 02, 03, 05, 06), write API steps: method, path under `/api/v1`, headers (session / `X-Reviewer-Id`) and the exact JSON body. For frontend requirements (04), write UI steps: page path and the element's `data-testid` where the doc gives one, or a plain description where it doesn't.
- **Use concrete data from the docs:** real zone codes and their values (06 §4), real band limits, exact gram and metre values. For times that depend on "now", write them relative to the moment of the step (e.g. `window_start = submission time + 6 h 00 m`) and give the zone-local time where curfew matters.
- **Preconditions** contain only setup. That includes setup done out of band, like "operator's `authorisation_level` raised to `L2` by admin" (registration always creates `L1`).
- **Expected result** describes one outcome. Several facts about that same outcome are fine, e.g. status `422` + `failing_gate: "TIME_WINDOW"` + `rule_reference: "A-7 §1"`. A second, independent outcome is not, e.g. "and the audit log has an entry". That belongs in its own test case. Use `rule_reference` values verbatim from 06 §6.
- **Mark unconfirmed citations.** If an expected value has a citation that `05` lists as not fully confirmed, such as the zone-`active` `ZC-2026.1 §4`, add `(citation unconfirmed — 05 §2)` after it.
- **Manual only.** Never write automation code (scripts, framework code, selectors-as-code). See `CLAUDE.md`.

### Example

```markdown
# TC-TW-007: Window crossing into the A-7 curfew in KBP-CTR-3 is rejected

**ID:** TC-TW-007
**Doc ref:** 06-business-rules.md §1.4 (TSD-4 §4; A-7 §1)

## Preconditions
1. Operator O1 is logged in; `authorisation_level` = `L2`, `status` = `ACTIVE`.
2. Pilot P1 belongs to O1: `rating` = `R_ADVANCED`, `certified_on` = 6 months before the test date.
3. Aircraft A1 belongs to O1: `mtom_grams` = 2000 (band C1), no other requests.
4. Flight request FR1 in `DRAFT` for O1/P1/A1, zone `KBP-CTR-3`, `requested_altitude_metres` = 100, window 22:30–23:30 Europe/Kyiv on a date 2 days from now (UTC values converted accordingly).

## Steps
1. Send `POST /api/v1/flight-requests/{FR1.id}/submit` with O1's session.

## Expected result
- Response `422` with `failing_gate: "TIME_WINDOW"` and `rule_reference: "A-7 §1"`; FR1 `state` = `REJECTED`.
```

For a UI-level test case, read `examples/TC-UI-001.md`. It uses `data-testid` values only where `04` defines them, and describes everything else in plain words.

## 6. Summarize

Finish with:
- A table of the created test cases: ID, title, file path.
- The skipped conditions, each with its reason (open question, doc conflict, duplicate of `<ID>`).
