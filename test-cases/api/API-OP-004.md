# API-OP-004: validate with window start = submission + 24 h (lead time in the valid class) in DNI-OPN-1 returns 200

**ID:** API-OP-004
**Doc ref:** 06 — Business Rules §1.4 (TSD-4 §2.1), §6; 03 — API Contract §Flight requests (endpoint 13, validate)

## Preconditions
1. Operator O1 exists and has an operator session; `authorisation_level` = `L1`, `status` = `ACTIVE`.
2. Pilot P1 of O1: `rating` = `R_BASIC`, `certified_on` = 6 months before the test date (current at `window_start`).
3. Aircraft A1 of O1: `mtom_grams` = 2000 (band C1); no other flight requests for A1.
4. Flight request FR1 of O1/P1/A1 in `DRAFT`: zone `DNI-OPN-1` (`OPEN`, ceiling 120 m, bands C0–C3, no curfew, required level `L1`, active), `requested_altitude_metres` = 100, `window_start` = time of step 1 + 24 h 00 m (UTC), `window_end` = `window_start` + 60 min (UTC). PILOT, AIRCRAFT and ZONE gates pass; only the lead-time condition of TIME_WINDOW varies.

## Steps
1. `POST /api/v1/flight-requests/{FR1.id}/validate`
   - Auth: O1's operator session
   - Body: none

## Expected result
- Response 200 (all four gates pass; no `failing_gate`).
