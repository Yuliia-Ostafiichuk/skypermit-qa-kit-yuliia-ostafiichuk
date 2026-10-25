# TC-UI-001: New operator registers via the /register form and is logged in immediately

**ID:** TC-UI-001
**Doc ref:** 04-frontend-spec.md §Operator portal (Login and register pages), §Two contracts to hold exactly (selector stability)

## Preconditions
1. Browser has no operator session (logged out); the header shows `operator-register-link`.
2. No operator or Supabase Auth user exists with `<email>` or `<national ID>` used in step 2.

## Steps
1. In the header, click `operator-register-link`.
2. On the `/register` page, fill in the single registration form:
   - email: `<email>`: valid format, not registered yet
   - password: `<password>`: valid password
   - legal name: `<legal name>`: any non-empty company name
   - national ID: `<national ID>`: not used by any existing operator
   - phone: `<phone>`: valid phone number
   - address line: `<address line>`: any non-empty street address
   - city: `<city>`: any non-empty city name
   - postal code: `<postal code>`: valid postal code
3. Submit the form.

## Expected result
- The operator is logged in straight after registration, without visiting `/login`. The header shows `operator-session-info` and `operator-logout-button`, and no longer shows `operator-register-link` or `operator-login-link`.
