# STRUCT-CALC ACERO - Contexto Completo para IA Manager

## IMPORTANTE: Lee este archivo completo antes de comenzar

Este documento contiene todo el contexto necesario para que una IA actúe como **manager de un equipo de agentes** para llevar esta aplicación de cálculo estructural al siguiente nivel.

---

## 1. DESCRIPCIÓN DEL PROYECTO

### Qué es
- **Nombre:** STRUCT-CALC ACERO
- **Propósito:** App móvil (PWA) para cálculo de estructuras de acero industriales
- **Usuario objetivo:** Ingenieros estructurales en terreno (obra) en Chile
- **Stack técnico:**
  - Backend: Python + FastAPI + OpenSeesPy (motor FEM)
  - Frontend: Next.js 16 + TypeScript + Tailwind CSS + Recharts
  - Deployment: Vercel (frontend) + Railway/Render (backend)

### Estructura de Directorios
```
C:\Seba\OpenSees\
├── backend/
│   ├── api/
│   │   ├── main.py              # FastAPI app, CORS, health
│   │   └── routes/
│   │       ├── analysis.py      # Endpoints de análisis (beam, column, frame)
│   │       ├── sections.py      # Endpoints de perfiles
│   │       └── materials.py     # Endpoints de materiales
│   ├── engine/
│   │   ├── opensees_runner.py   # Motor OpenSees (análisis FEM)
│   │   ├── materials.py         # Base de datos de materiales (7 tipos)
│   │   ├── sections.py          # Base de datos de perfiles (55 actualmente)
│   │   └── verification.py      # Verificaciones AISC 360
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Home
│   │   │   ├── beam/page.tsx    # Calculadora de vigas (77% completo)
│   │   │   ├── column/page.tsx  # Calculadora de columnas (72% completo)
│   │   │   ├── frame/page.tsx   # Editor de pórticos (40% completo)
│   │   │   └── config/page.tsx  # Configuración
│   │   ├── components/
│   │   │   ├── BeamDiagram.tsx  # Canvas de visualización de vigas
│   │   │   └── ResultsChart.tsx # Gráficos con Recharts
│   │   └── lib/
│   │       ├── types.ts         # Tipos TypeScript
│   │       └── api.ts           # Cliente API
│   └── public/
│       └── manifest.json        # PWA config
└── README.md
```

---

## 2. ESTADO ACTUAL (Post Bug-Fixes)

### Bugs Corregidos (25 bugs)
Ya se corrigieron 25 bugs en la sesión anterior:
- Backend: División por cero, validaciones, CORS, error handling, logging
- Frontend: useEffect en canvas, API URL reactivo, tipado, error handling unificado

### Métricas Actuales
| Aspecto | Estado | Objetivo |
|---------|--------|----------|
| Perfiles AISC | 43 (~15% del catálogo) | 200+ (80%) |
| Perfiles Chilenos | 12 (~40%) | 30+ (100%) |
| Materiales | 7 (completo) | OK |
| Vigas | 77% funcional | 95% |
| Columnas | 72% funcional | 90% |
| Pórticos | 40% funcional | 80% |
| Modo Offline | No funciona | Completo |
| Exportación PDF | No existe | Profesional |
| Combinaciones carga | No existe | LRFD + ASD |
| Verificación conexiones | No existe | Pernos + Soldaduras |

### Limitaciones Críticas Actuales
1. **Solo 55 perfiles** - Muy pocos para uso profesional
2. **Sin diseño iterativo** - Solo verifica un perfil, no sugiere alternativas
3. **Sin filtrado inteligente** - Difícil encontrar el perfil correcto
4. **Sin combinaciones de carga** - No cumple normativa real
5. **Sin verificación de conexiones** - Crítico para obra
6. **Sin modo offline** - Inútil sin internet
7. **Sin exportación** - No se puede compartir resultados
8. **Pórticos incompletos** - No verifica elementos individuales

---

## 3. VISIÓN: LA HERRAMIENTA DEFINITIVA

### Características Objetivo
1. **Catálogo completo de perfiles** (250+) con búsqueda inteligente
2. **Diseño iterativo** - Dado un momento/fuerza, sugiere los 5 mejores perfiles
3. **Modo offline completo** - Funciona sin internet
4. **Reportes PDF profesionales** - Para entregar a clientes
5. **Verificación de conexiones** - Pernos y soldaduras
6. **Combinaciones de carga** - LRFD y ASD según AISC
7. **Cumplimiento NCh 427** - Norma chilena completa
8. **UX de terreno** - Rápido, táctil, historial de cálculos

---

## 4. PLAN DE IMPLEMENTACIÓN POR FASES

### FASE 1: Base de Datos de Perfiles (PRIORIDAD MÁXIMA)

#### 1.1 Expandir Catálogo AISC
**Archivo:** `backend/engine/sections.py`

**Perfiles a agregar (~160 más):**
```
W Shapes (vigas I): W100x19 hasta W920x420 (80+ perfiles)
  - Incluir TODAS las series: W100, W130, W150, W200, W250, W310, W360,
    W410, W460, W530, W610, W690, W760, W840, W920
  - Cada serie tiene 3-8 pesos diferentes

HSS Rectangular (tubos): 30+ tamaños
  - HSS50x25 hasta HSS400x300
  - Espesores: 3.2, 4.8, 6.4, 7.9, 9.5, 12.7 mm

HSS Round (tubos circulares): 20+ tamaños
  - HSS48.3 hasta HSS508
  - Espesores variados

Channels (C): 15+ perfiles
  - C75 hasta C380

Angles (L): 25+ combinaciones
  - L25x25 hasta L200x200
  - Catetos iguales y desiguales
```

**Fuente de datos:** AISC Shapes Database (disponible en aisc.org/publications/steel-construction-manual-resources)

**Estructura de cada perfil (ya definida):**
```python
{
    "id": "W310X39",
    "type": "W",
    "catalog": "AISC",
    "d": 310,      # altura mm
    "bf": 165,     # ancho ala mm
    "tf": 9.7,     # espesor ala mm
    "tw": 5.8,     # espesor alma mm
    "A": 4930,     # área mm²
    "Ix": 84.9e6,  # inercia x mm⁴
    "Iy": 7.23e6,  # inercia y mm⁴
    "Sx": 547e3,   # módulo sección x mm³
    "Sy": 87.6e3,  # módulo sección y mm³
    "Zx": 634e3,   # módulo plástico x mm³
    "Zy": 137e3,   # módulo plástico y mm³
    "rx": 131,     # radio giro x mm
    "ry": 38.3,    # radio giro y mm
    "J": 227e3,    # constante torsional mm⁴
    "weight": 39.0 # peso kg/m
}
```

#### 1.2 Búsqueda y Filtrado Inteligente
**Archivos:**
- `backend/api/routes/sections.py` - Nuevos endpoints
- `frontend/src/app/beam/page.tsx` - UI de búsqueda

**Funcionalidades:**
```
GET /api/sections/search?min_Ix=50e6&max_weight=50
GET /api/sections/search?type=W&min_d=300&max_d=400
GET /api/sections/recommend?Mu=500&units=kN-m  # Sugiere perfiles

Filtros:
- Por tipo (W, HSS, C, L)
- Por altura (d_min, d_max)
- Por peso (weight_min, weight_max)
- Por inercia (Ix_min, Iy_min)
- Por módulo plástico (Zx_min)
- Por radio de giro (rx_min, ry_min)
```

#### 1.3 Diseño Iterativo (Sugerencia de Perfiles)
**Archivo nuevo:** `backend/engine/design.py`

**Lógica:**
```python
def suggest_beam_sections(Mu_required, Vu_required, Fy, num_suggestions=5):
    """
    Dado un momento y cortante requerido, sugiere los mejores perfiles.

    Criterios de ranking:
    1. Cumple capacidad (phi*Mn >= Mu)
    2. Menor peso (optimización de costo)
    3. Ratio de utilización entre 0.7 y 0.95 (eficiente)
    """
    candidates = []
    for section in ALL_SECTIONS:
        if section["type"] in ["W", "IN"]:  # Solo vigas
            phi_Mn = calculate_moment_capacity(section, Fy)
            if phi_Mn >= Mu_required:
                ratio = Mu_required / phi_Mn
                candidates.append({
                    "section": section,
                    "phi_Mn": phi_Mn,
                    "ratio": ratio,
                    "weight": section["weight"]
                })

    # Ordenar por peso (menor primero) y ratio (más cercano a 0.85)
    return sorted(candidates, key=lambda x: (x["weight"], abs(x["ratio"] - 0.85)))[:num_suggestions]
```

**UI en frontend:**
- Botón "Sugerir Perfiles" después de definir cargas
- Tabla comparativa de opciones
- Selección rápida para ver detalles

---

### FASE 2: Combinaciones de Carga

#### 2.1 Motor de Combinaciones
**Archivo nuevo:** `backend/engine/load_combinations.py`

```python
LRFD_COMBINATIONS = [
    {"name": "1.4D", "factors": {"D": 1.4}},
    {"name": "1.2D + 1.6L", "factors": {"D": 1.2, "L": 1.6}},
    {"name": "1.2D + 1.6L + 0.5S", "factors": {"D": 1.2, "L": 1.6, "S": 0.5}},
    {"name": "1.2D + 1.0L + 1.0E", "factors": {"D": 1.2, "L": 1.0, "E": 1.0}},
    {"name": "0.9D + 1.0E", "factors": {"D": 0.9, "E": 1.0}},
]

ASD_COMBINATIONS = [
    {"name": "D + L", "factors": {"D": 1.0, "L": 1.0}},
    {"name": "D + 0.75L + 0.75S", "factors": {"D": 1.0, "L": 0.75, "S": 0.75}},
    {"name": "D + 0.7E", "factors": {"D": 1.0, "E": 0.7}},
]

def get_critical_combination(load_cases, method="LRFD"):
    """Encuentra la combinación que produce mayores solicitaciones."""
    combinations = LRFD_COMBINATIONS if method == "LRFD" else ASD_COMBINATIONS
    max_Mu = 0
    critical = None
    for combo in combinations:
        Mu = sum(load_cases.get(load_type, 0) * factor
                 for load_type, factor in combo["factors"].items())
        if Mu > max_Mu:
            max_Mu = Mu
            critical = combo
    return critical, max_Mu
```

#### 2.2 UI de Combinaciones
**Archivo:** `frontend/src/app/beam/page.tsx`

- Selector LRFD/ASD
- Campos para cada tipo de carga (D, L, Lr, S, W, E)
- Mostrar combinación crítica y factores

---

### FASE 3: Verificación de Conexiones

#### 3.1 Módulo de Pernos
**Archivo nuevo:** `backend/engine/connections.py`

```python
BOLT_PROPERTIES = {
    "A325": {"Fnt": 620, "Fnv": 372},  # MPa (tensión, corte)
    "A490": {"Fnt": 780, "Fnv": 457},
    "4.6": {"Fnt": 240, "Fnv": 150},
    "8.8": {"Fnt": 640, "Fnv": 372},
    "10.9": {"Fnt": 830, "Fnv": 500},
}

BOLT_DIAMETERS = {
    "M12": {"d": 12, "Ab": 113},   # mm, mm²
    "M16": {"d": 16, "Ab": 201},
    "M20": {"d": 20, "Ab": 314},
    "M22": {"d": 22, "Ab": 380},
    "M24": {"d": 24, "Ab": 452},
    "M27": {"d": 27, "Ab": 573},
    "M30": {"d": 30, "Ab": 707},
}

def verify_bolt_shear(bolt_grade, diameter, num_bolts, Vu, shear_planes=1):
    """Verificar pernos a corte."""
    props = BOLT_PROPERTIES[bolt_grade]
    bolt = BOLT_DIAMETERS[diameter]
    phi = 0.75
    Rn = phi * props["Fnv"] * bolt["Ab"] * shear_planes * num_bolts / 1000  # kN
    ratio = Vu / Rn
    return {"Rn": Rn, "Vu": Vu, "ratio": ratio, "ok": ratio <= 1.0}

def verify_bolt_bearing(t_plate, Fu_plate, diameter, num_bolts, Vu, edge_dist, spacing):
    """Verificar aplastamiento en placa."""
    # AISC J3.10
    pass

def verify_bolt_tension(bolt_grade, diameter, num_bolts, Tu):
    """Verificar pernos a tensión."""
    pass
```

#### 3.2 Página de Pernos
**Archivo nuevo:** `frontend/src/app/bolts/page.tsx`

UI con:
- Selector de grado de perno
- Selector de diámetro
- Número de pernos
- Fuerza aplicada (corte, tensión)
- Verificación instantánea
- Diagrama visual del grupo de pernos

---

### FASE 4: Modo Offline

#### 4.1 Service Worker
**Archivo nuevo:** `frontend/public/sw.js`

```javascript
const CACHE_NAME = 'struct-calc-v1';
const urlsToCache = [
  '/',
  '/beam',
  '/column',
  '/frame',
  '/config',
  '/bolts',
  // CSS, JS bundles
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

#### 4.2 IndexedDB para Datos
**Archivo nuevo:** `frontend/src/lib/db.ts`

```typescript
import { openDB } from 'idb';

const dbPromise = openDB('struct-calc-db', 1, {
  upgrade(db) {
    db.createObjectStore('sections');
    db.createObjectStore('materials');
    db.createObjectStore('calculations', { keyPath: 'id', autoIncrement: true });
  },
});

export async function cacheSections(sections: Section[]) {
  const db = await dbPromise;
  const tx = db.transaction('sections', 'readwrite');
  await Promise.all(sections.map(s => tx.store.put(s, s.id)));
}

export async function getOfflineSections(): Promise<Section[]> {
  const db = await dbPromise;
  return db.getAll('sections');
}

export async function saveCalculation(calc: Calculation) {
  const db = await dbPromise;
  return db.add('calculations', { ...calc, timestamp: Date.now() });
}
```

#### 4.3 Cálculos Offline Simplificados
**Archivo:** `frontend/src/lib/api.ts`

Expandir `calculateBeamSimple()` para incluir verificación AISC básica.

---

### FASE 5: Exportación PDF

#### 5.1 Generador PDF Backend
**Archivo nuevo:** `backend/api/routes/reports.py`

```python
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, Paragraph

@router.post("/api/reports/beam")
async def generate_beam_report(request: BeamReportRequest):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []

    # Header
    elements.append(Paragraph("MEMORIA DE CÁLCULO - VIGA", styles['Title']))

    # Datos de entrada
    elements.append(Paragraph("1. DATOS DE ENTRADA", styles['Heading1']))
    data = [
        ["Longitud", f"{request.length} m"],
        ["Perfil", request.section_id],
        ["Material", request.material_id],
    ]
    elements.append(Table(data))

    # Resultados
    elements.append(Paragraph("2. RESULTADOS", styles['Heading1']))
    # ... momentos, cortantes, deflexiones

    # Verificaciones
    elements.append(Paragraph("3. VERIFICACIONES AISC 360", styles['Heading1']))
    # ... ratios de utilización

    # Conclusión
    status = "CUMPLE" if all_ok else "NO CUMPLE"
    elements.append(Paragraph(f"CONCLUSIÓN: {status}", styles['Heading1']))

    doc.build(elements)
    return StreamingResponse(buffer, media_type="application/pdf")
```

---

### FASE 6: Mejoras en Pórticos

#### 6.1 Cargas Distribuidas en Elementos
**Archivo:** `backend/engine/opensees_runner.py`

Implementar el TODO en línea ~588:
```python
# En analyze_frame(), después de cargas nodales:
for load in element_loads:
    if load["type"] == "distributed":
        elem_id = load["element_id"]
        w = load["w"]  # kN/m
        # Usar eleLoad de OpenSees
        ops.eleLoad('-ele', elem_id, '-type', '-beamUniform', w, 0.0)
```

#### 6.2 Verificación de Elementos
Después del análisis, verificar cada elemento:
```python
def verify_frame_elements(elements, forces, material, units):
    results = []
    for elem in elements:
        N = forces[elem.id]["N"]  # Axial
        V = forces[elem.id]["V"]  # Cortante
        M = forces[elem.id]["M"]  # Momento

        if elem.type == "beam":
            verification = verify_beam_aisc(...)
        else:  # column
            verification = verify_column_aisc(...)

        results.append({
            "element_id": elem.id,
            "type": elem.type,
            "verification": verification
        })
    return results
```

---

### FASE 7: NCh 427 (Chile)

**Archivo nuevo:** `backend/engine/verification_nch.py`

Diferencias con AISC:
- Factores de resistencia phi diferentes
- Combinaciones de carga NCh 3171
- Verificación sísmica NCh 433

---

### FASE 8: UX de Terreno

#### 8.1 Historial
**Archivo nuevo:** `frontend/src/app/history/page.tsx`

- Lista de últimos 50 cálculos
- Filtrar por tipo
- Re-abrir cálculo anterior
- Duplicar y modificar

#### 8.2 Templates
Agregar botón "Plantillas" con casos comunes pre-cargados.

---

## 5. ESTRATEGIA DE AGENTES

### Recomendación: 5-6 Agentes Especializados

#### AGENTE 1: Perfiles y Datos
**Responsabilidad:** Expandir catálogo de perfiles
**Archivos:**
- `backend/engine/sections.py`

**Tareas:**
1. Buscar datos AISC online (shapes database)
2. Agregar 160+ perfiles W, HSS, C, L
3. Agregar perfiles chilenos faltantes
4. Verificar estructura de datos consistente

#### AGENTE 2: Búsqueda y Diseño Iterativo
**Responsabilidad:** Filtrado inteligente y sugerencia de perfiles
**Archivos:**
- `backend/api/routes/sections.py`
- `backend/engine/design.py` (nuevo)
- `frontend/src/app/beam/page.tsx`

**Tareas:**
1. Crear endpoint de búsqueda avanzada
2. Implementar algoritmo de sugerencia de perfiles
3. UI de filtros en frontend
4. Tabla comparativa de opciones

#### AGENTE 3: Combinaciones de Carga
**Responsabilidad:** LRFD/ASD
**Archivos:**
- `backend/engine/load_combinations.py` (nuevo)
- `backend/api/routes/analysis.py`
- `frontend/src/app/beam/page.tsx`
- `frontend/src/app/column/page.tsx`

**Tareas:**
1. Implementar combinaciones LRFD y ASD
2. Modificar endpoints de análisis
3. UI de selección de tipos de carga
4. Mostrar combinación crítica

#### AGENTE 4: Conexiones
**Responsabilidad:** Pernos y soldaduras
**Archivos:**
- `backend/engine/connections.py` (nuevo)
- `backend/api/routes/connections.py` (nuevo)
- `frontend/src/app/bolts/page.tsx` (nuevo)

**Tareas:**
1. Implementar verificación de pernos
2. Crear endpoint de conexiones
3. Crear página de calculadora de pernos
4. Agregar a navegación

#### AGENTE 5: Offline y PWA
**Responsabilidad:** Modo offline completo
**Archivos:**
- `frontend/public/sw.js` (nuevo)
- `frontend/src/lib/db.ts` (nuevo)
- `frontend/src/lib/api.ts`
- `frontend/src/app/layout.tsx`

**Tareas:**
1. Crear service worker
2. Implementar IndexedDB
3. Cache de perfiles y materiales
4. Fallback offline para cálculos

#### AGENTE 6: Pórticos y PDF
**Responsabilidad:** Completar pórticos + exportación
**Archivos:**
- `backend/engine/opensees_runner.py`
- `backend/api/routes/reports.py` (nuevo)
- `frontend/src/app/frame/page.tsx`

**Tareas:**
1. Cargas distribuidas en frame
2. Verificación de elementos
3. Generación de PDF
4. Diagramas de fuerzas internas

---

## 6. ORDEN DE EJECUCIÓN RECOMENDADO

```
PARALELO INICIAL (Agentes 1, 2, 3):
├── Agente 1: Perfiles → 160+ perfiles nuevos
├── Agente 2: Búsqueda → Filtrado inteligente
└── Agente 3: Combinaciones → LRFD/ASD

PARALELO SEGUNDO (Agentes 4, 5):
├── Agente 4: Conexiones → Módulo de pernos
└── Agente 5: Offline → Service worker + IndexedDB

FINAL (Agente 6):
└── Agente 6: Pórticos + PDF → Completar funcionalidad
```

---

## 7. CÓMO EJECUTAR LA APP

### Backend
```bash
cd C:\Seba\OpenSees\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd C:\Seba\OpenSees\frontend
npm install
npm run dev
```

### URLs
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Swagger: http://localhost:8000/docs

---

## 8. NOTAS IMPORTANTES

### No romper lo existente
- Los 25 bugs ya fueron corregidos
- El análisis FEM funciona correctamente
- Las verificaciones AISC básicas funcionan

### Fuentes de datos para perfiles
- AISC: https://www.aisc.org/publications/steel-construction-manual-resources/
- Chilenos: Manual CAP de Construcción en Acero

### Dependencias a agregar
```
# Backend (requirements.txt)
reportlab>=4.0.0  # Para PDF

# Frontend (package.json)
"idb": "^7.1.1"  # Para IndexedDB
```

### Testing
Después de cada fase, verificar:
1. `npm run build` sin errores
2. `python -m py_compile` sin errores
3. Endpoints funcionan en Swagger
4. UI funciona en navegador

---

## 9. MÉTRICAS DE ÉXITO FINAL

| Métrica | Antes | Después |
|---------|-------|---------|
| Perfiles | 55 | 250+ |
| Búsqueda de perfiles | Básica | Inteligente con filtros |
| Diseño iterativo | No | Sugiere 5 mejores opciones |
| Combinaciones carga | No | LRFD + ASD |
| Conexiones | No | Pernos verificados |
| Modo offline | No | Completo |
| Exportación | No | PDF profesional |
| Pórticos | 40% | 80%+ |

---

**FIN DEL DOCUMENTO DE CONTEXTO**

*Generado: 2024-12-10*
*Para: Transferencia a IA Manager*
