"use client";

import { useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Play,
    RotateCcw,
    Check,
    X,
    Loader2,
    AlertTriangle,
    FileDown
} from "lucide-react";
import {
    ColumnAnalysisRequest,
    ColumnAnalysisResult,
    SupportType,
    UnitSystem,
    SUPPORT_LABELS,
    UNIT_LABELS,
    DesignMethod,
    LoadType,
    LOAD_TYPE_LABELS
} from "@/lib/types";
import { analyzeColumn } from "@/lib/api";
import { saveCalculation } from "@/lib/db";

// Default sections for columns
const COLUMN_SECTIONS = [
    "W200X22", "W250X33", "W310X39", "W310X33", "W360X44",
    "HSS152X152X9.5", "HSS203X152X9.5", "HSS254X152X9.5",
    "IN200X15", "IN250X29", "IN300X42"
];

const MATERIALS = [
    { id: "A36", name: "A36 (Fy=250 MPa)" },
    { id: "A572_GR50", name: "A572 Gr.50 (Fy=345 MPa)" },
    { id: "A992", name: "A992 (Fy=345 MPa)" },
    { id: "A42_27ES", name: "A42-27ES NCh (Fy=270 MPa)" },
];

const BASE_SUPPORTS: SupportType[] = ["fixed", "pinned"];
const TOP_SUPPORTS: SupportType[] = ["fixed", "pinned", "free"];

export default function ColumnCalculator() {
    // Form state
    const [height, setHeight] = useState<number>(4);
    const [base, setBase] = useState<SupportType>("fixed");
    const [top, setTop] = useState<SupportType>("free");
    const [sectionId, setSectionId] = useState<string>("W250X33");
    const [materialId, setMaterialId] = useState<string>("A572_GR50");
    const [units, setUnits] = useState<UnitSystem>("kN-m");

    // Loads - Traditional
    const [axialLoad, setAxialLoad] = useState<number>(500);
    const [momentTop, setMomentTop] = useState<number>(0);
    const [momentBase, setMomentBase] = useState<number>(0);

    // Load combinations
    const [useLoadCombinations, setUseLoadCombinations] = useState(false);
    const [designMethod, setDesignMethod] = useState<DesignMethod>("LRFD");
    const [loadTypes, setLoadTypes] = useState<Record<string, number>>({
        D: 300,
        L: 200,
        Lr: 0,
        S: 0,
        W: 0,
        E: 0
    });

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ColumnAnalysisResult | null>(null);

    // PDF export state
    const [isExportingPDF, setIsExportingPDF] = useState(false);

    const handleAnalyze = async () => {
        setIsLoading(true);
        setError(null);

        // Validación de altura
        if (height <= 0 || height > 50) {
            setError("La altura debe estar entre 0.1 y 50 metros");
            setIsLoading(false);
            return;
        }

        try {
            const request: ColumnAnalysisRequest = {
                height,
                base,
                top,
                section_id: sectionId,
                material_id: materialId,
                axial_load: axialLoad,
                moment_top: momentTop,
                moment_base: momentBase,
                units,
                // Add load combinations if enabled
                ...(useLoadCombinations && {
                    load_types: loadTypes,
                    design_method: designMethod
                })
            };

            const response = await analyzeColumn(request);
            setResult(response);

            // Save calculation to history (IndexedDB)
            try {
                await saveCalculation({
                    type: 'column',
                    timestamp: new Date(),
                    name: `Columna ${sectionId} - H=${height}m`,
                    result: response
                });
                console.log('[Column] Calculation saved to history');
            } catch (dbError) {
                console.warn('[Column] Could not save to history:', dbError);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error de conexión con el servidor";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setHeight(4);
        setBase("fixed");
        setTop("free");
        setSectionId("W250X33");
        setMaterialId("A572_GR50");
        setAxialLoad(500);
        setMomentTop(0);
        setMomentBase(0);
        setResult(null);
        setError(null);
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
                height,
                section_id: sectionId,
                material_id: materialId,
                base,
                top,
                units,

                // Loads
                axial_load: axialLoad,
                moment_top: momentTop,
                moment_base: momentBase,

                // Results
                k_factor: result.effective_length.K,
                kl_r: result.verification.slenderness.KL_r,
                pcr: result.euler_buckling.Pcr,

                // Section properties
                section_depth: result.input?.section?.d || 0,
                section_width: result.input?.section?.bf || 0,
                section_weight: result.input?.section?.weight || 0,
                section_rx: result.input?.section?.rx || 0,
                section_ry: result.input?.section?.ry || 0,

                // Material properties
                material_fy: result.input?.material?.Fy || 345,
                material_e: result.input?.material?.E || 200000,

                // Verification
                compression_pu: result.verification.compression.Pu,
                compression_phi_pn: result.verification.compression.phi_Pn,
                compression_fcr: result.verification.compression.Fcr,
                compression_ratio: result.verification.compression.ratio,
                compression_ok: result.verification.compression.ok,

                flexure_mu: result.verification.flexure.Mu,
                flexure_phi_mn: result.verification.flexure.phi_Mn,
                flexure_ratio: result.verification.flexure.ratio,

                interaction_equation: result.verification.interaction.equation,
                interaction_value: result.verification.interaction.value,
                interaction_pr_pc: result.verification.interaction.Pr_Pc,
                interaction_mr_mc: result.verification.interaction.Mr_Mc,
                interaction_utilization: result.verification.interaction.utilization,
                interaction_ok: result.verification.interaction.ok,

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

            const response = await fetch(`${apiUrl}/api/reports/column`, {
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
            a.download = `memoria_columna_${sectionId}_${new Date().getTime()}.pdf`;
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

    const unitLabels = UNIT_LABELS[units];

    // Get K factor description
    const getKDescription = (base: SupportType, top: SupportType): string => {
        const kValues: Record<string, { K: number; desc: string }> = {
            "fixed-fixed": { K: 0.65, desc: "Empotrado-Empotrado" },
            "fixed-pinned": { K: 0.80, desc: "Empotrado-Articulado" },
            "fixed-free": { K: 2.10, desc: "Voladizo" },
            "pinned-pinned": { K: 1.00, desc: "Articulado-Articulado" },
            "pinned-free": { K: 2.10, desc: "Articulado-Libre" },
        };
        const key = `${base}-${top}`;
        return kValues[key]?.desc || "Personalizado";
    };

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
                            <h1 className="text-lg font-bold">Columna de Acero</h1>
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

                {/* Column Visualization */}
                <section className="glass-card p-4">
                    <ColumnVisual
                        height={height}
                        base={base}
                        top={top}
                        axialLoad={axialLoad}
                        momentTop={momentTop}
                        displacement={result?.max_lateral}
                    />
                </section>

                {/* Input Form */}
                <section className="glass-card p-4 space-y-4">
                    <h3 className="font-semibold">Geometría y Material</h3>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Height */}
                        <div>
                            <label className="input-label">Altura ({unitLabels.length})</label>
                            <input
                                type="number"
                                value={height}
                                onChange={(e) => setHeight(Number(e.target.value))}
                                min={0.5}
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

                    {/* Boundary Conditions */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="input-label">Condición en Base</label>
                            <select
                                value={base}
                                onChange={(e) => setBase(e.target.value as SupportType)}
                                className="select-field"
                            >
                                {BASE_SUPPORTS.map(s => (
                                    <option key={s} value={s}>{SUPPORT_LABELS[s]}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="input-label">Condición en Tope</label>
                            <select
                                value={top}
                                onChange={(e) => setTop(e.target.value as SupportType)}
                                className="select-field"
                            >
                                {TOP_SUPPORTS.map(s => (
                                    <option key={s} value={s}>{SUPPORT_LABELS[s]}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* K Factor Info */}
                    <div className="p-3 rounded-lg bg-primary-900/30 border border-primary-800/50">
                        <p className="text-sm text-primary-300">
                            <span className="font-semibold">Condición de borde:</span> {getKDescription(base, top)}
                        </p>
                    </div>

                    {/* Section */}
                    <div>
                        <label className="input-label">Perfil</label>
                        <select
                            value={sectionId}
                            onChange={(e) => setSectionId(e.target.value)}
                            className="select-field"
                        >
                            <optgroup label="Wide Flange (W)">
                                {COLUMN_SECTIONS.filter(s => s.startsWith("W")).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </optgroup>
                            <optgroup label="HSS (Tubos)">
                                {COLUMN_SECTIONS.filter(s => s.startsWith("HSS")).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Chilenos">
                                {COLUMN_SECTIONS.filter(s => s.startsWith("IN")).map(s => (
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
                                    Cargas axiales sin factorizar ({unitLabels.force})
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
                                                step={10}
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
                        <h3 className="font-semibold">Cargas</h3>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Axial Load */}
                        <div>
                            <label className="input-label">Carga Axial P ({unitLabels.force})</label>
                            <input
                                type="number"
                                value={axialLoad}
                                onChange={(e) => setAxialLoad(Number(e.target.value))}
                                className="input-field"
                                placeholder="Positivo = Compresión"
                            />
                            <p className="text-xs text-text-tertiary mt-1">Positivo = Compresión</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Moment Top */}
                            <div>
                                <label className="input-label">Momento en Tope ({unitLabels.moment})</label>
                                <input
                                    type="number"
                                    value={momentTop}
                                    onChange={(e) => setMomentTop(Number(e.target.value))}
                                    className="input-field"
                                />
                            </div>

                            {/* Moment Base */}
                            <div>
                                <label className="input-label">Momento en Base ({unitLabels.moment})</label>
                                <input
                                    type="number"
                                    value={momentBase}
                                    onChange={(e) => setMomentBase(Number(e.target.value))}
                                    className="input-field"
                                />
                            </div>
                        </div>
                    </div>
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

                {/* Results Section */}
                {result && (
                    <>
                        {/* Summary */}
                        <section className="glass-card p-4">
                            <h3 className="font-semibold mb-4">Resumen de Análisis</h3>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="text-center p-3 rounded-lg bg-background-secondary">
                                    <p className="text-xs text-text-tertiary">Factor K</p>
                                    <p className="text-2xl font-bold font-mono text-primary-400">
                                        {result.effective_length.K.toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-background-secondary">
                                    <p className="text-xs text-text-tertiary">Esbeltez KL/r</p>
                                    <p className="text-2xl font-bold font-mono text-orange-400">
                                        {result.verification.slenderness.KL_r.toFixed(0)}
                                    </p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-background-secondary">
                                    <p className="text-xs text-text-tertiary">Pcr Euler</p>
                                    <p className="text-2xl font-bold font-mono text-green-400">
                                        {result.euler_buckling.Pcr.toFixed(0)}
                                    </p>
                                    <p className="text-xs text-text-tertiary">{unitLabels.force}</p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-background-secondary">
                                    <p className="text-xs text-text-tertiary">φPn</p>
                                    <p className="text-2xl font-bold font-mono text-blue-400">
                                        {result.verification.compression.phi_Pn.toFixed(0)}
                                    </p>
                                    <p className="text-xs text-text-tertiary">{unitLabels.force}</p>
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
                                            <p className="text-xs text-text-tertiary">Carga Axial Factorizada</p>
                                            <p className="text-xl font-bold font-mono text-primary-400">
                                                {result.load_combinations.critical_combination.factored_load.toFixed(1)}
                                            </p>
                                            <p className="text-xs text-text-tertiary">{unitLabels.force}</p>
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
                                                    <p className="font-mono font-bold">{value} {unitLabels.force}</p>
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
                                                            {combo.value.toFixed(1)}
                                                        </p>
                                                        <p className="text-xs text-text-tertiary">{unitLabels.force}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Verification */}
                        <section className="glass-card p-4">
                            <h3 className="font-semibold mb-4">Verificación AISC 360</h3>

                            <div className="space-y-4">
                                {/* Compression */}
                                <VerificationItem
                                    label="Compresión (Cap. E)"
                                    demand={result.verification.compression.Pu}
                                    capacity={result.verification.compression.phi_Pn}
                                    ratio={result.verification.compression.ratio}
                                    ok={result.verification.compression.ok}
                                    unit={unitLabels.force}
                                    detail={`Fcr = ${result.verification.compression.Fcr.toFixed(0)} MPa`}
                                />

                                {/* Flexure */}
                                {result.verification.flexure.Mu > 0 && (
                                    <VerificationItem
                                        label="Flexión (Cap. F)"
                                        demand={result.verification.flexure.Mu}
                                        capacity={result.verification.flexure.phi_Mn}
                                        ratio={result.verification.flexure.ratio}
                                        ok={result.verification.flexure.ratio <= 1}
                                        unit={unitLabels.moment}
                                    />
                                )}

                                {/* Interaction */}
                                <div className="p-4 rounded-lg bg-background-secondary border border-border-subtle">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <span className="font-medium">Interacción Flexo-Compresión</span>
                                            <span className="text-xs text-text-tertiary ml-2">
                                                (AISC {result.verification.interaction.equation})
                                            </span>
                                        </div>
                                        <span className={`badge ${result.verification.interaction.ok ? "badge-success" : "badge-error"}`}>
                                            {result.verification.interaction.ok ? "OK" : "NG"}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 text-center mb-3">
                                        <div>
                                            <p className="text-xs text-text-tertiary">Pr/Pc</p>
                                            <p className="font-mono text-lg">{result.verification.interaction.Pr_Pc.toFixed(3)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-text-tertiary">Mr/Mc</p>
                                            <p className="font-mono text-lg">{result.verification.interaction.Mr_Mc.toFixed(3)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-text-tertiary">Interacción</p>
                                            <p className={`font-mono text-lg font-bold ${result.verification.interaction.ok ? "text-success" : "text-error"
                                                }`}>
                                                {result.verification.interaction.value.toFixed(3)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="progress-bar">
                                        <div
                                            className={`progress-fill ${result.verification.interaction.utilization < 50 ? "low" :
                                                    result.verification.interaction.utilization < 80 ? "medium" : "high"
                                                }`}
                                            style={{ width: `${Math.min(result.verification.interaction.utilization, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-center text-sm mt-2">
                                        Utilización: <span className="font-bold">{result.verification.interaction.utilization.toFixed(0)}%</span>
                                    </p>
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
                    </>
                )}
            </div>
        </main>
    );
}

// Column Visualization Component
function ColumnVisual({
    height,
    base,
    top,
    axialLoad,
    momentTop,
    displacement
}: {
    height: number;
    base: SupportType;
    top: SupportType;
    axialLoad: number;
    momentTop: number;
    displacement?: number;
}) {
    const columnHeight = 150;
    const columnWidth = 20;

    return (
        <div className="flex justify-center items-end" style={{ height: columnHeight + 60 }}>
            <svg width="200" height={columnHeight + 60} viewBox={`0 0 200 ${columnHeight + 60}`}>
                {/* Base support */}
                {base === "fixed" && (
                    <>
                        <rect x="70" y={columnHeight + 10} width="60" height="10" fill="#10b981" />
                        <line x1="70" y1={columnHeight + 20} x2="130" y2={columnHeight + 20} stroke="#10b981" strokeWidth="3" />
                        {/* Hatching */}
                        {[0, 10, 20, 30, 40, 50].map(i => (
                            <line key={i} x1={75 + i} y1={columnHeight + 20} x2={70 + i} y2={columnHeight + 30} stroke="#10b981" strokeWidth="1" />
                        ))}
                    </>
                )}
                {base === "pinned" && (
                    <polygon points={`100,${columnHeight + 10} 80,${columnHeight + 35} 120,${columnHeight + 35}`} fill="#10b981" />
                )}

                {/* Column */}
                <rect
                    x={100 - columnWidth / 2}
                    y={10}
                    width={columnWidth}
                    height={columnHeight}
                    fill="url(#columnGradient)"
                    stroke="#f8fafc"
                    strokeWidth="2"
                />

                {/* Gradient definition */}
                <defs>
                    <linearGradient id="columnGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#475569" />
                        <stop offset="50%" stopColor="#64748b" />
                        <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                </defs>

                {/* Top support */}
                {top === "fixed" && (
                    <rect x="70" y="0" width="60" height="10" fill="#10b981" />
                )}
                {top === "pinned" && (
                    <circle cx="100" cy="10" r="6" fill="none" stroke="#10b981" strokeWidth="2" />
                )}

                {/* Axial load arrow */}
                {axialLoad > 0 && (
                    <>
                        <line x1="100" y1="-30" x2="100" y2="5" stroke="#ef4444" strokeWidth="2" />
                        <polygon points="100,5 95,-5 105,-5" fill="#ef4444" />
                        <text x="110" y="-15" fill="#ef4444" fontSize="10" fontWeight="bold">P</text>
                    </>
                )}

                {/* Moment at top */}
                {momentTop !== 0 && (
                    <g transform="translate(140, 30)">
                        <path d="M 0 0 A 12 12 0 1 1 0 24" fill="none" stroke="#f59e0b" strokeWidth="2" />
                        <polygon points="0,24 -5,18 5,18" fill="#f59e0b" />
                        <text x="15" y="15" fill="#f59e0b" fontSize="10" fontWeight="bold">M</text>
                    </g>
                )}

                {/* Deformed shape */}
                {displacement && (
                    <path
                        d={`M ${100 - columnWidth / 2},${columnHeight + 10} Q ${100 - columnWidth / 2 + displacement * 1000},{columnHeight/2 + 10} ${100 - columnWidth / 2 + displacement * 2000},10`}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                        opacity="0.7"
                    />
                )}

                {/* Height dimension */}
                <line x1="40" y1="10" x2="40" y2={columnHeight + 10} stroke="#64748b" strokeWidth="1" />
                <line x1="35" y1="10" x2="45" y2="10" stroke="#64748b" strokeWidth="1" />
                <line x1="35" y1={columnHeight + 10} x2="45" y2={columnHeight + 10} stroke="#64748b" strokeWidth="1" />
                <text x="25" y={columnHeight / 2 + 15} fill="#94a3b8" fontSize="10" textAnchor="middle" transform={`rotate(-90, 25, ${columnHeight / 2 + 15})`}>
                    H = {height} m
                </text>
            </svg>
        </div>
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
