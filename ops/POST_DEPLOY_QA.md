# Post-Deploy QA — Agenda Kareh

## Objetivo
Validar en producción que auth, agenda, WhatsApp y cashflow siguen operativos después de cada despliegue.

## Entorno
- Frontend: `https://agenda.kareh.com.ar`
- Backend: `https://kareh-backend.onrender.com`
- Navegador recomendado: incógnito limpio

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

## Notas
- Si falla auth, detener el QA y revisar cookies, refresh y bootstrap antes de seguir.
- Si falla agenda o evolución, validar primero el payload del modal y luego el schema del backend.
