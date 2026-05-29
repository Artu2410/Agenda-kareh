# Post-Deploy QA — Agenda Kareh

## Objetivo
Validar en producción que auth, agenda, WhatsApp y cashflow siguen operativos después de cada despliegue.

## Entorno
- Frontend: `https://agenda.kareh.com.ar`
- Backend: `https://kareh-backend.onrender.com`
- Navegador recomendado: incógnito limpio
- Release esperado: el commit de código que se esté promoviendo; hoy el candidato funcional es `6133966` y el commit `e84bdf0` es sólo documentación, sin impacto runtime.

## Preparación
- Abrir una ventana de incógnito.
- Confirmar que no existan sesiones previas.
- Tener acceso al mail/OTP de un usuario habilitado.

## Auth
- [ ] Login correcto con OTP.
- [ ] Login inválido muestra error y no avanza.
- [ ] Logout limpia la sesión y vuelve al acceso.
- [ ] Refresh de sesión no rompe la navegación.
- [ ] Expirar sesión manualmente redirige al login.
- [ ] La versión visible en el frontend coincide con `/api/version`.

## Agenda
- [ ] Abrir `/agenda` con sesión activa.
- [ ] Crear turno nuevo desde un slot libre.
- [ ] Confirmar que el turno aparece en la grilla.
- [ ] Editar un turno existente.
- [ ] Guardar asistencia/evolución.
- [ ] Cancelar un turno y verificar que desaparece.
- [ ] Verificar impresión/preview si aplica.

## Obras Sociales
- [ ] Abrir `/obras-sociales`.
- [ ] Filtrar por estado.
- [ ] Buscar por nombre o código.
- [ ] Crear una obra social manual.
- [ ] Editar una obra social existente.
- [ ] Confirmar que la grilla y el detalle se actualizan.

## WhatsApp
- [ ] Verificar que la bandeja carga conversaciones.
- [ ] Enviar mensaje manual.
- [ ] Confirmar recepción de webhook en staging si hay entorno disponible.
- [ ] Verificar que el bot básico responde en el flujo esperado.

## Cashflow
- [ ] Abrir `/cashflow`.
- [ ] Crear un ingreso.
- [ ] Crear un egreso.
- [ ] Exportar datos si el flujo está disponible.

## Responsive
- [ ] Revisar en móvil.
- [ ] Revisar en tablet.
- [ ] Revisar en desktop.

## Criterio de aprobación
- Sin errores visibles de consola.
- Sin pantallas blancas.
- Sin loops de auth.
- Sin 400/401 inesperados en flujos normales.
- `/api/version`, `/api/health` y `/metrics` devuelven lo esperado en producción.

## Parity y rollback
1. Consultar `GET /api/version` y verificar que `version` y `commit` coincidan con el release esperado.
2. Abrir `https://agenda.kareh.com.ar` y confirmar que el badge de versión muestra el mismo `version` / `commit`.
3. Verificar `GET /api/health` y `GET /health`.
4. Verificar `GET /metrics` y confirmar que sólo expone métricas agregadas, sin PII ni tokens.
5. Si el commit no coincide, bloquear promoción y redeployar manualmente el backend correcto.
6. Si el deploy nuevo introduce una regresión, volver al commit anterior ya validado y repetir QA.

## Smoke tests obligatorios
- `GET /api/version`
- `GET /api/health`
- `GET /health`
- Login OTP
- Logout
- Refresh de sesión
- Agenda básica
- WhatsApp inbox
- RBAC para `SECRETARIA` y `SUPER_USER`

## Notas
- Si falla auth, detener el QA y revisar cookies, refresh y bootstrap antes de seguir.
- Si falla agenda o evolución, validar primero el payload del modal y luego el schema del backend.
- Si el endpoint `/metrics` no existe en producción pero sí en repo, tratarlo como deploy drift y no como bug funcional.
