# Carpeta de Contexto para IA

Esta carpeta contiene documentacion estructurada para que una IA pueda retomar el trabajo en este proyecto de forma eficiente.

## Como usar en una nueva sesion

Al iniciar una nueva sesion con Claude u otra IA, ejecutar:

```
lee el archivo '.context/CONTEXTO-ACTUAL.md'
```

O simplemente:

```
/clear 'C:\Seba\OpenSees\.context\CONTEXTO-ACTUAL.md'
```

## Estructura

```
.context/
├── README.md              # Este archivo
├── GUIA-CONTEXTO.md       # Como crear/mantener documentos de contexto
├── CONTEXTO-ACTUAL.md     # *** DOCUMENTO PRINCIPAL - LEER PRIMERO ***
├── HISTORIAL/             # Contextos anteriores archivados
└── DECISIONES/            # Registro de decisiones tecnicas
```

## Documento clave

**SIEMPRE leer primero:** `CONTEXTO-ACTUAL.md`

Este archivo contiene:
- Estado actual del proyecto
- Archivos clave a revisar
- Funcionalidades completadas/pendientes
- Comandos para ejecutar
- Decisiones tecnicas

## Mantenimiento

Actualizar `CONTEXTO-ACTUAL.md` cuando:
- Se complete una funcionalidad mayor
- Se cambie la arquitectura
- Al final de cada sesion significativa

Formato de fecha: `YYYY-MM-DD HH:MM`
