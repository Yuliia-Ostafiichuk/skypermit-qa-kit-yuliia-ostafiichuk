# TC-UI-015: Check before submitting fails AIRCRAFT with ZC-2026.1 §2 for a 12 001 g (C3) aircraft in KBP-CTR-3

**ID:** TC-UI-015
**Doc ref:** 06 — Business Rules §1.2 (`ZC-2026.1` §2), §3 (C2/C3 boundary 12,000 g), §4 (`KBP-CTR-3` permitted bands C0–C2), §6; 07 — Clarifications §1 (weight band belongs to `AIRCRAFT`, not `ZONE`); 04 — Frontend Spec §Operator portal ("Check before submitting"); 03 — API Contract §Flight requests (endpoint 13 `validate`), §The `422` body; SKY-3 AC2

## Preconditions
1. Browser and OS time zone are set to Europe/Kyiv.
2. Operator O1 is logged in (header shows `operator-session-info`); `authorisation_level` = `L2` (raised out of band by admin), `status` = `ACTIVE`.
3. Pilot P1 "Pilot SKY3" belongs to O1: `rating` = `R_ADVANCED`, `certified_on` = 6 months before the test date.
4. Aircraft A3 belongs to O1: manufacturer `TestCo`, model `Heavy`, serial `SKY3-C3`, `mtom_grams` = 12001 (band `C3`); A3 has no `APPROVED` or `UNDER_REVIEW` requests.
5. D = the calendar date 2 days after the test date.
6. Browser DevTools are open on the Network tab (filter Fetch/XHR) before step 1.

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
- In `flight-request-validate-result`, card `flight-request-gate-result-AIRCRAFT` shows a "fail" badge and the rule reference `ZC-2026.1 §2`; card `flight-request-gate-result-ZONE` does not show a "fail" badge.
- In the Network tab, the response to `POST /api/v1/flight-requests/<id>/validate` (sent by step 9) has status `422` and body with `failing_gate: "AIRCRAFT"` and `rule_reference: "ZC-2026.1 §2"`.
