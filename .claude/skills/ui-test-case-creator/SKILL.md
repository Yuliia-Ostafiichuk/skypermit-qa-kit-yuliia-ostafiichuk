---
name: ui-test-case-creator
description: Generate atomic, low-level manual UI/E2E test cases (one check per scenario) for SkyPermit from the SkyPermit Docs Confluence space. Every case is executed through the web UI (pages, forms, buttons) and addresses elements by their data-testid from the ../skypermit code. Cases are derived with equivalence partitioning, boundary values and state transitions, and saved one markdown file per case in test-cases/ui/ with ID, doc ref, preconditions, steps and expected result. Input is a doc page, a doc section (e.g. "04 — Frontend Spec §Operator portal" or "06 §1.4"), or a single described scenario. Use it whenever the user asks to write, generate or add UI, E2E, end-to-end, form or screen test cases or checks for a SkyPermit page, form, flow or a rule as the user sees it in the browser (e.g. "cover the register form", "what should we check on the reviewer screen?"). Do NOT use it for API test cases (requests to /api/v1, status codes, JSON bodies, headers): a separate API test-case skill covers those. Do NOT use it for automation code.
argument-hint: <doc | doc §section | "scenario description">
allowed-tools: Read, Grep, Glob, Write, mcp__atlassian__getConfluencePage, mcp__atlassian__getPagesInConfluenceSpace, mcp__atlassian__searchConfluenceUsingCql
---

# Atomic UI test cases

Write manual UI/E2E test cases for SkyPermit from `$ARGUMENTS`. Each test case checks **one thing in one scenario**, is executed entirely through the browser, and goes in its own markdown file under `test-cases/ui/`.

Why atomic: when a test case fails, its ID alone should tell you what's broken. A defect report can link to exactly one test case, and a re-test after a fix runs exactly that check. A test case that checks "lead time and duration" or "5 and 6 hours" hides which part failed.

Why UI only: API cases (method, path, headers, JSON body, status code) are written by a separate API test-case skill. Keeping the two apart means every case here can be run by a tester with nothing but a browser.

## 1. Understand the input

`$ARGUMENTS` is one of these:
- **A doc or section** (`04 — Frontend Spec`, `04 §Operator portal`, `06 §1.4`): generate the **full set** of UI test cases the techniques in step 3 produce for that scope.
- **A scenario description** (`"window ends exactly at curfew start in KBP-CTR-3, submitted from the flight request form"`): generate **exactly one** test case.
- **Empty or unclear:** ask what to cover. List the pages of the `SD1` space (`getPagesInConfluenceSpace`) to help.

Resolve short names with the page table in `CLAUDE.md` (`06` → `06 — Business Rules`, id `491521`). For a scenario, find its source with `searchConfluenceUsingCql` (`space = SD1 AND text ~ "<term>"`). Every input, even a scenario, needs a source in the docs. If you can't find one, say so and don't write a test case. A test case that doesn't come from a requirement can't be judged pass or fail.

**Not reachable through the UI → not this skill.** If the scope or scenario can only be checked by calling the API directly (e.g. a missing field the form never lets you omit, a raw `409`, a reviewer header, another operator's resource id), don't write it as a UI case. List it in the summary as "API — out of scope for this skill".

## 2. Read the test basis

- Read the target page or section from Confluence (`getConfluencePage`), plus any pages it references. `04 — Frontend Spec` defines the screens and flows; `01`, `02`, `03` and `06` define the data, states and rules the screens show. Don't use `../skypermit/docs/` as the source.
- Always check `05 — Open Questions` and `07 — Clarifications` for the same topic. `07` overrides `06` where they disagree. `05` says what is still open.
- **Selectors come from the code, not from Confluence.** Look up every `data-testid` in `../skypermit/app/` and `../skypermit/components/` (Grep `data-testid="`). Use only values that exist there. If `04` names a selector the code doesn't have, or the other way round, record it as a finding in the summary.
- `../skypermit` is read-only (see `CLAUDE.md`). Read and search only. Don't run anything there.

## 3. Derive test conditions with test design techniques (doc/section input)

Before writing files, list the test conditions. Apply **all three** techniques below to every form field, rule and flow in scope, and generate every condition they produce. Don't stop at one happy path and one negative.

**Equivalence partitioning (EP).** For each input the user enters or selects in the UI (form fields, dropdowns, role switcher), split its values into classes the docs treat the same way:
- one condition per **valid** class (e.g. each pilot `rating` × zone class that the form lets you pick, each aircraft band);
- one condition per **invalid** class whose UI response the docs or code define (e.g. empty required field, duplicate national ID, weight above the registration ceiling): the error shown in the matching `*-error` element.
- One invalid class per test case. Don't combine two invalid values in one case: you won't know which one triggered the error.

**Boundary value analysis (BV).** For every numeric, length, date or time limit that can be entered through the UI, test the **on-point and the off-point on each side that matters**: e.g. window start = submission + 6 h 00 m passes, + 5 h 59 m fails; 900 g → C0, 901 g → C1; altitude exactly at the zone ceiling and 1 m above. Each boundary value is its own test case.

**State transition.** For flight requests (`02 — State Machine`, `06 §5`) and any other stateful entity shown in the UI:
- one condition per **legal transition** the UI can trigger (the button or action that causes it, and the new state shown on the detail page);
- **illegal transitions** as seen in the UI: the action is absent or disabled in a state where `02` forbids it, or the UI shows the error. Cover each state that has a forbidden action at least once.
- Where `04` defines it, one condition per state for **what the detail page shows** in that state (e.g. rejection reason and rule reference after a `REJECTED`).

**Decision rules / ordering** where they show in the UI: e.g. which gate's rule reference is shown when two would fail.

One condition = one test case. Show the list of conditions grouped by technique before writing. If there are more than ~25, ask the user to confirm the full list before generating the files. That's a lot of files to review at once, so don't write them unconfirmed.

Skip conditions that can't be judged:
- **Open items:** anything listed as open in `05`, e.g. the `SUSPENDED` operator response.
- **Unresolved conflicts:** two docs disagree and neither `07` nor `05` settles it.
- **API-only conditions** (step 1).

List skipped conditions with the reason in the final summary. Don't guess an expected result. A test case built on a guessed result produces false defects.

## 4. Check for duplicates and pick IDs

- Grep `test-cases/ui/` for test cases with the same doc ref and scenario. Don't duplicate them. Mention them in the summary instead.
- IDs are `TC-UI-<NNN>`. Continue from the highest existing number in `test-cases/ui/` (start at `001`). All UI cases go in `test-cases/ui/`, whatever rule or area they cover. The doc ref says which rule.

## 5. Write each test case

Read `templates/test-case.md` and copy it for each test case. Replace every `<placeholder>`, keep the headings and field order unchanged, and save it as `test-cases/ui/<ID>.md`. The template keeps every test case the same shape, so they're easy to review side by side and to link from defect reports.

What goes into each placeholder:
- `<ID>`: the ID chosen in step 4, used in both the heading and the **ID** field.
- `<title>`: one line naming the single check.
- `<doc ref>`: `<Confluence page title> §<section>`, plus the governing source in parentheses if the doc cites one, e.g. `06 — Business Rules §1.4 (TSD-4 §4); 04 — Frontend Spec §Operator portal`.
- `<precondition>`: one numbered item per piece of setup that must exist before step 1, with concrete data.
- `<step>`: one numbered item per user action in the browser, with exact values.
- `<expected result>`: the single observable outcome on screen.

Write at the lowest level a tester can execute without interpretation:
- **UI steps only.** Each step is a page path to open, an element to click, a field to fill or an option to choose. Name the element by its `data-testid` from the code (step 2); where it has none, describe it in plain words (label, button text, position). No `curl`, no request bodies, no headers.
- **Use concrete data from the docs:** real zone codes and their values (06 §4), real band limits, exact gram and metre values. For times that depend on "now", write them relative to the moment of the step (e.g. `window start = time of clicking Submit + 6 h 00 m`) and give the zone-local time where curfew matters.
- **Preconditions** contain only setup. Setup the UI can't do (e.g. "operator's `authorisation_level` raised to `L2` by admin"; registration always creates `L1`) is allowed here as out-of-band setup.
- **Expected result** describes one outcome as the user sees it: which element appears or changes, and its text or value, e.g. `flight-request-detail-rule-reference` shows `A-7 §1` and the request state is `REJECTED`. Several facts about that same outcome are fine. A second, independent outcome is not (e.g. "and the audit log has an entry"). That belongs in its own test case. Use `rule_reference` values verbatim from 06 §6.
- **Exception — network check on a gate failure.** When a UI action (Check before submitting, Submit) ends in a gate failure, the expected result also includes what the tester sees in the browser's DevTools → Network tab: the response to that action's request (`POST /api/v1/flight-requests/<id>/validate` or `.../submit`) has status `422` with `failing_gate` and `rule_reference` (verbatim from 06 §6). Add a precondition "Browser DevTools are open on the Network tab (filter Fetch/XHR) before step 1" and cite `03 — API Contract §The 422 body` in the doc ref. This is the only API detail allowed in a UI case: still no request bodies, headers or `curl`, and no API-only scenarios (step 1).
- **Mark unconfirmed citations.** If an expected value has a citation that `05` lists as not fully confirmed, such as the zone-`active` `ZC-2026.1 §4`, add `(citation unconfirmed — 05 §2)` after it.
- **Manual only.** Never write automation code (scripts, framework code, selectors-as-code). See `CLAUDE.md`.

### Example

Read `examples/TC-UI-001.md`. It shows the structure: header-link navigation, form fields, `data-testid` values only where the code has them, and a single on-screen outcome. Its form data is shown as `<placeholder>`s with a description of what each value must be. That shows the structure only. A real test case still uses concrete values.

## 6. Summarize

Finish with:
- A table of the created test cases: ID, title, technique (EP / BV / state transition / decision rule), file path.
- The skipped conditions, each with its reason (open question, doc conflict, API-only, duplicate of `<ID>`).
- Selector findings: `data-testid` mismatches between `04` and the code, if any.
