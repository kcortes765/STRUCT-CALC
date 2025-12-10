"""
Script de prueba para verificar el módulo de pórticos con cargas distribuidas
"""

from engine.opensees_runner import analyze_frame
from pydantic import BaseModel
from typing import List, Optional, Literal

# Definir modelos de prueba
class FrameNode(BaseModel):
    id: int
    x: float
    y: float
    support: Optional[Literal["fixed", "pinned", "roller", "free"]] = None

class FrameElement(BaseModel):
    id: int
    node_i: int
    node_j: int
    section_id: str
    element_type: Literal["beam", "column", "brace"] = "beam"

class FrameLoad(BaseModel):
    type: Literal["nodal", "distributed", "point"]
    element_id: Optional[int] = None
    node_id: Optional[int] = None
    Fx: float = 0
    Fy: float = 0
    Mz: float = 0
    w: Optional[float] = None
    position: Optional[float] = None

# Crear un pórtico simple con carga distribuida
nodes = [
    FrameNode(id=1, x=0, y=0, support="fixed"),
    FrameNode(id=2, x=6, y=0, support="fixed"),
    FrameNode(id=3, x=0, y=4),
    FrameNode(id=4, x=6, y=4),
]

elements = [
    FrameElement(id=1, node_i=1, node_j=3, section_id="W310X39", element_type="column"),
    FrameElement(id=2, node_i=2, node_j=4, section_id="W310X39", element_type="column"),
    FrameElement(id=3, node_i=3, node_j=4, section_id="W360X44", element_type="beam"),
]

loads = [
    FrameLoad(type="nodal", node_id=3, Fx=50, Fy=0, Mz=0),
    FrameLoad(type="nodal", node_id=4, Fx=50, Fy=0, Mz=0),
    FrameLoad(type="distributed", element_id=3, w=-15),  # Carga distribuida en viga
]

print("=" * 60)
print("PRUEBA: Análisis de Pórtico con Carga Distribuida")
print("=" * 60)
print("\nConfiguración:")
print(f"  Nodos: {len(nodes)}")
print(f"  Elementos: {len(elements)}")
print(f"  Cargas: {len(loads)}")
print(f"    - Nodales: {sum(1 for l in loads if l.type == 'nodal')}")
print(f"    - Distribuidas: {sum(1 for l in loads if l.type == 'distributed')}")

try:
    # Ejecutar análisis
    print("\n[1/2] Ejecutando análisis estructural...")
    result = analyze_frame(
        nodes=nodes,
        elements=elements,
        loads=loads,
        material_id="A572_GR50",
        units="kN-m"
    )

    if result.get("status") == "success":
        print("✓ Análisis estructural completado exitosamente")

        # Mostrar algunas reacciones
        print("\nReacciones en apoyos:")
        for node_id, reaction in result.get("reactions", {}).items():
            print(f"  Nodo {node_id}:")
            print(f"    Rx = {reaction['Rx']:.2f} kN")
            print(f"    Ry = {reaction['Ry']:.2f} kN")
            print(f"    Mz = {reaction['Mz']:.2f} kN·m")

        # Mostrar fuerzas en elementos
        print("\nFuerzas en elementos:")
        for elem_id, forces in result.get("element_forces", {}).items():
            print(f"  Elemento {elem_id}:")
            print(f"    N = {forces['N']:.2f} kN")
            print(f"    V_i = {forces['V_i']:.2f} kN, V_j = {forces['V_j']:.2f} kN")
            print(f"    M_i = {forces['M_i']:.2f} kN·m, M_j = {forces['M_j']:.2f} kN·m")

        # Verificar elementos
        print("\n[2/2] Verificando elementos según AISC 360...")
        from engine.frame_verification import verify_frame_elements
        from engine.materials import get_material_properties

        material = get_material_properties("A572_GR50")
        verifications = verify_frame_elements(
            elements=elements,
            element_forces=result.get("element_forces", {}),
            sections={},
            material=material,
            nodes=nodes,
            units="kN-m"
        )

        print("✓ Verificación de elementos completada")

        print("\nResultados de verificación:")
        print(f"{'Elem':<6} {'Tipo':<8} {'Perfil':<12} {'Ratio':<8} {'Estado'}")
        print("-" * 50)

        for ver in verifications:
            elem_id = ver["element_id"]
            elem_type = ver["type"]
            section_id = ver["section_id"]
            ratio = ver["max_ratio"]
            ok = ver["overall_ok"]

            status = "✓ OK" if ok else "✗ FALLA"
            status_color = status

            print(f"{elem_id:<6} {elem_type:<8} {section_id:<12} {ratio:<8.3f} {status_color}")

        # Resumen
        all_ok = all(v["overall_ok"] for v in verifications)
        max_ratio = max((v["max_ratio"] for v in verifications), default=0)

        print("\n" + "=" * 60)
        print("RESUMEN DE VERIFICACIÓN")
        print("=" * 60)
        print(f"Estado general: {'✓ TODOS LOS ELEMENTOS CUMPLEN' if all_ok else '✗ ALGUNOS ELEMENTOS NO CUMPLEN'}")
        print(f"Utilización máxima: {max_ratio * 100:.1f}%")
        print(f"Elementos verificados: {len(verifications)}")
        print(f"Elementos OK: {sum(1 for v in verifications if v['overall_ok'])}")
        print(f"Elementos con falla: {sum(1 for v in verifications if not v['overall_ok'])}")

    else:
        print(f"✗ Error en análisis: {result.get('message', 'Error desconocido')}")

except Exception as e:
    print(f"\n✗ ERROR: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("Prueba finalizada")
print("=" * 60)
