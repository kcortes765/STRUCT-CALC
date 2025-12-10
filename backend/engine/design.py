"""
Modulo de diseño iterativo y sugerencia de perfiles
Ayuda al ingeniero a seleccionar el perfil optimo para una condicion dada
"""

from typing import List, Dict, Any, Optional
import math
from .sections import get_all_sections, get_section_by_id, get_section_properties
from .materials import get_material_properties
from .verification import verify_beam_aisc


def suggest_beam_sections(
    Mu_required: float,
    Vu_required: Optional[float] = None,
    L: float = 6.0,
    material_id: str = "A572_GR50",
    units: str = "kN-m",
    num_suggestions: int = 5,
    section_type: Optional[str] = "W",
    catalog: Optional[str] = None,
    target_utilization: tuple = (0.7, 0.95),
    Lb: Optional[float] = None,
    Cb: float = 1.0
) -> List[Dict[str, Any]]:
    """
    Sugerir los mejores perfiles para una viga basado en momento requerido

    Criterios de seleccion:
    1. Cumple capacidad (phi*Mn >= Mu)
    2. Utilizacion entre target_utilization[0] y target_utilization[1]
    3. Menor peso (eficiencia estructural)

    Args:
        Mu_required: Momento ultimo requerido [kN·m]
        Vu_required: Corte ultimo requerido [kN] (opcional)
        L: Longitud de la viga [m]
        material_id: ID del material
        units: Sistema de unidades
        num_suggestions: Numero de sugerencias a retornar
        section_type: Tipo de perfil (W, HSS_RECT, C, etc)
        catalog: Catalogo (AISC o CHILEAN)
        target_utilization: Rango de utilizacion objetivo (min, max)
        Lb: Longitud no arriostrada [m]
        Cb: Factor de momento

    Returns:
        Lista de perfiles sugeridos ordenados por eficiencia
    """

    # Obtener todas las secciones disponibles del tipo especificado
    all_sections = get_all_sections(
        section_type=section_type,
        catalog=catalog,
        limit=200
    )

    if not all_sections:
        return []

    # Obtener propiedades del material
    mat = get_material_properties(material_id)
    Fy = mat["Fy"]  # MPa

    # Si no se proporciona Vu, estimarlo como 0 para solo verificar flexion
    if Vu_required is None:
        Vu_required = 0.0

    # Estimacion conservadora de deflexion (se calculara exactamente despues)
    # Asumimos carga uniforme: delta_max ≈ 5*w*L^4/(384*E*I)

    candidates = []

    for section in all_sections:
        section_id = section["id"]
        weight = section.get("weight", 0)

        try:
            # Obtener propiedades de seccion
            sec_props = get_section_properties(section_id)

            # Calcular capacidad a flexion (simplificada para screening inicial)
            Zx = sec_props["Zx"] * 1e9  # m³ -> mm³
            Mp = Fy * Zx / 1e6  # kN·m

            # Factor de reduccion conservador
            phi_b = 0.90

            # Considerar longitud no arriostrada si se proporciona
            if Lb is None:
                Lb_use = L
            else:
                Lb_use = Lb

            ry = sec_props["ry"] * 1e3  # m -> mm
            E = mat["E"]  # MPa
            Lp = 1.76 * ry * math.sqrt(E / Fy)  # mm
            Lb_mm = Lb_use * 1000

            # Estimacion rapida de capacidad
            if Lb_mm <= Lp:
                # Zona plastica
                phi_Mn = phi_b * Mp
            else:
                # Zona inelastica/elastica - usar factor conservador
                reduction = max(0.6, 1.0 - 0.3 * (Lb_mm - Lp) / Lp)
                phi_Mn = phi_b * Mp * reduction

            # Verificar que cumpla con capacidad
            if phi_Mn < Mu_required:
                continue

            # Calcular ratio de utilizacion
            utilization_ratio = Mu_required / phi_Mn if phi_Mn > 0 else 9999

            # Verificar corte si se proporciono
            if Vu_required > 0:
                # Estimacion rapida de capacidad a corte
                d = sec_props["d"] * 1e3  # m -> mm

                if section.get("type") == "W":
                    tw = section.get("tw", 6)  # mm
                    Aw = d * tw  # mm²
                else:
                    A = sec_props["A"] * 1e6  # m² -> mm²
                    Aw = 0.6 * A

                phi_v = 0.90
                Vn = 0.6 * Fy * Aw * 1.0 / 1e3  # kN
                phi_Vn = phi_v * Vn

                if phi_Vn < Vu_required:
                    continue

                shear_ratio = Vu_required / phi_Vn if phi_Vn > 0 else 9999
            else:
                shear_ratio = 0

            # Calcular score de eficiencia
            # Preferir utilizacion cercana al rango objetivo
            target_mid = (target_utilization[0] + target_utilization[1]) / 2
            utilization_score = 1.0 - abs(utilization_ratio - target_mid)

            # Penalizar por peso (menos peso = mejor)
            # Normalizar peso: asumir rango 10-150 kg/m
            weight_score = 1.0 - min(weight / 150.0, 1.0)

            # Score combinado (70% utilizacion, 30% peso)
            efficiency_score = 0.7 * utilization_score + 0.3 * weight_score

            candidates.append({
                "section_id": section_id,
                "section_type": section.get("type"),
                "catalog": section.get("catalog"),
                "weight": weight,
                "phi_Mn": phi_Mn,
                "Mp": Mp,
                "utilization_flexure": utilization_ratio,
                "utilization_shear": shear_ratio,
                "efficiency_score": efficiency_score,
                "meets_criteria": (
                    target_utilization[0] <= utilization_ratio <= target_utilization[1]
                ),
                "properties": {
                    "d": section.get("d", section.get("H", section.get("OD", 0))),
                    "bf": section.get("bf", section.get("B", 0)),
                    "A": section.get("A"),
                    "Ix": section.get("Ix", section.get("I")),
                    "Zx": section.get("Zx", section.get("Z")),
                }
            })

        except Exception as e:
            # Skip sections that cause errors
            continue

    # Ordenar por score de eficiencia (mayor primero)
    candidates.sort(key=lambda x: x["efficiency_score"], reverse=True)

    # Retornar top N sugerencias
    return candidates[:num_suggestions]


def filter_sections_advanced(
    section_type: Optional[str] = None,
    catalog: Optional[str] = None,
    d_min: Optional[float] = None,
    d_max: Optional[float] = None,
    weight_min: Optional[float] = None,
    weight_max: Optional[float] = None,
    Ix_min: Optional[float] = None,
    Iy_min: Optional[float] = None,
    Zx_min: Optional[float] = None,
    rx_min: Optional[float] = None,
    ry_min: Optional[float] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Busqueda avanzada de secciones con multiples filtros

    Args:
        section_type: Tipo de perfil (W, HSS_RECT, HSS_ROUND, C, L, WT)
        catalog: Catalogo (AISC, CHILEAN)
        d_min: Altura minima [mm]
        d_max: Altura maxima [mm]
        weight_min: Peso minimo [kg/m]
        weight_max: Peso maximo [kg/m]
        Ix_min: Inercia X minima [mm⁴]
        Iy_min: Inercia Y minima [mm⁴]
        Zx_min: Modulo plastico X minimo [mm³]
        rx_min: Radio de giro X minimo [mm]
        ry_min: Radio de giro Y minimo [mm]
        limit: Numero maximo de resultados

    Returns:
        Lista de secciones que cumplen todos los filtros
    """

    # Obtener todas las secciones
    all_sections = get_all_sections(
        section_type=section_type,
        catalog=catalog,
        limit=500  # Obtener mas para filtrar
    )

    filtered = []

    for section in all_sections:
        # Extraer propiedades (manejar diferentes tipos de perfiles)
        d = section.get("d", section.get("H", section.get("OD", 0)))
        weight = section.get("weight", 0)
        Ix = section.get("Ix", section.get("I", 0))
        Iy = section.get("Iy", section.get("I", 0))
        Zx = section.get("Zx", section.get("Z", 0))
        rx = section.get("rx", section.get("r", 0))
        ry = section.get("ry", section.get("r", 0))

        # Aplicar filtros
        if d_min is not None and d < d_min:
            continue
        if d_max is not None and d > d_max:
            continue
        if weight_min is not None and weight < weight_min:
            continue
        if weight_max is not None and weight > weight_max:
            continue
        if Ix_min is not None and Ix < Ix_min:
            continue
        if Iy_min is not None and Iy < Iy_min:
            continue
        if Zx_min is not None and Zx < Zx_min:
            continue
        if rx_min is not None and rx < rx_min:
            continue
        if ry_min is not None and ry < ry_min:
            continue

        filtered.append(section)

        if len(filtered) >= limit:
            break

    return filtered


def compare_sections(
    section_ids: List[str],
    Mu: float,
    Vu: float,
    L: float,
    material_id: str = "A572_GR50",
    units: str = "kN-m"
) -> List[Dict[str, Any]]:
    """
    Comparar multiples secciones para las mismas condiciones de carga

    Args:
        section_ids: Lista de IDs de secciones a comparar
        Mu: Momento ultimo [kN·m]
        Vu: Corte ultimo [kN]
        L: Longitud [m]
        material_id: ID del material
        units: Sistema de unidades

    Returns:
        Lista de comparaciones con verificaciones para cada seccion
    """

    comparisons = []

    for section_id in section_ids:
        try:
            section = get_section_by_id(section_id)
            if not section:
                continue

            # Para estimacion de deflexion, usamos una aproximacion
            # En una implementacion real, se necesitaria correr el analisis completo
            delta_estimate = 0.01  # Placeholder

            # Verificar seccion
            verification = verify_beam_aisc(
                Mu=Mu,
                Vu=Vu,
                L=L,
                delta_max=delta_estimate,
                section_id=section_id,
                material_id=material_id,
                units=units
            )

            comparisons.append({
                "section_id": section_id,
                "section_type": section.get("type"),
                "catalog": section.get("catalog"),
                "weight": section.get("weight"),
                "d": section.get("d", section.get("H", section.get("OD"))),
                "verification": verification,
                "utilization_flexure": verification["flexure"]["utilization"],
                "utilization_shear": verification["shear"]["utilization"],
                "overall_ok": verification["overall_ok"],
                "governing": verification["governing"]
            })

        except Exception as e:
            continue

    # Ordenar por utilizacion de flexion (mas eficiente primero)
    comparisons.sort(
        key=lambda x: abs(x["verification"]["flexure"]["ratio"] - 0.85)
    )

    return comparisons
