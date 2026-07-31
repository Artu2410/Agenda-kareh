# Definición funcional MER

## Contexto

El módulo COKIBA ya quedó sin IA. Antes de implementar MER hay que cerrar definición de negocio.

## Preguntas abiertas

### 1) ¿Quién carga el MER?

- administrativo
- profesional
- super user
- otro rol

### 2) ¿Con qué frecuencia?

- mensual
- quincenal
- semanal
- por evento

### 3) ¿Se necesita histórico?

- sí / no
- si sí: ¿por cuánto tiempo?

### 4) ¿Se necesita comparación contra honorarios?

- sí / no
- si sí: ¿contra qué referencia?

### 5) ¿Se necesita alerta automática?

- sí / no
- si sí: ¿qué dispara la alerta?

## Objetivo de negocio

Definir la forma más simple, auditable y predecible de registrar MER sin IA.

## Restricciones

- no usar Gemini
- no usar OCR automático salvo caso de negocio justificado
- no aumentar complejidad operativa
- no introducir dependencias innecesarias

## Criterio de cierre

El ticket se cierra cuando exista una decisión explícita sobre:

- actor responsable,
- frecuencia,
- persistencia histórica,
- comparación de valores,
- alertas automáticas.

