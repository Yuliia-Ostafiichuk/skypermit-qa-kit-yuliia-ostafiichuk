# TC-TW-003: 10-minute window in DNI-OPN-1 fails the TIME_WINDOW duration rule

**ID:** TC-TW-003
**Doc ref:** 06-business-rules.md §1.4 (TSD-4 §3); 06-business-rules.md §6; 03-api-contract.md §The `422` body

## Preconditions
1. Operator O1 is logged in; `authorisation_level` = `L1`, `status` = `ACTIVE`.
2. Pilot P1 belongs to O1: `rating` = `R_BASIC`, `certified_on` = 6 months before the test date.
3. Aircraft A1 belongs to O1: `mtom_grams` = 2000 (band C1), no other flight requests.
4. Flight request FR1 in `DRAFT` for O1/P1/A1, zone `DNI-OPN-1` (`OPEN`, ceiling 120 m, bands C0–C3, no curfew, required level `L1`), `requested_altitude_metres` = 100, window 10:00–10:10 Europe/Kyiv (duration 10 min) on a date 2 days from now (UTC values converted accordingly).

## Steps
1. Send `POST /api/v1/flight-requests/{FR1.id}/submit` with O1's session.

## Expected result
- Response `422` with `failing_gate: "TIME_WINDOW"` and `rule_reference: "TSD-4 §3"`; FR1 `state` = `REJECTED`.
