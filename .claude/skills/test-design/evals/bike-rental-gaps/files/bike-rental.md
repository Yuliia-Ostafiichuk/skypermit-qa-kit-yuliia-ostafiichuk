# CityBike — Rental Rules

## Rider

- A rider must be at least 16 years old to start a rental.
- The account PIN has 4 to 6 digits.

## Rental

- A single rental lasts between 30 and 480 minutes.
- A rider may hold at most 2 active rentals at the same time.
- A reservation expires if the bike is not unlocked within 15 minutes.

## Rental states

A rental is always in one of four states: RESERVED, ACTIVE, RETURNED, EXPIRED.

| From | Action | To |
| --- | --- | --- |
| RESERVED | unlock | ACTIVE |
| RESERVED | timeout | EXPIRED |
| ACTIVE | return | RETURNED |

RETURNED and EXPIRED are final.
