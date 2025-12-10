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
# CORS: Permitir todos los orígenes en producción (API pública)
# Para mayor seguridad, usar ALLOWED_ORIGINS env var con dominios específicos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite todos los orígenes
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
