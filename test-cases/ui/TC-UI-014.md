# TC-UI-014: Request form lets the operator create a request with a C3 aircraft in KBP-CTR-3 (no pre-filtering)

**ID:** TC-UI-014
**Doc ref:** 04 — Frontend Spec §Two contracts to hold exactly ("The form does not pre-filter"), §Operator portal (request creation form); 06 — Business Rules §3 (C3 = above 12,000 g to 30,000 g), §4 (`KBP-CTR-3` permitted bands C0–C2); 02 — State Machine §States (`DRAFT`); SKY-3 AC1

## Preconditions
1. Browser and OS time zone are set to Europe/Kyiv (the window inputs are `datetime-local` and are read in the browser's local time).
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

## Expected result
- The C3 aircraft and `KBP-CTR-3` stay selected with no warning or disabled option, the request is created (`flight-request-create-success` is shown, no `flight-request-create-error`), and the request panel `flight-request-detail` shows `flight-request-detail-state` = `DRAFT`.
