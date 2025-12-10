# GUIA DE GESTION DE CONTEXTO PARA IA

## Proposito
Esta guia establece el formato y mejores practicas para crear documentos de contexto que permitan a una IA retomar el trabajo en un proyecto de forma eficiente.

---

## Estructura de la Carpeta .context/

```
.context/
├── GUIA-CONTEXTO.md          # Esta guia (no modificar)
├── CONTEXTO-ACTUAL.md        # Estado actual del proyecto (DOCUMENTO CLAVE)
├── HISTORIAL/                # Contextos anteriores archivados
│   └── YYYY-MM-DD_contexto.md
└── DECISIONES/               # Registro de decisiones tecnicas importantes
    └── YYYY-MM-DD_decision.md
```

---

## Formato del Documento de Contexto

### Encabezado Obligatorio

```markdown
# [NOMBRE DEL PROYECTO] - Contexto para IA

**Fecha de creacion:** YYYY-MM-DD HH:MM
**Ultima actualizacion:** YYYY-MM-DD HH:MM
**Version:** X.Y
**Autor:** [nombre]

---
```

### Secciones Requeridas

1. **RESUMEN EJECUTIVO** (3-5 lineas)
   - Que es el proyecto
   - Estado actual en una frase
   - Proximos pasos prioritarios

2. **STACK TECNICO**
   - Backend: lenguaje, framework, dependencias clave
   - Frontend: framework, librerias principales
   - Base de datos (si aplica)
   - Deployment

3. **ESTRUCTURA DE DIRECTORIOS**
   - Arbol de carpetas principales
   - Descripcion de archivos clave

4. **ESTADO ACTUAL**
   - Funcionalidades completadas (con %)
   - Funcionalidades pendientes
   - Bugs conocidos

5. **ARCHIVOS CLAVE** (IMPORTANTE)
   - Lista de 5-10 archivos mas importantes
   - Ruta completa + descripcion de 1 linea

6. **DECISIONES TECNICAS**
   - Patrones usados
   - Por que se eligio X tecnologia
   - Restricciones conocidas

7. **COMANDOS UTILES**
   - Como ejecutar el proyecto
   - Como hacer build
   - Como correr tests

8. **TAREAS PENDIENTES**
   - Lista priorizada de lo que falta
   - Estimacion de complejidad (simple/media/compleja)

---

## Mejores Practicas

### DO (Hacer)
- Actualizar el contexto al terminar cada sesion significativa
- Incluir fecha y hora en cada actualizacion
- Marcar archivos clave con rutas absolutas
- Documentar decisiones tecnicas importantes
- Mantener el documento conciso (<500 lineas)
- Usar formato markdown consistente
- Incluir ejemplos de comandos que funcionan

### DON'T (No Hacer)
- No incluir codigo completo (solo snippets relevantes)
- No duplicar documentacion existente (referenciar)
- No incluir credenciales o secretos
- No dejar tareas sin priorizar
- No usar rutas relativas ambiguas

---

## Cuando Actualizar el Contexto

Actualizar CONTEXTO-ACTUAL.md cuando:
- Se complete una funcionalidad mayor
- Se cambie la arquitectura
- Se agreguen dependencias importantes
- Se corrijan bugs criticos
- Al final de cada sesion de trabajo con IA

---

## Plantilla Rapida

```markdown
# [PROYECTO] - Contexto para IA

**Fecha:** YYYY-MM-DD HH:MM
**Estado:** [En desarrollo / Produccion / Mantenimiento]

## Resumen
[2-3 lineas describiendo el proyecto y estado actual]

## Stack
- Backend: [tecnologias]
- Frontend: [tecnologias]

## Archivos Clave
1. `ruta/archivo1` - descripcion
2. `ruta/archivo2` - descripcion

## Completado
- [x] Funcionalidad A
- [x] Funcionalidad B

## Pendiente
- [ ] Funcionalidad C (prioridad alta)
- [ ] Funcionalidad D (prioridad media)

## Comandos
\`\`\`bash
# Ejecutar backend
cd backend && python -m uvicorn api.main:app --reload

# Ejecutar frontend
cd frontend && npm run dev
\`\`\`

## Notas
[Cualquier informacion adicional relevante]
```

---

## Archivo Clave a Leer Primero

Cuando inicies una nueva sesion, SIEMPRE lee primero:

```
C:\Seba\OpenSees\.context\CONTEXTO-ACTUAL.md
```

Este archivo contiene el estado mas reciente del proyecto.
