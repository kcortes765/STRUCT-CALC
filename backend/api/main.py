"""
STRUCT-CALC ACERO - API Principal
FastAPI backend para cálculo de estructuras de acero con OpenSeesPy
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Cargar variables de entorno
load_dotenv()

# Importar routers
from api.routes import analysis, sections, materials, connections, reports

# Crear app
app = FastAPI(
    title="STRUCT-CALC ACERO API",
    description="API para cálculo de estructuras de acero industriales usando OpenSeesPy",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configurar CORS para permitir requests desde orígenes específicos
# Usar variable de entorno ALLOWED_ORIGINS para dominios adicionales (separados por comas)
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
]

# Agregar orígenes adicionales desde variable de entorno
env_origins = os.getenv("ALLOWED_ORIGINS", "")
if env_origins:
    allowed_origins.extend([origin.strip() for origin in env_origins.split(",")])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "STRUCT-CALC ACERO API",
        "version": "1.0.0",
        "engine": "OpenSeesPy"
    }


@app.get("/health")
async def health_check():
    """Verificar que OpenSeesPy está funcionando"""
    try:
        import openseespy.opensees as ops
        ops.wipe()
        ops.model('basic', '-ndm', 2, '-ndf', 3)
        ops.wipe()
        return {"status": "healthy", "opensees": "operational"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# Registrar routers
app.include_router(analysis.router, prefix="/api/analysis", tags=["Análisis"])
app.include_router(sections.router, prefix="/api/sections", tags=["Secciones"])
app.include_router(materials.router, prefix="/api/materials", tags=["Materiales"])
app.include_router(connections.router, prefix="/api/connections", tags=["Conexiones"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reportes"])
