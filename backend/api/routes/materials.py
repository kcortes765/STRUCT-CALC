"""
Routes para consultar materiales de acero
"""

from fastapi import APIRouter, HTTPException
from typing import Optional, Literal
from engine.materials import get_all_materials, get_material_by_id, STEEL_GRADES

router = APIRouter()


@router.get("/")
async def list_materials():
    """
    Listar todos los materiales de acero disponibles
    
    Incluye propiedades:
    - Fy: Tensión de fluencia [MPa]
    - Fu: Tensión última [MPa]
    - E: Módulo de elasticidad [MPa]
    - G: Módulo de corte [MPa]
    - nu: Coeficiente de Poisson
    - rho: Densidad [kg/m³]
    """
    materials = get_all_materials()
    return {
        "count": len(materials),
        "materials": materials
    }


@router.get("/grades")
async def list_steel_grades():
    """Listar grados de acero disponibles"""
    return {
        "grades": list(STEEL_GRADES.keys()),
        "description": {
            "A36": "Acero estructural carbono (Fy=250 MPa)",
            "A572_GR50": "Acero alta resistencia baja aleación (Fy=345 MPa)",
            "A992": "Acero para perfiles W (Fy=345 MPa)",
            "A500_GR_B": "Acero para tubos estructurales (Fy=290 MPa)",
            "A500_GR_C": "Acero para tubos estructurales (Fy=317 MPa)",
        }
    }


@router.get("/{material_id}")
async def get_material(material_id: str):
    """
    Obtener propiedades de un material específico
    """
    material = get_material_by_id(material_id)
    if not material:
        raise HTTPException(status_code=404, detail=f"Material '{material_id}' no encontrado")
    return material
