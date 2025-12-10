"""
Routes para análisis estructural con OpenSeesPy
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal, Dict
from engine.opensees_runner import analyze_beam, analyze_column, analyze_frame
from engine.sections import get_section_by_id
from engine.materials import get_material_by_id
from engine.load_combinations import (
    get_critical_combination,
    calculate_all_combinations,
    apply_combination,
    get_combinations
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== MODELOS DE REQUEST ====================

class PointLoad(BaseModel):
    """Carga puntual"""
    position: float = Field(..., description="Posición desde el inicio [m]")
    Fy: float = Field(0, description="Fuerza vertical [kN] (positivo hacia abajo)")
    Fx: float = Field(0, description="Fuerza horizontal [kN]")
    Mz: float = Field(0, description="Momento [kN·m]")


class DistributedLoad(BaseModel):
    """Carga distribuida"""
    start: float = Field(..., description="Posición inicial [m]")
    end: float = Field(..., description="Posición final [m]")
    w_start: float = Field(..., description="Carga en inicio [kN/m]")
    w_end: Optional[float] = Field(None, description="Carga en fin [kN/m] (si es trapezoidal)")


class BeamAnalysisRequest(BaseModel):
    """Request para análisis de viga"""
    # Geometría
    length: float = Field(..., gt=0, description="Longitud de la viga [m]")

    # Apoyos
    support_left: Literal["fixed", "pinned", "roller", "free"] = Field("pinned")
    support_right: Literal["fixed", "pinned", "roller", "free"] = Field("roller")

    # Sección (perfil)
    section_id: str = Field(..., description="ID del perfil (ej: 'W14X22')")

    # Material
    material_id: str = Field("A572_GR50", description="ID del material")

    # Cargas - Método tradicional (compatibilidad hacia atrás)
    point_loads: List[PointLoad] = Field(default_factory=list)
    distributed_loads: List[DistributedLoad] = Field(default_factory=list)

    # Cargas por tipo (para combinaciones LRFD/ASD)
    load_types: Optional[Dict[str, float]] = Field(
        None,
        description="Cargas distribuidas por tipo {D, L, Lr, S, W, E} en kN/m"
    )

    # Método de diseño
    design_method: Optional[Literal["LRFD", "ASD"]] = Field(
        None,
        description="Método de diseño (LRFD o ASD). Si se especifica, usa load_types"
    )

    # Unidades de salida
    units: Literal["kN-m", "tonf-m", "kgf-cm"] = Field("kN-m")

    # Número de puntos para diagramas
    num_points: int = Field(21, ge=5, le=101)

    @field_validator("section_id")
    @classmethod
    def validate_section_id(cls, v: str) -> str:
        if get_section_by_id(v) is None:
            raise ValueError(f"Sección '{v}' no encontrada en el catálogo")
        return v

    @field_validator("material_id")
    @classmethod
    def validate_material_id(cls, v: str) -> str:
        if get_material_by_id(v) is None:
            raise ValueError(f"Material '{v}' no encontrado en el catálogo")
        return v


class ColumnAnalysisRequest(BaseModel):
    """Request para análisis de columna"""
    # Geometría
    height: float = Field(..., gt=0, description="Altura de la columna [m]")

    # Condiciones de borde
    base: Literal["fixed", "pinned"] = Field("fixed")
    top: Literal["fixed", "pinned", "free"] = Field("free")

    # Sección
    section_id: str = Field(..., description="ID del perfil")

    # Material
    material_id: str = Field("A572_GR50")

    # Cargas - Método tradicional
    axial_load: float = Field(0, description="Carga axial [kN] (positivo = compresión)")
    moment_top: float = Field(0, description="Momento en tope [kN·m]")
    moment_base: float = Field(0, description="Momento en base [kN·m]")

    # Cargas por tipo (para combinaciones LRFD/ASD)
    load_types: Optional[Dict[str, float]] = Field(
        None,
        description="Cargas axiales por tipo {D, L, Lr, S, W, E} en kN"
    )

    # Método de diseño
    design_method: Optional[Literal["LRFD", "ASD"]] = Field(
        None,
        description="Método de diseño (LRFD o ASD)"
    )

    # Unidades
    units: Literal["kN-m", "tonf-m", "kgf-cm"] = Field("kN-m")

    @field_validator("section_id")
    @classmethod
    def validate_section_id(cls, v: str) -> str:
        if get_section_by_id(v) is None:
            raise ValueError(f"Sección '{v}' no encontrada en el catálogo")
        return v

    @field_validator("material_id")
    @classmethod
    def validate_material_id(cls, v: str) -> str:
        if get_material_by_id(v) is None:
            raise ValueError(f"Material '{v}' no encontrado en el catálogo")
        return v


class FrameNode(BaseModel):
    """Nodo del pórtico"""
    id: int
    x: float
    y: float
    support: Optional[Literal["fixed", "pinned", "roller", "free"]] = None


class FrameElement(BaseModel):
    """Elemento del pórtico"""
    id: int
    node_i: int
    node_j: int
    section_id: str
    element_type: Literal["beam", "column", "brace"] = "beam"

    @field_validator("section_id")
    @classmethod
    def validate_section_id(cls, v: str) -> str:
        if get_section_by_id(v) is None:
            raise ValueError(f"Sección '{v}' no encontrada en el catálogo")
        return v


class FrameLoad(BaseModel):
    """Carga en el pórtico"""
    type: Literal["nodal", "distributed", "point"]
    element_id: Optional[int] = None  # Para cargas en elementos
    node_id: Optional[int] = None     # Para cargas nodales
    Fx: float = 0
    Fy: float = 0
    Mz: float = 0
    w: Optional[float] = None         # Para carga distribuida [kN/m]
    position: Optional[float] = None  # Para carga puntual en elemento


class FrameAnalysisRequest(BaseModel):
    """Request para análisis de pórtico 2D"""
    nodes: List[FrameNode]
    elements: List[FrameElement]
    loads: List[FrameLoad]
    material_id: str = Field("A572_GR50")
    units: Literal["kN-m", "tonf-m", "kgf-cm"] = Field("kN-m")
    verify_elements: bool = Field(True, description="Realizar verificación de elementos")

    @field_validator("material_id")
    @classmethod
    def validate_material_id(cls, v: str) -> str:
        if get_material_by_id(v) is None:
            raise ValueError(f"Material '{v}' no encontrado en el catálogo")
        return v


# ==================== ENDPOINTS ====================

@router.post("/beam")
async def analyze_beam_endpoint(request: BeamAnalysisRequest):
    """
    Analizar viga de acero con OpenSeesPy

    Retorna:
    - Reacciones en apoyos
    - Desplazamientos
    - Diagramas de M, V, N
    - Verificaciones AISC
    - Combinaciones de carga (si se especifica design_method)
    """
    try:
        # Si se especifica método de diseño y cargas por tipo, usar combinaciones
        if request.design_method and request.load_types:
            # Calcular todas las combinaciones
            all_combinations = calculate_all_combinations(
                request.load_types,
                request.design_method
            )

            # Obtener combinación crítica
            critical_combo, critical_value = get_critical_combination(
                request.load_types,
                request.design_method
            )

            # Crear carga distribuida con la combinación crítica
            distributed_loads = [
                DistributedLoad(
                    start=0,
                    end=request.length,
                    w_start=critical_value,
                    w_end=None
                )
            ]

            # Ejecutar análisis con carga factorizada
            result = analyze_beam(
                length=request.length,
                support_left=request.support_left,
                support_right=request.support_right,
                section_id=request.section_id,
                material_id=request.material_id,
                point_loads=request.point_loads,
                distributed_loads=distributed_loads,
                units=request.units,
                num_points=request.num_points
            )

            # Agregar información de combinaciones al resultado
            result["load_combinations"] = {
                "method": request.design_method,
                "unfactored_loads": request.load_types,
                "critical_combination": {
                    "name": critical_combo["name"],
                    "description": critical_combo["description"],
                    "factored_load": critical_value,
                    "factors": critical_combo["factors"]
                },
                "all_combinations": all_combinations[:5]  # Top 5
            }
        else:
            # Método tradicional (compatibilidad hacia atrás)
            result = analyze_beam(
                length=request.length,
                support_left=request.support_left,
                support_right=request.support_right,
                section_id=request.section_id,
                material_id=request.material_id,
                point_loads=request.point_loads,
                distributed_loads=request.distributed_loads,
                units=request.units,
                num_points=request.num_points
            )

        return result
    except Exception as e:
        logger.error(f"Error en análisis de viga: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error en análisis: {str(e)}")


@router.post("/column")
async def analyze_column_endpoint(request: ColumnAnalysisRequest):
    """
    Analizar columna de acero con OpenSeesPy

    Retorna:
    - Carga crítica de pandeo
    - Factor de utilización
    - Verificaciones AISC
    - Combinaciones de carga (si se especifica design_method)
    """
    try:
        # Determinar carga axial a usar
        axial_load = request.axial_load

        # Si se especifica método de diseño y cargas por tipo, usar combinaciones
        if request.design_method and request.load_types:
            # Calcular todas las combinaciones
            all_combinations = calculate_all_combinations(
                request.load_types,
                request.design_method
            )

            # Obtener combinación crítica
            critical_combo, critical_value = get_critical_combination(
                request.load_types,
                request.design_method
            )

            # Usar carga factorizada
            axial_load = critical_value

        # Ejecutar análisis
        result = analyze_column(
            height=request.height,
            base=request.base,
            top=request.top,
            section_id=request.section_id,
            material_id=request.material_id,
            axial_load=axial_load,
            moment_top=request.moment_top,
            moment_base=request.moment_base,
            units=request.units
        )

        # Agregar información de combinaciones si aplica
        if request.design_method and request.load_types:
            result["load_combinations"] = {
                "method": request.design_method,
                "unfactored_loads": request.load_types,
                "critical_combination": {
                    "name": critical_combo["name"],
                    "description": critical_combo["description"],
                    "factored_load": critical_value,
                    "factors": critical_combo["factors"]
                },
                "all_combinations": all_combinations[:5]  # Top 5
            }

        return result
    except Exception as e:
        logger.error(f"Error en análisis de columna: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error en análisis: {str(e)}")


@router.get("/load-combinations/{method}")
async def get_load_combinations_endpoint(method: Literal["LRFD", "ASD"]):
    """
    Obtener las combinaciones de carga disponibles para un método

    Args:
        method: Método de diseño (LRFD o ASD)

    Returns:
        Lista de combinaciones con nombre, descripción y factores
    """
    try:
        combinations = get_combinations(method)
        return {
            "method": method,
            "combinations": combinations
        }
    except Exception as e:
        logger.error(f"Error al obtener combinaciones: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/frame")
async def analyze_frame_endpoint(request: FrameAnalysisRequest):
    """
    Analizar pórtico 2D con OpenSeesPy

    Retorna:
    - Reacciones
    - Desplazamientos nodales
    - Fuerzas en elementos
    - Verificaciones por elemento (si verify_elements=True)
    """
    try:
        # Ejecutar análisis estructural
        result = analyze_frame(
            nodes=request.nodes,
            elements=request.elements,
            loads=request.loads,
            material_id=request.material_id,
            units=request.units
        )

        # Si se solicita verificación de elementos
        if request.verify_elements and result.get("status") == "success":
            from engine.frame_verification import verify_frame_elements
            from engine.materials import get_material_properties

            # Obtener propiedades del material
            material = get_material_properties(request.material_id)

            # Verificar elementos
            element_forces = result.get("element_forces", {})
            verifications = verify_frame_elements(
                elements=request.elements,
                element_forces=element_forces,
                sections={},  # No se usa, se obtiene internamente
                material=material,
                nodes=request.nodes,
                units=request.units
            )

            # Agregar verificaciones al resultado
            result["element_verifications"] = verifications

            # Agregar resumen de verificación
            all_ok = all(v.get("overall_ok", False) for v in verifications)
            max_ratio = max((v.get("max_ratio", 0) for v in verifications), default=0)

            result["verification_summary"] = {
                "all_ok": all_ok,
                "max_ratio": round(max_ratio, 3),
                "max_utilization": round(max_ratio * 100, 1),
                "total_elements": len(verifications),
                "passed_elements": sum(1 for v in verifications if v.get("overall_ok", False)),
                "failed_elements": sum(1 for v in verifications if not v.get("overall_ok", False))
            }

        return result
    except Exception as e:
        logger.error(f"Error en análisis de pórtico: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error en análisis: {str(e)}")
