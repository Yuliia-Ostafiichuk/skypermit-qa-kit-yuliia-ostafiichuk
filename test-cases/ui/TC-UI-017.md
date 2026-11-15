# TC-UI-017: When AIRCRAFT fails, the check shows PILOT as passed and ZONE and TIME_WINDOW as not evaluated

**ID:** TC-UI-017
**Doc ref:** 06 — Business Rules §Evaluation order (API-REF §5: "evaluation stops at the first failure"), §1.1 (`OH-1` §2.1, §2.3), §1.2 (`ZC-2026.1` §2), §4 (`KBP-CTR-3`); 03 — API Contract §Gate pipeline; 04 — Frontend Spec §Operator portal ("per-gate pass/fail result"); SKY-3 AC3

## Preconditions
1. Browser and OS time zone are set to Europe/Kyiv.
2. Operator O1 is logged in (header shows `operator-session-info`); `authorisation_level` = `L2` (raised out of band by admin), `status` = `ACTIVE`.
3. Pilot P1 "Pilot SKY3" belongs to O1: `rating` = `R_ADVANCED` (covers `CONTROLLED`), `certified_on` = 6 months before the test date (current for 18 months).
4. Aircraft A3 belongs to O1: manufacturer `TestCo`, model `Heavy`, serial `SKY3-C3`, `mtom_grams` = 12001 (band `C3`).
5. D = the calendar date 2 days after the test date.

## Steps
1. In the operator portal, open the request creation form ("New flight request", `flight-request-create-form`).
2. In `flight-request-zone-select` choose `KBP-CTR-3 — Kyiv Boryspil Corridor 3`.
3. In `flight-request-pilot-select` choose `Pilot SKY3 (R_ADVANCED)`.
4. In `flight-request-aircraft-select` choose `TestCo Heavy (SKY3-C3)`.
5. In `flight-request-window-start-input` enter D 10:00.
6. In `flight-request-window-end-input` enter D 11:00.
7. In `flight-request-altitude-input` enter `100`.
8. Click `flight-request-create-submit-button`.
9. Click `flight-request-validate-button` ("Check before submitting").

## Expected result
- In `flight-request-validate-result`: card `flight-request-gate-result-PILOT` shows a "pass" badge; card `flight-request-gate-result-AIRCRAFT` shows a "fail" badge; cards `flight-request-gate-result-ZONE` and `flight-request-gate-result-TIME_WINDOW` show neither "pass" nor "fail" but a "not evaluated" badge.
