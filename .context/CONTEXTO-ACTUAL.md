# STRUCT-CALC ACERO - Contexto para IA

**Fecha de creacion:** 2024-12-10 15:30
**Ultima actualizacion:** 2024-12-10 21:00
**Version:** 3.0
**Estado:** DEPLOYADO EN PRODUCCIÓN

---

## RESUMEN EJECUTIVO

STRUCT-CALC ACERO es una PWA para cálculo de estructuras de acero industriales, orientada a ingenieros estructurales en terreno (Chile). Usa OpenSeesPy como motor FEM en backend y Next.js en frontend.

**Estado actual:** 100% funcional. Deployado en producción.

---

## URLS DE PRODUCCIÓN

| Servicio | URL | Hosting |
|----------|-----|---------|
| Frontend | https://struct-calc.vercel.app | Vercel |
| Backend | https://struct-calc.onrender.com | Render |
| API Docs | https://struct-calc.onrender.com/docs | Render |
| GitHub | https://github.com/kcortes765/STRUCT-CALC | GitHub |

---

## STACK TÉCNICO

### Backend
- **Lenguaje:** Python 3.11
- **Framework:** FastAPI
- **Motor FEM:** OpenSeesPy
- **PDF:** ReportLab
- **Validación:** Pydantic
- **Hosting:** Render

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS
- **Gráficos:** Canvas 2D (custom)
- **Storage:** IndexedDB (historial)
- **Hosting:** Vercel

---

## ESTRUCTURA DE DIRECTORIOS

```
STRUCT-CALC/
├── .context/                    # Documentos de contexto para IA
│   ├── GUIA-CONTEXTO.md
│   ├── CONTEXTO-ACTUAL.md       # ESTE ARCHIVO
│   └── HISTORIAL/
├── backend/
│   ├── api/
│   │   ├── main.py              # App FastAPI, CORS (allow all)
│   │   └── routes/
│   │       ├── analysis.py      # /api/analysis/beam, column, frame
│   │       ├── sections.py      # /api/sections/
│   │       ├── materials.py     # /api/materials/
│   │       ├── connections.py   # /api/connections/bolts
│   │       └── reports.py       # /api/reports/beam, column (PDF)
│   ├── engine/
│   │   ├── opensees_runner.py   # Motor OpenSees
│   │   ├── materials.py         # BD materiales (7 tipos)
│   │   ├── sections.py          # BD perfiles (243 perfiles)
│   │   ├── verification.py      # Verificaciones AISC 360
│   │   ├── design.py            # Sugerencia de perfiles
│   │   ├── load_combinations.py # LRFD + ASD
│   │   ├── connections.py       # Verificación pernos
│   │   └── frame_verification.py# Verificación pórticos
│   ├── requirements.txt
│   ├── railway.toml             # Config Railway (alternativo)
│   └── nixpacks.toml            # Config Nixpacks
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Home
│   │   │   ├── layout.tsx       # Layout + SW register
│   │   │   ├── sw-register.tsx  # Solo inicializa IndexedDB (SW deshabilitado)
│   │   │   ├── beam/page.tsx    # Calculadora vigas
│   │   │   ├── column/page.tsx  # Calculadora columnas
│   │   │   ├── frame/page.tsx   # Editor pórticos
│   │   │   ├── bolts/page.tsx   # Verificación pernos
│   │   │   └── config/page.tsx  # Configuración
│   │   ├── components/
│   │   │   ├── BeamDiagram.tsx  # Diagrama de viga interactivo
│   │   │   └── ResultsChart.tsx # Gráficos de resultados
│   │   └── lib/
│   │       ├── types.ts         # Tipos TypeScript
│   │       ├── api.ts           # Cliente API
│   │       └── db.ts            # IndexedDB wrapper (historial)
│   ├── public/
│   │   ├── manifest.json        # PWA config
│   │   └── sw.js                # Service Worker (no usado)
│   ├── vercel.json              # Config Vercel
│   └── package.json
└── .gitignore
```

---

## VARIABLES DE ENTORNO

### Frontend (Vercel)
```
NEXT_PUBLIC_API_URL=https://struct-calc.onrender.com
```

### Backend (Render)
```
PORT=10000  (asignado automáticamente)
```

---

## ESTADO DE FUNCIONALIDADES

### Completadas (100%)

| Funcionalidad | Descripción |
|---------------|-------------|
| Perfiles AISC | 243 perfiles (W, HSS, IN) con propiedades completas |
| Búsqueda inteligente | Filtros por tipo, altura, peso, inercia |
| Sugerir perfiles | Dado Mu, sugiere mejores perfiles |
| Combinaciones LRFD | 7 combinaciones según ASCE 7-16 |
| Combinaciones ASD | 9 combinaciones según ASCE 7-16 |
| Verificación pernos | Corte, tensión, combinado, aplastamiento |
| Historial | IndexedDB guarda cálculos automáticamente |
| Exportación PDF | Memorias de cálculo profesionales |
| Pórticos | Análisis + verificación de elementos |
| Análisis vigas | FEM + verificación flexión/corte/deflexión |
| Análisis columnas | FEM + verificación compresión/interacción |
| Diagramas | Momento, corte, deflexión interactivos |

---

## BUGS CORREGIDOS (Sesión 2024-12-10)

| Bug | Archivo | Descripción |
|-----|---------|-------------|
| Type hint | load_combinations.py:210 | `any` → `Any` |
| Variable sin default | opensees_runner.py:471 | `max_lateral` |
| Lógica de apoyo | frame_verification.py:69 | Condición corregida |
| Manejo errores | opensees_runner.py:560 | `except:` → `except Exception as e:` |
| Validación ry | verification.py:51 | Fallback a rx |
| Factor K | opensees_runner.py:385 | Agregada combinación faltante |
| Validaciones | beam.tsx, column.tsx | Validación de inputs |
| Null check | beam.tsx:959 | `displacements?.map()` |
| PDF validation | beam.tsx, column.tsx | Valida blob antes de descargar |
| Historial | beam/column/frame | Conectado saveCalculation() |
| CORS | main.py | `allow_origins=["*"]` |
| Service Worker | sw-register.tsx | Deshabilitado (causaba problemas) |

---

## COMANDOS ÚTILES

```bash
# === DESARROLLO LOCAL ===

# Backend
cd backend
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev

# === URLs LOCALES ===
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# Swagger:  http://localhost:8000/docs

# === GIT ===
git add -A
git commit -m "mensaje"
git push
```

---

## NOTAS IMPORTANTES

1. **Service Worker deshabilitado** - Causaba problemas con Next.js en desarrollo
2. **CORS permite todos los orígenes** - API pública
3. **IndexedDB funciona** - Guarda historial de cálculos
4. **OpenSeesPy requiere Linux** - Render maneja esto automáticamente
5. **Vercel para frontend** - Detecta Next.js automáticamente
6. **Render para backend** - Usa Nixpacks para Python

---

## HISTORIAL DE SESIONES

### 2024-12-10 - Sesión de mejoras y deployment
- Expandido catálogo de perfiles: 55 → 243
- Implementado búsqueda inteligente y sugerencia de perfiles
- Agregado combinaciones de carga LRFD y ASD
- Creado módulo de verificación de pernos
- Implementado modo offline con Service Worker (luego deshabilitado)
- Agregado exportación de memorias de cálculo PDF
- Completado módulo de pórticos con verificación
- **Testing exhaustivo con 4 agentes en paralelo**
- **Corregidos 22+ bugs identificados**
- **Deployado a producción: Vercel + Render**
- Creada estructura de documentación de contexto
