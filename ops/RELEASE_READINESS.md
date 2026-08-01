# Release Readiness

## Backend

- migrations OK
- envs OK
- health OK
- logs OK
- CORS OK
- cookies OK
- authLimiter OK
- refreshLimiter OK

## Frontend

- build OK
- env OK
- API URL OK
- auth OK
- responsive OK

## Observabilidad

- `SENTRY_DSN` definido en backend si se habilita
- `VITE_SENTRY_DSN` definido en frontend si se habilita
- logs revisables en staging y produccion

## Documentos de soporte

- staging: [ops/STAGING_RUNBOOK.md](/d:/Agenda-kareh/ops/STAGING_RUNBOOK.md:1)
- QA manual: [ops/MANUAL_QA_CHECKLIST.md](/d:/Agenda-kareh/ops/MANUAL_QA_CHECKLIST.md:1)
- backups: [ops/BACKUP_RESTORE_RUNBOOK.md](/d:/Agenda-kareh/ops/BACKUP_RESTORE_RUNBOOK.md:1)
