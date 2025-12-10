"""
Routes para consultar secciones/perfiles de acero
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Literal
from engine.sections import get_all_sections, get_section_by_id, search_sections, SECTION_TYPES
from engine.design import filter_sections_advanced, suggest_beam_sections, compare_sections

router = APIRouter()


@router.get("/")
async def list_sections(
    section_type: Optional[Literal["W", "HSS_RECT", "HSS_ROUND", "C", "L", "WT"]] = None,
    catalog: Optional[Literal["AISC", "CHILEAN"]] = None,
    limit: int = Query(50, le=200)
):
    """
    Listar todos los perfiles disponibles
    
    Filtros opcionales:
    - section_type: Tipo de perfil (W, HSS_RECT, HSS_ROUND, C, L, WT)
    - catalog: Catálogo (AISC o CHILEAN)
    """
    sections = get_all_sections(section_type=section_type, catalog=catalog, limit=limit)
    return {
        "count": len(sections),
        "sections": sections
    }


@router.get("/types")
async def list_section_types():
    """Listar tipos de secciones disponibles"""
    return {
        "types": SECTION_TYPES
    }


@router.get("/search")
async def search_sections_endpoint(
    query: str = Query(..., min_length=1, description="Término de búsqueda (ej: 'W14', 'HSS6')"),
    catalog: Optional[Literal["AISC", "CHILEAN"]] = None
):
    """
    Buscar perfiles por nombre
    
    Ejemplos:
    - 'W14' -> todos los perfiles W14
    - 'HSS6x6' -> perfiles HSS 6x6
    """
    results = search_sections(query, catalog)
    return {
        "query": query,
        "count": len(results),
        "sections": results
    }


@router.get("/{section_id}")
async def get_section(section_id: str):
    """
    Obtener propiedades de un perfil específico

    Retorna todas las propiedades geométricas:
    - A: Área
    - Ix, Iy: Momentos de inercia
    - Sx, Sy: Módulos de sección
    - Zx, Zy: Módulos plásticos
    - rx, ry: Radios de giro
    - d, bf, tf, tw: Dimensiones
    """
    section = get_section_by_id(section_id)
    if not section:
        raise HTTPException(status_code=404, detail=f"Perfil '{section_id}' no encontrado")
    return section


@router.get("/advanced/search")
async def advanced_search(
    section_type: Optional[Literal["W", "HSS_RECT", "HSS_ROUND", "C", "L", "WT"]] = None,
    catalog: Optional[Literal["AISC", "CHILEAN"]] = None,
    d_min: Optional[float] = Query(None, description="Altura mínima [mm]"),
    d_max: Optional[float] = Query(None, description="Altura máxima [mm]"),
    weight_min: Optional[float] = Query(None, description="Peso mínimo [kg/m]"),
    weight_max: Optional[float] = Query(None, description="Peso máximo [kg/m]"),
    Ix_min: Optional[float] = Query(None, description="Inercia X mínima [mm⁴]"),
    Iy_min: Optional[float] = Query(None, description="Inercia Y mínima [mm⁴]"),
    Zx_min: Optional[float] = Query(None, description="Módulo plástico X mínimo [mm³]"),
    rx_min: Optional[float] = Query(None, description="Radio de giro X mínimo [mm]"),
    ry_min: Optional[float] = Query(None, description="Radio de giro Y mínimo [mm]"),
    limit: int = Query(50, le=200)
):
    """
    Búsqueda avanzada de perfiles con múltiples filtros

    Ejemplos:
    - `/api/sections/advanced/search?min_Ix=50e6&max_weight=50`
    - `/api/sections/advanced/search?type=W&min_d=300&max_d=400`
    - `/api/sections/advanced/search?catalog=AISC&min_Zx=500e3`

    Filtros disponibles:
    - Por tipo (W, HSS, C, L)
    - Por catálogo (AISC, CHILEAN)
    - Por altura (d_min, d_max) en mm
    - Por peso (weight_min, weight_max) en kg/m
    - Por inercia (Ix_min, Iy_min) en mm⁴
    - Por módulo plástico (Zx_min) en mm³
    - Por radio de giro (rx_min, ry_min) en mm
    """

    results = filter_sections_advanced(
        section_type=section_type,
        catalog=catalog,
        d_min=d_min,
        d_max=d_max,
        weight_min=weight_min,
        weight_max=weight_max,
        Ix_min=Ix_min,
        Iy_min=Iy_min,
        Zx_min=Zx_min,
        rx_min=rx_min,
        ry_min=ry_min,
        limit=limit
    )

    return {
        "count": len(results),
        "filters": {
            "section_type": section_type,
            "catalog": catalog,
            "d_range": [d_min, d_max],
            "weight_range": [weight_min, weight_max],
            "Ix_min": Ix_min,
            "Iy_min": Iy_min,
            "Zx_min": Zx_min,
            "rx_min": rx_min,
            "ry_min": ry_min
        },
        "sections": results
    }


@router.get("/advanced/recommend")
async def recommend_sections(
    Mu: float = Query(..., description="Momento último requerido [kN·m]"),
    Vu: Optional[float] = Query(None, description="Corte último requerido [kN]"),
    L: float = Query(6.0, description="Longitud de la viga [m]"),
    material_id: str = Query("A572_GR50", description="Material (A36, A572_GR50, A992, etc)"),
    units: Literal["kN-m", "tonf-m", "kgf-cm"] = Query("kN-m", description="Sistema de unidades"),
    section_type: Optional[Literal["W", "HSS_RECT", "HSS_ROUND", "C", "L"]] = Query("W", description="Tipo de perfil"),
    catalog: Optional[Literal["AISC", "CHILEAN"]] = Query(None, description="Catálogo"),
    num_suggestions: int = Query(5, le=10, description="Número de sugerencias"),
    target_util_min: float = Query(0.7, description="Utilización mínima objetivo"),
    target_util_max: float = Query(0.95, description="Utilización máxima objetivo"),
    Lb: Optional[float] = Query(None, description="Longitud no arriostrada [m]"),
    Cb: float = Query(1.0, description="Factor de momento")
):
    """
    Recomendar perfiles óptimos para condiciones de carga dadas

    Ejemplos:
    - `/api/sections/advanced/recommend?Mu=500&units=kN-m`
    - `/api/sections/advanced/recommend?Mu=200&Vu=150&L=8&material_id=A992`
    - `/api/sections/advanced/recommend?Mu=300&section_type=W&catalog=AISC`

    Criterios de selección:
    1. Cumple capacidad (φMn ≥ Mu)
    2. Utilización entre target_util_min y target_util_max
    3. Menor peso (eficiencia estructural)

    Retorna perfiles ordenados por score de eficiencia
    """

    try:
        suggestions = suggest_beam_sections(
            Mu_required=Mu,
            Vu_required=Vu,
            L=L,
            material_id=material_id,
            units=units,
            num_suggestions=num_suggestions,
            section_type=section_type,
            catalog=catalog,
            target_utilization=(target_util_min, target_util_max),
            Lb=Lb,
            Cb=Cb
        )

        return {
            "count": len(suggestions),
            "criteria": {
                "Mu_required": Mu,
                "Vu_required": Vu,
                "L": L,
                "material": material_id,
                "target_utilization": [target_util_min, target_util_max]
            },
            "suggestions": suggestions
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al generar recomendaciones: {str(e)}")


@router.post("/advanced/compare")
async def compare_multiple_sections(
    section_ids: List[str],
    Mu: float = Query(..., description="Momento último [kN·m]"),
    Vu: float = Query(..., description="Corte último [kN]"),
    L: float = Query(6.0, description="Longitud [m]"),
    material_id: str = Query("A572_GR50", description="Material"),
    units: Literal["kN-m", "tonf-m", "kgf-cm"] = Query("kN-m", description="Sistema de unidades")
):
    """
    Comparar múltiples perfiles para las mismas condiciones de carga

    Body: Lista de section_ids a comparar

    Ejemplo:
    ```
    POST /api/sections/advanced/compare?Mu=300&Vu=150&L=6
    ["W310X39", "W360X44", "W410X54"]
    ```

    Retorna comparación lado a lado con verificaciones completas
    """

    if not section_ids or len(section_ids) == 0:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos un section_id")

    if len(section_ids) > 10:
        raise HTTPException(status_code=400, detail="Máximo 10 secciones para comparar")

    try:
        comparisons = compare_sections(
            section_ids=section_ids,
            Mu=Mu,
            Vu=Vu,
            L=L,
            material_id=material_id,
            units=units
        )

        return {
            "count": len(comparisons),
            "conditions": {
                "Mu": Mu,
                "Vu": Vu,
                "L": L,
                "material": material_id,
                "units": units
            },
            "comparisons": comparisons
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al comparar secciones: {str(e)}")
