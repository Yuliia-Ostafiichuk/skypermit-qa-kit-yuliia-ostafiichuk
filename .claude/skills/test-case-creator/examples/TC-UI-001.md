# TC-UI-001: New operator registers via the /register form and is logged in immediately

**ID:** TC-UI-001
**Doc ref:** 04-frontend-spec.md §Operator portal (Login and register pages), §Two contracts to hold exactly (selector stability)

## Preconditions
1. Browser has no operator session (logged out); the header shows `operator-register-link`.
2. No operator or Supabase Auth user exists with email `op.ui001@example.com` or `national_id` `UA-UI-0001`.

## Steps
1. In the header, click `operator-register-link`.
2. On the `/register` page, fill in the single registration form:
   - email: `op.ui001@example.com`
   - password: `Str0ng-Passw0rd!`
   - legal name: `UI001 Aerial Services LLC`
   - national ID: `UA-UI-0001`
   - phone: `+380441234567`
   - address line: `1 Test Street`
   - city: `Kyiv`
   - postal code: `01001`
3. Submit the form.

## Expected result
- The operator is logged in straight after registration, without visiting `/login`. The header shows `operator-session-info` and `operator-logout-button`, and no longer shows `operator-register-link` or `operator-login-link`.
