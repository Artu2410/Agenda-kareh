# Backup and Restore Runbook

## Objetivo

Confirmar que existen backups reales y que el equipo sabe restaurarlos.

## Obligatorio antes de produccion

- backups automaticos activos
- PITR activo si el proveedor lo soporta
- retention definida
- restore test ejecutado y documentado

## Confirmacion por proveedor

Verificar en la consola del proveedor actual:

- Railway
- Neon
- Supabase
- Vercel Postgres

Campos a confirmar:

- backup schedule
- retention
- point in time recovery
- restore to new database

## Restore test

1. Crear una base de datos restaurada nueva, nunca sobre la principal.
2. Restaurar desde el backup mas reciente o desde un punto exacto.
3. Obtener nueva `DATABASE_URL`.
4. Levantar backend contra la base restaurada.
5. Validar:
   - `GET /health`
   - `GET /api/health`
   - login
   - lectura de pacientes
   - lectura de turnos
   - lectura de caja
6. Confirmar que los datos esperados existen.
7. Documentar tiempo total de restore.

## Evidencia minima del restore test

- fecha
- proveedor
- snapshot o timestamp restaurado
- nueva base creada
- tiempo de restore
- checks funcionales ejecutados
- resultado final

## Criterio de salida

No considerar que hay backup real hasta tener:

- restore test exitoso
- evidencia guardada
- responsables asignados para repetirlo
