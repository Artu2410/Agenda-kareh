# Staging Runbook

## Objetivo

Tener un entorno real de staging antes de seguir agregando features.

Stack minimo:

- Frontend staging: `https://staging-agenda.kareh.com.ar`
- Backend staging: `https://api-staging.kareh.com.ar`
- Base de datos staging: separada de produccion

## Reglas

- Nunca reutilizar la base de datos de produccion.
- Nunca compartir secretos entre staging y produccion.
- Staging debe correr migraciones propias.
- Staging debe tener logs, health checks y CORS propios.

## Variables de entorno

Backend:

- usar [server/.env.staging.example](/d:/Agenda-kareh/server/.env.staging.example:1)
- `NODE_ENV=production`
- `CLIENT_URL=https://staging-agenda.kareh.com.ar`
- `FRONTEND_URL=https://staging-agenda.kareh.com.ar`
- `CORS_ALLOWED_ORIGINS=https://staging-agenda.kareh.com.ar`
- `COOKIE_SECURE=true`

Frontend:

- usar [client/.env.staging.example](/d:/Agenda-kareh/client/.env.staging.example:1)
- `VITE_API_URL=https://api-staging.kareh.com.ar`

## Checklist de deploy staging

Backend:

- `npm ci`
- `npm test`
- `npm run prisma:generate`
- `npm run prisma:migrate:deploy`
- `npm start`
- verificar `GET /health`
- verificar `GET /api/health`

Frontend:

- `npm ci --legacy-peer-deps`
- `npm run test:unit`
- `npm run build`
- publicar con `VITE_API_URL` apuntando al backend staging

## Smoke check post deploy

Local o CI:

- definir `FRONTEND_URL`
- definir `BACKEND_URL`
- correr `npm run smoke:deploy` dentro de `server`

GitHub Actions:

- cargar repo vars `STAGING_FRONTEND_URL`
- cargar repo vars `STAGING_BACKEND_URL`
- ejecutar workflow [staging-smoke.yml](/d:/Agenda-kareh/.github/workflows/staging-smoke.yml:1)

## Criterio de salida

Staging no esta listo hasta que:

- frontend responda 200
- backend responda 200 en `/health`
- backend responda 200 en `/api/health`
- CORS devuelva el origin exacto de staging
- cookies de auth funcionen con `secure=true`
- login, refresh y logout funcionen manualmente
