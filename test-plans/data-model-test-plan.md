# Test Plan: Data Model

**Test basis:** `01-data-model.md`; referenced: `02-state-machine.md`, `03-api-contract.md`, `06-business-rules.md` §1.4, §2–§4, `05-open-questions.md`, `07-clarifications.md` · **Existing tests reviewed:** `tests/lib/`, `tests/lib/gates/`, `tests/routes/`, `tests/business-rules/` · **Date:** 2026-10-18

## 1. Scope
**In scope**
- Field constraints of the 7 entities: uniqueness (`national_id`, `email`, `serial_number`), FKs, `window_end > window_start`, `flight_purpose` ≤ 2,000 chars in API **and** DB — 01 §Entities, §Time handling
- Enumerations and their allowed values — 01 §Enumerations
- `Operator.id` = Supabase Auth user id, cascade on delete; registration always at `L1` — 01 §Operator; 03 §Authentication
- Derived, never-stored values: pilot currency (18 months), weight band (C0–C3) — 01 §Derived; 06 §2–§3
- Rejection fields `rejection_reason` / `failing_gate` / `rule_reference` populated only when expected — 01 §FlightRequest
- `ReviewAction.note` required on `REJECT` — 01 §ReviewAction
- `AuditLog` append-only, one entry per state transition — 01 §AuditLog; 02 §Implementation note
- `Zone` read-only reference data — 01 §Zone; 06 §4
- UTC storage vs. zone-local curfew evaluation — 01 §Time handling; 06 §1.4

**Out of scope**
- Full gate pass/fail logic (06 §1), covered by a separate gate test plan
- UI layout and styling, performance, superseded `OH-1` v1.4 and unadopted `CR-1` values

## 2. Risks
| ID | Risk | Likelihood | Impact | Mitigation | Source |
|----|------|------------|--------|------------|--------|
| R1 | Derived currency / weight band is persisted or cached and goes stale after `certified_on` / `mtom_grams` is corrected | M | H | Correct the input field and re-read the value immediately; confirm already-approved requests are not re-evaluated | 01 §Derived |
| R2 | Docs conflict: 01 fills `failing_gate` only on gate failure, 02 says it's filled for every `REJECTED` request (incl. reviewer rejection) | H | M | Raise a clarification; test gate rejection and reviewer rejection separately | 01 §FlightRequest; 02 §States |
| R3 | Over-30,000 g registration: 06 says `422`, existing test expects `400` | H | M | Log a defect or doc clarification; test the actual response code | 06 §3; `tests/routes/aircraft.test.ts` |
| R4 | UTC ↔ zone-local conversion errors on midnight-crossing curfews and DST changeovers | M | H | Boundary tests around 23:00/05:00 local and both DST transition dates | 01 §Time handling; 06 §1.4 |
| R5 | `SUSPENDED` operator response undefined (05 says open, 03 lists `403`) | M | M | Treat as known open item; verify it is not returned as `422` with a `failing_gate` | 05 §1; 03 §Error semantics |
| R6 | `AuditLog` can be updated/deleted, or a transition path skips logging | L | H | Probe API/UI for any update/delete path; check one log entry per transition | 01 §AuditLog; 02 §Implementation note |
| R7 | Doc and migrations drift (e.g. `user_id` column removed in `0004`) | M | M | Compare entity tables against applied schema before execution | 01 intro, §Operator |

## 3. Strategy
| Area | Approach | Rationale | Existing automated coverage |
|------|----------|-----------|-----------------------------|
| Derived values | Automated | Pure boundary calculations | `derived.test.ts`, `pilot-gate.test.ts`, `aircraft-gate.test.ts` (calculation only) |
| Field constraints & enums | Both | Rules are deterministic; error messages need human review | `validation.test.ts` (generic validators only) |
| Rejection fields, `ReviewAction.note` | Both | Persistence + reviewer UI flow | none |
| `AuditLog` append-only | Both | API probing automatable; UI absence of edit/delete is manual | none |
| Operator identity & `L1` default | Both | Involves Supabase Auth setup | none |
| Time handling | Automated | Many timezone boundary combinations | `curfew.test.ts` (no DST cases) |
| Zone reference data | Automated + manual check of no create/edit path | Seed must match 06 §4 | `zone-catalogue.test.ts` |

- **Manual focus:** reviewer rejection vs. gate rejection in the detail view, operator registration flow, exploratory probing for audit/zone write paths, readability of validation messages.
- **Automation gaps to close:** uniqueness and FK constraints, `flight_purpose` 2,000-char limit at API and DB, `window_end > window_start`, rejection-field persistence, `AuditLog` immutability and per-transition entries, currency exposed on pilot `GET`, band recalculation after `mtom_grams` correction, DST curfew cases.

## 4. Entry criteria
- Test basis documents above baselined at their current version
- Environment with migrations `0001`–`0004` applied and `seed.sql` loaded (six zones)
- At least two operator accounts and a reviewer id (`X-Reviewer-Id`) available
- Clarifications for R2, R3, R5 raised with doc owners (answers not required to start)

## 5. Exit criteria
- All in-scope conditions executed; every H-impact risk covered by at least one executed test (proposed)
- No open Critical/High defects; Medium defects have an agreed workaround (proposed)
- R2, R3, R5 resolved or formally accepted as known risks (proposed)
- Automation gaps from §3 automated or logged in the backlog; existing Vitest suite passing (proposed)
