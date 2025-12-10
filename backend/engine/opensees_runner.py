"""
OpenSees Runner - Motor de análisis estructural
Interfaz principal con OpenSeesPy para análisis de estructuras de acero
"""

import openseespy.opensees as ops
import numpy as np
from typing import List, Dict, Any, Tuple, Optional, Literal
from .materials import get_material_properties, get_material_by_id
from .sections import get_section_properties, get_section_by_id
from .verification import verify_beam_aisc, verify_column_aisc


# ==================== CONSTANTES ====================

SUPPORT_DOF = {
    "fixed": [1, 1, 1],      # Empotrado: restringir dx, dy, rz
    "pinned": [1, 1, 0],     # Articulado: restringir dx, dy
    "roller": [0, 1, 0],     # Rodillo (vertical): restringir dy
    "roller_h": [1, 0, 0],   # Rodillo (horizontal): restringir dx
    "free": [0, 0, 0],       # Libre
}


# ==================== CONVERSIÓN DE UNIDADES ====================

def convert_output_units(value: float, unit_type: str, to_units: str) -> float:
    """
    Convertir valores de salida de kN-m (interno) a unidades deseadas
    
    Args:
        value: Valor en unidades internas (kN, m, kN-m)
        unit_type: Tipo de valor ("force", "moment", "length", "displacement")
        to_units: Unidades de destino ("kN-m", "tonf-m", "kgf-cm")
    """
    if to_units == "kN-m":
        return value
    
    elif to_units == "tonf-m":
        if unit_type == "force":
            return value / 9.80665  # kN -> tonf
        elif unit_type == "moment":
            return value / 9.80665  # kN·m -> tonf·m
        elif unit_type in ("length", "displacement"):
            return value  # m -> m
    
    elif to_units == "kgf-cm":
        if unit_type == "force":
            return value * 101.972  # kN -> kgf
        elif unit_type == "moment":
            return value * 10197.2  # kN·m -> kgf·cm
        elif unit_type == "length":
            return value * 100  # m -> cm
        elif unit_type == "displacement":
            return value * 100  # m -> cm
    
    return value


# ==================== ANÁLISIS DE VIGA ====================

def analyze_beam(
    length: float,
    support_left: str,
    support_right: str,
    section_id: str,
    material_id: str,
    point_loads: List[Any],
    distributed_loads: List[Any],
    units: str = "kN-m",
    num_points: int = 21
) -> Dict[str, Any]:
    """
    Analizar viga de acero con OpenSeesPy
    
    Args:
        length: Longitud de la viga [m]
        support_left: Tipo de apoyo izquierdo
        support_right: Tipo de apoyo derecho
        section_id: ID del perfil
        material_id: ID del material
        point_loads: Lista de cargas puntuales
        distributed_loads: Lista de cargas distribuidas
        units: Sistema de unidades de salida
        num_points: Número de puntos para diagramas
    
    Returns:
        Diccionario con reacciones, desplazamientos, diagramas y verificaciones
    """
    
    # Obtener propiedades
    mat_props = get_material_properties(material_id)
    sec_props = get_section_properties(section_id)
    section_info = get_section_by_id(section_id)
    
    E = mat_props["E"] * 1e6  # MPa -> kN/m² (kPa)
    A = sec_props["A"]        # m²
    Iz = sec_props["Ix"]      # m⁴ (usando Ix para flexión en plano)
    
    # Limpiar modelo anterior
    ops.wipe()
    
    # Crear modelo 2D con 3 DOF por nodo (dx, dy, rz)
    ops.model('basic', '-ndm', 2, '-ndf', 3)
    
    # Discretizar la viga en varios elementos para mejor precisión
    n_elements = max(10, num_points - 1)
    n_nodes = n_elements + 1
    dx = length / n_elements
    
    # Crear nodos
    for i in range(n_nodes):
        x = i * dx
        ops.node(i + 1, x, 0.0)
    
    # Aplicar condiciones de apoyo
    left_dof = SUPPORT_DOF.get(support_left, [0, 0, 0])
    right_dof = SUPPORT_DOF.get(support_right, [0, 0, 0])
    
    ops.fix(1, *left_dof)
    ops.fix(n_nodes, *right_dof)
    
    # Transformación geométrica (lineal para análisis elástico)
    ops.geomTransf('Linear', 1)
    
    # Crear elementos elasticBeamColumn
    for i in range(n_elements):
        ops.element('elasticBeamColumn', i + 1, i + 1, i + 2, A, E, Iz, 1)
    
    # Crear patrón de carga
    ops.timeSeries('Linear', 1)
    ops.pattern('Plain', 1, 1)
    
    # Aplicar cargas puntuales
    for load in point_loads:
        pos = load.position
        Fy = load.Fy
        Fx = load.Fx
        Mz = load.Mz
        
        # Encontrar el nodo más cercano
        node_idx = int(round(pos / dx)) + 1

        # Validar que node_idx esté dentro del rango
        if pos > length:
            print(f"Warning: Carga puntual en posición {pos}m excede la longitud de la viga {length}m. Se coloca en el extremo.")
        node_idx = max(1, min(n_nodes, node_idx))

        # Aplicar carga (Fy negativo porque OpenSees usa +Y hacia arriba)
        ops.load(node_idx, Fx, -Fy, Mz)
    
    # Aplicar cargas distribuidas (convertir a cargas nodales equivalentes)
    for dload in distributed_loads:
        start = dload.start
        end = dload.end if dload.end is not None else length
        w_start = dload.w_start
        w_end = dload.w_end if dload.w_end is not None else w_start

        # Validar límites de la carga distribuida
        if start < 0 or end > length or start > end:
            print(f"Warning: Carga distribuida con límites inválidos (start={start}, end={end}, length={length}). Se ajustan a [0, {length}].")
            start = max(0, min(start, length))
            end = max(start, min(end, length))

        # Evitar división por cero: si start == end, saltar esta carga
        if abs(end - start) < 1e-9:
            continue

        # Encontrar elementos afectados
        for i in range(n_elements):
            x1 = i * dx
            x2 = (i + 1) * dx
            
            # Verificar si el elemento está dentro del rango de carga
            if x2 <= start or x1 >= end:
                continue
            
            # Calcular carga en este segmento
            x1_load = max(x1, start)
            x2_load = min(x2, end)
            
            # Interpolar magnitud de carga
            if end > start:
                t1 = (x1_load - start) / (end - start) if (end - start) > 0 else 0
                t2 = (x2_load - start) / (end - start) if (end - start) > 0 else 0
                w1 = w_start + (w_end - w_start) * t1
                w2 = w_start + (w_end - w_start) * t2
            else:
                w1 = w2 = w_start
            
            # Carga promedio en el segmento
            w_avg = (w1 + w2) / 2
            seg_length = x2_load - x1_load
            total_load = w_avg * seg_length
            
            # Distribuir entre nodos del elemento
            node_i = i + 1
            node_j = i + 2
            ops.load(node_i, 0, -total_load / 2, 0)
            ops.load(node_j, 0, -total_load / 2, 0)
    
    # Configurar análisis
    ops.system('BandSPD')
    ops.numberer('RCM')
    ops.constraints('Plain')
    ops.integrator('LoadControl', 1.0)
    ops.algorithm('Linear')
    ops.analysis('Static')
    
    # Ejecutar análisis
    analysis_ok = ops.analyze(1)

    if analysis_ok != 0:
        ops.wipe()
        raise RuntimeError("El análisis de viga no convergió")

    # Extraer resultados

    # Desplazamientos nodales
    displacements = []
    for i in range(n_nodes):
        node_id = i + 1
        x = i * dx
        ux = ops.nodeDisp(node_id, 1)
        uy = ops.nodeDisp(node_id, 2)
        rz = ops.nodeDisp(node_id, 3)
        displacements.append({
            "x": convert_output_units(x, "length", units),
            "ux": convert_output_units(ux, "displacement", units),
            "uy": convert_output_units(uy, "displacement", units),
            "rz": rz  # [rad] Rotación en radianes
        })

    # Reacciones - necesitamos calcularlas primero
    ops.reactions()
    
    reactions = {}
    if any(left_dof):
        reactions["left"] = {
            "Rx": convert_output_units(ops.nodeReaction(1, 1), "force", units),
            "Ry": convert_output_units(-ops.nodeReaction(1, 2), "force", units),
            "Mz": convert_output_units(ops.nodeReaction(1, 3), "moment", units)
        }
    if any(right_dof):
        reactions["right"] = {
            "Rx": convert_output_units(ops.nodeReaction(n_nodes, 1), "force", units),
            "Ry": convert_output_units(-ops.nodeReaction(n_nodes, 2), "force", units),
            "Mz": convert_output_units(ops.nodeReaction(n_nodes, 3), "moment", units)
        }
    
    # Fuerzas en elementos (M, V, N)
    forces_diagram = {"moment": [], "shear": [], "axial": []}
    
    for i in range(n_elements):
        elem_id = i + 1
        x_mid = (i + 0.5) * dx
        
        # Obtener fuerzas del elemento [N1, V1, M1, N2, V2, M2]
        forces = ops.eleResponse(elem_id, 'forces')
        
        # Para cada extremo del elemento
        x1 = i * dx
        x2 = (i + 1) * dx
        
        # Fuerzas en i (índices 0, 1, 2)
        N1, V1, M1 = forces[0], forces[1], forces[2]
        # Fuerzas en j (índices 3, 4, 5)
        N2, V2, M2 = forces[3], forces[4], forces[5]
        
        if i == 0:
            forces_diagram["moment"].append({
                "x": convert_output_units(x1, "length", units),
                "value": convert_output_units(M1, "moment", units)
            })
            forces_diagram["shear"].append({
                "x": convert_output_units(x1, "length", units),
                "value": convert_output_units(V1, "force", units)
            })
            forces_diagram["axial"].append({
                "x": convert_output_units(x1, "length", units),
                "value": convert_output_units(N1, "force", units)
            })
        
        forces_diagram["moment"].append({
            "x": convert_output_units(x2, "length", units),
            "value": convert_output_units(-M2, "moment", units)
        })
        forces_diagram["shear"].append({
            "x": convert_output_units(x2, "length", units),
            "value": convert_output_units(-V2, "force", units)
        })
        forces_diagram["axial"].append({
            "x": convert_output_units(x2, "length", units),
            "value": convert_output_units(-N2, "force", units)
        })
    
    # Valores máximos
    max_moment = max((abs(p["value"]) for p in forces_diagram["moment"]), default=0.0)
    max_shear = max((abs(p["value"]) for p in forces_diagram["shear"]), default=0.0)
    max_deflection = max((abs(d["uy"]) for d in displacements), default=0.0)
    
    # Verificaciones AISC
    verification = verify_beam_aisc(
        Mu=max_moment,
        Vu=max_shear,
        L=length,
        delta_max=max_deflection,
        section_id=section_id,
        material_id=material_id,
        units=units
    )
    
    # Limpiar
    ops.wipe()
    
    return {
        "status": "success",
        "input": {
            "length": length,
            "section": section_info,
            "material": get_material_by_id(material_id),
            "supports": {"left": support_left, "right": support_right}
        },
        "reactions": reactions,
        "displacements": displacements,
        "diagrams": forces_diagram,
        "max_values": {
            "moment": max_moment,
            "shear": max_shear,
            "deflection": max_deflection
        },
        "verification": verification,
        "units": units
    }


# ==================== ANÁLISIS DE COLUMNA ====================

def analyze_column(
    height: float,
    base: str,
    top: str,
    section_id: str,
    material_id: str,
    axial_load: float,
    moment_top: float = 0,
    moment_base: float = 0,
    units: str = "kN-m"
) -> Dict[str, Any]:
    """
    Analizar columna de acero con OpenSeesPy
    
    Args:
        height: Altura de la columna [m]
        base: Condición en la base ("fixed", "pinned")
        top: Condición en el tope ("fixed", "pinned", "free")
        section_id: ID del perfil
        material_id: ID del material
        axial_load: Carga axial [kN] (positivo = compresión)
        moment_top: Momento en tope [kN·m]
        moment_base: Momento en base [kN·m]
        units: Sistema de unidades
    
    Returns:
        Diccionario con resultados y verificaciones
    """
    
    # Obtener propiedades
    mat_props = get_material_properties(material_id)
    sec_props = get_section_properties(section_id)
    section_info = get_section_by_id(section_id)
    
    E = mat_props["E"] * 1e6  # MPa -> kPa
    Fy = mat_props["Fy"] * 1e3  # MPa -> kPa
    A = sec_props["A"]
    Ix = sec_props["Ix"]
    Iy = sec_props["Iy"]
    rx = sec_props["rx"]
    ry = sec_props["ry"]
    
    # Factor K para longitud efectiva
    K_values = {
        ("fixed", "fixed"): 0.65,
        ("fixed", "pinned"): 0.80,
        ("pinned", "fixed"): 0.70,
        ("fixed", "free"): 2.10,
        ("pinned", "pinned"): 1.00,
        ("pinned", "free"): 2.10,
    }
    K = K_values.get((base, top), 1.0)
    
    # Longitud efectiva
    Leff_x = K * height
    Leff_y = K * height
    
    # Esbeltez
    lambda_x = Leff_x / rx
    lambda_y = Leff_y / ry
    lambda_max = max(lambda_x, lambda_y)
    
    # Carga crítica de Euler: Pcr = π² * E * I / (K*L)²
    # Usando el eje más débil
    I_min = min(Ix, Iy)
    r_min = min(rx, ry)
    
    # Tensión crítica de Euler
    Fe = (np.pi ** 2 * E) / (K * height / r_min) ** 2  # kPa
    
    # Carga crítica de Euler usando Pcr = π²EI/(KL)²
    Pcr_euler = (np.pi ** 2 * E * I_min) / (K * height) ** 2  # kN
    
    # Verificación AISC con OpenSees
    ops.wipe()
    ops.model('basic', '-ndm', 2, '-ndf', 3)
    
    # Nodos
    n_elements = 10
    dy = height / n_elements
    for i in range(n_elements + 1):
        ops.node(i + 1, 0.0, i * dy)
    
    # Apoyos
    base_dof = SUPPORT_DOF.get(base, [1, 1, 1])
    top_dof = SUPPORT_DOF.get(top, [0, 0, 0])
    
    ops.fix(1, *base_dof)
    if any(top_dof):
        ops.fix(n_elements + 1, *top_dof)
    
    # Transformación geométrica (PDelta para efectos de segundo orden)
    ops.geomTransf('PDelta', 1)
    
    # Elementos
    for i in range(n_elements):
        ops.element('elasticBeamColumn', i + 1, i + 1, i + 2, A, E, Ix, 1)
    
    # Cargas
    ops.timeSeries('Linear', 1)
    ops.pattern('Plain', 1, 1)
    
    # Carga axial en el tope (negativo porque compresión va hacia abajo)
    ops.load(n_elements + 1, 0, -axial_load, moment_top)
    
    # Momento en la base (si hay)
    if abs(moment_base) > 0:
        ops.load(1, 0, 0, moment_base)
    
    # Análisis
    ops.system('BandSPD')
    ops.numberer('RCM')
    ops.constraints('Plain')
    ops.integrator('LoadControl', 1.0)
    ops.algorithm('Linear')
    ops.analysis('Static')
    ops.analyze(1)
    
    # Extraer desplazamientos
    displacements = []
    for i in range(n_elements + 1):
        node_id = i + 1
        y = i * dy
        ux = ops.nodeDisp(node_id, 1)
        uy = ops.nodeDisp(node_id, 2)
        rz = ops.nodeDisp(node_id, 3)
        displacements.append({
            "y": convert_output_units(y, "length", units),
            "ux": convert_output_units(ux, "displacement", units),
            "uy": convert_output_units(uy, "displacement", units),
            "rz": rz  # [rad] Rotación en radianes
        })
    
    max_lateral = max((abs(d["ux"]) for d in displacements), default=0.0)
    
    ops.wipe()
    
    # Verificación AISC
    verification = verify_column_aisc(
        Pu=axial_load,
        Mu_top=moment_top,
        Mu_base=moment_base,
        L=height,
        K=K,
        section_id=section_id,
        material_id=material_id,
        units=units
    )
    
    return {
        "status": "success",
        "input": {
            "height": height,
            "section": section_info,
            "material": get_material_by_id(material_id),
            "supports": {"base": base, "top": top},
            "loads": {
                "axial": axial_load,
                "moment_top": moment_top,
                "moment_base": moment_base
            }
        },
        "effective_length": {
            "K": K,
            "Leff_x": Leff_x,
            "Leff_y": Leff_y
        },
        "slenderness": {
            "lambda_x": lambda_x,
            "lambda_y": lambda_y,
            "governing": lambda_max
        },
        "euler_buckling": {
            "Fe": Fe / 1e3,  # kPa -> MPa
            "Pcr": Pcr_euler
        },
        "displacements": displacements,
        "max_lateral": max_lateral,
        "verification": verification,
        "units": units
    }


# ==================== ANÁLISIS DE PÓRTICO ====================

def get_element_forces(element_ids: List[int], units: str = "kN-m") -> Dict[int, Dict[str, float]]:
    """
    Extraer fuerzas internas de elementos después del análisis

    Args:
        element_ids: Lista de IDs de elementos
        units: Sistema de unidades de salida

    Returns:
        Diccionario {elem_id: {N, V_i, M_i, V_j, M_j}}
    """
    forces = {}

    for elem_id in element_ids:
        try:
            # basicForce retorna fuerzas en el sistema local del elemento
            # Para elasticBeamColumn 2D: [N, V_i, M_i, V_j, M_j]
            # donde i y j son los extremos del elemento
            force = ops.basicForce(elem_id)

            if len(force) >= 5:
                forces[elem_id] = {
                    "N": convert_output_units(force[0], "force", units),       # Axial
                    "V_i": convert_output_units(force[1], "force", units),     # Cortante en i
                    "M_i": convert_output_units(force[2], "moment", units),    # Momento en i
                    "V_j": convert_output_units(force[3], "force", units),     # Cortante en j
                    "M_j": convert_output_units(force[4], "moment", units)     # Momento en j
                }
            else:
                # Si no hay suficientes valores, retornar ceros
                forces[elem_id] = {
                    "N": 0.0,
                    "V_i": 0.0,
                    "M_i": 0.0,
                    "V_j": 0.0,
                    "M_j": 0.0
                }
        except Exception as e:
            # En caso de error, retornar ceros
            print(f"Warning: Error al obtener fuerzas del elemento {elem_id}: {e}")
            forces[elem_id] = {
                "N": 0.0,
                "V_i": 0.0,
                "M_i": 0.0,
                "V_j": 0.0,
                "M_j": 0.0
            }

    return forces


def analyze_frame(
    nodes: List[Any],
    elements: List[Any],
    loads: List[Any],
    material_id: str,
    units: str = "kN-m"
) -> Dict[str, Any]:
    """
    Analizar pórtico 2D con OpenSeesPy
    
    Args:
        nodes: Lista de nodos [{id, x, y, support}]
        elements: Lista de elementos [{id, node_i, node_j, section_id, element_type}]
        loads: Lista de cargas
        material_id: ID del material
        units: Sistema de unidades
    
    Returns:
        Diccionario con resultados completos
    """
    
    mat_props = get_material_properties(material_id)
    E = mat_props["E"] * 1e6  # MPa -> kPa
    
    ops.wipe()
    ops.model('basic', '-ndm', 2, '-ndf', 3)
    
    # Crear nodos
    node_coords = {}
    for node in nodes:
        node_id = node.id
        x = node.x
        y = node.y
        support = node.support
        
        ops.node(node_id, x, y)
        node_coords[node_id] = (x, y)
        
        if support:
            dof = SUPPORT_DOF.get(support, [0, 0, 0])
            ops.fix(node_id, *dof)
    
    # Transformación geométrica
    ops.geomTransf('PDelta', 1)
    
    # Crear elementos
    element_props = {}
    for elem in elements:
        elem_id = elem.id
        node_i = elem.node_i
        node_j = elem.node_j
        section_id = elem.section_id
        
        sec_props = get_section_properties(section_id)
        A = sec_props["A"]
        I = sec_props["Ix"]
        
        ops.element('elasticBeamColumn', elem_id, node_i, node_j, A, E, I, 1)
        
        element_props[elem_id] = {
            "section_id": section_id,
            "node_i": node_i,
            "node_j": node_j,
            "A": A,
            "I": I
        }
    
    # Aplicar cargas
    ops.timeSeries('Linear', 1)
    ops.pattern('Plain', 1, 1)

    for load in loads:
        load_type = load.type

        if load_type == "nodal":
            node_id = load.node_id
            Fx = load.Fx
            Fy = load.Fy
            Mz = load.Mz
            ops.load(node_id, Fx, -Fy, Mz)  # Fy negativo (hacia abajo)

        elif load_type == "distributed":
            # Carga distribuida en elemento
            elem_id = load.element_id
            w = load.w  # kN/m (carga uniforme)

            # Usar eleLoad de OpenSees para carga distribuida uniforme
            # beamUniform: primer valor = carga transversal (perpendicular al eje)
            # segundo valor = carga axial (a lo largo del eje)
            ops.eleLoad('-ele', elem_id, '-type', '-beamUniform', -w, 0.0)
    
    # Análisis
    ops.system('BandSPD')
    ops.numberer('RCM')
    ops.constraints('Plain')
    ops.integrator('LoadControl', 1.0)
    ops.algorithm('Linear')
    ops.analysis('Static')

    analysis_ok = ops.analyze(1)

    if analysis_ok != 0:
        ops.wipe()
        return {"status": "error", "message": "El análisis no convergió"}

    # Extraer resultados

    # Desplazamientos nodales
    node_results = {}
    for node in nodes:
        node_id = node.id
        ux = ops.nodeDisp(node_id, 1)
        uy = ops.nodeDisp(node_id, 2)
        rz = ops.nodeDisp(node_id, 3)

        node_results[node_id] = {
            "x": node_coords[node_id][0],
            "y": node_coords[node_id][1],
            "ux": convert_output_units(ux, "displacement", units),
            "uy": convert_output_units(uy, "displacement", units),
            "rz": rz  # [rad] Rotación en radianes
        }

    # Reacciones en apoyos - solo si el análisis fue exitoso
    ops.reactions()
    
    reactions = {}
    for node in nodes:
        node_id = node.id
        support = node.support
        
        if support and support != "free":
            Rx = ops.nodeReaction(node_id, 1)
            Ry = -ops.nodeReaction(node_id, 2)
            Mz = ops.nodeReaction(node_id, 3)
            
            reactions[node_id] = {
                "Rx": convert_output_units(Rx, "force", units),
                "Ry": convert_output_units(Ry, "force", units),
                "Mz": convert_output_units(Mz, "moment", units)
            }
    
    # Fuerzas en elementos usando basicForce (más preciso)
    element_ids = [elem.id for elem in elements]
    element_forces = get_element_forces(element_ids, units)

    element_results = {}
    for elem in elements:
        elem_id = elem.id
        forces = element_forces.get(elem_id, {})

        element_results[elem_id] = {
            "section_id": element_props[elem_id]["section_id"],
            "element_type": elem.element_type,
            "forces_i": {
                "N": forces.get("N", 0.0),
                "V": forces.get("V_i", 0.0),
                "M": forces.get("M_i", 0.0)
            },
            "forces_j": {
                "N": -forces.get("N", 0.0),  # Axial es igual pero opuesto
                "V": forces.get("V_j", 0.0),
                "M": forces.get("M_j", 0.0)
            }
        }

    ops.wipe()

    return {
        "status": "success",
        "nodes": node_results,
        "reactions": reactions,
        "elements": element_results,
        "element_forces": element_forces,  # Agregar fuerzas detalladas
        "units": units
    }
