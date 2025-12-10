"""
REPORTS - Generación de memorias de cálculo en PDF
Genera reportes profesionales con ReportLab para vigas y columnas
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.platypus.frames import Frame
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
from reportlab.pdfgen import canvas

router = APIRouter()


# ============================================================================
# PYDANTIC MODELS FOR REPORT REQUESTS
# ============================================================================

class BeamReportRequest(BaseModel):
    """Request model for beam calculation report"""
    # Input data
    length: float
    section_id: str
    material_id: str
    support_left: str
    support_right: str
    units: str = "kN-m"

    # Loads
    point_loads: Optional[List[Dict]] = []
    distributed_loads: Optional[List[Dict]] = []

    # Results
    max_moment: float
    max_shear: float
    max_deflection: float

    # Reactions
    reaction_left_ry: Optional[float] = 0
    reaction_left_rx: Optional[float] = 0
    reaction_left_mz: Optional[float] = 0
    reaction_right_ry: Optional[float] = 0
    reaction_right_rx: Optional[float] = 0
    reaction_right_mz: Optional[float] = 0

    # Section properties
    section_depth: Optional[float] = 0
    section_width: Optional[float] = 0
    section_weight: Optional[float] = 0
    section_ix: Optional[float] = 0
    section_zx: Optional[float] = 0

    # Material properties
    material_fy: Optional[float] = 345
    material_e: Optional[float] = 200000

    # Verification results
    flexure_mu: float
    flexure_phi_mn: float
    flexure_ratio: float
    flexure_ok: bool
    flexure_zone: Optional[str] = "compact"

    shear_vu: float
    shear_phi_vn: float
    shear_ratio: float
    shear_ok: bool

    deflection_l180_limit: float
    deflection_l180_actual: float
    deflection_l180_ok: bool
    deflection_l240_limit: float
    deflection_l240_actual: float
    deflection_l240_ok: bool
    deflection_l360_limit: float
    deflection_l360_actual: float
    deflection_l360_ok: bool

    overall_ok: bool

    # Load combinations (optional)
    load_combination_method: Optional[str] = None
    load_combination_name: Optional[str] = None
    load_combination_factored_load: Optional[float] = None

    # Optional metadata
    project_name: str = "Proyecto de Estructuras"
    engineer: str = ""
    date: str = ""
    notes: str = ""


class ColumnReportRequest(BaseModel):
    """Request model for column calculation report"""
    # Input data
    height: float
    section_id: str
    material_id: str
    base: str
    top: str
    units: str = "kN-m"

    # Loads
    axial_load: float
    moment_top: Optional[float] = 0
    moment_base: Optional[float] = 0

    # Results
    k_factor: float
    kl_r: float
    pcr: float

    # Section properties
    section_depth: Optional[float] = 0
    section_width: Optional[float] = 0
    section_weight: Optional[float] = 0
    section_rx: Optional[float] = 0
    section_ry: Optional[float] = 0

    # Material properties
    material_fy: Optional[float] = 345
    material_e: Optional[float] = 200000

    # Verification results
    compression_pu: float
    compression_phi_pn: float
    compression_fcr: float
    compression_ratio: float
    compression_ok: bool

    flexure_mu: Optional[float] = 0
    flexure_phi_mn: Optional[float] = 0
    flexure_ratio: Optional[float] = 0

    interaction_equation: Optional[str] = "H1-1a"
    interaction_value: float
    interaction_pr_pc: float
    interaction_mr_mc: float
    interaction_utilization: float
    interaction_ok: bool

    overall_ok: bool

    # Load combinations (optional)
    load_combination_method: Optional[str] = None
    load_combination_name: Optional[str] = None
    load_combination_factored_load: Optional[float] = None

    # Optional metadata
    project_name: str = "Proyecto de Estructuras"
    engineer: str = ""
    date: str = ""
    notes: str = ""


# ============================================================================
# PDF GENERATION UTILITIES
# ============================================================================

def create_header_footer(canvas_obj, doc):
    """Draw header and footer on each page"""
    canvas_obj.saveState()

    # Header
    canvas_obj.setFont('Helvetica-Bold', 10)
    canvas_obj.drawString(50, A4[1] - 30, "STRUCT-CALC ACERO")
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.drawRightString(A4[0] - 50, A4[1] - 30, f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    canvas_obj.line(50, A4[1] - 35, A4[0] - 50, A4[1] - 35)

    # Footer
    canvas_obj.line(50, 40, A4[0] - 50, 40)
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.drawString(50, 25, "Memoria de Cálculo - AISC 360")
    canvas_obj.drawRightString(A4[0] - 50, 25, f"Página {doc.page}")

    canvas_obj.restoreState()


def get_unit_labels(units: str) -> Dict[str, str]:
    """Get unit labels based on unit system"""
    unit_systems = {
        "kN-m": {"force": "kN", "length": "m", "moment": "kN-m", "stress": "MPa"},
        "tonf-m": {"force": "tonf", "length": "m", "moment": "tonf-m", "stress": "kgf/cm²"},
        "kgf-cm": {"force": "kgf", "length": "cm", "moment": "kgf-cm", "stress": "kgf/cm²"},
    }
    return unit_systems.get(units, unit_systems["kN-m"])


def create_title_section(title: str, styles):
    """Create title section"""
    elements = []
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=18,
        textColor=colors.HexColor('#1e3a8a'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    elements.append(Paragraph(title, title_style))
    return elements


def create_info_table(data: List[List], col_widths=None):
    """Create a formatted info table"""
    if col_widths is None:
        col_widths = [4*inch, 2*inch]

    table = Table(data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1e293b')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return table


def create_results_table(data: List[List], header_color='#3b82f6'):
    """Create results table with header"""
    table = Table(data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
    table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(header_color)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        # Data rows
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1e293b')),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica'),
        ('FONTNAME', (1, 1), (-1, -1), 'Courier'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
        # Grid
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return table


def create_verification_table(checks: List[Dict], header_color='#10b981'):
    """Create verification table with OK/NO OK status"""
    data = [['Verificación', 'Demanda / Capacidad', 'Ratio', 'Estado']]

    for check in checks:
        status = 'OK' if check['ok'] else 'NO OK'
        ratio_str = f"{check['ratio']*100:.1f}%"
        demand_capacity = f"{check['demand']:.1f} / {check['capacity']:.1f} {check['unit']}"
        data.append([
            check['label'],
            demand_capacity,
            ratio_str,
            status
        ])

    table = Table(data, colWidths=[2*inch, 2.2*inch, 1*inch, 0.8*inch])

    # Base style
    style = [
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(header_color)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        # Data
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1e293b')),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica'),
        ('FONTNAME', (1, 1), (-1, -1), 'Courier'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]

    # Color status column
    for i, check in enumerate(checks, start=1):
        if check['ok']:
            style.append(('BACKGROUND', (3, i), (3, i), colors.HexColor('#d1fae5')))
            style.append(('TEXTCOLOR', (3, i), (3, i), colors.HexColor('#065f46')))
        else:
            style.append(('BACKGROUND', (3, i), (3, i), colors.HexColor('#fee2e2')))
            style.append(('TEXTCOLOR', (3, i), (3, i), colors.HexColor('#991b1b')))
        style.append(('FONTNAME', (3, i), (3, i), 'Helvetica-Bold'))

    table.setStyle(TableStyle(style))
    return table


def create_conclusion_box(overall_ok: bool, styles):
    """Create conclusion box"""
    elements = []

    if overall_ok:
        bg_color = colors.HexColor('#d1fae5')
        text_color = colors.HexColor('#065f46')
        conclusion_text = "LA SECCIÓN CUMPLE CON TODOS LOS REQUISITOS"
        icon = "✓"
    else:
        bg_color = colors.HexColor('#fee2e2')
        text_color = colors.HexColor('#991b1b')
        conclusion_text = "LA SECCIÓN NO CUMPLE - REDIMENSIONAR"
        icon = "✗"

    conclusion_style = ParagraphStyle(
        'Conclusion',
        parent=styles['Normal'],
        fontSize=14,
        fontName='Helvetica-Bold',
        textColor=text_color,
        alignment=TA_CENTER,
        spaceAfter=10,
        spaceBefore=10
    )

    data = [[Paragraph(f"{icon}  {conclusion_text}", conclusion_style)]]
    table = Table(data, colWidths=[6*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_color),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 20),
        ('RIGHTPADDING', (0, 0), (-1, -1), 20),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ('BOX', (0, 0), (-1, -1), 2, text_color),
    ]))

    elements.append(table)
    return elements


# ============================================================================
# BEAM REPORT GENERATOR
# ============================================================================

@router.post("/beam")
async def generate_beam_report(request: BeamReportRequest):
    """Generate professional beam calculation report in PDF format"""

    try:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=50,
            leftMargin=50,
            topMargin=60,
            bottomMargin=60
        )

        styles = getSampleStyleSheet()
        elements = []
        unit_labels = get_unit_labels(request.units)

        # ====================================================================
        # TITLE
        # ====================================================================
        elements.extend(create_title_section("MEMORIA DE CÁLCULO - VIGA DE ACERO", styles))
        elements.append(Spacer(1, 0.2*inch))

        # ====================================================================
        # PROJECT INFO
        # ====================================================================
        heading_style = ParagraphStyle(
            'Heading2Custom',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#1e3a8a'),
            spaceAfter=12,
            fontName='Helvetica-Bold'
        )

        elements.append(Paragraph("1. INFORMACIÓN DEL PROYECTO", heading_style))

        project_data = [
            ['Proyecto:', request.project_name],
            ['Fecha:', request.date or datetime.now().strftime('%d/%m/%Y')],
            ['Ingeniero:', request.engineer or 'No especificado'],
        ]
        elements.append(create_info_table(project_data))
        elements.append(Spacer(1, 0.3*inch))

        # ====================================================================
        # INPUT DATA
        # ====================================================================
        elements.append(Paragraph("2. DATOS DE ENTRADA", heading_style))

        # Geometry and supports
        support_labels = {
            'fixed': 'Empotrado',
            'pinned': 'Articulado',
            'roller': 'Rodillo',
            'free': 'Libre'
        }

        input_data = [
            ['Longitud de la viga:', f"{request.length} {unit_labels['length']}"],
            ['Apoyo izquierdo:', support_labels.get(request.support_left, request.support_left)],
            ['Apoyo derecho:', support_labels.get(request.support_right, request.support_right)],
            ['Sistema de unidades:', request.units],
        ]
        elements.append(create_info_table(input_data))
        elements.append(Spacer(1, 0.2*inch))

        # Section properties
        elements.append(Paragraph("2.1 Perfil Estructural", styles['Heading3']))
        section_data = [
            ['Designación:', request.section_id],
            ['Profundidad:', f"{request.section_depth} mm" if request.section_depth else "N/A"],
            ['Ancho de ala:', f"{request.section_width} mm" if request.section_width else "N/A"],
            ['Peso:', f"{request.section_weight} kg/m" if request.section_weight else "N/A"],
            ['Momento de inercia Ix:', f"{request.section_ix} cm⁴" if request.section_ix else "N/A"],
            ['Módulo plástico Zx:', f"{request.section_zx} cm³" if request.section_zx else "N/A"],
        ]
        elements.append(create_info_table(section_data))
        elements.append(Spacer(1, 0.2*inch))

        # Material properties
        elements.append(Paragraph("2.2 Material", styles['Heading3']))
        material_data = [
            ['Especificación:', request.material_id],
            ['Esfuerzo de fluencia Fy:', f"{request.material_fy} MPa"],
            ['Módulo de elasticidad E:', f"{request.material_e} MPa"],
        ]
        elements.append(create_info_table(material_data))
        elements.append(Spacer(1, 0.2*inch))

        # Loads
        elements.append(Paragraph("2.3 Cargas Aplicadas", styles['Heading3']))

        if request.load_combination_method:
            load_text = f"<b>Método de diseño:</b> {request.load_combination_method}<br/>"
            load_text += f"<b>Combinación crítica:</b> {request.load_combination_name}<br/>"
            load_text += f"<b>Carga factorizada:</b> {request.load_combination_factored_load:.2f} {unit_labels['force']}/{unit_labels['length']}"
            elements.append(Paragraph(load_text, styles['Normal']))
        else:
            # Distributed loads
            if request.distributed_loads:
                dl_text = "<b>Cargas distribuidas:</b><br/>"
                for i, load in enumerate(request.distributed_loads, 1):
                    dl_text += f"  {i}. w = {load.get('w_start', 0)} {unit_labels['force']}/{unit_labels['length']} "
                    dl_text += f"desde x={load.get('start', 0)} hasta x={load.get('end', request.length)} {unit_labels['length']}<br/>"
                elements.append(Paragraph(dl_text, styles['Normal']))

            # Point loads
            if request.point_loads:
                pl_text = "<b>Cargas puntuales:</b><br/>"
                for i, load in enumerate(request.point_loads, 1):
                    pl_text += f"  {i}. Fy = {load.get('Fy', 0)} {unit_labels['force']} "
                    pl_text += f"en x={load.get('position', 0)} {unit_labels['length']}<br/>"
                elements.append(Paragraph(pl_text, styles['Normal']))

        elements.append(Spacer(1, 0.3*inch))

        # ====================================================================
        # ANALYSIS RESULTS
        # ====================================================================
        elements.append(Paragraph("3. RESULTADOS DEL ANÁLISIS", heading_style))

        results_data = [
            ['Parámetro', 'Valor', 'Unidad'],
            ['Momento flector máximo', f"{request.max_moment:.2f}", unit_labels['moment']],
            ['Cortante máximo', f"{request.max_shear:.2f}", unit_labels['force']],
            ['Deflexión máxima', f"{request.max_deflection*1000:.2f}", 'mm'],
        ]
        elements.append(create_results_table(results_data, header_color='#3b82f6'))
        elements.append(Spacer(1, 0.2*inch))

        # Reactions
        elements.append(Paragraph("3.1 Reacciones en Apoyos", styles['Heading3']))
        reactions_data = [
            ['Apoyo', 'Rx', 'Ry', 'Mz'],
            [
                'Izquierdo',
                f"{abs(request.reaction_left_rx):.2f}",
                f"{abs(request.reaction_left_ry):.2f}",
                f"{abs(request.reaction_left_mz):.2f}" if request.reaction_left_mz != 0 else "-"
            ],
            [
                'Derecho',
                f"{abs(request.reaction_right_rx):.2f}",
                f"{abs(request.reaction_right_ry):.2f}",
                f"{abs(request.reaction_right_mz):.2f}" if request.reaction_right_mz != 0 else "-"
            ],
        ]
        reactions_table = Table(reactions_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        reactions_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#64748b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 1), (-1, -1), 'Courier'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(reactions_table)
        elements.append(Spacer(1, 0.3*inch))

        # ====================================================================
        # VERIFICATION AISC 360
        # ====================================================================
        elements.append(Paragraph("4. VERIFICACIÓN SEGÚN AISC 360", heading_style))

        verification_checks = [
            {
                'label': f'Flexión (Zona {request.flexure_zone})',
                'demand': request.flexure_mu,
                'capacity': request.flexure_phi_mn,
                'ratio': request.flexure_ratio,
                'ok': request.flexure_ok,
                'unit': unit_labels['moment']
            },
            {
                'label': 'Cortante',
                'demand': request.shear_vu,
                'capacity': request.shear_phi_vn,
                'ratio': request.shear_ratio,
                'ok': request.shear_ok,
                'unit': unit_labels['force']
            },
        ]

        elements.append(create_verification_table(verification_checks, header_color='#10b981'))
        elements.append(Spacer(1, 0.2*inch))

        # Deflection checks
        elements.append(Paragraph("4.1 Verificación de Deflexiones", styles['Heading3']))
        deflection_data = [
            ['Límite', 'Máximo Permisible', 'Actual', 'Estado'],
            [
                'L/180',
                f"{request.deflection_l180_limit:.2f} mm",
                f"{request.deflection_l180_actual:.2f} mm",
                'OK' if request.deflection_l180_ok else 'NO OK'
            ],
            [
                'L/240',
                f"{request.deflection_l240_limit:.2f} mm",
                f"{request.deflection_l240_actual:.2f} mm",
                'OK' if request.deflection_l240_ok else 'NO OK'
            ],
            [
                'L/360',
                f"{request.deflection_l360_limit:.2f} mm",
                f"{request.deflection_l360_actual:.2f} mm",
                'OK' if request.deflection_l360_ok else 'NO OK'
            ],
        ]

        deflection_table = Table(deflection_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        style_list = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 1), (-1, -1), 'Courier'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]

        # Color status
        if request.deflection_l180_ok:
            style_list.append(('BACKGROUND', (3, 1), (3, 1), colors.HexColor('#d1fae5')))
            style_list.append(('TEXTCOLOR', (3, 1), (3, 1), colors.HexColor('#065f46')))
        else:
            style_list.append(('BACKGROUND', (3, 1), (3, 1), colors.HexColor('#fee2e2')))
            style_list.append(('TEXTCOLOR', (3, 1), (3, 1), colors.HexColor('#991b1b')))

        if request.deflection_l240_ok:
            style_list.append(('BACKGROUND', (3, 2), (3, 2), colors.HexColor('#d1fae5')))
            style_list.append(('TEXTCOLOR', (3, 2), (3, 2), colors.HexColor('#065f46')))
        else:
            style_list.append(('BACKGROUND', (3, 2), (3, 2), colors.HexColor('#fee2e2')))
            style_list.append(('TEXTCOLOR', (3, 2), (3, 2), colors.HexColor('#991b1b')))

        if request.deflection_l360_ok:
            style_list.append(('BACKGROUND', (3, 3), (3, 3), colors.HexColor('#d1fae5')))
            style_list.append(('TEXTCOLOR', (3, 3), (3, 3), colors.HexColor('#065f46')))
        else:
            style_list.append(('BACKGROUND', (3, 3), (3, 3), colors.HexColor('#fee2e2')))
            style_list.append(('TEXTCOLOR', (3, 3), (3, 3), colors.HexColor('#991b1b')))

        deflection_table.setStyle(TableStyle(style_list))
        elements.append(deflection_table)
        elements.append(Spacer(1, 0.3*inch))

        # ====================================================================
        # CONCLUSION
        # ====================================================================
        elements.append(Paragraph("5. CONCLUSIÓN", heading_style))
        elements.extend(create_conclusion_box(request.overall_ok, styles))

        # Additional notes
        if request.notes:
            elements.append(Spacer(1, 0.2*inch))
            elements.append(Paragraph("6. NOTAS ADICIONALES", heading_style))
            elements.append(Paragraph(request.notes, styles['Normal']))

        # ====================================================================
        # BUILD PDF
        # ====================================================================
        doc.build(elements, onFirstPage=create_header_footer, onLaterPages=create_header_footer)
        buffer.seek(0)

        # Generate filename
        filename = f"memoria_viga_{request.section_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando reporte: {str(e)}")


# ============================================================================
# COLUMN REPORT GENERATOR
# ============================================================================

@router.post("/column")
async def generate_column_report(request: ColumnReportRequest):
    """Generate professional column calculation report in PDF format"""

    try:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=50,
            leftMargin=50,
            topMargin=60,
            bottomMargin=60
        )

        styles = getSampleStyleSheet()
        elements = []
        unit_labels = get_unit_labels(request.units)

        # ====================================================================
        # TITLE
        # ====================================================================
        elements.extend(create_title_section("MEMORIA DE CÁLCULO - COLUMNA DE ACERO", styles))
        elements.append(Spacer(1, 0.2*inch))

        # ====================================================================
        # PROJECT INFO
        # ====================================================================
        heading_style = ParagraphStyle(
            'Heading2Custom',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#1e3a8a'),
            spaceAfter=12,
            fontName='Helvetica-Bold'
        )

        elements.append(Paragraph("1. INFORMACIÓN DEL PROYECTO", heading_style))

        project_data = [
            ['Proyecto:', request.project_name],
            ['Fecha:', request.date or datetime.now().strftime('%d/%m/%Y')],
            ['Ingeniero:', request.engineer or 'No especificado'],
        ]
        elements.append(create_info_table(project_data))
        elements.append(Spacer(1, 0.3*inch))

        # ====================================================================
        # INPUT DATA
        # ====================================================================
        elements.append(Paragraph("2. DATOS DE ENTRADA", heading_style))

        # Geometry and boundary conditions
        support_labels = {
            'fixed': 'Empotrado',
            'pinned': 'Articulado',
            'free': 'Libre'
        }

        input_data = [
            ['Altura de la columna:', f"{request.height} {unit_labels['length']}"],
            ['Condición en base:', support_labels.get(request.base, request.base)],
            ['Condición en tope:', support_labels.get(request.top, request.top)],
            ['Factor de longitud efectiva K:', f"{request.k_factor:.2f}"],
            ['Sistema de unidades:', request.units],
        ]
        elements.append(create_info_table(input_data))
        elements.append(Spacer(1, 0.2*inch))

        # Section properties
        elements.append(Paragraph("2.1 Perfil Estructural", styles['Heading3']))
        section_data = [
            ['Designación:', request.section_id],
            ['Profundidad:', f"{request.section_depth} mm" if request.section_depth else "N/A"],
            ['Ancho:', f"{request.section_width} mm" if request.section_width else "N/A"],
            ['Peso:', f"{request.section_weight} kg/m" if request.section_weight else "N/A"],
            ['Radio de giro rx:', f"{request.section_rx} cm" if request.section_rx else "N/A"],
            ['Radio de giro ry:', f"{request.section_ry} cm" if request.section_ry else "N/A"],
        ]
        elements.append(create_info_table(section_data))
        elements.append(Spacer(1, 0.2*inch))

        # Material properties
        elements.append(Paragraph("2.2 Material", styles['Heading3']))
        material_data = [
            ['Especificación:', request.material_id],
            ['Esfuerzo de fluencia Fy:', f"{request.material_fy} MPa"],
            ['Módulo de elasticidad E:', f"{request.material_e} MPa"],
        ]
        elements.append(create_info_table(material_data))
        elements.append(Spacer(1, 0.2*inch))

        # Loads
        elements.append(Paragraph("2.3 Cargas Aplicadas", styles['Heading3']))

        if request.load_combination_method:
            load_text = f"<b>Método de diseño:</b> {request.load_combination_method}<br/>"
            load_text += f"<b>Combinación crítica:</b> {request.load_combination_name}<br/>"
            load_text += f"<b>Carga axial factorizada:</b> {request.load_combination_factored_load:.1f} {unit_labels['force']}"
        else:
            load_text = f"<b>Carga axial P:</b> {request.axial_load} {unit_labels['force']} (Compresión)<br/>"
            if request.moment_top and request.moment_top != 0:
                load_text += f"<b>Momento en tope:</b> {request.moment_top} {unit_labels['moment']}<br/>"
            if request.moment_base and request.moment_base != 0:
                load_text += f"<b>Momento en base:</b> {request.moment_base} {unit_labels['moment']}<br/>"

        elements.append(Paragraph(load_text, styles['Normal']))
        elements.append(Spacer(1, 0.3*inch))

        # ====================================================================
        # ANALYSIS RESULTS
        # ====================================================================
        elements.append(Paragraph("3. RESULTADOS DEL ANÁLISIS", heading_style))

        results_data = [
            ['Parámetro', 'Valor', 'Unidad'],
            ['Esbeltez KL/r', f"{request.kl_r:.1f}", '-'],
            ['Carga crítica de Euler Pcr', f"{request.pcr:.1f}", unit_labels['force']],
            ['Esfuerzo crítico Fcr', f"{request.compression_fcr:.1f}", 'MPa'],
        ]
        elements.append(create_results_table(results_data, header_color='#3b82f6'))
        elements.append(Spacer(1, 0.3*inch))

        # ====================================================================
        # VERIFICATION AISC 360
        # ====================================================================
        elements.append(Paragraph("4. VERIFICACIÓN SEGÚN AISC 360", heading_style))

        elements.append(Paragraph("4.1 Compresión (Capítulo E)", styles['Heading3']))
        compression_checks = [
            {
                'label': 'Compresión axial',
                'demand': request.compression_pu,
                'capacity': request.compression_phi_pn,
                'ratio': request.compression_ratio,
                'ok': request.compression_ok,
                'unit': unit_labels['force']
            },
        ]
        elements.append(create_verification_table(compression_checks, header_color='#10b981'))
        elements.append(Spacer(1, 0.2*inch))

        # Flexure if applicable
        if request.flexure_mu and request.flexure_mu > 0:
            elements.append(Paragraph("4.2 Flexión (Capítulo F)", styles['Heading3']))
            flexure_checks = [
                {
                    'label': 'Momento flector',
                    'demand': request.flexure_mu,
                    'capacity': request.flexure_phi_mn,
                    'ratio': request.flexure_ratio,
                    'ok': request.flexure_ratio <= 1.0,
                    'unit': unit_labels['moment']
                },
            ]
            elements.append(create_verification_table(flexure_checks, header_color='#10b981'))
            elements.append(Spacer(1, 0.2*inch))

        # Interaction
        elements.append(Paragraph("4.3 Interacción Flexo-Compresión (Capítulo H)", styles['Heading3']))

        interaction_text = f"<b>Ecuación aplicada:</b> AISC {request.interaction_equation}<br/><br/>"
        interaction_text += f"<b>Pr/Pc:</b> {request.interaction_pr_pc:.3f}<br/>"
        interaction_text += f"<b>Mr/Mc:</b> {request.interaction_mr_mc:.3f}<br/>"
        interaction_text += f"<b>Valor de interacción:</b> {request.interaction_value:.3f} ≤ 1.0<br/>"
        interaction_text += f"<b>Utilización:</b> {request.interaction_utilization:.1f}%<br/>"

        elements.append(Paragraph(interaction_text, styles['Normal']))

        interaction_data = [[
            'Interacción',
            f"{request.interaction_value:.3f}",
            f"{request.interaction_utilization:.1f}%",
            'OK' if request.interaction_ok else 'NO OK'
        ]]

        interaction_table = Table(interaction_data, colWidths=[2*inch, 2.2*inch, 1*inch, 0.8*inch])
        style_list = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981') if request.interaction_ok else colors.HexColor('#ef4444')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (1, 0), (-1, 0), 'Courier-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]

        interaction_table.setStyle(TableStyle(style_list))
        elements.append(interaction_table)
        elements.append(Spacer(1, 0.3*inch))

        # ====================================================================
        # CONCLUSION
        # ====================================================================
        elements.append(Paragraph("5. CONCLUSIÓN", heading_style))
        elements.extend(create_conclusion_box(request.overall_ok, styles))

        # Additional notes
        if request.notes:
            elements.append(Spacer(1, 0.2*inch))
            elements.append(Paragraph("6. NOTAS ADICIONALES", heading_style))
            elements.append(Paragraph(request.notes, styles['Normal']))

        # ====================================================================
        # BUILD PDF
        # ====================================================================
        doc.build(elements, onFirstPage=create_header_footer, onLaterPages=create_header_footer)
        buffer.seek(0)

        # Generate filename
        filename = f"memoria_columna_{request.section_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando reporte: {str(e)}")


@router.get("/health")
async def reports_health():
    """Health check for reports module"""
    try:
        # Test reportlab import
        from reportlab.lib import colors
        return {"status": "healthy", "reportlab": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
