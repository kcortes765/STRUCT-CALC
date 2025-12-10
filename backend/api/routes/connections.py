"""
Routes para verificacion de conexiones con pernos
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from engine.connections import (
    verify_bolt_shear,
    verify_bolt_tension,
    verify_bolt_combined,
    verify_bolt_bearing,
    verify_block_shear,
    get_available_bolt_grades,
    get_available_bolt_diameters
)

router = APIRouter()


# Request Models
class BoltShearRequest(BaseModel):
    bolt_grade: str = Field(..., description="Grado del perno (A325, A490, 8.8, 10.9)")
    diameter: str = Field(..., description="Diametro nominal (M12, M16, 3/4\", etc)")
    num_bolts: int = Field(..., ge=1, description="Numero de pernos")
    Vu: float = Field(..., description="Fuerza de corte demandada [kN]")
    shear_planes: int = Field(1, ge=1, le=2, description="Numero de planos de corte")


class BoltTensionRequest(BaseModel):
    bolt_grade: str = Field(..., description="Grado del perno")
    diameter: str = Field(..., description="Diametro nominal")
    num_bolts: int = Field(..., ge=1, description="Numero de pernos")
    Tu: float = Field(..., description="Fuerza de tension demandada [kN]")


class BoltCombinedRequest(BaseModel):
    bolt_grade: str = Field(..., description="Grado del perno")
    diameter: str = Field(..., description="Diametro nominal")
    num_bolts: int = Field(..., ge=1, description="Numero de pernos")
    Vu: float = Field(..., description="Fuerza de corte [kN]")
    Tu: float = Field(..., description="Fuerza de tension [kN]")
    shear_planes: int = Field(1, ge=1, le=2, description="Numero de planos de corte")


class BoltBearingRequest(BaseModel):
    t_plate: float = Field(..., gt=0, description="Espesor de placa [mm]")
    Fu_plate: float = Field(..., gt=0, description="Tension ultima de placa [MPa]")
    diameter: str = Field(..., description="Diametro nominal del perno")
    num_bolts: int = Field(..., ge=1, description="Numero de pernos")
    Vu: float = Field(..., description="Fuerza de corte [kN]")
    edge_dist: float = Field(..., gt=0, description="Distancia al borde [mm]")
    spacing: float = Field(..., gt=0, description="Espaciamiento entre pernos [mm]")
    hole_type: Literal["STD", "OVS", "SLOTTED"] = Field("STD", description="Tipo de agujero")


class BlockShearRequest(BaseModel):
    Agv: float = Field(..., gt=0, description="Area bruta a corte [mm2]")
    Anv: float = Field(..., gt=0, description="Area neta a corte [mm2]")
    Ant: float = Field(..., gt=0, description="Area neta a tension [mm2]")
    Fy: float = Field(..., gt=0, description="Tension de fluencia [MPa]")
    Fu: float = Field(..., gt=0, description="Tension ultima [MPa]")
    Ubs: float = Field(1.0, ge=0.5, le=1.0, description="Factor de reduccion (0.5 o 1.0)")


# Endpoints
@router.post("/bolts/shear")
async def verify_shear(request: BoltShearRequest):
    """Verificar pernos a corte segun AISC J3.6"""
    try:
        result = verify_bolt_shear(
            bolt_grade=request.bolt_grade,
            diameter=request.diameter,
            num_bolts=request.num_bolts,
            Vu=request.Vu,
            shear_planes=request.shear_planes
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en verificacion: {str(e)}")


@router.post("/bolts/tension")
async def verify_tension(request: BoltTensionRequest):
    """Verificar pernos a tension segun AISC J3.6"""
    try:
        result = verify_bolt_tension(
            bolt_grade=request.bolt_grade,
            diameter=request.diameter,
            num_bolts=request.num_bolts,
            Tu=request.Tu
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en verificacion: {str(e)}")


@router.post("/bolts/combined")
async def verify_combined(request: BoltCombinedRequest):
    """Verificar pernos a tension + corte combinado segun AISC J3.7"""
    try:
        result = verify_bolt_combined(
            bolt_grade=request.bolt_grade,
            diameter=request.diameter,
            num_bolts=request.num_bolts,
            Vu=request.Vu,
            Tu=request.Tu,
            shear_planes=request.shear_planes
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en verificacion: {str(e)}")


@router.post("/bolts/bearing")
async def verify_bearing(request: BoltBearingRequest):
    """Verificar aplastamiento en placa segun AISC J3.10"""
    try:
        result = verify_bolt_bearing(
            t_plate=request.t_plate,
            Fu_plate=request.Fu_plate,
            diameter=request.diameter,
            num_bolts=request.num_bolts,
            Vu=request.Vu,
            edge_dist=request.edge_dist,
            spacing=request.spacing,
            hole_type=request.hole_type
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en verificacion: {str(e)}")


@router.post("/block-shear")
async def verify_block_shear_endpoint(request: BlockShearRequest):
    """Verificar bloque de corte segun AISC J4.3"""
    try:
        result = verify_block_shear(
            Agv=request.Agv,
            Anv=request.Anv,
            Ant=request.Ant,
            Fy=request.Fy,
            Fu=request.Fu,
            Ubs=request.Ubs
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en verificacion: {str(e)}")


@router.get("/bolts/grades")
async def list_bolt_grades():
    """Listar grados de pernos disponibles con sus propiedades"""
    return {
        "count": len(get_available_bolt_grades()),
        "grades": get_available_bolt_grades()
    }


@router.get("/bolts/diameters")
async def list_bolt_diameters():
    """Listar diametros de pernos disponibles con sus propiedades"""
    return {
        "count": len(get_available_bolt_diameters()),
        "diameters": get_available_bolt_diameters()
    }
