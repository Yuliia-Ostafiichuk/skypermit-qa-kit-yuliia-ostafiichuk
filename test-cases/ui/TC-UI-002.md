# TC-UI-002: Registered operator logs in via the /login page with valid credentials

**ID:** TC-UI-002
**Doc ref:** 04-frontend-spec.md §Operator portal (Login page), §Two contracts to hold exactly (selector stability); 03-api-contract.md §Authentication & authorisation (`POST /auth/login`)

## Preconditions
1. An operator account exists with email `op.ui002@example.com` and password `Str0ng-Passw0rd!` (registered beforehand, e.g. via `/register`).
2. Browser has no operator session (logged out); the header shows `operator-login-link`.

## Steps
1. In the header, click `operator-login-link`.
2. On the `/login` page, enter:
   - email: `op.ui002@example.com`
   - password: `Str0ng-Passw0rd!`
3. Submit the form.

## Expected result
- The operator is logged in. The header shows `operator-session-info` and `operator-logout-button`, and no longer shows `operator-login-link` or `operator-register-link`.
