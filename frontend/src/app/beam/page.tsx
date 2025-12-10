"use client";

import { useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Play,
    RotateCcw,
    ChevronDown,
    ChevronUp,
    Check,
    X,
    AlertTriangle,
    Loader2,
    Lightbulb,
    Search,
    FileDown
} from "lucide-react";
import {
    BeamAnalysisRequest,
    BeamAnalysisResult,
    PointLoad,
    DistributedLoad,
    SupportType,
    UnitSystem,
    SUPPORT_LABELS,
    UNIT_LABELS,
    DesignMethod,
    LoadType,
    LOAD_TYPE_LABELS
} from "@/lib/types";
import { analyzeBeam, recommendSections, SectionSuggestion } from "@/lib/api";
import { saveCalculation } from "@/lib/db";
import BeamDiagram from "@/components/BeamDiagram";
import ResultsChart from "@/components/ResultsChart";

// Default sections for quick selection
const COMMON_SECTIONS = [
    "W200X22", "W250X33", "W310X39", "W360X44", "W410X54",
    "W460X68", "W530X85", "W610X101",
    "IN200X15", "IN250X29", "IN300X42", "IN350X55"
];

const MATERIALS = [
    { id: "A36", name: "A36 (Fy=250 MPa)" },
    { id: "A572_GR50", name: "A572 Gr.50 (Fy=345 MPa)" },
    { id: "A992", name: "A992 (Fy=345 MPa)" },
    { id: "A42_27ES", name: "A42-27ES NCh (Fy=270 MPa)" },
    { id: "A52_34ES", name: "A52-34ES NCh (Fy=340 MPa)" },
];

export default function BeamCalculator() {
    // Form state
    const [length, setLength] = useState<number>(6);
    const [supportLeft, setSupportLeft] = useState<SupportType>("pinned");
    const [supportRight, setSupportRight] = useState<SupportType>("roller");
    const [sectionId, setSectionId] = useState<string>("W310X39");
    const [materialId, setMaterialId] = useState<string>("A572_GR50");
    const [units, setUnits] = useState<UnitSystem>("kN-m");

    // Loads - Traditional method
    const [pointLoads, setPointLoads] = useState<PointLoad[]>([]);
    const [distributedLoads, setDistributedLoads] = useState<DistributedLoad[]>([
        { start: 0, end: 6, w_start: 15 }
    ]);

    // Load combinations
    const [useLoadCombinations, setUseLoadCombinations] = useState(false);
    const [designMethod, setDesignMethod] = useState<DesignMethod>("LRFD");
    const [loadTypes, setLoadTypes] = useState<Record<string, number>>({
        D: 10,
        L: 5,
        Lr: 0,
        S: 0,
        W: 0,
        E: 0
    });

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<BeamAnalysisResult | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [activeTab, setActiveTab] = useState<"moment" | "shear" | "deflection">("moment");

    // Section suggestion state
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState<SectionSuggestion[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

    // PDF export state
    const [isExportingPDF, setIsExportingPDF] = useState(false);

    // Handlers
    const handleAnalyze = async () => {
        setIsLoading(true);
        setError(null);

        // Validación de inputs numéricos
        if (length <= 0 || length > 100) {
            setError("La longitud debe estar entre 0.1 y 100 metros");
            setIsLoading(false);
            return;
        }

        // Validar cargas distribuidas
        for (const dl of distributedLoads) {
            if (dl.w_start < 0 || (dl.end && dl.end <= dl.start)) {
                setError("Las cargas distribuidas tienen valores inválidos");
                setIsLoading(false);
                return;
            }
        }

        // Validar cargas puntuales
        for (const pl of pointLoads) {
            if (pl.position < 0 || pl.position > length) {
                setError("Las cargas puntuales deben estar dentro de la longitud de la viga");
                setIsLoading(false);
                return;
            }
        }

        try {
            const request: BeamAnalysisRequest = {
                length,
                support_left: supportLeft,
                support_right: supportRight,
                section_id: sectionId,
                material_id: materialId,
                point_loads: pointLoads,
                distributed_loads: distributedLoads.map(dl => ({
                    ...dl,
                    end: dl.end ?? length
                })),
                units,
                num_points: 21,
                // Add load combinations if enabled
                ...(useLoadCombinations && {
                    load_types: loadTypes,
                    design_method: designMethod
                })
            };

            const response = await analyzeBeam(request);
            setResult(response);

            // Save calculation to history (IndexedDB)
            try {
                await saveCalculation({
                    type: 'beam',
                    timestamp: new Date(),
                    name: `Viga ${sectionId} - L=${length}m`,
                    result: response
                });
                console.log('[Beam] Calculation saved to history');
            } catch (dbError) {
                console.warn('[Beam] Could not save to history:', dbError);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error de conexión con el servidor";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setLength(6);
        setSupportLeft("pinned");
        setSupportRight("roller");
        setSectionId("W310X39");
        setMaterialId("A572_GR50");
        setPointLoads([]);
        setDistributedLoads([{ start: 0, end: 6, w_start: 15 }]);
        setResult(null);
        setError(null);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleSuggestSections = async () => {
        setIsLoadingSuggestions(true);
        setError(null);

        try {
            // Calculate estimated moment for suggestions
            // Simple estimation: uniformly distributed load
            const totalDistLoad = distributedLoads.reduce((sum, dl) => {
                const span = (dl.end ?? length) - dl.start;
                return sum + dl.w_start * span;
            }, 0);
            const totalPointLoad = pointLoads.reduce((sum, pl) => sum + Math.abs(pl.Fy), 0);

            // Rough estimate: Mu ≈ wL²/8 for simply supported
            const estimatedMu = (totalDistLoad * length / 8) + (totalPointLoad * length / 4);
            const estimatedVu = (totalDistLoad / 2) + (totalPointLoad / 2);

            if (estimatedMu <= 0) {
                setError("No se puede sugerir perfiles sin cargas definidas");
                setIsLoadingSuggestions(false);
                return;
            }

            const response = await recommendSections({
                Mu: estimatedMu,
                Vu: estimatedVu > 0 ? estimatedVu : undefined,
                L: length,
                material_id: materialId,
                units: units,
                section_type: "W",
                num_suggestions: 5,
                target_util_min: 0.7,
                target_util_max: 0.95
            });

            setSuggestions(response.suggestions);
            setShowSuggestions(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error al buscar sugerencias";
            setError(message);
        } finally {
            setIsLoadingSuggestions(false);
        }
    };

    const handleSelectSuggestion = (suggestion: SectionSuggestion) => {
        setSectionId(suggestion.section_id);
        setShowSuggestions(false);
    };

    const handleExportPDF = async () => {
        if (!result) return;

        setIsExportingPDF(true);
        setError(null);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

            // Prepare report data
            const reportData = {
                // Input data
                length,
                section_id: sectionId,
                material_id: materialId,
                support_left: supportLeft,
                support_right: supportRight,
                units,

                // Loads
                point_loads: pointLoads,
                distributed_loads: distributedLoads,

                // Results
                max_moment: result.max_values.moment,
                max_shear: result.max_values.shear,
                max_deflection: result.max_values.deflection,

                // Reactions
                reaction_left_ry: result.reactions.left?.Ry || 0,
                reaction_left_rx: result.reactions.left?.Rx || 0,
                reaction_left_mz: result.reactions.left?.Mz || 0,
                reaction_right_ry: result.reactions.right?.Ry || 0,
                reaction_right_rx: result.reactions.right?.Rx || 0,
                reaction_right_mz: result.reactions.right?.Mz || 0,

                // Section properties
                section_depth: result.input?.section?.d || 0,
                section_width: result.input?.section?.bf || 0,
                section_weight: result.input?.section?.weight || 0,
                section_ix: result.input?.section?.Ix || 0,
                section_zx: result.input?.section?.Zx || 0,

                // Material properties
                material_fy: result.input?.material?.Fy || 345,
                material_e: result.input?.material?.E || 200000,

                // Verification
                flexure_mu: result.verification.flexure.Mu,
                flexure_phi_mn: result.verification.flexure.phi_Mn,
                flexure_ratio: result.verification.flexure.ratio,
                flexure_ok: result.verification.flexure.ok,
                flexure_zone: result.verification.flexure.zone,

                shear_vu: result.verification.shear.Vu,
                shear_phi_vn: result.verification.shear.phi_Vn,
                shear_ratio: result.verification.shear.ratio,
                shear_ok: result.verification.shear.ok,

                deflection_l180_limit: result.verification.deflection["L/180"].limit,
                deflection_l180_actual: result.verification.deflection["L/180"].actual,
                deflection_l180_ok: result.verification.deflection["L/180"].ok,
                deflection_l240_limit: result.verification.deflection["L/240"].limit,
                deflection_l240_actual: result.verification.deflection["L/240"].actual,
                deflection_l240_ok: result.verification.deflection["L/240"].ok,
                deflection_l360_limit: result.verification.deflection["L/360"].limit,
                deflection_l360_actual: result.verification.deflection["L/360"].actual,
                deflection_l360_ok: result.verification.deflection["L/360"].ok,

                overall_ok: result.verification.overall_ok,

                // Load combinations if applicable
                load_combination_method: result.load_combinations?.method,
                load_combination_name: result.load_combinations?.critical_combination.name,
                load_combination_factored_load: result.load_combinations?.critical_combination.factored_load,

                // Metadata
                project_name: "Proyecto de Estructuras",
                engineer: "",
                date: new Date().toLocaleDateString('es-CL'),
                notes: ""
            };

            const response = await fetch(`${apiUrl}/api/reports/beam`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reportData),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error al generar el reporte PDF: ${errorText || response.statusText}`);
            }

            // Download the PDF
            const blob = await response.blob();

            // Validate blob content
            if (!blob || blob.size === 0) {
                throw new Error('El archivo PDF generado está vacío');
            }

            if (blob.type !== 'application/pdf') {
                console.warn(`[PDF] Tipo de contenido inesperado: ${blob.type}`);
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `memoria_viga_${sectionId}_${new Date().getTime()}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (err) {
            const message = err instanceof Error ? err.message : "Error al exportar PDF";
            setError(message);
        } finally {
            setIsExportingPDF(false);
        }
    };

    const addPointLoad = () => {
        setPointLoads([...pointLoads, { position: length / 2, Fx: 0, Fy: 10, Mz: 0 }]);
    };

    const removePointLoad = (index: number) => {
        setPointLoads(pointLoads.filter((_, i) => i !== index));
    };

    const updatePointLoad = (index: number, field: keyof PointLoad, value: number) => {
        const updated = [...pointLoads];
        updated[index] = { ...updated[index], [field]: value };
        setPointLoads(updated);
    };

    const addDistributedLoad = () => {
        setDistributedLoads([...distributedLoads, { start: 0, end: length, w_start: 10 }]);
    };

    const removeDistributedLoad = (index: number) => {
        setDistributedLoads(distributedLoads.filter((_, i) => i !== index));
    };

    const updateDistributedLoad = (index: number, field: keyof DistributedLoad, value: number) => {
        const updated = [...distributedLoads];
        updated[index] = { ...updated[index], [field]: value };
        setDistributedLoads(updated);
    };

    const unitLabels = UNIT_LABELS[units];

    return (
        <main className="min-h-screen grid-background pb-20">
            {/* Header */}
            <header className="sticky top-0 z-50 p-4 border-b border-border-subtle bg-background/80 backdrop-blur-glass">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="p-2 rounded-lg hover:bg-surface transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold">Viga de Acero</h1>
                            <p className="text-xs text-text-tertiary">Verificación AISC 360</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleReset} className="btn btn-secondary text-sm p-2">
                            <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleAnalyze}
                            disabled={isLoading}
                            className="btn btn-primary text-sm"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Play className="w-4 h-4" />
                            )}
                            <span>Calcular</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto p-4 space-y-6">

                {/* Beam Visualization */}
                <section className="glass-card p-4">
                    <BeamDiagram
                        length={length}
                        supportLeft={supportLeft}
                        supportRight={supportRight}
                        pointLoads={pointLoads}
                        distributedLoads={distributedLoads}
                        deformed={result?.displacements}
                    />
                </section>

                {/* Input Form */}
                <section className="glass-card p-4 space-y-4">
                    <h3 className="font-semibold">Geometría y Material</h3>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Length */}
                        <div>
                            <label className="input-label">Longitud ({unitLabels.length})</label>
                            <input
                                type="number"
                                value={length}
                                onChange={(e) => setLength(Number(e.target.value))}
                                min={0.1}
                                step={0.5}
                                className="input-field"
                            />
                        </div>

                        {/* Units */}
                        <div>
                            <label className="input-label">Unidades</label>
                            <select
                                value={units}
                                onChange={(e) => setUnits(e.target.value as UnitSystem)}
                                className="select-field"
                            >
                                <option value="kN-m">kN-m (SI)</option>
                                <option value="tonf-m">tonf-m</option>
                                <option value="kgf-cm">kgf-cm</option>
                            </select>
                        </div>
                    </div>

                    {/* Supports */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="input-label">Apoyo Izquierdo</label>
                            <select
                                value={supportLeft}
                                onChange={(e) => setSupportLeft(e.target.value as SupportType)}
                                className="select-field"
                            >
                                {Object.entries(SUPPORT_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="input-label">Apoyo Derecho</label>
                            <select
                                value={supportRight}
                                onChange={(e) => setSupportRight(e.target.value as SupportType)}
                                className="select-field"
                            >
                                {Object.entries(SUPPORT_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Section with Suggest Button */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="input-label">Perfil</label>
                            <button
                                onClick={handleSuggestSections}
                                disabled={isLoadingSuggestions}
                                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
                            >
                                {isLoadingSuggestions ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Lightbulb className="w-3 h-3" />
                                )}
                                <span>Sugerir Perfiles</span>
                            </button>
                        </div>
                        <select
                            value={sectionId}
                            onChange={(e) => setSectionId(e.target.value)}
                            className="select-field"
                        >
                            <optgroup label="AISC">
                                {COMMON_SECTIONS.filter(s => s.startsWith("W")).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Chilenos">
                                {COMMON_SECTIONS.filter(s => s.startsWith("IN")).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    {/* Material */}
                    <div>
                        <label className="input-label">Material</label>
                        <select
                            value={materialId}
                            onChange={(e) => setMaterialId(e.target.value)}
                            className="select-field"
                        >
                            {MATERIALS.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                </section>

                {/* Load Combinations Section */}
                <section className="glass-card p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Método de Diseño</h3>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-text-secondary">Combinaciones AISC</label>
                            <input
                                type="checkbox"
                                checked={useLoadCombinations}
                                onChange={(e) => setUseLoadCombinations(e.target.checked)}
                                className="w-4 h-4 accent-primary-600"
                            />
                        </div>
                    </div>

                    {useLoadCombinations && (
                        <>
                            {/* Design Method Selector */}
                            <div>
                                <label className="input-label">Método</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setDesignMethod("LRFD")}
                                        className={`p-3 rounded-lg font-medium transition-all ${
                                            designMethod === "LRFD"
                                                ? "bg-primary-600 text-white"
                                                : "bg-surface text-text-secondary hover:bg-surface/80"
                                        }`}
                                    >
                                        LRFD
                                    </button>
                                    <button
                                        onClick={() => setDesignMethod("ASD")}
                                        className={`p-3 rounded-lg font-medium transition-all ${
                                            designMethod === "ASD"
                                                ? "bg-primary-600 text-white"
                                                : "bg-surface text-text-secondary hover:bg-surface/80"
                                        }`}
                                    >
                                        ASD
                                    </button>
                                </div>
                                <p className="text-xs text-text-tertiary mt-2">
                                    {designMethod === "LRFD"
                                        ? "Load and Resistance Factor Design - Factores de carga mayorados"
                                        : "Allowable Stress Design - Esfuerzos admisibles"}
                                </p>
                            </div>

                            {/* Load Types Input */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-text-secondary">
                                    Cargas sin factorizar ({unitLabels.force}/{unitLabels.length})
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {(["D", "L", "Lr", "S", "W", "E"] as LoadType[]).map((type) => (
                                        <div key={type}>
                                            <label className="text-xs text-text-tertiary">
                                                {type} - {LOAD_TYPE_LABELS[type]}
                                            </label>
                                            <input
                                                type="number"
                                                value={loadTypes[type] || 0}
                                                onChange={(e) =>
                                                    setLoadTypes({
                                                        ...loadTypes,
                                                        [type]: Number(e.target.value)
                                                    })
                                                }
                                                className="input-field text-sm mt-1"
                                                step={0.5}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Info note */}
                            <div className="p-3 rounded-lg bg-primary-900/30 border border-primary-800/50">
                                <p className="text-xs text-primary-300">
                                    El análisis se ejecutará con la combinación crítica según {designMethod}.
                                    Los resultados mostrarán qué combinación gobierna el diseño.
                                </p>
                            </div>
                        </>
                    )}
                </section>

                {/* Loads Section */}
                {!useLoadCombinations && (
                    <section className="glass-card p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Cargas</h3>
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-sm text-text-secondary flex items-center gap-1"
                            >
                                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                {showAdvanced ? "Menos" : "Más opciones"}
                            </button>
                        </div>

                    {/* Distributed Loads */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-text-secondary">Cargas Distribuidas</label>
                            <button onClick={addDistributedLoad} className="text-xs text-primary-400 hover:text-primary-300">
                                + Agregar
                            </button>
                        </div>

                        {distributedLoads.map((load, index) => (
                            <div key={index} className="grid grid-cols-4 gap-2 items-end p-3 bg-background-secondary rounded-lg">
                                <div>
                                    <label className="text-xs text-text-tertiary">Inicio ({unitLabels.length})</label>
                                    <input
                                        type="number"
                                        value={load.start}
                                        onChange={(e) => updateDistributedLoad(index, "start", Number(e.target.value))}
                                        className="input-field text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-text-tertiary">Fin ({unitLabels.length})</label>
                                    <input
                                        type="number"
                                        value={load.end}
                                        onChange={(e) => updateDistributedLoad(index, "end", Number(e.target.value))}
                                        className="input-field text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-text-tertiary">w ({unitLabels.force}/{unitLabels.length})</label>
                                    <input
                                        type="number"
                                        value={load.w_start}
                                        onChange={(e) => updateDistributedLoad(index, "w_start", Number(e.target.value))}
                                        className="input-field text-sm"
                                    />
                                </div>
                                <button
                                    onClick={() => removeDistributedLoad(index)}
                                    className="p-2 text-error hover:bg-error/20 rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Point Loads */}
                    {showAdvanced && (
                        <div className="space-y-3 pt-4 border-t border-border-subtle">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-text-secondary">Cargas Puntuales</label>
                                <button onClick={addPointLoad} className="text-xs text-primary-400 hover:text-primary-300">
                                    + Agregar
                                </button>
                            </div>

                            {pointLoads.length === 0 && (
                                <p className="text-xs text-text-tertiary text-center py-2">No hay cargas puntuales</p>
                            )}

                            {pointLoads.map((load, index) => (
                                <div key={index} className="grid grid-cols-4 gap-2 items-end p-3 bg-background-secondary rounded-lg">
                                    <div>
                                        <label className="text-xs text-text-tertiary">Posición ({unitLabels.length})</label>
                                        <input
                                            type="number"
                                            value={load.position}
                                            onChange={(e) => updatePointLoad(index, "position", Number(e.target.value))}
                                            className="input-field text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-text-tertiary">Fy ({unitLabels.force})</label>
                                        <input
                                            type="number"
                                            value={load.Fy}
                                            onChange={(e) => updatePointLoad(index, "Fy", Number(e.target.value))}
                                            className="input-field text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-text-tertiary">M ({unitLabels.moment})</label>
                                        <input
                                            type="number"
                                            value={load.Mz}
                                            onChange={(e) => updatePointLoad(index, "Mz", Number(e.target.value))}
                                            className="input-field text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={() => removePointLoad(index)}
                                        className="p-2 text-error hover:bg-error/20 rounded-lg transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    </section>
                )}

                {/* Error Display */}
                {error && (
                    <div className="glass-card p-4 border-error/50 bg-error/10">
                        <div className="flex items-center gap-2 text-error">
                            <AlertTriangle className="w-5 h-5" />
                            <span className="font-medium">Error</span>
                        </div>
                        <p className="text-sm text-text-secondary mt-1">{error}</p>
                    </div>
                )}

                {/* Section Suggestions Panel */}
                {showSuggestions && suggestions.length > 0 && (
                    <section className="glass-card p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Lightbulb className="w-5 h-5 text-primary-400" />
                                <h3 className="font-semibold">Perfiles Sugeridos</h3>
                            </div>
                            <button
                                onClick={() => setShowSuggestions(false)}
                                className="text-text-tertiary hover:text-text-primary"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {suggestions.map((suggestion, index) => (
                                <div
                                    key={suggestion.section_id}
                                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                        sectionId === suggestion.section_id
                                            ? "border-primary-500 bg-primary-500/10"
                                            : "border-border-subtle bg-background-secondary hover:border-primary-500/50"
                                    }`}
                                    onClick={() => handleSelectSuggestion(suggestion)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-semibold text-sm">
                                                    {suggestion.section_id}
                                                </span>
                                                {index === 0 && (
                                                    <span className="badge badge-success text-xs">Recomendado</span>
                                                )}
                                                {suggestion.meets_criteria && (
                                                    <Check className="w-4 h-4 text-success" />
                                                )}
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-text-tertiary">
                                                <span>Peso: {suggestion.weight.toFixed(1)} kg/m</span>
                                                <span>d: {suggestion.properties.d} mm</span>
                                                <span>Utilización: {(suggestion.utilization_flexure * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-semibold text-primary-400">
                                                {suggestion.phi_Mn.toFixed(1)} {unitLabels.moment}
                                            </div>
                                            <div className="text-xs text-text-tertiary">Capacidad</div>
                                        </div>
                                    </div>
                                    <div className="progress-bar mt-2">
                                        <div
                                            className={`progress-fill ${
                                                suggestion.utilization_flexure < 0.5 ? "low" :
                                                suggestion.utilization_flexure < 0.8 ? "medium" : "high"
                                            }`}
                                            style={{ width: `${Math.min(suggestion.utilization_flexure * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-3 p-2 bg-background-secondary rounded text-xs text-text-tertiary">
                            <p>Los perfiles son sugeridos según eficiencia estructural y utilización óptima (70-95%).</p>
                        </div>
                    </section>
                )}

                {/* Results Section */}
                {result && (
                    <>
                        {/* Max Values Summary */}
                        <section className="glass-card p-4">
                            <h3 className="font-semibold mb-4">Resultados Máximos</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-3 rounded-lg bg-background-secondary">
                                    <p className="text-xs text-text-tertiary">Momento Max</p>
                                    <p className="text-xl font-bold font-mono text-primary-400">
                                        {result.max_values.moment.toFixed(1)}
                                    </p>
                                    <p className="text-xs text-text-tertiary">{unitLabels.moment}</p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-background-secondary">
                                    <p className="text-xs text-text-tertiary">Corte Max</p>
                                    <p className="text-xl font-bold font-mono text-green-400">
                                        {result.max_values.shear.toFixed(1)}
                                    </p>
                                    <p className="text-xs text-text-tertiary">{unitLabels.force}</p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-background-secondary">
                                    <p className="text-xs text-text-tertiary">Deflexión Max</p>
                                    <p className="text-xl font-bold font-mono text-orange-400">
                                        {(result.max_values.deflection * 1000).toFixed(2)}
                                    </p>
                                    <p className="text-xs text-text-tertiary">mm</p>
                                </div>
                            </div>
                        </section>

                        {/* Load Combinations Results */}
                        {result.load_combinations && (
                            <section className="glass-card p-4">
                                <h3 className="font-semibold mb-4">
                                    Combinaciones de Carga - {result.load_combinations.method}
                                </h3>

                                {/* Critical Combination */}
                                <div className="p-4 rounded-lg bg-primary-900/30 border border-primary-800/50 mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-primary-300">Combinación Crítica</span>
                                        <span className="badge badge-primary">Gobierna</span>
                                    </div>
                                    <p className="font-bold text-lg mb-1">
                                        {result.load_combinations.critical_combination.name}
                                    </p>
                                    <p className="text-sm text-text-secondary mb-3">
                                        {result.load_combinations.critical_combination.description}
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="text-center p-2 rounded bg-background-secondary">
                                            <p className="text-xs text-text-tertiary">Carga Factorizada</p>
                                            <p className="text-xl font-bold font-mono text-primary-400">
                                                {result.load_combinations.critical_combination.factored_load.toFixed(2)}
                                            </p>
                                            <p className="text-xs text-text-tertiary">{unitLabels.force}/{unitLabels.length}</p>
                                        </div>
                                        <div className="p-2 rounded bg-background-secondary">
                                            <p className="text-xs text-text-tertiary mb-1">Factores Aplicados:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {Object.entries(result.load_combinations.critical_combination.factors).map(
                                                    ([type, factor]) => (
                                                        <span key={type} className="text-xs px-2 py-1 rounded bg-surface">
                                                            {type}×{factor}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* All Combinations */}
                                <div>
                                    <p className="text-sm font-medium text-text-secondary mb-2">
                                        Cargas sin factorizar ingresadas:
                                    </p>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {Object.entries(result.load_combinations.unfactored_loads)
                                            .filter(([_, value]) => value > 0)
                                            .map(([type, value]) => (
                                                <div key={type} className="px-3 py-2 rounded-lg bg-background-secondary">
                                                    <span className="text-xs text-text-tertiary">{LOAD_TYPE_LABELS[type as LoadType]}</span>
                                                    <p className="font-mono font-bold">{value} {unitLabels.force}/{unitLabels.length}</p>
                                                </div>
                                            ))}
                                    </div>

                                    <p className="text-sm font-medium text-text-secondary mb-2">Top 5 Combinaciones:</p>
                                    <div className="space-y-2">
                                        {result.load_combinations.all_combinations.map((combo, index) => (
                                            <div key={index} className="p-3 rounded-lg bg-background-secondary">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium">{combo.name}</p>
                                                        <p className="text-xs text-text-tertiary">{combo.description}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-mono font-bold text-lg">
                                                            {combo.value.toFixed(2)}
                                                        </p>
                                                        <p className="text-xs text-text-tertiary">{unitLabels.force}/{unitLabels.length}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Diagrams */}
                        <section className="glass-card p-4">
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={() => setActiveTab("moment")}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "moment" ? "bg-primary-600 text-white" : "bg-surface text-text-secondary"
                                        }`}
                                >
                                    Momento
                                </button>
                                <button
                                    onClick={() => setActiveTab("shear")}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "shear" ? "bg-green-600 text-white" : "bg-surface text-text-secondary"
                                        }`}
                                >
                                    Cortante
                                </button>
                                <button
                                    onClick={() => setActiveTab("deflection")}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "deflection" ? "bg-orange-600 text-white" : "bg-surface text-text-secondary"
                                        }`}
                                >
                                    Deflexión
                                </button>
                            </div>

                            <ResultsChart
                                data={
                                    activeTab === "moment" ? result.diagrams.moment :
                                        activeTab === "shear" ? result.diagrams.shear :
                                            result.displacements?.map(d => ({ x: d.x, value: d.uy * 1000 })) || []
                                }
                                color={
                                    activeTab === "moment" ? "#3b82f6" :
                                        activeTab === "shear" ? "#22c55e" :
                                            "#f59e0b"
                                }
                                label={
                                    activeTab === "moment" ? `Momento (${unitLabels.moment})` :
                                        activeTab === "shear" ? `Cortante (${unitLabels.force})` :
                                            "Deflexión (mm)"
                                }
                            />
                        </section>

                        {/* Verification */}
                        <section className="glass-card p-4">
                            <h3 className="font-semibold mb-4">Verificación AISC 360</h3>

                            <div className="space-y-4">
                                {/* Flexure */}
                                <VerificationItem
                                    label="Flexión"
                                    demand={result.verification.flexure.Mu}
                                    capacity={result.verification.flexure.phi_Mn}
                                    ratio={result.verification.flexure.ratio}
                                    ok={result.verification.flexure.ok}
                                    unit={unitLabels.moment}
                                    detail={`Zona: ${result.verification.flexure.zone}`}
                                />

                                {/* Shear */}
                                <VerificationItem
                                    label="Corte"
                                    demand={result.verification.shear.Vu}
                                    capacity={result.verification.shear.phi_Vn}
                                    ratio={result.verification.shear.ratio}
                                    ok={result.verification.shear.ok}
                                    unit={unitLabels.force}
                                />

                                {/* Deflection */}
                                <div className="p-3 rounded-lg bg-background-secondary">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium">Deflexión</span>
                                        <span className={`badge ${result.verification.deflection["L/240"].ok ? "badge-success" : "badge-warning"}`}>
                                            {result.verification.deflection["L/240"].ok ? "OK" : "REVISAR"}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        {Object.entries(result.verification.deflection).map(([limit, check]) => (
                                            <div key={limit} className="text-center">
                                                <p className="text-text-tertiary">{limit}</p>
                                                <p className={check.ok ? "text-success" : "text-warning"}>
                                                    {check.actual.toFixed(1)} / {check.limit.toFixed(1)} mm
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Overall Status */}
                            <div className={`mt-4 p-4 rounded-lg flex items-center justify-center gap-2 ${result.verification.overall_ok ? "bg-success/20 text-success" : "bg-error/20 text-error"
                                }`}>
                                {result.verification.overall_ok ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        <span className="font-semibold">VERIFICACIÓN OK</span>
                                    </>
                                ) : (
                                    <>
                                        <X className="w-5 h-5" />
                                        <span className="font-semibold">NO CUMPLE</span>
                                    </>
                                )}
                            </div>

                            {/* Export PDF Button */}
                            <div className="mt-4">
                                <button
                                    onClick={handleExportPDF}
                                    disabled={isExportingPDF}
                                    className="btn btn-primary w-full"
                                >
                                    {isExportingPDF ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Generando PDF...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FileDown className="w-4 h-4" />
                                            <span>Exportar Memoria de Cálculo (PDF)</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </section>

                        {/* Reactions */}
                        <section className="glass-card p-4">
                            <h3 className="font-semibold mb-4">Reacciones</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {result.reactions.left && (
                                    <div className="p-3 rounded-lg bg-background-secondary">
                                        <p className="text-sm font-medium mb-2">Apoyo Izquierdo</p>
                                        <div className="space-y-1 text-sm font-mono">
                                            <p>Ry = {Math.abs(result.reactions.left.Ry).toFixed(2)} {unitLabels.force}</p>
                                            <p>Rx = {Math.abs(result.reactions.left.Rx).toFixed(2)} {unitLabels.force}</p>
                                            {result.reactions.left.Mz !== 0 && (
                                                <p>Mz = {Math.abs(result.reactions.left.Mz).toFixed(2)} {unitLabels.moment}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {result.reactions.right && (
                                    <div className="p-3 rounded-lg bg-background-secondary">
                                        <p className="text-sm font-medium mb-2">Apoyo Derecho</p>
                                        <div className="space-y-1 text-sm font-mono">
                                            <p>Ry = {Math.abs(result.reactions.right.Ry).toFixed(2)} {unitLabels.force}</p>
                                            <p>Rx = {Math.abs(result.reactions.right.Rx).toFixed(2)} {unitLabels.force}</p>
                                            {result.reactions.right.Mz !== 0 && (
                                                <p>Mz = {Math.abs(result.reactions.right.Mz).toFixed(2)} {unitLabels.moment}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}

// Verification Item Component
function VerificationItem({
    label,
    demand,
    capacity,
    ratio,
    ok,
    unit,
    detail
}: {
    label: string;
    demand: number;
    capacity: number;
    ratio: number;
    ok: boolean;
    unit: string;
    detail?: string;
}) {
    const utilization = ratio * 100;
    const progressClass = utilization < 50 ? "low" : utilization < 80 ? "medium" : "high";

    return (
        <div className="p-3 rounded-lg bg-background-secondary">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <span className="font-medium">{label}</span>
                    {detail && <span className="text-xs text-text-tertiary ml-2">({detail})</span>}
                </div>
                <span className={`badge ${ok ? "badge-success" : "badge-error"}`}>
                    {ok ? "OK" : "NG"}
                </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
                <span className="font-mono">{demand.toFixed(1)} / {capacity.toFixed(1)} {unit}</span>
                <span className={`font-bold ${ok ? "text-success" : "text-error"}`}>
                    {utilization.toFixed(0)}%
                </span>
            </div>
            <div className="progress-bar mt-2">
                <div
                    className={`progress-fill ${progressClass}`}
                    style={{ width: `${Math.min(utilization, 100)}%` }}
                />
            </div>
        </div>
    );
}
