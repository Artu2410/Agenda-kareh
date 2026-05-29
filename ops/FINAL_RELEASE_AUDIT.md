# Final Release Audit — Agenda Kareh

## Executive Summary

- Final release candidate SHA on `main`: `45e289a23059d8e1cad5f7c3cb91c30db1255554` (`45e289a`).
- Runtime codebase was already frozen at `3a8ce07fece011075a84064ee7cf40a8e69881ea`; the current HEAD is docs-only and keeps the same runtime behavior.
- Codebase status: release-candidate ready.
- Production status: **NO-GO** until Render is redeployed to the runtime candidate and authenticated QA is completed.
- Main blocker: live Render backend still serves an older runtime; `/api/version` and `/metrics` are not exposed in production yet.
- External blocker: GitHub Actions frontend workflow is still affected by the account billing lock, not by a Vitest regression.

## Current Release Contract

### Backend endpoints

| Route | Auth | Expected response | Current production |
|---|---:|---|---|
| `/health` | No | `200` with `{ "status": "ok" }` | `200` |
| `/api/health` | No | `200` with `{ "status": "ok" }` | `200` |
| `/metrics` | No | `200` Prometheus text/plain | `404` drift |
| `/api/metrics` | Yes | `401` without auth, `200` with auth | `401` without auth |
| `/api/version` | No | `200` JSON with `version`, `commit`, `environment`, `deployedAt` | `404` drift |

### `/api/version` payload

```json
{
  "version": "2026.05.28-rc1",
  "commit": "45e289a23059d8e1cad5f7c3cb91c30db1255554",
  "environment": "production",
  "deployedAt": "2026-05-28T22:00:00.000Z"
}
```

## Parity Commands

Run these immediately after the Render redeploy:

| Check | Command | Expected | Rollback trigger |
|---|---|---|---|
| Health | `curl -i https://kareh-backend.onrender.com/health` | `200` and `{"status":"ok"}` | Non-200 or non-JSON |
| API health | `curl -i https://kareh-backend.onrender.com/api/health` | `200` and `{"status":"ok"}` | Non-200 or non-JSON |
| Metrics | `curl -i https://kareh-backend.onrender.com/metrics` | `200`, `Content-Type: text/plain; version=0.0.4; charset=utf-8`, Prometheus text (`# TYPE http_requests_total counter`) | `404`, HTML, or missing Prometheus text |
| Auth metrics | `curl -i https://kareh-backend.onrender.com/api/metrics` | `401` without session; `200` with authenticated session | `200` without auth or `404` |
| Version | `curl -i https://kareh-backend.onrender.com/api/version` | `200` JSON with `version`, `commit`, `environment`, `deployedAt`; commit must match the release candidate SHA | `404`, stale commit, missing fields, or `unknown` values |

## Release Candidate Consistency

| Field | Expected |
|---|---|
| Git commit candidate | `45e289a23059d8e1cad5f7c3cb91c30db1255554` |
| Short commit | `45e289a` |
| `APP_VERSION` | `2026.05.28-rc1` |
| `COMMIT_SHA` | `45e289a23059d8e1cad5f7c3cb91c30db1255554` |
| `deployedAt` | ISO timestamp of the actual Render boot time |
| Frontend badge | `UI 2026.05.28-rc1 · 45e289a | API 2026.05.28-rc1 · production · 45e289a` |
| API version body | `version`, `commit`, `environment`, `deployedAt` |

## Build and Start

### Backend

- Start command: `npm start`
- Actual runtime entry: `node scripts/bootstrap-production.js`
- Bootstrap behavior:
  - runs `prisma generate`
  - runs `prisma migrate deploy`
  - then imports `server.js`
- Test command: `npm test`

### Frontend

- Build command: `npm run build`
- Unit tests: `npm run test:unit`
- E2E: `npm run test:e2e`
- Lint: `npm run lint`

## Runtime Requirements

### Backend production env

Critical vars:

- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET` or `REFRESH_TOKEN_SECRET`
- `JWT_EXPIRES_IN`
- `CLIENT_URL`
- `FRONTEND_URL`
- `CORS_ALLOWED_ORIGINS`
- `COOKIE_SECURE=true`
- `AUTHORIZED_EMAIL`
- `APP_VERSION`
- `COMMIT_SHA`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_CRON_TOKEN`

Optional/legacy:

- `SENTRY_DSN` is not required for runtime behavior in the current codebase.

### Frontend production env

Critical vars:

- `VITE_API_URL`
- `VITE_APP_VERSION`
- `VITE_COMMIT_SHA`

## Node Runtime Compatibility

- Server engine: `22.x`
- Client engine: `22.x`
- Current code is aligned with Node 22 across both packages.

## Migrations and Seeds

- Prisma migrations are versioned in `server/prisma/migrations`.
- No pending migration files are present in git.
- `server/scripts/bootstrap-production.js` still executes `prisma migrate deploy` on startup when `DATABASE_URL` exists.
- No Prisma seed script is defined in `server/package.json`.
- No seed phase is part of the standard deploy path.

## Render Readiness

### Expected Render behavior after redeploy

- Boot log prints:
  - `version`
  - `commit`
  - `environment`
  - `deployedAt`
  - `startedAt`
  - `port`
- `GET /api/version` returns release metadata immediately after deploy.
- `GET /metrics` is available publicly and returns Prometheus text/plain.
- `GET /api/metrics` remains protected by auth.

### Render healthcheck recommendation

- Use `/health` as the primary healthcheck path.
- `/api/health` is also valid and returns the same `200` JSON body.

### Render drift currently observed

- Live backend does not expose `/api/version`.
- Live backend does not expose `/metrics`.
- Live backend still exposes `/api/metrics` with auth.
- This is a deploy drift blocker, not an application bug.

## QA Authenticated Checklist

Use an incognito window and a real OTP inbox.

### Authentication

- [ ] Login OTP succeeds.
- [ ] Login with invalid OTP fails visibly.
- [ ] Logout clears the session.
- [ ] Refresh rehydrates session without loops.
- [ ] Session expiration redirects to login.

### RBAC

- [ ] `SECRETARIA` can access agenda, patients and cashflow.
- [ ] `SECRETARIA` cannot access settings.
- [ ] `PROFESSIONAL` can access clinical areas allowed by role.
- [ ] `SUPER_USER` can access settings and admin areas.

### Clinical and operational flows

- [ ] Agenda CRUD works.
- [ ] Patients CRUD works.
- [ ] Cashflow entry/exit works.
- [ ] Obras sociales CRUD works.
- [ ] WhatsApp inbox loads and responds.
- [ ] Configuration screens load and save.

### Release parity check

- [ ] `GET /api/version` matches the deployed commit SHA.
- [ ] Frontend release badge matches the same version and commit.
- [ ] `GET /metrics` returns Prometheus text/plain.
- [ ] `GET /api/metrics` stays protected by auth.
- [ ] `GET /health` and `GET /api/health` return `200`.

### Rollback criteria

- [ ] `version` or `commit` in `/api/version` does not match the release candidate.
- [ ] Any auth loop returns.
- [ ] Any sustained 5xx spike appears in the first 30 minutes.
- [ ] Any clinical flow fails with a regression.

## Post-Release Monitoring

Monitor the first 30 minutes after deploy:

- Logs:
  - startup line with version metadata
  - request logs
  - auth failures
  - WhatsApp webhook receipts
- Errors:
  - 5xx spikes
  - uncaught frontend errors
  - auth refresh failures
- Performance:
  - request latency
  - memory growth
  - slow routes
- Domain checks:
  - WhatsApp webhooks
  - login failures
  - `/api/version`
  - `/metrics`

## Operational Commands

- Backend tests: `cd server && npm test`
- Backend smoke: `cd server && npm run smoke:deploy`
- Frontend lint: `cd client && npm run lint`
- Frontend unit tests: `cd client && npm run test:unit`
- Frontend E2E: `cd client && npm run test:e2e`
- Frontend build: `cd client && npm run build`

## Risks and Blockers

### Blockers

- Render still serves an older backend.
- Authenticated QA real is still pending until OTP inbox access is available.
- GitHub Actions frontend job is blocked by the external billing/account lock.

### Residual risks

- If Render deploys the wrong commit, parity must block promotion.
- `smoke:deploy` currently checks `/health`, `/api/health` and CORS, but not `/api/version`; parity must still be checked manually.

## Go / No-Go

- **Codebase:** GO
- **Production release:** NO-GO until Render is redeployed to `45e289a23059d8e1cad5f7c3cb91c30db1255554` and authenticated QA completes successfully.
