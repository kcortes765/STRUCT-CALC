"""
Materiales de Acero Estructural
Base de datos de propiedades de aceros según ASTM
"""

from typing import Dict, Any, Optional, List

# ==================== BASE DE DATOS DE ACEROS ====================

STEEL_GRADES: Dict[str, Dict[str, Any]] = {
    # Aceros estructurales comunes
    "A36": {
        "id": "A36",
        "name": "ASTM A36",
        "description": "Acero estructural carbono",
        "Fy": 250,      # MPa - Tensión de fluencia
        "Fu": 400,      # MPa - Tensión última
        "E": 200000,    # MPa - Módulo de elasticidad
        "G": 77000,     # MPa - Módulo de corte
        "nu": 0.3,      # Coeficiente de Poisson
        "rho": 7850,    # kg/m³ - Densidad
        "alpha": 1.2e-5 # 1/°C - Coef. dilatación térmica
    },
    "A572_GR50": {
        "id": "A572_GR50",
        "name": "ASTM A572 Grado 50",
        "description": "Acero alta resistencia baja aleación",
        "Fy": 345,
        "Fu": 450,
        "E": 200000,
        "G": 77000,
        "nu": 0.3,
        "rho": 7850,
        "alpha": 1.2e-5
    },
    "A992": {
        "id": "A992",
        "name": "ASTM A992",
        "description": "Acero para perfiles W",
        "Fy": 345,
        "Fu": 450,
        "E": 200000,
        "G": 77000,
        "nu": 0.3,
        "rho": 7850,
        "alpha": 1.2e-5
    },
    "A500_GR_B": {
        "id": "A500_GR_B",
        "name": "ASTM A500 Grado B",
        "description": "Acero para tubos estructurales",
        "Fy": 290,
        "Fu": 400,
        "E": 200000,
        "G": 77000,
        "nu": 0.3,
        "rho": 7850,
        "alpha": 1.2e-5
    },
    "A500_GR_C": {
        "id": "A500_GR_C",
        "name": "ASTM A500 Grado C",
        "description": "Acero para tubos estructurales alta resistencia",
        "Fy": 317,
        "Fu": 427,
        "E": 200000,
        "G": 77000,
        "nu": 0.3,
        "rho": 7850,
        "alpha": 1.2e-5
    },
    # Aceros chilenos (equivalentes)
    "A42_27ES": {
        "id": "A42_27ES",
        "name": "A42-27ES (NCh 203)",
        "description": "Acero estructural chileno (equiv. A36)",
        "Fy": 270,
        "Fu": 420,
        "E": 200000,
        "G": 77000,
        "nu": 0.3,
        "rho": 7850,
        "alpha": 1.2e-5
    },
    "A52_34ES": {
        "id": "A52_34ES",
        "name": "A52-34ES (NCh 203)",
        "description": "Acero estructural chileno alta resistencia",
        "Fy": 340,
        "Fu": 520,
        "E": 200000,
        "G": 77000,
        "nu": 0.3,
        "rho": 7850,
        "alpha": 1.2e-5
    },
}


def get_all_materials() -> List[Dict[str, Any]]:
    """Obtener todos los materiales disponibles"""
    return list(STEEL_GRADES.values())


def get_material_by_id(material_id: str) -> Optional[Dict[str, Any]]:
    """Obtener un material por su ID"""
    return STEEL_GRADES.get(material_id.upper())


def get_material_properties(material_id: str, units: str = "kN-m") -> Dict[str, float]:
    """
    Obtener propiedades del material convertidas a las unidades solicitadas
    
    Args:
        material_id: ID del material
        units: Sistema de unidades ("kN-m", "tonf-m", "kgf-cm")
    
    Returns:
        Diccionario con propiedades en las unidades solicitadas
    """
    material = get_material_by_id(material_id)
    if not material:
        raise ValueError(f"Material '{material_id}' no encontrado")
    
    # Propiedades base en MPa
    Fy = material["Fy"]
    Fu = material["Fu"]
    E = material["E"]
    G = material["G"]
    
    # Conversión según unidades
    if units == "kN-m":
        # MPa = N/mm² = kN/m² * 1000 -> Mantener en MPa para cálculos
        return {
            "Fy": Fy,           # MPa
            "Fu": Fu,           # MPa
            "E": E,             # MPa
            "G": G,             # MPa
            "nu": material["nu"],
            "rho": material["rho"],
        }
    elif units == "tonf-m":
        # 1 MPa = 0.10197 tonf/cm²
        # Para consistencia interna, mantener en MPa y convertir solo en salidas
        return {
            "Fy": Fy,           # Mantener en MPa
            "Fu": Fu,           # Mantener en MPa
            "E": E,             # Mantener en MPa
            "G": G,             # Mantener en MPa
            "nu": material["nu"],
            "rho": material["rho"],
        }
    elif units == "kgf-cm":
        # 1 MPa = 10.197 kgf/cm²
        # Para consistencia interna, mantener en MPa y convertir solo en salidas
        return {
            "Fy": Fy,           # Mantener en MPa
            "Fu": Fu,           # Mantener en MPa
            "E": E,             # Mantener en MPa
            "G": G,             # Mantener en MPa
            "nu": material["nu"],
            "rho": material["rho"],
        }
    else:
        raise ValueError(f"Unidades '{units}' no soportadas")
