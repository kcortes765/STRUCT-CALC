"""
Combinaciones de carga según AISC 360 / ASCE 7
Implementa métodos LRFD y ASD para diseño estructural
"""

from typing import Any, Dict, List, Literal, Optional, Tuple


# ==================== COMBINACIONES LRFD (ASCE 7-16) ====================

LRFD_COMBINATIONS = [
    {
        "name": "1.4D",
        "description": "Carga muerta únicamente",
        "factors": {"D": 1.4}
    },
    {
        "name": "1.2D + 1.6L + 0.5(Lr o S)",
        "description": "Carga muerta + viva + techo/nieve",
        "factors": {"D": 1.2, "L": 1.6, "Lr": 0.5, "S": 0.5}
    },
    {
        "name": "1.2D + 1.6(Lr o S) + (L o 0.5W)",
        "description": "Carga muerta + techo/nieve + viva/viento",
        "factors": {"D": 1.2, "Lr": 1.6, "S": 1.6, "L": 1.0, "W": 0.5}
    },
    {
        "name": "1.2D + 1.0W + L + 0.5(Lr o S)",
        "description": "Carga muerta + viento + viva + techo/nieve",
        "factors": {"D": 1.2, "W": 1.0, "L": 1.0, "Lr": 0.5, "S": 0.5}
    },
    {
        "name": "1.2D + 1.0E + L + 0.2S",
        "description": "Carga muerta + sismo + viva + nieve",
        "factors": {"D": 1.2, "E": 1.0, "L": 1.0, "S": 0.2}
    },
    {
        "name": "0.9D + 1.0W",
        "description": "Carga muerta mínima + viento (levantamiento)",
        "factors": {"D": 0.9, "W": 1.0}
    },
    {
        "name": "0.9D + 1.0E",
        "description": "Carga muerta mínima + sismo (levantamiento)",
        "factors": {"D": 0.9, "E": 1.0}
    }
]


# ==================== COMBINACIONES ASD (ASCE 7-16) ====================

ASD_COMBINATIONS = [
    {
        "name": "D",
        "description": "Carga muerta únicamente",
        "factors": {"D": 1.0}
    },
    {
        "name": "D + L",
        "description": "Carga muerta + viva",
        "factors": {"D": 1.0, "L": 1.0}
    },
    {
        "name": "D + (Lr o S)",
        "description": "Carga muerta + techo/nieve",
        "factors": {"D": 1.0, "Lr": 1.0, "S": 1.0}
    },
    {
        "name": "D + 0.75L + 0.75(Lr o S)",
        "description": "Carga muerta + viva + techo/nieve",
        "factors": {"D": 1.0, "L": 0.75, "Lr": 0.75, "S": 0.75}
    },
    {
        "name": "D + (0.6W o 0.7E)",
        "description": "Carga muerta + viento o sismo",
        "factors": {"D": 1.0, "W": 0.6, "E": 0.7}
    },
    {
        "name": "D + 0.75L + 0.75(0.6W) + 0.75(Lr o S)",
        "description": "Carga muerta + viva + viento + techo/nieve",
        "factors": {"D": 1.0, "L": 0.75, "W": 0.45, "Lr": 0.75, "S": 0.75}
    },
    {
        "name": "D + 0.75L + 0.75(0.7E) + 0.75S",
        "description": "Carga muerta + viva + sismo + nieve",
        "factors": {"D": 1.0, "L": 0.75, "E": 0.525, "S": 0.75}
    },
    {
        "name": "0.6D + 0.6W",
        "description": "Carga muerta mínima + viento (levantamiento)",
        "factors": {"D": 0.6, "W": 0.6}
    },
    {
        "name": "0.6D + 0.7E",
        "description": "Carga muerta mínima + sismo (levantamiento)",
        "factors": {"D": 0.6, "E": 0.7}
    }
]


# ==================== TIPOS DE CARGA ====================

LOAD_TYPE_LABELS = {
    "D": "Carga Muerta (Dead)",
    "L": "Carga Viva (Live)",
    "Lr": "Carga Viva Techo (Roof Live)",
    "S": "Nieve (Snow)",
    "W": "Viento (Wind)",
    "E": "Sismo (Earthquake)",
    "R": "Lluvia (Rain)",
    "H": "Peso de Suelos (Soil)",
    "F": "Fluidos (Fluid)",
    "T": "Temperatura (Temperature)"
}


# ==================== FUNCIONES PRINCIPALES ====================

def get_combinations(method: Literal["LRFD", "ASD"]) -> List[Dict]:
    """
    Obtener las combinaciones de carga según el método de diseño

    Args:
        method: Método de diseño ("LRFD" o "ASD")

    Returns:
        Lista de combinaciones con nombre, descripción y factores
    """
    if method == "LRFD":
        return LRFD_COMBINATIONS
    elif method == "ASD":
        return ASD_COMBINATIONS
    else:
        raise ValueError(f"Método '{method}' no reconocido. Use 'LRFD' o 'ASD'")


def apply_combination(
    loads: Dict[str, float],
    combination: Dict
) -> float:
    """
    Aplicar una combinación de carga a un conjunto de cargas

    Args:
        loads: Diccionario con cargas {tipo: magnitud} (ej: {"D": 10, "L": 5})
        combination: Diccionario de combinación con factores

    Returns:
        Carga total factorizada

    Example:
        >>> loads = {"D": 10, "L": 5, "S": 2}
        >>> combo = {"factors": {"D": 1.2, "L": 1.6, "S": 0.5}}
        >>> apply_combination(loads, combo)
        22.0  # 1.2*10 + 1.6*5 + 0.5*2
    """
    total = 0.0
    factors = combination.get("factors", {})

    for load_type, factor in factors.items():
        load_value = loads.get(load_type, 0.0)
        total += factor * load_value

    return total


def get_critical_combination(
    loads: Dict[str, float],
    method: Literal["LRFD", "ASD"] = "LRFD",
    maximize: bool = True
) -> Tuple[Dict, float]:
    """
    Encontrar la combinación crítica que produce la mayor (o menor) solicitación

    Args:
        loads: Diccionario con cargas sin factorizar {tipo: magnitud}
        method: Método de diseño ("LRFD" o "ASD")
        maximize: Si True, busca la combinación máxima; si False, la mínima

    Returns:
        Tupla (combinación_crítica, carga_factorizada)

    Example:
        >>> loads = {"D": 15, "L": 10, "S": 3}
        >>> combo, value = get_critical_combination(loads, "LRFD")
        >>> print(f"{combo['name']}: {value:.2f} kN/m")
        1.2D + 1.6L + 0.5(Lr o S): 35.50 kN/m
    """
    combinations = get_combinations(method)

    critical_combo = None
    critical_value = float('-inf') if maximize else float('inf')

    for combo in combinations:
        value = apply_combination(loads, combo)

        if maximize and value > critical_value:
            critical_value = value
            critical_combo = combo
        elif not maximize and value < critical_value:
            critical_value = value
            critical_combo = combo

    return critical_combo, critical_value


def calculate_all_combinations(
    loads: Dict[str, float],
    method: Literal["LRFD", "ASD"] = "LRFD"
) -> List[Dict[str, Any]]:
    """
    Calcular todas las combinaciones de carga para un conjunto de cargas

    Args:
        loads: Diccionario con cargas sin factorizar
        method: Método de diseño

    Returns:
        Lista de resultados con cada combinación y su valor

    Example:
        >>> loads = {"D": 15, "L": 10}
        >>> results = calculate_all_combinations(loads, "LRFD")
        >>> for r in results:
        >>>     print(f"{r['name']}: {r['value']:.2f}")
    """
    combinations = get_combinations(method)
    results = []

    for combo in combinations:
        value = apply_combination(loads, combo)
        results.append({
            "name": combo["name"],
            "description": combo["description"],
            "value": value,
            "factors_used": {
                k: v for k, v in combo["factors"].items()
                if k in loads and loads[k] != 0
            }
        })

    # Ordenar por valor (descendente)
    results.sort(key=lambda x: x["value"], reverse=True)

    return results


def get_factored_loads(
    loads: Dict[str, float],
    combination: Dict
) -> Dict[str, float]:
    """
    Obtener las cargas factorizadas individualmente según una combinación

    Args:
        loads: Diccionario con cargas sin factorizar
        combination: Diccionario de combinación con factores

    Returns:
        Diccionario con cargas factorizadas por tipo

    Example:
        >>> loads = {"D": 10, "L": 5}
        >>> combo = {"factors": {"D": 1.2, "L": 1.6}}
        >>> get_factored_loads(loads, combo)
        {"D": 12.0, "L": 8.0}
    """
    factored = {}
    factors = combination.get("factors", {})

    for load_type in loads:
        factor = factors.get(load_type, 0.0)
        factored[load_type] = loads[load_type] * factor

    return factored


def validate_loads(loads: Dict[str, float]) -> bool:
    """
    Validar que las cargas ingresadas sean válidas

    Args:
        loads: Diccionario de cargas

    Returns:
        True si las cargas son válidas

    Raises:
        ValueError: Si hay cargas inválidas
    """
    valid_types = set(LOAD_TYPE_LABELS.keys())

    for load_type in loads:
        if load_type not in valid_types:
            raise ValueError(
                f"Tipo de carga '{load_type}' no reconocido. "
                f"Tipos válidos: {', '.join(valid_types)}"
            )

        if loads[load_type] < 0:
            raise ValueError(
                f"Carga '{load_type}' no puede ser negativa: {loads[load_type]}"
            )

    return True


# ==================== FUNCIONES AUXILIARES ====================

def get_load_type_description(load_type: str) -> str:
    """Obtener descripción de un tipo de carga"""
    return LOAD_TYPE_LABELS.get(load_type, "Desconocido")


def print_combination_summary(
    loads: Dict[str, float],
    method: Literal["LRFD", "ASD"] = "LRFD",
    max_results: int = 5
):
    """
    Imprimir resumen de combinaciones para debugging

    Args:
        loads: Diccionario de cargas sin factorizar
        method: Método de diseño
        max_results: Número máximo de combinaciones a mostrar
    """
    print(f"\n{'='*60}")
    print(f"RESUMEN DE COMBINACIONES - Método {method}")
    print(f"{'='*60}")

    print("\nCargas ingresadas (sin factorizar):")
    for load_type, value in loads.items():
        desc = get_load_type_description(load_type)
        print(f"  {load_type} ({desc}): {value:.2f}")

    results = calculate_all_combinations(loads, method)

    print(f"\nTop {max_results} combinaciones críticas:")
    for i, result in enumerate(results[:max_results], 1):
        print(f"\n{i}. {result['name']}")
        print(f"   {result['description']}")
        print(f"   Carga total: {result['value']:.2f}")
        if result['factors_used']:
            factors_str = ", ".join(
                f"{k}×{v:.2f}" for k, v in result['factors_used'].items()
            )
            print(f"   Factores aplicados: {factors_str}")

    print(f"\n{'='*60}\n")


# ==================== EJEMPLO DE USO ====================

if __name__ == "__main__":
    # Ejemplo: Viga con cargas distribuidas
    example_loads = {
        "D": 15.0,  # kN/m - Carga muerta (peso propio + acabados)
        "L": 10.0,  # kN/m - Carga viva (ocupación)
        "S": 3.0,   # kN/m - Nieve
    }

    print("EJEMPLO: Análisis de viga con cargas distribuidas")
    print_combination_summary(example_loads, "LRFD", max_results=5)

    # Obtener combinación crítica
    critical, value = get_critical_combination(example_loads, "LRFD")
    print(f"Combinación crítica LRFD:")
    print(f"  {critical['name']}: {value:.2f} kN/m")

    # Comparar con ASD
    critical_asd, value_asd = get_critical_combination(example_loads, "ASD")
    print(f"\nCombinación crítica ASD:")
    print(f"  {critical_asd['name']}: {value_asd:.2f} kN/m")

    print(f"\nRatio LRFD/ASD: {value/value_asd:.2f}")
