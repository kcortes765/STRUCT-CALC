/**
 * API Client for STRUCT-CALC ACERO Backend
 */

import {
    BeamAnalysisRequest,
    BeamAnalysisResult,
    ColumnAnalysisRequest,
    ColumnAnalysisResult,
    FrameAnalysisRequest,
    SteelMaterial,
    SteelSection,
    DEFAULT_CONFIG
} from "./types";

const getApiUrl = () => {
    if (typeof window !== 'undefined') {
        const config = localStorage.getItem('struct-calc-config');
        if (config) {
            try {
                return JSON.parse(config).apiUrl;
            } catch {
                return DEFAULT_CONFIG.apiUrl;
            }
        }
    }
    return DEFAULT_CONFIG.apiUrl;
};

// ==================== HELPER FUNCTIONS ====================

async function fetchAPI<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${getApiUrl()}${endpoint}`;

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
        });

        if (!response.ok) {
            let errorMessage = `Error ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch {
                // Si no es JSON, usar status text
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        return response.json();
    } catch (error) {
        if (!navigator.onLine) {
            throw new Error('Sin conexión a internet. Los cálculos offline están disponibles.');
        }
        throw error;
    }
}

// ==================== HEALTH CHECK ====================

export async function checkHealth(): Promise<{ status: string; opensees: string }> {
    return fetchAPI("/health");
}

// ==================== MATERIALS ====================

export async function getMaterials(): Promise<{ count: number; materials: SteelMaterial[] }> {
    return fetchAPI("/api/materials/");
}

export async function getMaterial(id: string): Promise<SteelMaterial> {
    return fetchAPI(`/api/materials/${id}`);
}

export async function getSteelGrades(): Promise<{ grades: string[]; description: Record<string, string> }> {
    return fetchAPI("/api/materials/grades");
}

// ==================== SECTIONS ====================

export async function getSections(params?: {
    section_type?: string;
    catalog?: string;
    limit?: number;
}): Promise<{ count: number; sections: SteelSection[] }> {
    const searchParams = new URLSearchParams();
    if (params?.section_type) searchParams.set("section_type", params.section_type);
    if (params?.catalog) searchParams.set("catalog", params.catalog);
    if (params?.limit) searchParams.set("limit", params.limit.toString());

    const query = searchParams.toString();
    return fetchAPI(`/api/sections/${query ? `?${query}` : ""}`);
}

export async function getSection(id: string): Promise<SteelSection> {
    return fetchAPI(`/api/sections/${id}`);
}

export async function searchSections(query: string, catalog?: string): Promise<{
    query: string;
    count: number;
    sections: SteelSection[];
}> {
    const searchParams = new URLSearchParams({ query });
    if (catalog) searchParams.set("catalog", catalog);
    return fetchAPI(`/api/sections/search?${searchParams.toString()}`);
}

export async function getSectionTypes(): Promise<{ types: Record<string, string> }> {
    return fetchAPI("/api/sections/types");
}

export async function advancedSearchSections(params: {
    section_type?: string;
    catalog?: string;
    d_min?: number;
    d_max?: number;
    weight_min?: number;
    weight_max?: number;
    Ix_min?: number;
    Iy_min?: number;
    Zx_min?: number;
    rx_min?: number;
    ry_min?: number;
    limit?: number;
}): Promise<{
    count: number;
    filters: Record<string, any>;
    sections: SteelSection[];
}> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            searchParams.set(key, value.toString());
        }
    });

    const query = searchParams.toString();
    return fetchAPI(`/api/sections/advanced/search${query ? `?${query}` : ""}`);
}

export interface SectionSuggestion {
    section_id: string;
    section_type: string;
    catalog: string;
    weight: number;
    phi_Mn: number;
    Mp: number;
    utilization_flexure: number;
    utilization_shear: number;
    efficiency_score: number;
    meets_criteria: boolean;
    properties: {
        d: number;
        bf?: number;
        A: number;
        Ix: number;
        Zx: number;
    };
}

export async function recommendSections(params: {
    Mu: number;
    Vu?: number;
    L?: number;
    material_id?: string;
    units?: string;
    section_type?: string;
    catalog?: string;
    num_suggestions?: number;
    target_util_min?: number;
    target_util_max?: number;
    Lb?: number;
    Cb?: number;
}): Promise<{
    count: number;
    criteria: Record<string, any>;
    suggestions: SectionSuggestion[];
}> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            searchParams.set(key, value.toString());
        }
    });

    const query = searchParams.toString();
    return fetchAPI(`/api/sections/advanced/recommend${query ? `?${query}` : ""}`);
}

export interface SectionComparison {
    section_id: string;
    section_type: string;
    catalog: string;
    weight: number;
    d: number;
    verification: any;
    utilization_flexure: number;
    utilization_shear: number;
    overall_ok: boolean;
    governing: string;
}

export async function compareSections(
    section_ids: string[],
    params: {
        Mu: number;
        Vu: number;
        L?: number;
        material_id?: string;
        units?: string;
    }
): Promise<{
    count: number;
    conditions: Record<string, any>;
    comparisons: SectionComparison[];
}> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            searchParams.set(key, value.toString());
        }
    });

    const query = searchParams.toString();
    return fetchAPI(`/api/sections/advanced/compare${query ? `?${query}` : ""}`, {
        method: "POST",
        body: JSON.stringify(section_ids),
    });
}

// ==================== ANALYSIS ====================

export async function analyzeBeam(request: BeamAnalysisRequest): Promise<BeamAnalysisResult> {
    try {
        return await fetchAPI("/api/analysis/beam", {
            method: "POST",
            body: JSON.stringify(request),
        });
    } catch (error) {
        // Fallback offline para beam simple (solo cargas distribuidas uniformes)
        if (!navigator.onLine && request.distributed_loads && request.distributed_loads.length > 0) {
            console.log('[API] Intentando cálculo offline simple para beam');

            // Solo funciona para vigas simplemente apoyadas con carga distribuida
            const isSimplySupported = request.support_left === 'pinned' && request.support_right === 'roller';
            const dl = request.distributed_loads[0];

            if (isSimplySupported && dl && dl.w_start > 0) {
                const result = calculateBeamSimple(
                    request.length,
                    dl.w_start,
                    200000, // E default para acero (MPa)
                    1e8,    // Ix aproximado (mm^4)
                    "simply_supported"
                );

                // Retornar resultado simplificado (marcado como offline)
                console.log('[API] Cálculo offline completado');
                return {
                    status: 'success',
                    input: {
                        length: request.length,
                        section: { id: request.section_id } as any,
                        material: { id: request.material_id } as any,
                        supports: { left: request.support_left, right: request.support_right }
                    },
                    reactions: {
                        left: { Rx: 0, Ry: result.V_max, Mz: 0 },
                        right: { Rx: 0, Ry: result.V_max, Mz: 0 }
                    },
                    displacements: [],
                    diagrams: { moment: [], shear: [], axial: [] },
                    max_values: {
                        moment: result.M_max,
                        shear: result.V_max,
                        deflection: result.delta_max / 1000
                    },
                    verification: {
                        flexure: { Mu: result.M_max, phi_Mn: 0, Mp: 0, ratio: 0, utilization: 0, ok: false, zone: 'offline', Lb: 0, Lp: 0, Lr: 0 },
                        shear: { Vu: result.V_max, phi_Vn: 0, ratio: 0, utilization: 0, ok: false },
                        deflection: { "L/180": { limit: 0, actual: 0, ok: false }, "L/240": { limit: 0, actual: 0, ok: false }, "L/360": { limit: 0, actual: 0, ok: false } },
                        overall_ok: false,
                        governing: 'offline - requiere verificación online'
                    },
                    units: request.units
                } as BeamAnalysisResult;
            }
        }
        throw error;
    }
}

export async function analyzeColumn(request: ColumnAnalysisRequest): Promise<ColumnAnalysisResult> {
    return fetchAPI("/api/analysis/column", {
        method: "POST",
        body: JSON.stringify(request),
    });
}

export async function analyzeFrame(request: FrameAnalysisRequest): Promise<unknown> {
    return fetchAPI("/api/analysis/frame", {
        method: "POST",
        body: JSON.stringify(request),
    });
}

// ==================== OFFLINE FALLBACK ====================

// For when the API is not available, we can do basic calculations client-side
export function calculateBeamSimple(
    L: number,
    w: number,
    E: number,
    I: number,
    supportType: "simply_supported" | "cantilever" | "fixed_fixed"
): {
    M_max: number;
    V_max: number;
    delta_max: number;
} {
    switch (supportType) {
        case "simply_supported":
            return {
                M_max: (w * L * L) / 8,
                V_max: (w * L) / 2,
                delta_max: (5 * w * Math.pow(L, 4)) / (384 * E * I),
            };
        case "cantilever":
            return {
                M_max: (w * L * L) / 2,
                V_max: w * L,
                delta_max: (w * Math.pow(L, 4)) / (8 * E * I),
            };
        case "fixed_fixed":
            return {
                M_max: (w * L * L) / 12,
                V_max: (w * L) / 2,
                delta_max: (w * Math.pow(L, 4)) / (384 * E * I),
            };
    }
}
