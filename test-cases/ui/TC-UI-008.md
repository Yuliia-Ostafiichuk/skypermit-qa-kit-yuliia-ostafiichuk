# TC-UI-008: Check before submitting fails TIME_WINDOW with A-7 §1 for a window starting 1 minute before the KBP-CTR-3 curfew ends (04:59–05:59)

**ID:** TC-UI-008
**Doc ref:** 06 — Business Rules §1.4 (TSD-4 §4; A-7 §1), §4 (`KBP-CTR-3`), §6; 04 — Frontend Spec §Operator portal; SKY-1 AC1–AC3; 03 — API Contract §Flight requests (endpoint 13 `validate`), §The `422` body

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
5. In `flight-request-window-start-input` enter D 04:59.
6. In `flight-request-window-end-input` enter D 05:59.
7. In `flight-request-altitude-input` enter `100`.
8. Click `flight-request-create-submit-button`.
9. Click `flight-request-validate-button` ("Check before submitting").

## Expected result
- In `flight-request-validate-result`, card `flight-request-gate-result-TIME_WINDOW` shows a "fail" badge and the rule reference `A-7 §1` (not `ZC-2026.1 §3`); cards `flight-request-gate-result-PILOT`, `flight-request-gate-result-AIRCRAFT` and `flight-request-gate-result-ZONE` each show a "pass" badge.
- In the Network tab, the response to `POST /api/v1/flight-requests/<id>/validate` (sent by step 9) has status `422` and body with `failing_gate: "TIME_WINDOW"` and `rule_reference: "A-7 §1"`.
