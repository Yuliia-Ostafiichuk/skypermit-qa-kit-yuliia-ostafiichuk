# TC-UI-009: Check before submitting passes TIME_WINDOW for a window starting 1 minute after the KBP-CTR-3 curfew ends (05:01–06:00)

**ID:** TC-UI-009
**Doc ref:** 06 — Business Rules §1.4 (TSD-4 §4; A-7 §1), §4 (`KBP-CTR-3`), §6; 04 — Frontend Spec §Operator portal

## Preconditions
1. Browser and OS time zone are set to Europe/Kyiv (the window inputs are `datetime-local` and are read in the browser's local time, so the entered time equals zone-local time of `KBP-CTR-3`).
2. Operator O1 is logged in (header shows `operator-session-info`); `authorisation_level` = `L2` (raised out of band by admin), `status` = `ACTIVE`.
3. Pilot P1 "Pilot SKY1" belongs to O1: `rating` = `R_ADVANCED`, `certified_on` = 6 months before the test date.
4. Aircraft A1 belongs to O1: `mtom_grams` = 2000 (band `C1`); A1 has no `APPROVED` or `UNDER_REVIEW` requests.
5. D = the calendar date 2 days after the test date.

## Steps
1. In the operator portal, open the request creation form ("New flight request", `flight-request-create-form`).
2. In `flight-request-zone-select` choose `KBP-CTR-3 — Kyiv Boryspil Corridor 3`.
3. In `flight-request-pilot-select` choose `Pilot SKY1 (R_ADVANCED)`.
4. In `flight-request-aircraft-select` choose A1.
5. In `flight-request-window-start-input` enter D 05:01.
6. In `flight-request-window-end-input` enter D 06:00.
7. In `flight-request-altitude-input` enter `100`.
8. Click `flight-request-create-submit-button`.
9. Click `flight-request-validate-button` ("Check before submitting").

## Expected result
- In `flight-request-validate-result`, cards `flight-request-gate-result-PILOT`, `flight-request-gate-result-AIRCRAFT`, `flight-request-gate-result-ZONE` and `flight-request-gate-result-TIME_WINDOW` each show a "pass" badge; no rule reference is shown.
