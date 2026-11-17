---
name: api-test-case-creator
description: Пише API-кейси на ОДНЕ бізнес-правило SkyPermit у test-cases/api/ — HTTP-запити до /api/v1 у Steps, статус і тіло 422 в Expected result. BV і EP як validate-перевірки, state transition як ланцюжки запитів. НЕ для UI-кейсів (ui-test-case-creator), не для запуску запитів (postman-cli-run).
argument-hint: '{"gate": "TIME_WINDOW", "rule_reference": "TSD-4 §2.1", "story": "SKY-2"}'
model: sonnet
allowed-tools:
  - Read(test-cases/**)
  - Grep(test-cases/**)
  - Glob(test-cases/**)
  - Write(test-cases/api/**)
  - mcp__atlassian__getConfluencePage
  - mcp__atlassian__searchConfluenceUsingCql
---

# API test cases for one business rule

Write manual API test cases for **one** SkyPermit business rule from `$ARGUMENTS`. Each case checks **one thing**, is executed only with HTTP requests to `/api/v1`, and goes in its own markdown file `test-cases/api/API-OP-<NNN>.md`.

UI cases (pages, forms, buttons, `data-testid`) are written by **`ui-test-case-creator`**, not here. Running the requests is `/postman-cli-run`; turning cases into a Postman collection is `/postman-collection-builder`.

Why atomic: a failing case's ID alone should tell you what broke, a defect report links to exactly one case, and a re-test runs exactly that check.

## 1. Understand the input

`$ARGUMENTS` is one of:

- **JSON for one rule**, e.g. `{"gate": "TIME_WINDOW", "rule_reference": "TSD-4 §2.1", "story": "SKY-2"}`.
  - `gate`: `PILOT`, `AIRCRAFT`, `ZONE`, `TIME_WINDOW`, or `REGISTRATION` (the aircraft-write rule, which has no gate).
  - `rule_reference`: a value from `06 — Business Rules` §6, verbatim.
  - `story` (optional): Jira key. Not a case field; it goes into the summary and the hand-off JSON for `/postman-collection-builder` (step 6).
  - Generate the **full set** of cases the techniques in step 3 produce for that one rule.
- **A scenario description** (this is how `/cover-gaps` calls the skill): generate **exactly one** case for it.
- **Empty, unclear, or more than one rule:** ask which single rule to cover. One run = one rule.

Every case needs a source in the docs. If you can't find the rule in `06` §6 (as corrected by `07`), say so and write nothing. A case without a requirement can't be judged pass or fail.

## 2. Read the test basis (Confluence only)

Read with `getConfluencePage` (cloudId `fda6a7bd-b624-41c9-b57a-3bf22663b4ab`); find sections with `searchConfluenceUsingCql` (`space = SD1 AND text ~ "<term>"`).

| Need | Page | Id |
|---|---|---|
| The rule: condition, limits, zone/band values, `rule_reference` (§6) | `06 — Business Rules` | 491521 |
| Endpoints, methods, auth, status codes, the `422` body, gate order | `03 — API Contract` | 65822 |
| Legal and illegal transitions (`409`) | `02 — State Machine` | 131074 |
| Entity fields and types for request bodies | `01 — Data Model` | 458753 |
| Corrections to `06` (they win over `06`) | `07 — Clarifications` | 524289 |
| What is still open | `05 — Open Questions` | 98576 |

- Always read `07` and `05` for the rule's topic. `07` overrides `06`; anything `05` lists as open is skipped (step 3).
- **Endpoints and status codes come only from `03`.** Rules and `rule_reference` values come only from `06` §6 (as corrected by `07`). Don't use `../skypermit/docs/`, and don't invent an endpoint, field or code the docs don't define.
- **No `data-testid`, no UI.** Nothing here is clicked; the code is not needed.
- Confluence is read-only: never create, update or comment on pages. Doc gaps go into the summary as findings.

Facts from `03` to apply (re-check them on the page each run, the page wins):
- Base path `/api/v1`. JSON in, JSON out.
- **Auth is either / or, never both in one request:**
  - **Operator session** (cookie from `POST /operators` or `POST /auth/login`) for operator-scoped endpoints: pilots, aircraft, flight-requests create / list / submit / cancel / validate.
  - **`X-Reviewer-Id` header** for reviewer endpoints (`approve`, `reject`) and as the alternative for reviewer-or-owner reads (`GET` single entity, `POST …/validate`).
- `POST /flight-requests/{id}/validate` runs every gate like `submit` but **never changes state**. A failure is `422`; a pass is `200`.
- Gates run `PILOT` → `AIRCRAFT` → `ZONE` → `TIME_WINDOW`; the `422` names the **first** failure.
- `409` = the request cannot be attempted (wrong state, scheduling conflict). `422` = attempted and refused by a business rule.

## 3. Derive test conditions

List the conditions first, grouped by technique. One condition = one case.

**Boundary value analysis (BV)** — separate checks via `POST /flight-requests/{id}/validate`.
For each numeric, time or weight limit in the rule, the on-point and the off-point on each side that matters, one case each. E.g. window start = request time + 6 h 00 m → `200`; + 5 h 59 m → `422`. Altitude at the zone ceiling → `200`; ceiling + 1 m → `422`.

**Equivalence partitioning (EP)** — separate checks via `POST /flight-requests/{id}/validate`.
- One case per **valid class** the rule treats the same (e.g. each rating × zone class it allows) → `200`.
- One case per **invalid class** → `422`. Exactly one invalid value per case, every other gate set to pass, so the failure can only come from this rule.

**State transition** — end-to-end request chains, each ending in one checked outcome. These become a Postman collection, so each chain must run top to bottom without manual work between steps. Cover at least:
1. `validate` (failing the rule) → `GET /flight-requests/{id}`: state is still `DRAFT` (validate never changes state).
2. `submit` (failing the rule) → `GET /flight-requests/{id}`: state `REJECTED`, `failing_gate` and `rule_reference` set on the request.
3. `submit` (failing the rule) → repeated `submit` on the same request: `409` (`REJECTED` → anything is illegal, `02`).

**Decision rule / gate order** where the rule shares a request with another gate: which `failing_gate` is reported when two gates fail (first in order wins).

**Rule that isn't a gate (`REGISTRATION`).** The check is the write itself (`POST /aircraft`), not `validate`: BV/EP on that write, `422` with `rule_reference` and **no** `failing_gate`. Skip the validate/submit chains.

Skip, and list with the reason in the summary:
- anything `05` lists as open (e.g. the `SUSPENDED` operator response);
- conflicts between docs that neither `07` nor `05` settles;
- conditions only reachable through the UI (→ `ui-test-case-creator`).

Never guess an expected result: a guessed result produces false defects.

If there are more than ~25 conditions, show the list and ask for confirmation before writing files.

## 4. Duplicates and IDs

- Grep **all** of `test-cases/` (older API cases live in other folders, e.g. `test-cases/time-window/`) for the same `rule_reference` + technique + value. Don't duplicate; name the existing case in the summary.
- IDs are `API-OP-<NNN>`, three digits. Continue from the highest number in `test-cases/api/` (start at `001`). Pick IDs one run at a time — `/cover-gaps` calls this skill sequentially for that reason.

## 5. Write each case

Use this template exactly. Same headings and field order as the UI cases; replace every `<placeholder>`. Save as `test-cases/api/<ID>.md`.

```markdown
# <ID>: <title>

**ID:** <ID>
**Doc ref:** <doc ref>

## Preconditions
1. <precondition>

## Steps
1. <step>

## Expected result
- <expected result>
```

**Title.** One line naming the single check, with the technique-relevant value: `validate with window start = now + 5 h 59 m in DNI-OPN-1 returns 422 TIME_WINDOW (TSD-4 §2.1)`.

**Doc ref.** `<page title> §<section>` with the governing source in parentheses, always including `06 — Business Rules §6` and `03 — API Contract` (endpoint table and, for a `422`, `§The 422 body`); add `02 — State Machine` for chains and `07 — Clarifications §…` if a correction applies.
E.g. `06 — Business Rules §1.4 (TSD-4 §2.1), §6; 03 — API Contract §Flight requests (endpoint 13), §The 422 body`.

**Preconditions** — setup only, with concrete data from the docs: operator (`authorisation_level`, `status`), pilot (`rating`, `certified_on`), aircraft (`mtom_grams`, band), zone (real code and its values from `06` §4), the flight request in `DRAFT` with every field given. Every gate except the one under test must pass; say so. Setup the API can't do (e.g. `authorisation_level` raised to `L2` by an admin — registration always creates `L1`) is written as out-of-band setup. Times relative to the moment of a step: `window_start` = time of step 1 + 5 h 59 m (UTC); give zone-local time where curfew matters.

**Steps** — one HTTP request per step, in this form:

```
1. `POST /api/v1/flight-requests/{FR1.id}/validate`
   - Auth: O1's operator session
   - Body: none
```

- Method and full path from `03`, with ids as `{FR1.id}`-style references to preconditions.
- **Auth:** exactly one of `<operator>'s operator session` or `X-Reviewer-Id: <value>`. Never both in one request. Use the header only where `03` allows a reviewer.
- **Body:** the exact JSON with concrete values, or `none`. Field names from `01`/`03`.
- **Chains:** every step except the last ends with `→ expect <status>` (and the field the next step relies on, e.g. `state = REJECTED`). That is a checkpoint, not the outcome: if it fails, the case is blocked. The **last step is the checked request**.
- No `curl`, no scripts, no Postman syntax, no secrets (passwords are `<O1 password>`, never a literal).

**Expected result** — the outcome of the last step only:
- the status code;
- for `422`, the body written exactly like this (the coverage script in `scripts/uncovered-rules.mjs` matches `failing_gate: "…"` and `rule_reference: "…"` literally):
  `Response 422 with failing_gate: "TIME_WINDOW", rule_reference: "TSD-4 §2.1", message: non-empty, operator-readable text`
  - `rule_reference` verbatim from `06` §6 (as corrected by `07`). Don't assert exact `message` text unless the docs fix it.
  - For `REGISTRATION`: `rule_reference: "OH-1 §3"` and `failing_gate` absent from the body. Don't write the `failing_gate: "…"` pattern anywhere in that file.
  - If `05` says the citation isn't confirmed (e.g. zone-`active` `ZC-2026.1 §4`), append `(citation unconfirmed — 05 §2)`.
- for `200` on validate: `Response 200`, with the body only if `03` defines it;
- for a `GET` at the end of a chain: `Response 200` and the state field (plus `failing_gate`/`rule_reference` on the request when `REJECTED`);
- for `409`: `Response 409` (body: conflict detail, don't assert its text).

Several facts about that same response are fine. A second, independent outcome (e.g. "and an audit row exists") is a separate case.

**Manual only.** No test scripts, Postman tests or framework code (see `CLAUDE.md`). `/postman-collection-builder` does the conversion.

### Example

```markdown
# API-OP-002: submit failing TIME_WINDOW lead time, then submit again, returns 409

**ID:** API-OP-002
**Doc ref:** 02 — State Machine (REJECTED → anything is illegal); 06 — Business Rules §1.4 (TSD-4 §2.1), §6; 03 — API Contract §Flight requests (endpoint 10), §Error semantics

## Preconditions
1. Operator O1 exists and has an operator session; `authorisation_level` = `L1`, `status` = `ACTIVE`.
2. Pilot P1 of O1: `rating` = `R_BASIC`, `certified_on` = 6 months before the test date.
3. Aircraft A1 of O1: `mtom_grams` = 2000 (band C1).
4. Flight request FR1 of O1/P1/A1 in `DRAFT`: zone `DNI-OPN-1` (`OPEN`, ceiling 120 m, bands C0–C3, no curfew, level `L1`), `requested_altitude_metres` = 100, `window_start` = time of step 1 + 5 h 00 m, `window_end` = `window_start` + 60 min (UTC). PILOT, AIRCRAFT and ZONE gates pass.

## Steps
1. `POST /api/v1/flight-requests/{FR1.id}/submit`
   - Auth: O1's operator session
   - Body: none
   → expect 422, FR1 `state` = `REJECTED`
2. `POST /api/v1/flight-requests/{FR1.id}/submit`
   - Auth: O1's operator session
   - Body: none

## Expected result
- Response 409 (invalid state transition); FR1 stays `REJECTED`.
```

## 6. Summarize

Finish with:
- A table: ID, title, technique (BV / EP / state transition / decision rule), endpoint of the checked request, file path.
- Skipped conditions with reasons (open in `05`, doc conflict, UI-only → `ui-test-case-creator`, duplicate of `<ID>`).
- Findings: gaps or contradictions between `03`, `06`, `07`, `02`.
- Hand-off for the Postman collection — the state-transition chains, as a ready argument (omit `key` if no `story` was given, and say so):
  `/postman-collection-builder {"key": "<story>", "files": ["test-cases/api/API-OP-…md", …]}`
  In the collection, a chain's earlier steps become `setup <ID>: …` requests with their `→ expect` status asserted, and the last step becomes the `<ID>: <title>` case request.
