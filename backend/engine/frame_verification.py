"""
Verificación de elementos de pórticos según AISC 360
"""

from typing import Dict, List, Any
import math
from .verification import verify_beam_aisc, verify_column_aisc
from .sections import get_section_properties, get_section_by_id
from .materials import get_material_properties


def calculate_element_length(elem: Any, nodes: List[Any]) -> float:
    """
    Calcular longitud de un elemento basado en coordenadas de nodos

    Args:
        elem: Elemento con node_i y node_j
        nodes: Lista de nodos con id, x, y

    Returns:
        Longitud del elemento en metros
    """
    node_i = next((n for n in nodes if n.id == elem.node_i), None)
    node_j = next((n for n in nodes if n.id == elem.node_j), None)

    if not node_i or not node_j:
        return 0.0

    dx = node_j.x - node_i.x
    dy = node_j.y - node_i.y
    length = math.sqrt(dx**2 + dy**2)

    return length


def get_K_factor(elem: Any, elements: List[Any], nodes: List[Any]) -> float:
    """
    Determinar factor de longitud efectiva K para columnas

    Args:
        elem: Elemento a verificar
        elements: Lista de todos los elementos
        nodes: Lista de nodos

    Returns:
        Factor K (conservador)
    """
    # Simplificación: asumir K basado en tipo de elemento y conexiones
    # Para columnas en pórticos:
    # - Si ambos extremos conectados: K = 1.0 (arriostrado)
    # - Si un extremo libre: K = 2.0 (voladizo)
    # - Por defecto: K = 1.0 (conservador)

    # Verificar si los nodos tienen apoyos
    node_i = next((n for n in nodes if n.id == elem.node_i), None)
    node_j = next((n for n in nodes if n.id == elem.node_j), None)

    if not node_i or not node_j:
        return 1.0

    # Si algún nodo es libre (sin conexiones y sin apoyo), usar K mayor
    support_i = getattr(node_i, 'support', None)
    support_j = getattr(node_j, 'support', None)

    if support_i == "fixed" and support_j == "fixed":
        return 0.65  # Ambos empotrados
    elif support_i == "pinned" and support_j == "pinned":
        return 1.0  # Ambos articulados
    elif (support_i == "fixed" and support_j == "pinned") or \
         (support_i == "pinned" and support_j == "fixed"):
        return 0.8  # Empotrado-articulado
    else:
        # Para pórticos típicos sin arriostrar
        return 1.0  # Conservador


def verify_beam_flexure(section: Dict, material: Dict, M: float, units: str) -> Dict[str, Any]:
    """
    Verificar viga a flexión

    Args:
        section: Propiedades de la sección
        material: Propiedades del material
        M: Momento máximo [kN·m o según unidades]
        units: Sistema de unidades

    Returns:
        Resultado de verificación a flexión
    """
    Fy = material["Fy"]  # MPa
    Zx = section["Zx"] * 1e9  # m³ -> mm³

    # Momento plástico
    Mp = Fy * Zx / 1e6  # kN·m
    phi_b = 0.90
    phi_Mn = phi_b * Mp

    ratio = abs(M) / phi_Mn if phi_Mn > 0 else 9999.0
    ok = ratio <= 1.0

    return {
        "Mu": M,
        "phi_Mn": phi_Mn,
        "ratio": round(ratio, 3),
        "utilization": round(ratio * 100, 1),
        "ok": ok
    }


def verify_beam_shear(section: Dict, material: Dict, V: float, units: str) -> Dict[str, Any]:
    """
    Verificar viga a corte

    Args:
        section: Propiedades de la sección
        material: Propiedades del material
        V: Cortante máximo [kN o según unidades]
        units: Sistema de unidades

    Returns:
        Resultado de verificación a corte
    """
    Fy = material["Fy"]  # MPa
    A = section["A"] * 1e6  # m² -> mm²

    # Área de corte aproximada
    Aw = 0.6 * A  # Aproximación conservadora
    Cv1 = 1.0  # Para perfiles laminados

    phi_v = 0.90
    Vn = 0.6 * Fy * Aw * Cv1 / 1e3  # kN
    phi_Vn = phi_v * Vn

    ratio = abs(V) / phi_Vn if phi_Vn > 0 else 9999.0
    ok = ratio <= 1.0

    return {
        "Vu": V,
        "phi_Vn": phi_Vn,
        "ratio": round(ratio, 3),
        "utilization": round(ratio * 100, 1),
        "ok": ok
    }


def verify_column_combined(
    section: Dict,
    material: Dict,
    N: float,
    M: float,
    L: float,
    K: float,
    units: str
) -> Dict[str, Any]:
    """
    Verificar columna bajo carga axial y momento (flexo-compresión)

    Args:
        section: Propiedades de la sección
        material: Propiedades del material
        N: Carga axial [kN]
        M: Momento máximo [kN·m]
        L: Longitud del elemento [m]
        K: Factor de longitud efectiva
        units: Sistema de unidades

    Returns:
        Resultado de verificación combinada
    """
    Fy = material["Fy"]  # MPa
    E = material["E"]  # MPa

    A = section["A"] * 1e6       # m² -> mm²
    Zx = section["Zx"] * 1e9     # m³ -> mm³
    rx = section["rx"] * 1e3     # m -> mm
    ry = section["ry"] * 1e3     # m -> mm

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

    # Capacidad a flexión
    phi_b = 0.90
    Mp = Fy * Zx / 1e6  # kN·m
    phi_Mn = phi_b * Mp

    # Ratios
    ratio_axial = abs(N) / phi_Pn if phi_Pn > 0 else 9999.0
    ratio_moment = abs(M) / phi_Mn if phi_Mn > 0 else 0.0

    # Interacción flexo-compresión (AISC H1)
    Pr_Pc = ratio_axial
    Mr_Mc = ratio_moment

    if Pr_Pc >= 0.2:
        # Ecuación H1-1a
        interaction = Pr_Pc + (8/9) * Mr_Mc
        equation = "H1-1a"
    else:
        # Ecuación H1-1b
        interaction = Pr_Pc / 2 + Mr_Mc
        equation = "H1-1b"

    ok = interaction <= 1.0

    return {
        "compression": {
            "Pu": N,
            "phi_Pn": phi_Pn,
            "ratio": round(ratio_axial, 3),
            "utilization": round(ratio_axial * 100, 1)
        },
        "flexure": {
            "Mu": M,
            "phi_Mn": phi_Mn,
            "ratio": round(ratio_moment, 3),
            "utilization": round(ratio_moment * 100, 1)
        },
        "interaction": {
            "equation": equation,
            "value": round(interaction, 3),
            "utilization": round(interaction * 100, 1),
            "ok": ok
        },
        "slenderness": {
            "KL_r": round(lambda_c, 1),
            "K": K,
            "L": L
        },
        "overall_ok": ok,
        "max_ratio": round(interaction, 3)
    }


def verify_frame_elements(
    elements: List[Any],
    element_forces: Dict[int, Dict[str, float]],
    sections: Dict[str, Any],
    material: Dict,
    nodes: List[Any],
    units: str
) -> List[Dict[str, Any]]:
    """
    Verificar cada elemento del pórtico según AISC 360

    Args:
        elements: Lista de elementos con tipo y section_id
        element_forces: Dict con fuerzas {elem_id: {N, V_i, M_i, V_j, M_j}}
        sections: Dict de secciones (ya no se usa, se obtiene con get_section_*)
        material: Propiedades del material
        nodes: Lista de nodos para calcular longitudes
        units: Sistema de unidades

    Returns:
        Lista de verificaciones por elemento
    """
    results = []

    for elem in elements:
        elem_id = elem.id
        forces = element_forces.get(elem_id, {})

        # Obtener propiedades de la sección
        section = get_section_properties(elem.section_id)
        section_info = get_section_by_id(elem.section_id)

        # Fuerzas máximas
        N = abs(forces.get("N", 0))
        V = max(abs(forces.get("V_i", 0)), abs(forces.get("V_j", 0)))
        M = max(abs(forces.get("M_i", 0)), abs(forces.get("M_j", 0)))

        # Calcular longitud del elemento
        L = calculate_element_length(elem, nodes)

        if elem.element_type == "beam":
            # Verificar como viga (flexión + corte)
            flexure = verify_beam_flexure(section, material, M, units)
            shear = verify_beam_shear(section, material, V, units)

            verification = {
                "element_id": elem_id,
                "type": "beam",
                "section_id": elem.section_id,
                "length": round(L, 2),
                "forces": {
                    "N": round(N, 2),
                    "V": round(V, 2),
                    "M": round(M, 2)
                },
                "flexure": flexure,
                "shear": shear,
                "overall_ok": flexure["ok"] and shear["ok"],
                "max_ratio": max(flexure["ratio"], shear["ratio"])
            }

        else:  # column o brace
            # Verificar como columna (compresión + flexión)
            K = get_K_factor(elem, elements, nodes)

            verification = verify_column_combined(
                section, material, N, M, L, K, units
            )
            verification["element_id"] = elem_id
            verification["type"] = elem.element_type
            verification["section_id"] = elem.section_id
            verification["length"] = round(L, 2)
            verification["forces"] = {
                "N": round(N, 2),
                "V": round(V, 2),
                "M": round(M, 2)
            }

        results.append(verification)

    return results
