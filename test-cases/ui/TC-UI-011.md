# TC-UI-011: Submitting a curfew-violating KBP-CTR-3 request moves it to REJECTED with rule reference A-7 §1

**ID:** TC-UI-011
**Doc ref:** 06 — Business Rules §1.4 (TSD-4 §4; A-7 §1), §4 (`KBP-CTR-3`), §6; 02 — State Machine (DRAFT → submit → SUBMITTED → gates fail → REJECTED); 04 — Frontend Spec §Operator portal (request detail view); 03 — API Contract §Flight requests (endpoint 10 `submit`), §The `422` body

## Preconditions
1. Browser and OS time zone are set to Europe/Kyiv (the window inputs are `datetime-local` and are read in the browser's local time, so the entered time equals zone-local time of `KBP-CTR-3`).
2. Operator O1 is logged in (header shows `operator-session-info`); `authorisation_level` = `L2` (raised out of band by admin), `status` = `ACTIVE`.
3. Pilot P1 "Pilot SKY1" belongs to O1: `rating` = `R_ADVANCED`, `certified_on` = 6 months before the test date.
4. Aircraft A1 belongs to O1: `mtom_grams` = 2000 (band `C1`); A1 has no `APPROVED` or `UNDER_REVIEW` requests.
5. D = the calendar date 2 days after the test date.
6. Browser DevTools are open on the Network tab (filter Fetch/XHR) before step 1.

## Steps
1. In the operator portal, open the request creation form ("New flight request", `flight-request-create-form`).
2. In `flight-request-zone-select` choose `KBP-CTR-3 — Kyiv Boryspil Corridor 3`.
3. In `flight-request-pilot-select` choose `Pilot SKY1 (R_ADVANCED)`.
4. In `flight-request-aircraft-select` choose A1.
5. In `flight-request-window-start-input` enter D 23:30.
6. In `flight-request-window-end-input` enter D+1 00:30.
7. In `flight-request-altitude-input` enter `100`.
8. Click `flight-request-create-submit-button`.
9. Click `flight-request-submit-button` ("Submit").

## Expected result
- `flight-request-detail-state` shows `REJECTED`; `rejection-callout` is shown with a non-empty `flight-request-detail-rejection-reason` and `flight-request-detail-rule-reference` = `A-7 §1`.
- In the Network tab, the response to `POST /api/v1/flight-requests/<id>/submit` (sent by step 9) has status `422` and body with `failing_gate: "TIME_WINDOW"` and `rule_reference: "A-7 §1"`.
