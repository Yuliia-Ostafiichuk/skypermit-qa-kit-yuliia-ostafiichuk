# API-OP-007: submit failing lead time (+ 5 h 00 m), then submit the same request again: 409

**ID:** API-OP-007
**Doc ref:** 02 — State Machine (`REJECTED` → anything is illegal and returns 409); 06 — Business Rules §1.4 (TSD-4 §2.1), §6; 03 — API Contract §Flight requests (endpoint 10), §Error semantics

## Preconditions
1. Operator O1 exists and has an operator session; `authorisation_level` = `L1`, `status` = `ACTIVE`.
2. Pilot P1 of O1: `rating` = `R_BASIC`, `certified_on` = 6 months before the test date (current at `window_start`).
3. Aircraft A1 of O1: `mtom_grams` = 2000 (band C1); no other flight requests for A1.
4. Flight request FR1 of O1/P1/A1 in `DRAFT`: zone `DNI-OPN-1` (`OPEN`, ceiling 120 m, bands C0–C3, no curfew, required level `L1`, active), `requested_altitude_metres` = 100, `window_start` = time of step 1 + 5 h 00 m (UTC), `window_end` = `window_start` + 60 min (UTC). PILOT, AIRCRAFT and ZONE gates pass; only the lead-time condition of TIME_WINDOW varies.
   The first submit is made at step 1.

## Steps
1. `POST /api/v1/flight-requests/{FR1.id}/submit`
   - Auth: O1's operator session
   - Body: none
   → expect 422 with `failing_gate: "TIME_WINDOW"`, FR1 `state` = `REJECTED`
2. `POST /api/v1/flight-requests/{FR1.id}/submit`
   - Auth: O1's operator session
   - Body: none

## Expected result
- Response 409 (invalid state transition: re-submit of a `REJECTED` request); FR1 stays `REJECTED`.
