# TC-UI-021: Submitting a C3 aircraft request in KBP-CTR-3 moves it to REJECTED with rule reference ZC-2026.1 §2

**ID:** TC-UI-021
**Doc ref:** 06 — Business Rules §1.2 (`ZC-2026.1` §2), §4 (`KBP-CTR-3` bands C0–C2), §6; 07 — Clarifications §1; 02 — State Machine (DRAFT → submit → SUBMITTED → gates fail → REJECTED; `failing_gate`/`rejection_reason` populated); 04 — Frontend Spec §Operator portal (request detail view "showing rejection reason and rule reference"); 01 — Data Model §FlightRequest (`rule_reference`)

## Preconditions
1. Browser and OS time zone are set to Europe/Kyiv.
2. Operator O1 is logged in (header shows `operator-session-info`); `authorisation_level` = `L2` (raised out of band by admin), `status` = `ACTIVE`.
3. Pilot P1 "Pilot SKY3" belongs to O1: `rating` = `R_ADVANCED`, `certified_on` = 6 months before the test date.
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
9. Click `flight-request-submit-button` ("Submit").

## Expected result
- `flight-request-detail-state` shows `REJECTED`; `rejection-callout` is shown with a non-empty `flight-request-detail-rejection-reason` and `flight-request-detail-rule-reference` = `ZC-2026.1 §2`.
