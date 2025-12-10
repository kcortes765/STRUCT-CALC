# STRUCT-CALC ACERO - Contexto para IA

**Fecha de creacion:** 2024-12-10 15:30
**Ultima actualizacion:** 2024-12-10 18:45
**Version:** 2.0
**Estado:** En desarrollo activo - Funcionalidades principales completadas

---

## RESUMEN EJECUTIVO

STRUCT-CALC ACERO es una PWA para calculo de estructuras de acero industriales, orientada a ingenieros estructurales en terreno (Chile). Usa OpenSeesPy como motor FEM en backend y Next.js en frontend.

**Estado actual:** 95% funcional. Todas las fases principales completadas. Listo para pruebas de usuario.

**Proximos pasos:** Testing de integracion, optimizacion de UX, agregar historial de calculos.

---

## STACK TECNICO

### Backend
- **Lenguaje:** Python 3.10+
- **Framework:** FastAPI
- **Motor FEM:** OpenSeesPy
- **PDF:** ReportLab
- **Validacion:** Pydantic

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS
- **Graficos:** Recharts
- **Offline:** Service Worker + IndexedDB (idb)

### Deployment
- **Frontend:** Vercel (pendiente)
- **Backend:** Railway/Render (pendiente)

---

## ESTRUCTURA DE DIRECTORIOS

```
C:\Seba\OpenSees\
├── .context/                    # Documentos de contexto para IA
│   ├── GUIA-CONTEXTO.md
│   └── CONTEXTO-ACTUAL.md       # ESTE ARCHIVO
├── backend/
│   ├── api/
│   │   ├── main.py              # App FastAPI, CORS, routers
│   │   └── routes/
│   │       ├── analysis.py      # Endpoints beam, column, frame
│   │       ├── sections.py      # Endpoints perfiles + busqueda
│   │       ├── materials.py     # Endpoints materiales
│   │       ├── connections.py   # Endpoints pernos (NUEVO)
│   │       └── reports.py       # Generacion PDF (NUEVO)
│   ├── engine/
│   │   ├── opensees_runner.py   # Motor OpenSees (analisis FEM)
│   │   ├── materials.py         # BD materiales (7 tipos)
│   │   ├── sections.py          # BD perfiles (243 perfiles)
│   │   ├── verification.py      # Verificaciones AISC 360
│   │   ├── design.py            # Sugerencia de perfiles (NUEVO)
│   │   ├── load_combinations.py # LRFD + ASD (NUEVO)
│   │   ├── connections.py       # Verificacion pernos (NUEVO)
│   │   └── frame_verification.py# Verificacion porticos (NUEVO)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Home
│   │   │   ├── layout.tsx       # Layout + SW register
│   │   │   ├── sw-register.tsx  # Service Worker client (NUEVO)
│   │   │   ├── beam/page.tsx    # Calculadora vigas (95%)
│   │   │   ├── column/page.tsx  # Calculadora columnas (90%)
│   │   │   ├── frame/page.tsx   # Editor porticos (100%)
│   │   │   ├── bolts/page.tsx   # Verificacion pernos (NUEVO)
│   │   │   └── config/page.tsx  # Configuracion
│   │   ├── components/
│   │   │   ├── BeamDiagram.tsx
│   │   │   └── ResultsChart.tsx
│   │   └── lib/
│   │       ├── types.ts         # Tipos TypeScript
│   │       ├── api.ts           # Cliente API + offline fallback
│   │       └── db.ts            # IndexedDB wrapper (NUEVO)
│   ├── public/
│   │   ├── manifest.json        # PWA config
│   │   └── sw.js                # Service Worker (NUEVO)
│   └── package.json
└── CONTEXTO-PARA-IA.md          # Contexto original (obsoleto)
```

---

## ESTADO DE FUNCIONALIDADES

### Completadas (100%)

| Funcionalidad | Descripcion |
|---------------|-------------|
| Perfiles AISC | 243 perfiles (W, HSS, C, L) con propiedades completas |
| Busqueda inteligente | Filtros por tipo, altura, peso, inercia, modulo plastico |
| Sugerir perfiles | Dado Mu, sugiere 5 mejores perfiles optimizados |
| Combinaciones LRFD | 7 combinaciones segun ASCE 7-16 |
| Combinaciones ASD | 9 combinaciones segun ASCE 7-16 |
| Verificacion pernos | Corte, tension, combinado, aplastamiento (AISC J3) |
| Modo offline | Service Worker + IndexedDB con fallback |
| Exportacion PDF | Memorias de calculo profesionales |
| Porticos | Cargas distribuidas + verificacion elementos |
| Analisis vigas | FEM + verificacion flexion/corte/deflexion |
| Analisis columnas | FEM + verificacion compresion/interaccion |

### Pendientes

| Funcionalidad | Prioridad | Complejidad |
|---------------|-----------|-------------|
| Historial de calculos | Media | Simple |
| Templates predefinidos | Baja | Simple |
| Verificacion soldaduras | Media | Media |
| NCh 427 (Chile) | Baja | Media |
| Tests automatizados | Alta | Media |
| Deployment produccion | Alta | Simple |

---

## ARCHIVOS CLAVE

Leer estos archivos para entender el proyecto:

1. **`backend/api/main.py`** - Entrada principal, todos los routers registrados
2. **`backend/engine/sections.py`** - 243 perfiles de acero con propiedades
3. **`backend/engine/opensees_runner.py`** - Motor FEM, funciones analyze_beam/column/frame
4. **`backend/engine/verification.py`** - Verificaciones AISC 360 (flexion, corte, compresion)
5. **`backend/api/routes/analysis.py`** - Endpoints principales de analisis
6. **`frontend/src/lib/types.ts`** - Todos los tipos TypeScript
7. **`frontend/src/lib/api.ts`** - Cliente API con fallback offline
8. **`frontend/src/app/beam/page.tsx`** - UI completa de calculadora de vigas
9. **`frontend/src/app/frame/page.tsx`** - UI del editor de porticos

---

## DECISIONES TECNICAS

### Por que OpenSeesPy
- Motor FEM robusto y validado academicamente
- Licencia open source
- Soporta analisis no lineal (futuro)

### Por que Next.js 15 App Router
- SSR para SEO
- App Router es el estandar moderno
- Facil deployment en Vercel

### Por que Service Worker manual (no next-pwa)
- Control total sobre estrategias de cache
- Menor complejidad de configuracion
- Funciona con App Router

### Patron de verificacion
- Todas las verificaciones siguen AISC 360-16
- Retornan objeto con: ok, ratio, utilization, details
- Colores: verde (ratio<0.8), amarillo (0.8-1.0), rojo (>1.0)

---

## COMANDOS UTILES

```bash
# === BACKEND ===

# Activar entorno virtual (Windows)
cd C:\Seba\OpenSees\backend
.\venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar servidor desarrollo
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# Verificar sintaxis Python
python -m py_compile api/main.py

# === FRONTEND ===

# Instalar dependencias
cd C:\Seba\OpenSees\frontend
npm install

# Ejecutar desarrollo
npm run dev

# Build produccion
npm run build

# === URLs ===
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# Swagger:  http://localhost:8000/docs
```

---

## METRICAS ACTUALES

| Metrica | Valor |
|---------|-------|
| Perfiles de acero | 243 |
| Endpoints API | 18 |
| Paginas frontend | 6 |
| Lineas backend | ~4500 |
| Lineas frontend | ~3500 |

---

## BUGS CONOCIDOS

- Ninguno critico actualmente
- El Service Worker puede requerir hard refresh en desarrollo

---

## NOTAS PARA LA IA

1. **Siempre verificar compilacion** despues de cambios:
   - Backend: `python -m py_compile archivo.py`
   - Frontend: `npm run build`

2. **No romper lo existente** - El analisis FEM funciona correctamente

3. **Seguir patrones existentes** - Ver archivos similares antes de crear nuevos

4. **Unidades consistentes** - Todo en mm, MPa, kN internamente

5. **El archivo original `CONTEXTO-PARA-IA.md` esta obsoleto** - Usar este documento

---

## HISTORIAL DE SESIONES

### 2024-12-10 - Sesion de mejoras mayores
- Expandido catalogo de perfiles: 55 -> 243
- Implementado busqueda inteligente y sugerencia de perfiles
- Agregado combinaciones de carga LRFD y ASD
- Creado modulo de verificacion de pernos
- Implementado modo offline con Service Worker
- Agregado exportacion de memorias de calculo PDF
- Completado modulo de porticos con verificacion
- Creada estructura de documentacion de contexto
