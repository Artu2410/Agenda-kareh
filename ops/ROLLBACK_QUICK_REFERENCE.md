# Rollback Quick Reference — Agenda Kareh

## Use this when

- `/api/version` does not match the release candidate SHA.
- `/metrics` is missing or returns HTML/404.
- Authenticated QA finds a blocker.
- 5xx spikes or auth loops appear after deploy.

## Fast rollback

1. Open the Render service deployment history.
2. Redeploy the previous successful deploy that passed parity checks.
3. If main must be moved back, revert the release commit locally and push:

```bash
git revert --no-edit 232f8045d1c5ea4ed9b1c407f3d06b306ef7f2fe
git push origin main
```

## Validate rollback

Check these first, in this order:

```bash
curl -i https://kareh-backend.onrender.com/api/version
curl -i https://kareh-backend.onrender.com/health
curl -i https://kareh-backend.onrender.com/api/health
curl -i https://kareh-backend.onrender.com/metrics
curl -i https://kareh-backend.onrender.com/api/metrics
```

Expected after rollback:

- `/api/version` matches the known-good commit and deploy timestamp.
- `/health` and `/api/health` return `200`.
- `/metrics` returns Prometheus text/plain.
- `/api/metrics` stays protected by auth.

## Abort criteria

- Version mismatch persists after redeploy.
- `/metrics` is still `404`, HTML, or missing Prometheus text.
- `/api/metrics` is publicly accessible without auth.
- Auth loops, 5xx spikes, or clinical flow regressions continue.
