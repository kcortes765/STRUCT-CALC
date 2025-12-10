// ==================== UNITS ====================

export type UnitSystem = "kN-m" | "tonf-m" | "kgf-cm";

export const UNIT_LABELS: Record<UnitSystem, {
    force: string;
    moment: string;
    length: string;
    stress: string;
    displacement: string;
}> = {
    "kN-m": {
        force: "kN",
        moment: "kN·m",
        length: "m",
        stress: "MPa",
        displacement: "mm"
    },
    "tonf-m": {
        force: "tonf",
        moment: "tonf·m",
        length: "m",
        stress: "MPa",
        displacement: "mm"
    },
    "kgf-cm": {
        force: "kgf",
        moment: "kgf·cm",
        length: "cm",
        stress: "kgf/cm²",
        displacement: "cm"
    }
};

// ==================== MATERIALS ====================

export interface SteelMaterial {
    id: string;
    name: string;
    description: string;
    Fy: number;  // MPa
    Fu: number;  // MPa
    E: number;   // MPa
    G: number;   // MPa
    nu: number;
    rho: number; // kg/m³
}

// ==================== SECTIONS ====================

export type SectionType = "W" | "HSS_RECT" | "HSS_ROUND" | "C" | "L" | "WT";
export type Catalog = "AISC" | "CHILEAN";

export interface SteelSection {
    id: string;
    type: SectionType;
    catalog: Catalog;
    weight: number; // kg/m

    // Wide Flange / Channel dimensions
    d?: number;   // depth (mm)
    bf?: number;  // flange width (mm)
    tf?: number;  // flange thickness (mm)
    tw?: number;  // web thickness (mm)

    // HSS Rectangular
    H?: number;   // height (mm)
    B?: number;   // width (mm)
    t?: number;   // wall thickness (mm)

    // HSS Round
    OD?: number;  // outer diameter (mm)

    // Angle
    leg1?: number;
    leg2?: number;

    // Properties
    A: number;    // area (mm²)
    Ix: number;   // moment of inertia x (mm⁴)
    Iy: number;   // moment of inertia y (mm⁴)
    Sx?: number;  // section modulus x (mm³)
    Sy?: number;  // section modulus y (mm³)
    Zx?: number;  // plastic modulus x (mm³)
    Zy?: number;  // plastic modulus y (mm³)
    rx: number;   // radius of gyration x (mm)
    ry: number;   // radius of gyration y (mm)
    J?: number;   // torsional constant (mm⁴)
}

// ==================== SUPPORTS ====================

export type SupportType = "fixed" | "pinned" | "roller" | "free";

export const SUPPORT_LABELS: Record<SupportType, string> = {
    fixed: "Empotrado",
    pinned: "Articulado",
    roller: "Rodillo",
    free: "Libre"
};

// ==================== LOADS ====================

export interface PointLoad {
    position: number;  // m
    Fx: number;        // kN (horizontal)
    Fy: number;        // kN (vertical, positive down)
    Mz: number;        // kN·m (moment)
}

export interface DistributedLoad {
    start: number;    // m
    end: number;      // m
    w_start: number;  // kN/m
    w_end?: number;   // kN/m (for trapezoidal)
}

// ==================== LOAD COMBINATIONS ====================

export type DesignMethod = "LRFD" | "ASD";

export type LoadType = "D" | "L" | "Lr" | "S" | "W" | "E" | "R" | "H" | "F" | "T";

export const LOAD_TYPE_LABELS: Record<LoadType, string> = {
    D: "Carga Muerta",
    L: "Carga Viva",
    Lr: "Carga Viva Techo",
    S: "Nieve",
    W: "Viento",
    E: "Sismo",
    R: "Lluvia",
    H: "Peso de Suelos",
    F: "Fluidos",
    T: "Temperatura"
};

export interface LoadCombination {
    name: string;
    description: string;
    factors: Record<string, number>;
}

export interface LoadCombinationResult {
    name: string;
    description: string;
    value: number;
    factors_used: Record<string, number>;
}

export interface LoadCombinationInfo {
    method: DesignMethod;
    unfactored_loads: Record<string, number>;
    critical_combination: {
        name: string;
        description: string;
        factored_load: number;
        factors: Record<string, number>;
    };
    all_combinations: LoadCombinationResult[];
}

// ==================== ANALYSIS REQUESTS ====================

export interface BeamAnalysisRequest {
    length: number;
    support_left: SupportType;
    support_right: SupportType;
    section_id: string;
    material_id: string;
    point_loads: PointLoad[];
    distributed_loads: DistributedLoad[];
    units: UnitSystem;
    num_points?: number;
    // Load combinations
    load_types?: Record<string, number>;
    design_method?: DesignMethod;
}

export interface ColumnAnalysisRequest {
    height: number;
    base: SupportType;
    top: SupportType;
    section_id: string;
    material_id: string;
    axial_load: number;
    moment_top: number;
    moment_base: number;
    units: UnitSystem;
    // Load combinations
    load_types?: Record<string, number>;
    design_method?: DesignMethod;
}

export interface FrameNode {
    id: number;
    x: number;
    y: number;
    support?: SupportType;
}

export interface FrameElement {
    id: number;
    node_i: number;
    node_j: number;
    section_id: string;
    element_type: "beam" | "column" | "brace";
}

export interface FrameLoad {
    type: "nodal" | "distributed" | "point";
    element_id?: number;
    node_id?: number;
    Fx: number;
    Fy: number;
    Mz: number;
    w?: number;           // kN/m for distributed loads
    position?: number;    // m for point loads on elements
}

export interface FrameAnalysisRequest {
    nodes: FrameNode[];
    elements: FrameElement[];
    loads: FrameLoad[];
    material_id: string;
    units: UnitSystem;
    verify_elements?: boolean;
}

export interface ElementForces {
    N: number;
    V_i: number;
    M_i: number;
    V_j: number;
    M_j: number;
}

export interface ElementVerification {
    element_id: number;
    type: "beam" | "column" | "brace";
    section_id: string;
    length: number;
    forces: {
        N: number;
        V: number;
        M: number;
    };
    flexure?: {
        Mu: number;
        phi_Mn: number;
        ratio: number;
        utilization: number;
        ok: boolean;
    };
    shear?: {
        Vu: number;
        phi_Vn: number;
        ratio: number;
        utilization: number;
        ok: boolean;
    };
    compression?: {
        Pu: number;
        phi_Pn: number;
        ratio: number;
        utilization: number;
    };
    interaction?: {
        equation: string;
        value: number;
        utilization: number;
        ok: boolean;
    };
    slenderness?: {
        KL_r: number;
        K: number;
        L: number;
    };
    overall_ok: boolean;
    max_ratio: number;
}

export interface FrameAnalysisResult {
    status: "success" | "error";
    message?: string;
    nodes?: Record<string, { x: number; y: number; ux: number; uy: number; rz: number }>;
    reactions?: Record<string, { Rx?: number; Ry?: number; Mz?: number }>;
    elements?: Record<string, {
        section_id: string;
        element_type: string;
        forces_i: { N: number; V: number; M: number };
        forces_j: { N: number; V: number; M: number };
    }>;
    element_forces?: Record<string, ElementForces>;
    element_verifications?: ElementVerification[];
    verification_summary?: {
        all_ok: boolean;
        max_ratio: number;
        max_utilization: number;
        total_elements: number;
        passed_elements: number;
        failed_elements: number;
    };
    units?: UnitSystem;
}

// ==================== ANALYSIS RESULTS ====================

export interface DiagramPoint {
    x: number;
    value: number;
}

export interface DisplacementPoint {
    x: number;
    ux: number;
    uy: number;
    rz: number;
}

export interface Reaction {
    Rx: number;
    Ry: number;
    Mz: number;
}

export interface FlexureVerification {
    Mu: number;
    phi_Mn: number;
    Mp: number;
    ratio: number;
    utilization: number;
    ok: boolean;
    zone: string;
    Lb: number;
    Lp: number;
    Lr: number;
}

export interface ShearVerification {
    Vu: number;
    phi_Vn: number;
    ratio: number;
    utilization: number;
    ok: boolean;
}

export interface DeflectionCheck {
    limit: number;
    actual: number;
    ok: boolean;
}

export interface BeamVerification {
    flexure: FlexureVerification;
    shear: ShearVerification;
    deflection: Record<string, DeflectionCheck>;
    overall_ok: boolean;
    governing: string;
}

export interface BeamAnalysisResult {
    status: string;
    input: {
        length: number;
        section: SteelSection;
        material: SteelMaterial;
        supports: { left: string; right: string };
    };
    reactions: {
        left?: Reaction;
        right?: Reaction;
    };
    displacements: DisplacementPoint[];
    diagrams: {
        moment: DiagramPoint[];
        shear: DiagramPoint[];
        axial: DiagramPoint[];
    };
    max_values: {
        moment: number;
        shear: number;
        deflection: number;
    };
    verification: BeamVerification;
    units: UnitSystem;
    load_combinations?: LoadCombinationInfo;
}

export interface ColumnVerification {
    compression: {
        Pu: number;
        phi_Pn: number;
        Pn: number;
        Fcr: number;
        Fe: number;
        ratio: number;
        utilization: number;
        ok: boolean;
    };
    slenderness: {
        KL_r: number;
        limit: number;
        governing_axis: string;
    };
    flexure: {
        Mu: number;
        phi_Mn: number;
        ratio: number;
        utilization: number;
    };
    interaction: {
        equation: string;
        Pr_Pc: number;
        Mr_Mc: number;
        value: number;
        utilization: number;
        ok: boolean;
    };
    overall_ok: boolean;
    governing: string;
}

export interface ColumnAnalysisResult {
    status: string;
    input: {
        height: number;
        section: SteelSection;
        material: SteelMaterial;
        supports: { base: string; top: string };
        loads: { axial: number; moment_top: number; moment_base: number };
    };
    effective_length: {
        K: number;
        Leff_x: number;
        Leff_y: number;
    };
    slenderness: {
        lambda_x: number;
        lambda_y: number;
        governing: number;
    };
    euler_buckling: {
        Fe: number;
        Pcr: number;
    };
    displacements: DisplacementPoint[];
    max_lateral: number;
    verification: ColumnVerification;
    units: UnitSystem;
    load_combinations?: LoadCombinationInfo;
}

// ==================== APP STATE ====================

export interface AppConfig {
    units: UnitSystem;
    defaultMaterial: string;
    apiUrl: string;
}

export const DEFAULT_CONFIG: AppConfig = {
    units: "kN-m",
    defaultMaterial: "A572_GR50",
    apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
};
