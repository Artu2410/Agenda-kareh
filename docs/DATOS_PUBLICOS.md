# Política de Datos Públicos

Este documento define qué datos pueden incluirse en el repositorio y qué datos deben mantenerse fuera del código fuente.

## Permitido subir
- Nombre de la cobertura / obra social.
- Alias públicos y nombres alternativos.
- Estado activo/inactivo.
- Texto comercial aprobado y mensajes de comunicación pública.
- Identificadores de catálogo que no revelen contratos.

## No subir nunca
- Contratos privados.
- Aranceles.
- Autorizaciones internas o específicas.
- Vigencias contractuales.
- Convenios privados.
- PDFs internos relacionados con convenios, autorizaciones, normas operativas o planillas privadas.
- Catálogos COKIBA completos o datos de tarifas detallados.
- Datos de aseguradoras específicos que revelen información de operadores privados no públicos.

## Ruta de manejo seguro
- Los archivos con información de cumplimiento contractual o tarifas deben guardarse en `server/private/`.
- `server/private/` debe estar en `.gitignore` y no debe subirse al repositorio.

## Responsabilidades
- Antes de subir cambios, verificar que no haya referencias a:
  - `ARANCEL`
  - `AUTORIZACION`
  - `VIGENCIA`
  - `CONTRATO`
  - `COKIBA`
  - `OSDE`
  - `PAMI`
- Use `npm run compliance-check` en el directorio `server/` para validar los archivos públicos.
