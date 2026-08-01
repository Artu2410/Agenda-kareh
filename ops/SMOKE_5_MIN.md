# Smoke 5 Min — Agenda Kareh

Run this immediately after deploy in an incognito window.

## Checklist

- [ ] Open `https://agenda.kareh.com.ar`.
- [ ] Login with valid OTP.
- [ ] Confirm invalid OTP fails visibly.
- [ ] Open agenda and verify it loads.
- [ ] Open patients and verify search/list loads.
- [ ] Check RBAC: `SECRETARIA` cannot open settings; `SUPER_USER` can.
- [ ] Open WhatsApp inbox and verify it loads.
- [ ] Log out and confirm session is cleared.
- [ ] Verify frontend badge matches `/api/version`.
- [ ] Verify `/metrics` and `/api/metrics` parity with curl or browser network.

## Stop immediately if

- OTP login fails.
- Logout leaves the session active.
- Any protected route loops back to login unexpectedly.
- `/api/version` does not match the deployed release candidate.
- `/metrics` is missing or `/api/metrics` is unprotected.
