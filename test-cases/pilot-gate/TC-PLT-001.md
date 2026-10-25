# TC-PLT-001: R_BASIC pilot in a CONTROLLED zone (KBP-CTR-3) fails the PILOT gate

**ID:** TC-PLT-001
**Doc ref:** 06-business-rules.md §1.1 (OH-1 §2.1); 06-business-rules.md §6; 03-api-contract.md §The `422` body

## Preconditions
1. Operator O1 is logged in; `authorisation_level` = `L2` (raised out of band by admin), `status` = `ACTIVE`.
2. Pilot P1 belongs to O1: `rating` = `R_BASIC`, `certified_on` = 6 months before the test date.
3. Aircraft A1 belongs to O1: `mtom_grams` = 2000 (band C1), no other flight requests.
4. Flight request FR1 in `DRAFT` for O1/P1/A1, zone `KBP-CTR-3` (`CONTROLLED`, ceiling 120 m, bands C0–C2, curfew 23:00–05:00, required level `L2`), `requested_altitude_metres` = 100, window 10:00–11:00 Europe/Kyiv on a date 2 days from now (UTC values converted accordingly).

## Steps
1. Send `POST /api/v1/flight-requests/{FR1.id}/submit` with O1's session.

## Expected result
- Response `422` with `failing_gate: "PILOT"` and `rule_reference: "OH-1 §2.1"`; FR1 `state` = `REJECTED`.
