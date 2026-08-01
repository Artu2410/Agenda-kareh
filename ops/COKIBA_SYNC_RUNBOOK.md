# COKIBA Sync Runbook

## Qué hace el sync

El proceso COKIBA:

- descarga el catálogo público de obras sociales,
- normaliza los campos relevantes,
- actualiza `ObraSocial`,
- genera un snapshot diario,
- calcula un diff contra el snapshot anterior,
- registra auditoría,
- dispara una notificación interna si hay cambios relevantes,
- y clasifica `authorizationType` por heurística sobre el texto extraído.

## Cómo dispararlo

### Cron HTTP

Endpoint:

```http
POST /api/cron/cokiba-sync
```

Autenticación:

- enviar `x-cron-token: <COKIBA_CRON_TOKEN>`, o
- `?token=<COKIBA_CRON_TOKEN>` en query string.

Respuesta esperada:

```json
{
  "success": true,
  "created": 3,
  "updated": 12,
  "total": 115,
  "extracted": 118,
  "status": { "...": "..." },
  "snapshot": { "...": "..." },
  "diffSummary": { "...": "..." }
}
```

### Ejemplo cURL

```bash
curl -X POST \
  -H "x-cron-token: $COKIBA_CRON_TOKEN" \
  https://<host>/api/cron/cokiba-sync
```

### Ejecución manual local

```bash
cd server
npm run cokiba-sync
```

## AuditLog generado

El sync escribe auditoría con:

- `entityType = "COKIBA_SYNC"`
- `entityId = YYYY-MM-DD`
- `action`:
  - `COKIBA_SYNC_SNAPSHOT`
  - `COKIBA_SYNC_DIFF`
  - `COKIBA_SYNC_ALERT`

### Snapshot

`newValues` guarda:

- `records`: snapshot completo normalizado del día
- `summary`: estado resumido del sync

`details` guarda:

- `trigger`
- `snapshotDateKey`
- `diffSummary`

### Diff

`newValues.diff` contiene:

- `previousRecords`
- `currentRecords`
- `added`
- `removed`
- `changed`

`newValues.diffSummary` contiene:

- `addedCount`
- `removedCount`
- `changedCount`
- `totalChanges`
- `activeToInactive`
- `inactiveToActive`
- `honorarioChanges`
- `authorizationChanges`
- `fieldCounts`
- `hasChanges`

## `authorizationType`

Campo persistido en `ObraSocial`.

Valores:

- `TOKEN_ONLINE` → la obra social exige token / validación online / credencial digital
- `COKIBA_SISTEMA` → la autorización se resuelve dentro del sistema COKIBA / autogestión / plataforma web
- `PRESENCIAL` → la autorización depende de presencia física / sucursal / delegación / filial

Si el scraper no detecta un patrón confiable, el campo queda `null`.

## Snapshots y diffs

El snapshot diario permite responder:

- qué obra social se dio de alta,
- cuál se suspendió,
- si cambió el honorario,
- si cambió el coseguro,
- si cambió el tipo de autorización.

Los diffs se escriben como auditoría y alimentan la notificación interna.

