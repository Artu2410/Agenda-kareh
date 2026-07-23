# Manual QA Checklist

## Regla

Esto se corre contra staging real. No reemplazarlo con unit tests.

## Auth

- login con usuario valido
- login con usuario invalido
- refresh automatico al expirar access token
- logout limpia estado y cookies
- expiracion de sesion redirige correctamente
- doble pestaña: login/logout consistente
- multiples dispositivos: revocacion y refresh consistentes

## Agenda

- crear turno
- editar turno
- mover turno
- cancelar turno
- eliminar turno futuro
- validar que no haya superposicion invalida
- validar timezone correcto
- refrescar pagina mientras se edita un turno

## Roles y rutas

- secretaria: acceso a agenda, pacientes, caja segun permisos
- kinesiologo: acceso restringido a sus datos
- admin: acceso completo esperado
- rutas protegidas no accesibles sin auth
- rutas de admin no accesibles con rol menor

## Caja

- crear ingreso
- crear egreso
- editar movimiento
- borrar movimiento
- validar permisos por rol

## Pacientes

- crear paciente
- editar paciente
- buscar por DNI
- buscar por nombre
- abrir historial
- subir adjuntos
- abrir adjuntos ya guardados

## Responsive

- login mobile
- agenda mobile
- modal de turnos mobile
- sidebar y navegacion mobile

## Evidencia minima

- fecha de prueba
- entorno probado
- usuario y rol usado
- resultado esperado
- resultado real
- screenshot o video si hay bug
