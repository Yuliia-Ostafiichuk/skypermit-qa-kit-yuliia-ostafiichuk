# TC-UI-016: Check before submitting passes AIRCRAFT for a 12 000 g (C2) aircraft in KBP-CTR-3

**ID:** TC-UI-016
**Doc ref:** 06 — Business Rules §1.2 (`ZC-2026.1` §2), §3 ("exactly 12,000 g is `C2`"), §4 (`KBP-CTR-3` permitted bands C0–C2); 04 — Frontend Spec §Operator portal ("Check before submitting"); SKY-3 AC4

## Preconditions
1. Browser and OS time zone are set to Europe/Kyiv.
2. Operator O1 is logged in (header shows `operator-session-info`); `authorisation_level` = `L2` (raised out of band by admin), `status` = `ACTIVE`.
3. Pilot P1 "Pilot SKY3" belongs to O1: `rating` = `R_ADVANCED`, `certified_on` = 6 months before the test date.
4. Aircraft A2 belongs to O1: manufacturer `TestCo`, model `Edge`, serial `SKY3-C2`, `mtom_grams` = 12000 (band `C2`); A2 has no `APPROVED` or `UNDER_REVIEW` requests.
5. D = the calendar date 2 days after the test date.

## Steps
1. In the operator portal, open the request creation form ("New flight request", `flight-request-create-form`).
2. In `flight-request-zone-select` choose `KBP-CTR-3 — Kyiv Boryspil Corridor 3`.
3. In `flight-request-pilot-select` choose `Pilot SKY3 (R_ADVANCED)`.
4. In `flight-request-aircraft-select` choose `TestCo Edge (SKY3-C2)`.
5. In `flight-request-window-start-input` enter D 10:00.
6. In `flight-request-window-end-input` enter D 11:00.
7. In `flight-request-altitude-input` enter `100`.
8. Click `flight-request-create-submit-button`.
9. Click `flight-request-validate-button` ("Check before submitting").

## Expected result
- In `flight-request-validate-result`, card `flight-request-gate-result-AIRCRAFT` shows a "pass" badge and no rule reference.
