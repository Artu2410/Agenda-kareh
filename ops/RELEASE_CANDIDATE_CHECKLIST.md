# Release Candidate Checklist

Use this checklist before promoting a new release candidate to production.

## Backend
- [ ] `npm test`
- [ ] `GET /health` returns `200`
- [ ] `GET /api/health` returns `200`
- [ ] `GET /metrics` returns Prometheus metrics
- [ ] `GET /api/version` returns version, commit and environment
- [ ] RBAC behaves as expected for `SECRETARIA`, `PROFESSIONAL`, `ADMIN` and `SUPER_USER`
- [ ] Structured logger prints startup metadata
- [ ] Session manager initializes without errors
- [ ] Env validation passes on boot

## Frontend
- [ ] `npm run lint`
- [ ] `npm run test:unit`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] Login page renders version badge
- [ ] Sidebar renders version badge
- [ ] Settings page renders version badge
- [ ] Responsive layout works on mobile, tablet and desktop

## QA Manual
- [ ] Login OTP succeeds
- [ ] Logout clears the session
- [ ] Session refresh works
- [ ] Session expiration redirects to login
- [ ] Agenda CRUD works
- [ ] Patients CRUD works
- [ ] Obras sociales CRUD works
- [ ] Cashflow flows work
- [ ] WhatsApp inbox loads and responds
- [ ] Print flows work
- [ ] Upload flows work
- [ ] `SECRETARIA` permissions are correct
- [ ] `SUPER_USER` permissions are correct

## Infra
- [ ] Render deploy matches the expected commit SHA
- [ ] Vercel deploy matches the expected release version
- [ ] Backup exists and restore procedure is documented
- [ ] Restore checklist has been reviewed
- [ ] Critical env vars are configured
- [ ] Health checks are green
- [ ] `/api/version` and `/metrics` are verified in production

## Notes
- `GET /api/version` is intentionally public and exposes only non-sensitive release metadata.
- Any mismatch between UI version and API version is a deploy drift signal and should block release promotion.
