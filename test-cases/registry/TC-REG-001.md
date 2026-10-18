# TC-REG-001: New operator registers with valid data and is signed in

**ID:** TC-REG-001
**Doc ref:** 03-api-contract.md §Authentication & authorisation (`POST /operators`); 01-data-model.md §Operator

## Preconditions
1. No operator session (not logged in).
2. No operator or Supabase Auth user exists with email `op.reg001@example.com` or `national_id` `UA-REG-0001`.

## Steps
1. Send `POST /api/v1/operators` with no session and body:
   ```json
   {
     "email": "op.reg001@example.com",
     "password": "Str0ng-Passw0rd!",
     "legal_name": "Reg001 Aerial Services LLC",
     "national_id": "UA-REG-0001",
     "phone": "+380441234567",
     "address_line": "1 Test Street",
     "city": "Kyiv",
     "postal_code": "01001"
   }
   ```
2. Send `GET /api/v1/auth/me` using the session cookie returned in step 1.

## Expected result
- The operator is registered and signed in. Step 1 returns a 2xx response and sets a session cookie. Step 2 returns `200` with the operator profile, where `email`, `legal_name`, `national_id`, `phone`, `address_line`, `city` and `postal_code` equal the values sent in step 1.
