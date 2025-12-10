"""
Verificaciones AISC 360 para elementos de acero
"""

from typing import Dict, Any
import math
from .materials import get_material_properties
from .sections import get_section_properties, get_section_by_id


def verify_beam_aisc(
    Mu: float,
    Vu: float,
    L: float,
    delta_max: float,
    section_id: str,
    material_id: str,
    units: str = "kN-m",
    Lb: float = None,  # Longitud no arriostrada (si None = L)
    Cb: float = 1.0    # Factor de momento
) -> Dict[str, Any]:
    """
    Verificar viga según AISC 360 Capítulo F y G
    
    Args:
        Mu: Momento último demandado [kN·m]
        Vu: Corte último demandado [kN]
        L: Longitud de la viga [m]
        delta_max: Deflexión máxima [m]
        section_id: ID del perfil
        material_id: ID del material
        units: Sistema de unidades
        Lb: Longitud no arriostrada lateral [m]
        Cb: Factor de modificación por gradiente de momento
    
    Returns:
        Diccionario con resultados de verificación
    """
    
    # Obtener propiedades
    mat = get_material_properties(material_id)
    sec = get_section_properties(section_id)
    sec_info = get_section_by_id(section_id)
    
    Fy = mat["Fy"]  # MPa
    E = mat["E"]    # MPa
    
    # Propiedades de sección en unidades consistentes
    Zx = sec["Zx"] * 1e9  # m³ -> mm³
    Sx = sec["Sx"] * 1e9  # m³ -> mm³
    ry = sec.get("ry", sec.get("rx", 0)) * 1e3  # m -> mm, usar rx como fallback
    d = sec["d"] * 1e3    # m -> mm
    
    # Momento plástico
    Mp = Fy * Zx / 1e6  # kN·m
    
    # Longitud no arriostrada
    if Lb is None:
        Lb = L
    Lb_mm = Lb * 1000  # m -> mm
    
    # Longitudes límite (simplificado para perfiles compactos)
    Lp = 1.76 * ry * math.sqrt(E / Fy)  # mm
    
    # Lr aproximado para perfiles I
    if sec_info and sec_info.get("type") == "W":
        # Aproximación conservadora
        Lr = 3.5 * ry * math.sqrt(E / Fy)  # mm
    else:
        Lr = 2.5 * ry * math.sqrt(E / Fy)  # mm
    
    # Capacidad a flexión según zona
    phi_b = 0.90
    
    if Lb_mm <= Lp:
        # Zona plástica
        Mn = Mp
        zone = "plastic"
    elif Lb_mm <= Lr:
        # Zona inelástica
        Mr = 0.7 * Fy * Sx / 1e6  # kN·m
        Mn = Cb * (Mp - (Mp - Mr) * (Lb_mm - Lp) / (Lr - Lp))
        Mn = min(Mn, Mp)
        zone = "inelastic"
    else:
        # Zona elástica (pandeo lateral-torsional)
        Fe = Cb * math.pi**2 * E / (Lb_mm / ry)**2  # MPa
        Mn = Fe * Sx / 1e6  # kN·m
        Mn = min(Mn, Mp)
        zone = "elastic_LTB"
    
    phi_Mn = phi_b * Mn

    # Verificación a flexión
    ratio_moment = abs(Mu) / phi_Mn if phi_Mn > 0 else 9999.0
    flex_ok = ratio_moment <= 1.0
    
    # Capacidad a corte (AISC G2)
    phi_v = 0.90
    
    # Área de corte aproximada
    if sec_info and sec_info.get("type") == "W":
        tf = sec_info.get("tf", 10)  # mm
        tw = sec_info.get("tw", 6)   # mm
        Aw = d * tw  # mm²
    else:
        A = sec["A"] * 1e6  # m² -> mm²
        Aw = 0.6 * A  # Aproximación
    
    # Cv1 = 1.0 para la mayoría de perfiles laminados
    Cv1 = 1.0
    Vn = 0.6 * Fy * Aw * Cv1 / 1e3  # kN
    phi_Vn = phi_v * Vn

    # Verificación a corte
    ratio_shear = abs(Vu) / phi_Vn if phi_Vn > 0 else 9999.0
    shear_ok = ratio_shear <= 1.0
    
    # Verificación de deflexión
    L_mm = L * 1000
    delta_limit_L180 = L_mm / 180  # mm (carga viva servicio)
    delta_limit_L240 = L_mm / 240  # mm
    delta_limit_L360 = L_mm / 360  # mm
    delta_max_mm = abs(delta_max) * 1000  # m -> mm
    
    deflection_checks = {
        "L/180": {
            "limit": delta_limit_L180,
            "actual": delta_max_mm,
            "ok": delta_max_mm <= delta_limit_L180
        },
        "L/240": {
            "limit": delta_limit_L240,
            "actual": delta_max_mm,
            "ok": delta_max_mm <= delta_limit_L240
        },
        "L/360": {
            "limit": delta_limit_L360,
            "actual": delta_max_mm,
            "ok": delta_max_mm <= delta_limit_L360
        }
    }
    
    return {
        "flexure": {
            "Mu": Mu,
            "phi_Mn": phi_Mn,
            "Mp": Mp,
            "ratio": round(ratio_moment, 3),
            "utilization": round(ratio_moment * 100, 1),
            "ok": flex_ok,
            "zone": zone,
            "Lb": Lb,
            "Lp": Lp / 1000,  # mm -> m
            "Lr": Lr / 1000   # mm -> m
        },
        "shear": {
            "Vu": Vu,
            "phi_Vn": phi_Vn,
            "ratio": round(ratio_shear, 3),
            "utilization": round(ratio_shear * 100, 1),
            "ok": shear_ok
        },
        "deflection": deflection_checks,
        "overall_ok": flex_ok and shear_ok,
        "governing": "flexure" if ratio_moment > ratio_shear else "shear"
    }


def verify_column_aisc(
    Pu: float,
    Mu_top: float,
    Mu_base: float,
    L: float,
    K: float,
    section_id: str,
    material_id: str,
    units: str = "kN-m"
) -> Dict[str, Any]:
    """
    Verificar columna según AISC 360 Capítulo E y H
    
    Args:
        Pu: Carga axial última [kN] (positivo = compresión)
        Mu_top: Momento en tope [kN·m]
        Mu_base: Momento en base [kN·m]
        L: Altura de la columna [m]
        K: Factor de longitud efectiva
        section_id: ID del perfil
        material_id: ID del material
        units: Sistema de unidades
    
    Returns:
        Diccionario con resultados de verificación
    """
    
    mat = get_material_properties(material_id)
    sec = get_section_properties(section_id)
    sec_info = get_section_by_id(section_id)
    
    Fy = mat["Fy"]  # MPa
    E = mat["E"]    # MPa
    
    A = sec["A"] * 1e6       # m² -> mm²
    Zx = sec["Zx"] * 1e9     # m³ -> mm³
    rx = sec["rx"] * 1e3     # m -> mm
    ry = sec["ry"] * 1e3     # m -> mm
    
    # Longitud efectiva
    KL = K * L * 1000  # mm
    
    # Esbeltez (usar el eje menor)
    r_min = min(rx, ry)
    lambda_c = KL / r_min
    
    # Esbeltez límite
    lambda_limit = 4.71 * math.sqrt(E / Fy)
    
    # Tensión de Euler
    Fe = math.pi**2 * E / lambda_c**2  # MPa
    
    # Tensión crítica de pandeo (AISC E3)
    if lambda_c <= lambda_limit:
        # Pandeo inelástico
        Fcr = (0.658 ** (Fy / Fe)) * Fy
    else:
        # Pandeo elástico
        Fcr = 0.877 * Fe
    
    # Capacidad a compresión
    phi_c = 0.90
    Pn = Fcr * A / 1e3  # kN
    phi_Pn = phi_c * Pn

    # Verificación a compresión pura
    ratio_axial = abs(Pu) / phi_Pn if phi_Pn > 0 else 9999.0
    compression_ok = ratio_axial <= 1.0
    
    # Capacidad a flexión (simplificada)
    phi_b = 0.90
    Mp = Fy * Zx / 1e6  # kN·m
    phi_Mn = phi_b * Mp  # Conservador: asumir arriostrado
    
    Mu = max(abs(Mu_top), abs(Mu_base))
    ratio_moment = Mu / phi_Mn if phi_Mn > 0 else 0
    
    # Interacción flexo-compresión (AISC H1)
    Pr_Pc = ratio_axial
    Mr_Mc = ratio_moment
    
    if Pr_Pc >= 0.2:
        # Ecuación H1-1a
        interaction = Pr_Pc + (8/9) * Mr_Mc
    else:
        # Ecuación H1-1b
        interaction = Pr_Pc / 2 + Mr_Mc
    
    interaction_ok = interaction <= 1.0
    
    return {
        "compression": {
            "Pu": Pu,
            "phi_Pn": phi_Pn,
            "Pn": Pn,
            "Fcr": Fcr,
            "Fe": Fe,
            "ratio": round(ratio_axial, 3),
            "utilization": round(ratio_axial * 100, 1),
            "ok": compression_ok
        },
        "slenderness": {
            "KL_r": round(lambda_c, 1),
            "limit": round(lambda_limit, 1),
            "governing_axis": "y" if ry < rx else "x"
        },
        "flexure": {
            "Mu": Mu,
            "phi_Mn": phi_Mn,
            "ratio": round(ratio_moment, 3),
            "utilization": round(ratio_moment * 100, 1)
        },
        "interaction": {
            "equation": "H1-1a" if Pr_Pc >= 0.2 else "H1-1b",
            "Pr_Pc": round(Pr_Pc, 3),
            "Mr_Mc": round(Mr_Mc, 3),
            "value": round(interaction, 3),
            "utilization": round(interaction * 100, 1),
            "ok": interaction_ok
        },
        "overall_ok": interaction_ok,
        "governing": "interaction"
    }
