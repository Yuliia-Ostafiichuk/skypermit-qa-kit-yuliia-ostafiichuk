# Test Plan: SkyPermit (whole project)

**Test basis:** `docs/01`–`08` (all) · **Existing tests reviewed:** `tests/lib/`, `tests/lib/gates/`, `tests/routes/`, `tests/business-rules/` · **Date:** 2026-10-18

## 1. Scope
**In scope**
- Operator auth & ownership: register/login/logout/me, `401`/`403`, session-derived `operator_id`, reviewer-or-owner reads — 03 §Authentication
- Registry: operators, pilots, aircraft (incl. list extensions, derived currency/band, 30,000 g ceiling) — 03 §Registry; 01; 06 §2–§3
- Zone reference data, read-only — 03 §Reference data; 06 §4
- Flight requests: create, submit, validate (no state change), cancel, list filters — 03 §Flight requests
- Gate pipeline: 4 gates, fixed order, first failure, `422` body and `rule_reference` values — 06 §1, §6; 03 §Error semantics
- State machine, `409` on illegal transitions, 2 h cancellation deadline — 02; 06 §5
- Reviewer approve/reject, `ReviewAction`, `AuditLog` append-only — 03 §Reviewer; 01
- Operator portal and reviewer queue UI, `data-testid` contract, unfiltered pickers — 04

**Out of scope**
- `CR-1` proposal and superseded `OH-1` v1.4 values — 06 intro
- Zone create/edit and raising `authorisation_level` (managed out-of-band) — 03 §Reference data, §Authentication
- Visual design, performance/load, penetration testing — not specified in docs
- Writing automated tests (recommendations only)

## 2. Risks
| ID | Risk | Likelihood | Impact | Mitigation | Source |
|----|------|------------|--------|------------|--------|
| R1 | Docs vs. tests contradict: `SUBMITTED`→cancel allowed in 02 but `canCancel` returns false; >30,000 g is `422` in 06 but test expects `400`; missing `X-Reviewer-Id` is `400` in 03 §Reviewer but `401` in 03 §Error semantics | H | M | Raise clarifications/defects before execution; test against confirmed values | 02 §States; 06 §1.2; 03; `state-machine.test.ts`, `aircraft.test.ts` |
| R2 | UI must show per-gate / "all four gate results", but the pipeline stops at the first failure | H | M | Clarify expected `validate` output; test with multi-gate failures | 04 §Operator portal, §Reviewer queue; 03 §Gate pipeline |
| R3 | Authorisation leak: operator reads/changes another operator's data, list not scoped, client-supplied `operator_id` trusted | M | H | Ownership matrix per endpoint × role (owner / other operator / reviewer / anonymous) | 03 §Authentication |
| R4 | Wrong state transitions or missing audit: illegal pair not `409`, deadline off by boundary, `COMPLETED` endpoint not defined in the contract | M | H | Full transition table tests incl. 2 h ± 1 min; clarify the maintenance endpoint | 02; 03 §Flight requests; 06 §5 |
| R5 | Time errors: UTC vs. zone-local curfew, midnight crossing, DST, lead time measured from submission | M | H | Boundary and DST-date tests; minute-by-minute curfew cases | 06 §1.4; 01 §Time handling |
| R6 | Open items ship as guesses: `SUSPENDED` response, zone-`active` citation; reviewer rejection `failing_gate` unclear (01 vs 02) | M | M | Track as known open; verify `SUSPENDED` is not a `422` gate failure | 05 §1–§2; 01 §FlightRequest; 02 §States |
| R7 | `data-testid` renamed or pickers pre-filtered, breaking automation and hiding gate failures | M | M | Manual checklist of testids and unfiltered pickers each release | 04 §Two contracts |

## 3. Strategy
| Area | Approach | Rationale | Existing automated coverage |
|------|----------|-----------|-----------------------------|
| Gate rules & pipeline order | Automated | Deterministic boundaries | `*-gate.test.ts`, `pipeline.test.ts`, `curfew.test.ts`, `derived.test.ts` |
| Zone catalogue | Automated | Seed must match 06 §4 | `zone-catalogue.test.ts` |
| State machine & cancellation | Both | Lib rules automated; API `409`s and UI flow | `state-machine.test.ts`, `submit.test.ts` (409/404/400 only) |
| Auth & ownership | Automated (API) | Large role × endpoint matrix | none |
| Registry & validation | Both | API rules + form messages | `aircraft.test.ts`, `validation.test.ts` |
| `validate` / reviewer / audit | Automated (API) | Side-effect checks | none at route level |
| Operator portal & reviewer queue | Manual | End-to-end flows, message clarity | none |

- **Manual focus:** registration → pilot/aircraft → request → validate → submit → review end-to-end; reviewer queue sorting and reject-with-note; rejection detail view; exploratory testing of unfiltered pickers, testids, error messages.
- **Automation gaps to close:** auth/ownership matrix, route tests for validate (no state change), cancel (2 h deadline), approve/reject, list filters and scoping, `AuditLog`/`ReviewAction` writes, DST curfew cases, UI E2E on `data-testid`.

## 4. Entry criteria
- Docs `01`–`08` baselined; R1, R2 clarifications raised with doc owners
- Environment with migrations `0001`–`0004` and `seed.sql` (six zones) applied
- Two operator accounts (different authorisation levels) and a reviewer id available
- Existing Vitest suite passing on the build under test

## 5. Exit criteria
- All in-scope conditions executed; every H-impact risk covered by executed tests (proposed)
- No open Critical/High defects; Medium defects have an agreed workaround (proposed)
- R1, R2, R6 resolved or formally accepted as known risks (proposed)
- Automation gaps from §3 automated or logged in the backlog (proposed)
