# API-OP-008: validate with lapsed pilot certification and window start = now + 5 h 00 m in DNI-OPN-1 returns 422 PILOT (OH-1 §2.3), not TIME_WINDOW

**ID:** API-OP-008
**Doc ref:** 06 — Business Rules §Evaluation order (API-REF §5), §1.4 (TSD-4 §2.1), §1.1 / §2 (OH-1 §2.3), §6; 03 — API Contract §Flight requests (endpoint 13, validate), §The 422 body, §Gate pipeline

## Preconditions
1. Operator O1 exists and has an operator session; `authorisation_level` = `L1`, `status` = `ACTIVE`.
2. Pilot P1 of O1: `rating` = `R_BASIC`, `certified_on` = 19 months before the test date (not current at `window_start`: currency is 18 months, no grace period).
3. Aircraft A1 of O1: `mtom_grams` = 2000 (band C1); no other flight requests for A1.
4. Flight request FR1 of O1/P1/A1 in `DRAFT`: zone `DNI-OPN-1` (`OPEN`, ceiling 120 m, bands C0–C3, no curfew, required level `L1`, active), `requested_altitude_metres` = 100, `window_start` = time of step 1 + 5 h 00 m (UTC), `window_end` = `window_start` + 60 min (UTC).
5. Two gates fail on purpose: PILOT (certification not current) and TIME_WINDOW (lead time < 6 h). AIRCRAFT and ZONE pass; all other TIME_WINDOW conditions (max advance, duration, curfew, overlap) pass.

## Steps
1. `POST /api/v1/flight-requests/{FR1.id}/validate`
   - Auth: O1's operator session
   - Body: none

## Expected result
- Response 422 with failing_gate: "PILOT", rule_reference: "OH-1 §2.3", message: non-empty, operator-readable text (the first failing gate in the order PILOT → AIRCRAFT → ZONE → TIME_WINDOW; TIME_WINDOW is not reported).
