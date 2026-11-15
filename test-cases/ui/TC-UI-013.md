# TC-UI-013: With an R_BASIC pilot and a curfew window in KBP-CTR-3, the check reports PILOT (OH-1 §2.1), not the curfew

**ID:** TC-UI-013
**Doc ref:** 06 — Business Rules §Evaluation order (API-REF §5), §1.1 (OH-1 §2.1), §1.4 (A-7 §1); 04 — Frontend Spec §Operator portal; SKY-1 AC3 (negative: when PILOT fails, evaluation stops before TIME_WINDOW and A-7 §1 is not reported)

## Preconditions
1. Browser and OS time zone are set to Europe/Kyiv (the window inputs are `datetime-local` and are read in the browser's local time, so the entered time equals zone-local time of `KBP-CTR-3`).
2. Operator O1 is logged in (header shows `operator-session-info`); `authorisation_level` = `L2` (raised out of band by admin), `status` = `ACTIVE`.
3. Pilot P2 "Pilot SKY1 Basic" belongs to O1: `rating` = `R_BASIC`, `certified_on` = 6 months before the test date.
4. Aircraft A1 belongs to O1: `mtom_grams` = 2000 (band `C1`); A1 has no `APPROVED` or `UNDER_REVIEW` requests.
5. D = the calendar date 2 days after the test date.

## Steps
1. In the operator portal, open the request creation form ("New flight request", `flight-request-create-form`).
2. In `flight-request-zone-select` choose `KBP-CTR-3 — Kyiv Boryspil Corridor 3`.
3. In `flight-request-pilot-select` choose `Pilot SKY1 Basic (R_BASIC)`.
4. In `flight-request-aircraft-select` choose A1.
5. In `flight-request-window-start-input` enter D 23:30.
6. In `flight-request-window-end-input` enter D+1 00:30.
7. In `flight-request-altitude-input` enter `100`.
8. Click `flight-request-create-submit-button`.
9. Click `flight-request-validate-button` ("Check before submitting").

## Expected result
- Card `flight-request-gate-result-PILOT` shows a "fail" badge and rule reference `OH-1 §2.1`; card `flight-request-gate-result-TIME_WINDOW` does not show a "fail" badge or `A-7 §1`.
