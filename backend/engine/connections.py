"""
Verificaciones de conexiones con pernos segun AISC 360
Capitulo J - Diseno de Conexiones
"""

from typing import Dict, Any, Literal

# Propiedades de pernos segun AISC J3.2
BOLT_PROPERTIES = {
    "A325": {"Fnt": 620, "Fnv": 372},  # MPa (tension, corte)
    "A490": {"Fnt": 780, "Fnv": 457},
    "4.6": {"Fnt": 240, "Fnv": 150},   # Grados metricos
    "8.8": {"Fnt": 640, "Fnv": 372},
    "10.9": {"Fnt": 830, "Fnv": 500},
}

# Diametros de pernos comunes con areas nominales
BOLT_DIAMETERS = {
    "M12": {"d": 12, "Ab": 113},   # mm, mm2
    "M16": {"d": 16, "Ab": 201},
    "M20": {"d": 20, "Ab": 314},
    "M22": {"d": 22, "Ab": 380},
    "M24": {"d": 24, "Ab": 452},
    "M27": {"d": 27, "Ab": 573},
    "M30": {"d": 30, "Ab": 707},
    "3/4\"": {"d": 19.05, "Ab": 285},
    "7/8\"": {"d": 22.23, "Ab": 388},
    "1\"": {"d": 25.4, "Ab": 507},
    "1-1/8\"": {"d": 28.58, "Ab": 641},
    "1-1/4\"": {"d": 31.75, "Ab": 792},
}


def verify_bolt_shear(
    bolt_grade: str,
    diameter: str,
    num_bolts: int,
    Vu: float,
    shear_planes: int = 1
) -> Dict[str, Any]:
    """
    Verificar pernos a corte segun AISC J3.6

    Args:
        bolt_grade: Grado del perno (A325, A490, 8.8, 10.9, etc)
        diameter: Diametro nominal (M12, M16, 3/4", etc)
        num_bolts: Numero de pernos
        Vu: Fuerza de corte demandada [kN]
        shear_planes: Numero de planos de corte (1=simple, 2=doble)

    Returns:
        Diccionario con resultados de verificacion
    """

    if bolt_grade not in BOLT_PROPERTIES:
        raise ValueError(f"Grado de perno '{bolt_grade}' no valido. Use: {list(BOLT_PROPERTIES.keys())}")

    if diameter not in BOLT_DIAMETERS:
        raise ValueError(f"Diametro '{diameter}' no valido. Use: {list(BOLT_DIAMETERS.keys())}")

    # Propiedades del perno
    Fnv = BOLT_PROPERTIES[bolt_grade]["Fnv"]  # MPa
    Ab = BOLT_DIAMETERS[diameter]["Ab"]  # mm2

    # Resistencia nominal a corte (AISC J3-1)
    Rn_per_bolt = Fnv * Ab / 1000  # kN por perno
    Rn_total = Rn_per_bolt * num_bolts * shear_planes

    # Factor de resistencia (AISC J3.6)
    phi_v = 0.75
    phi_Rn = phi_v * Rn_total

    # Verificacion
    ratio = abs(Vu) / phi_Rn if phi_Rn > 0 else 9999.0
    ok = ratio <= 1.0

    return {
        "type": "shear",
        "Vu": Vu,
        "phi_Rn": round(phi_Rn, 2),
        "Rn": round(Rn_total, 2),
        "phi": phi_v,
        "ratio": round(ratio, 3),
        "utilization": round(ratio * 100, 1),
        "ok": ok,
        "details": {
            "Fnv": Fnv,
            "Ab_per_bolt": Ab,
            "Rn_per_bolt": round(Rn_per_bolt, 2),
            "num_bolts": num_bolts,
            "shear_planes": shear_planes,
            "bolt_grade": bolt_grade,
            "diameter": diameter
        }
    }


def verify_bolt_tension(
    bolt_grade: str,
    diameter: str,
    num_bolts: int,
    Tu: float
) -> Dict[str, Any]:
    """
    Verificar pernos a tension segun AISC J3.6

    Args:
        bolt_grade: Grado del perno (A325, A490, 8.8, 10.9, etc)
        diameter: Diametro nominal (M12, M16, 3/4", etc)
        num_bolts: Numero de pernos
        Tu: Fuerza de tension demandada [kN]

    Returns:
        Diccionario con resultados de verificacion
    """

    if bolt_grade not in BOLT_PROPERTIES:
        raise ValueError(f"Grado de perno '{bolt_grade}' no valido. Use: {list(BOLT_PROPERTIES.keys())}")

    if diameter not in BOLT_DIAMETERS:
        raise ValueError(f"Diametro '{diameter}' no valido. Use: {list(BOLT_DIAMETERS.keys())}")

    # Propiedades del perno
    Fnt = BOLT_PROPERTIES[bolt_grade]["Fnt"]  # MPa
    Ab = BOLT_DIAMETERS[diameter]["Ab"]  # mm2

    # Resistencia nominal a tension (AISC J3-2)
    Rn_per_bolt = Fnt * Ab / 1000  # kN por perno
    Rn_total = Rn_per_bolt * num_bolts

    # Factor de resistencia (AISC J3.6)
    phi_t = 0.75
    phi_Rn = phi_t * Rn_total

    # Verificacion
    ratio = abs(Tu) / phi_Rn if phi_Rn > 0 else 9999.0
    ok = ratio <= 1.0

    return {
        "type": "tension",
        "Tu": Tu,
        "phi_Rn": round(phi_Rn, 2),
        "Rn": round(Rn_total, 2),
        "phi": phi_t,
        "ratio": round(ratio, 3),
        "utilization": round(ratio * 100, 1),
        "ok": ok,
        "details": {
            "Fnt": Fnt,
            "Ab_per_bolt": Ab,
            "Rn_per_bolt": round(Rn_per_bolt, 2),
            "num_bolts": num_bolts,
            "bolt_grade": bolt_grade,
            "diameter": diameter
        }
    }


def verify_bolt_combined(
    bolt_grade: str,
    diameter: str,
    num_bolts: int,
    Vu: float,
    Tu: float,
    shear_planes: int = 1
) -> Dict[str, Any]:
    """
    Verificar pernos a tension + corte combinado segun AISC J3.7

    Ecuacion de interaccion (AISC J3-3a):
    (frv/phiFnv)^2 + (frt/phiFnt)^2 <= 1.0
    """

    if bolt_grade not in BOLT_PROPERTIES:
        raise ValueError(f"Grado de perno '{bolt_grade}' no valido")

    if diameter not in BOLT_DIAMETERS:
        raise ValueError(f"Diametro '{diameter}' no valido")

    # Verificaciones individuales
    shear_check = verify_bolt_shear(bolt_grade, diameter, num_bolts, Vu, shear_planes)
    tension_check = verify_bolt_tension(bolt_grade, diameter, num_bolts, Tu)

    # Esfuerzos por perno
    Ab = BOLT_DIAMETERS[diameter]["Ab"]  # mm2
    frv = abs(Vu) / (num_bolts * shear_planes)  # kN por plano
    frt = abs(Tu) / num_bolts  # kN por perno

    # Resistencias con factores
    Fnv = BOLT_PROPERTIES[bolt_grade]["Fnv"]  # MPa
    Fnt = BOLT_PROPERTIES[bolt_grade]["Fnt"]  # MPa
    phi_v = 0.75
    phi_t = 0.75

    phi_Fnv = phi_v * Fnv  # MPa
    phi_Fnt = phi_t * Fnt  # MPa

    # Convertir fuerzas a esfuerzos
    frv_stress = frv * 1000 / Ab  # MPa
    frt_stress = frt * 1000 / Ab  # MPa

    # Ecuacion de interaccion AISC J3-3a
    interaction = (frv_stress / phi_Fnv)**2 + (frt_stress / phi_Fnt)**2
    ok = interaction <= 1.0

    return {
        "type": "combined",
        "Vu": Vu,
        "Tu": Tu,
        "shear_check": shear_check,
        "tension_check": tension_check,
        "interaction": {
            "value": round(interaction, 3),
            "ok": ok,
            "utilization": round(interaction * 100, 1),
            "formula": "(frv/phiFnv)^2 + (frt/phiFnt)^2 <= 1.0"
        },
        "stresses": {
            "frv": round(frv_stress, 2),
            "frt": round(frt_stress, 2),
            "phi_Fnv": round(phi_Fnv, 2),
            "phi_Fnt": round(phi_Fnt, 2)
        },
        "overall_ok": ok,
        "details": {
            "bolt_grade": bolt_grade,
            "diameter": diameter,
            "num_bolts": num_bolts,
            "shear_planes": shear_planes
        }
    }


def verify_bolt_bearing(
    t_plate: float,
    Fu_plate: float,
    diameter: str,
    num_bolts: int,
    Vu: float,
    edge_dist: float,
    spacing: float,
    hole_type: Literal["STD", "OVS", "SLOTTED"] = "STD"
) -> Dict[str, Any]:
    """
    Verificar aplastamiento en placa segun AISC J3.10
    """

    if diameter not in BOLT_DIAMETERS:
        raise ValueError(f"Diametro '{diameter}' no valido")

    d_bolt = BOLT_DIAMETERS[diameter]["d"]  # mm

    # Distancia clara (clear distance)
    d_hole = d_bolt + 2  # mm (agujero estandar AISC J3.3)

    # Distancia clara al borde
    Lc_edge = edge_dist - d_hole/2

    # Distancia clara entre pernos
    Lc_spacing = spacing - d_hole

    # Usar el menor de los dos
    Lc = min(Lc_edge, Lc_spacing / 2) if num_bolts > 1 else Lc_edge

    # Resistencia nominal al aplastamiento (AISC J3-6a y J3-6b)
    Rn_bearing = min(1.2 * Lc * t_plate * Fu_plate / 1000,
                     2.4 * d_bolt * t_plate * Fu_plate / 1000)

    # Para agujeros no estandar, aplicar reduccion
    if hole_type == "OVS":
        Rn_bearing *= 0.8
    elif hole_type == "SLOTTED":
        Rn_bearing *= 0.7

    # Resistencia total (todos los pernos)
    Rn_total = Rn_bearing * num_bolts

    # Factor de resistencia (AISC J3.10)
    phi_bearing = 0.75
    phi_Rn = phi_bearing * Rn_total

    # Verificacion
    ratio = abs(Vu) / phi_Rn if phi_Rn > 0 else 9999.0
    ok = ratio <= 1.0

    return {
        "type": "bearing",
        "Vu": Vu,
        "phi_Rn": round(phi_Rn, 2),
        "Rn": round(Rn_total, 2),
        "phi": phi_bearing,
        "ratio": round(ratio, 3),
        "utilization": round(ratio * 100, 1),
        "ok": ok,
        "details": {
            "t_plate": t_plate,
            "Fu_plate": Fu_plate,
            "diameter": diameter,
            "d_bolt": d_bolt,
            "d_hole": d_hole,
            "edge_dist": edge_dist,
            "spacing": spacing,
            "Lc": round(Lc, 2),
            "Rn_per_bolt": round(Rn_bearing, 2),
            "num_bolts": num_bolts,
            "hole_type": hole_type
        }
    }


def verify_block_shear(
    Agv: float,
    Anv: float,
    Ant: float,
    Fy: float,
    Fu: float,
    Ubs: float = 1.0
) -> Dict[str, Any]:
    """
    Verificar bloque de corte segun AISC J4.3

    Ecuacion de bloque de corte:
    Rn = 0.6*Fu*Anv + Ubs*Fu*Ant <= 0.6*Fy*Agv + Ubs*Fu*Ant
    """

    # Resistencia nominal (AISC J4-5)
    Rn1 = 0.6 * Fu * Anv + Ubs * Fu * Ant
    Rn2 = 0.6 * Fy * Agv + Ubs * Fu * Ant

    # Tomar el menor
    Rn = min(Rn1, Rn2) / 1000  # kN

    # Factor de resistencia
    phi_bs = 0.75
    phi_Rn = phi_bs * Rn

    return {
        "type": "block_shear",
        "phi_Rn": round(phi_Rn, 2),
        "Rn": round(Rn, 2),
        "phi": phi_bs,
        "governing": "fracture_tension" if Rn1 < Rn2 else "yield_shear",
        "details": {
            "Agv": Agv,
            "Anv": Anv,
            "Ant": Ant,
            "Fy": Fy,
            "Fu": Fu,
            "Ubs": Ubs,
            "Rn1_fracture": round(Rn1 / 1000, 2),
            "Rn2_yield": round(Rn2 / 1000, 2)
        }
    }


def get_available_bolt_grades() -> list:
    """Obtener lista de grados de pernos disponibles"""
    return [
        {"id": grade, "name": grade, "Fnt": props["Fnt"], "Fnv": props["Fnv"]}
        for grade, props in BOLT_PROPERTIES.items()
    ]


def get_available_bolt_diameters() -> list:
    """Obtener lista de diametros de pernos disponibles"""
    return [
        {"id": dia, "name": dia, "d": props["d"], "Ab": props["Ab"]}
        for dia, props in BOLT_DIAMETERS.items()
    ]
