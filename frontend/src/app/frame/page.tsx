"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Play,
    RotateCcw,
    Plus,
    Trash2,
    Move,
    MousePointer,
    Loader2,
    AlertTriangle,
    Check,
    X
} from "lucide-react";
import {
    FrameNode,
    FrameElement,
    FrameLoad,
    FrameAnalysisResult,
    UnitSystem,
    UNIT_LABELS
} from "@/lib/types";
import { analyzeFrame } from "@/lib/api";
import { saveCalculation } from "@/lib/db";

type Tool = "select" | "node" | "beam" | "column" | "load";

export default function FrameCalculator() {
    // Canvas state
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [tool, setTool] = useState<Tool>("select");
    const [selectedNode, setSelectedNode] = useState<number | null>(null);
    const [selectedElement, setSelectedElement] = useState<number | null>(null);

    // Model state
    const [nodes, setNodes] = useState<FrameNode[]>([
        { id: 1, x: 0, y: 0, support: "fixed" },
        { id: 2, x: 6, y: 0, support: "fixed" },
        { id: 3, x: 0, y: 4 },
        { id: 4, x: 6, y: 4 },
    ]);
    const [elements, setElements] = useState<FrameElement[]>([
        { id: 1, node_i: 1, node_j: 3, section_id: "W310X39", element_type: "column" },
        { id: 2, node_i: 2, node_j: 4, section_id: "W310X39", element_type: "column" },
        { id: 3, node_i: 3, node_j: 4, section_id: "W360X44", element_type: "beam" },
    ]);
    const [loads, setLoads] = useState<FrameLoad[]>([
        { type: "nodal", node_id: 3, Fx: 50, Fy: 0, Mz: 0 },
        { type: "nodal", node_id: 4, Fx: 50, Fy: 0, Mz: 0 },
    ]);

    // Analysis state
    const [materialId, setMaterialId] = useState("A572_GR50");
    const [units, setUnits] = useState<UnitSystem>("kN-m");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<FrameAnalysisResult | null>(null);

    // Connection mode for creating elements
    const [connectingFrom, setConnectingFrom] = useState<number | null>(null);

    const unitLabels = UNIT_LABELS[units];

    const handleAnalyze = async () => {
        setError(null);
        setIsLoading(true);

        try {
            const response = await analyzeFrame({
                nodes,
                elements,
                loads,
                material_id: materialId,
                units
            });
            setResult(response as FrameAnalysisResult);

            // Save calculation to history (IndexedDB)
            try {
                await saveCalculation({
                    type: 'frame',
                    timestamp: new Date(),
                    name: `Pórtico ${nodes.length} nodos`,
                    result: response
                });
                console.log('[Frame] Calculation saved to history');
            } catch (dbError) {
                console.warn('[Frame] Could not save to history:', dbError);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error de conexión con el servidor";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setNodes([
            { id: 1, x: 0, y: 0, support: "fixed" },
            { id: 2, x: 6, y: 0, support: "fixed" },
            { id: 3, x: 0, y: 4 },
            { id: 4, x: 6, y: 4 },
        ]);
        setElements([
            { id: 1, node_i: 1, node_j: 3, section_id: "W310X39", element_type: "column" },
            { id: 2, node_i: 2, node_j: 4, section_id: "W310X39", element_type: "column" },
            { id: 3, node_i: 3, node_j: 4, section_id: "W360X44", element_type: "beam" },
        ]);
        setLoads([
            { type: "nodal", node_id: 3, Fx: 50, Fy: 0, Mz: 0 },
            { type: "nodal", node_id: 4, Fx: 50, Fy: 0, Mz: 0 },
        ]);
        setResult(null);
        setError(null);
        setSelectedNode(null);
        setSelectedElement(null);
    };

    const addNode = () => {
        const newId = Math.max(...nodes.map(n => n.id), 0) + 1;
        const newNode: FrameNode = {
            id: newId,
            x: 3,
            y: 2,
        };
        setNodes([...nodes, newNode]);
        setSelectedNode(newId);
    };

    const removeNode = (id: number) => {
        // Remove node and any connected elements and loads
        setNodes(nodes.filter(n => n.id !== id));
        setElements(elements.filter(e => e.node_i !== id && e.node_j !== id));
        setLoads(loads.filter(l => l.node_id !== id));
        setSelectedNode(null);
    };

    const updateNode = (id: number, updates: Partial<FrameNode>) => {
        setNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
    };

    const addElement = (node_i: number, node_j: number, type: "beam" | "column") => {
        const newId = Math.max(...elements.map(e => e.id), 0) + 1;
        const newElement: FrameElement = {
            id: newId,
            node_i,
            node_j,
            section_id: type === "beam" ? "W360X44" : "W310X39",
            element_type: type
        };
        setElements([...elements, newElement]);
    };

    const removeElement = (id: number) => {
        setElements(elements.filter(e => e.id !== id));
        setSelectedElement(null);
    };

    const updateElement = (id: number, updates: Partial<FrameElement>) => {
        setElements(elements.map(e => e.id === id ? { ...e, ...updates } : e));
    };

    const addLoad = (nodeId: number) => {
        const newLoad: FrameLoad = {
            type: "nodal",
            node_id: nodeId,
            Fx: 0,
            Fy: -50,
            Mz: 0
        };
        setLoads([...loads, newLoad]);
    };

    const removeLoad = (index: number) => {
        setLoads(loads.filter((_, i) => i !== index));
    };

    const updateLoad = (index: number, updates: Partial<FrameLoad>) => {
        const updated = [...loads];
        updated[index] = { ...updated[index], ...updates };
        setLoads(updated);
    };

    // Handle canvas click for adding nodes
    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Convert to model coordinates
        const margin = 60;
        const scale = 40;
        const modelX = (x - margin) / scale;
        const modelY = (rect.height - margin - y) / scale;

        if (tool === "node") {
            const newId = Math.max(...nodes.map(n => n.id), 0) + 1;
            setNodes([...nodes, {
                id: newId,
                x: Math.round(modelX * 2) / 2, // Snap to 0.5m grid
                y: Math.round(modelY * 2) / 2
            }]);
        } else if (tool === "select") {
            // Find clicked node
            const clickedNode = nodes.find(n => {
                const nx = margin + n.x * scale;
                const ny = rect.height - margin - n.y * scale;
                return Math.hypot(x - nx, y - ny) < 15;
            });

            if (clickedNode) {
                setSelectedNode(clickedNode.id);
                setSelectedElement(null);

                if (connectingFrom !== null && connectingFrom !== clickedNode.id) {
                    // Create element between nodes
                    const ni = nodes.find(n => n.id === connectingFrom);
                    const nj = clickedNode;
                    if (ni && nj) {
                        const type = Math.abs(ni.y - nj.y) > Math.abs(ni.x - nj.x) ? "column" : "beam";
                        addElement(connectingFrom, clickedNode.id, type);
                    }
                    setConnectingFrom(null);
                }
            } else {
                setSelectedNode(null);
                // Find clicked element
                const clickedElement = elements.find(e => {
                    const ni = nodes.find(n => n.id === e.node_i);
                    const nj = nodes.find(n => n.id === e.node_j);
                    if (!ni || !nj) return false;

                    const x1 = margin + ni.x * scale;
                    const y1 = rect.height - margin - ni.y * scale;
                    const x2 = margin + nj.x * scale;
                    const y2 = rect.height - margin - nj.y * scale;

                    // Distance from point to line segment
                    const A = x - x1;
                    const B = y - y1;
                    const C = x2 - x1;
                    const D = y2 - y1;
                    const dot = A * C + B * D;
                    const len_sq = C * C + D * D;
                    let t = dot / len_sq;
                    t = Math.max(0, Math.min(1, t));
                    const xx = x1 + t * C;
                    const yy = y1 + t * D;
                    const dist = Math.hypot(x - xx, y - yy);

                    return dist < 10;
                });

                if (clickedElement) {
                    setSelectedElement(clickedElement.id);
                } else {
                    setSelectedElement(null);
                }
            }
        }
    }, [tool, nodes, elements, connectingFrom]);

    // Get selected node/element data
    const selectedNodeData = selectedNode ? nodes.find(n => n.id === selectedNode) : null;
    const selectedElementData = selectedElement ? elements.find(e => e.id === selectedElement) : null;

    return (
        <main className="min-h-screen grid-background pb-20">
            {/* Header */}
            <header className="sticky top-0 z-50 p-4 border-b border-border-subtle bg-background/80 backdrop-blur-glass">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="p-2 rounded-lg hover:bg-surface transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold">Pórtico 2D</h1>
                            <p className="text-xs text-text-tertiary">Editor Visual</p>
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
                            <span>Analizar</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto p-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                    {/* Left Panel - Canvas and Tools */}
                    <div className="md:col-span-2 lg:col-span-2 space-y-4">

                        {/* Toolbar */}
                        <div className="glass-card p-3 flex items-center gap-2 flex-wrap">
                            <ToolButton
                                active={tool === "select"}
                                onClick={() => setTool("select")}
                                icon={<MousePointer className="w-4 h-4" />}
                                label="Seleccionar"
                            />
                            <ToolButton
                                active={tool === "node"}
                                onClick={() => setTool("node")}
                                icon={<Plus className="w-4 h-4" />}
                                label="Nodo"
                            />
                            <div className="w-px h-6 bg-border-subtle mx-1" />
                            <button
                                onClick={addNode}
                                className="btn btn-secondary text-xs py-1 px-2"
                            >
                                + Nodo
                            </button>
                            <button
                                onClick={() => selectedNode && setConnectingFrom(selectedNode)}
                                disabled={!selectedNode}
                                className="btn btn-secondary text-xs py-1 px-2"
                            >
                                Conectar desde selección
                            </button>
                            {connectingFrom && (
                                <span className="text-xs text-primary-400">
                                    Conectando desde nodo {connectingFrom}...
                                </span>
                            )}
                        </div>

                        {/* Canvas */}
                        <div className="glass-card p-4">
                            <FrameCanvas
                                ref={canvasRef}
                                nodes={nodes}
                                elements={elements}
                                loads={loads}
                                selectedNode={selectedNode}
                                selectedElement={selectedElement}
                                result={result}
                                onClick={handleCanvasClick}
                            />
                        </div>

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

                        {/* Element Verifications Table */}
                        {result && result.element_verifications && result.element_verifications.length > 0 && (
                            <div className="glass-card p-4 space-y-3">
                                <h3 className="font-semibold text-sm">Verificación de Elementos</h3>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="border-b border-border-subtle">
                                            <tr className="text-text-tertiary">
                                                <th className="text-left py-2 px-2">Elem</th>
                                                <th className="text-left py-2 px-2">Tipo</th>
                                                <th className="text-left py-2 px-2">Perfil</th>
                                                <th className="text-right py-2 px-2">N ({unitLabels.force})</th>
                                                <th className="text-right py-2 px-2">V ({unitLabels.force})</th>
                                                <th className="text-right py-2 px-2">M ({unitLabels.moment})</th>
                                                <th className="text-right py-2 px-2">Ratio</th>
                                                <th className="text-center py-2 px-2">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.element_verifications.map((ver) => (
                                                <tr
                                                    key={ver.element_id}
                                                    className={`border-b border-border-subtle/50 ${
                                                        ver.overall_ok ? "hover:bg-success/5" : "hover:bg-error/5"
                                                    }`}
                                                >
                                                    <td className="py-2 px-2 font-mono">{ver.element_id}</td>
                                                    <td className="py-2 px-2 capitalize">{ver.type}</td>
                                                    <td className="py-2 px-2 font-mono">{ver.section_id}</td>
                                                    <td className="py-2 px-2 text-right font-mono">
                                                        {ver.forces.N.toFixed(1)}
                                                    </td>
                                                    <td className="py-2 px-2 text-right font-mono">
                                                        {ver.forces.V.toFixed(1)}
                                                    </td>
                                                    <td className="py-2 px-2 text-right font-mono">
                                                        {ver.forces.M.toFixed(1)}
                                                    </td>
                                                    <td className="py-2 px-2 text-right font-mono">
                                                        <span className={
                                                            ver.max_ratio > 1.0 ? "text-error font-bold" :
                                                            ver.max_ratio > 0.8 ? "text-warning" :
                                                            "text-success"
                                                        }>
                                                            {ver.max_ratio.toFixed(2)}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-2 text-center">
                                                        {ver.overall_ok ? (
                                                            <span className="text-success">✓</span>
                                                        ) : (
                                                            <span className="text-error">✗</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <p className="text-xs text-text-tertiary mt-2">
                                    * Ratio: Demanda / Capacidad según AISC 360
                                </p>
                            </div>
                        )}

                    </div>

                    {/* Right Panel - Properties */}
                    <div className="space-y-4">

                        {/* Analysis Settings */}
                        <div className="glass-card p-4 space-y-3">
                            <h3 className="font-semibold text-sm">Configuración</h3>

                            <div>
                                <label className="input-label text-xs">Material</label>
                                <select
                                    value={materialId}
                                    onChange={(e) => setMaterialId(e.target.value)}
                                    className="select-field text-sm"
                                >
                                    <option value="A36">A36</option>
                                    <option value="A572_GR50">A572 Gr.50</option>
                                    <option value="A992">A992</option>
                                </select>
                            </div>

                            <div>
                                <label className="input-label text-xs">Unidades</label>
                                <select
                                    value={units}
                                    onChange={(e) => setUnits(e.target.value as UnitSystem)}
                                    className="select-field text-sm"
                                >
                                    <option value="kN-m">kN-m</option>
                                    <option value="tonf-m">tonf-m</option>
                                </select>
                            </div>
                        </div>

                        {/* Node Properties */}
                        {selectedNodeData && (
                            <div className="glass-card p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-sm">Nodo {selectedNodeData.id}</h3>
                                    <button
                                        onClick={() => removeNode(selectedNodeData.id)}
                                        className="p-1 text-error hover:bg-error/20 rounded"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="input-label text-xs">X (m)</label>
                                        <input
                                            type="number"
                                            value={selectedNodeData.x}
                                            onChange={(e) => updateNode(selectedNodeData.id, { x: Number(e.target.value) })}
                                            step={0.5}
                                            className="input-field text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="input-label text-xs">Y (m)</label>
                                        <input
                                            type="number"
                                            value={selectedNodeData.y}
                                            onChange={(e) => updateNode(selectedNodeData.id, { y: Number(e.target.value) })}
                                            step={0.5}
                                            className="input-field text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="input-label text-xs">Apoyo</label>
                                    <select
                                        value={selectedNodeData.support || "free"}
                                        onChange={(e) => updateNode(selectedNodeData.id, {
                                            support: e.target.value === "free" ? undefined : e.target.value as "fixed" | "pinned" | "roller"
                                        })}
                                        className="select-field text-sm"
                                    >
                                        <option value="free">Libre</option>
                                        <option value="fixed">Empotrado</option>
                                        <option value="pinned">Articulado</option>
                                        <option value="roller">Rodillo</option>
                                    </select>
                                </div>

                                <button
                                    onClick={() => addLoad(selectedNodeData.id)}
                                    className="btn btn-secondary text-xs w-full"
                                >
                                    + Agregar carga en nodo
                                </button>
                            </div>
                        )}

                        {/* Element Properties */}
                        {selectedElementData && (
                            <div className="glass-card p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-sm">
                                        {selectedElementData.element_type === "beam" ? "Viga" : "Columna"} {selectedElementData.id}
                                    </h3>
                                    <button
                                        onClick={() => removeElement(selectedElementData.id)}
                                        className="p-1 text-error hover:bg-error/20 rounded"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="text-xs text-text-secondary">
                                    Nodos: {selectedElementData.node_i} → {selectedElementData.node_j}
                                </div>

                                <div>
                                    <label className="input-label text-xs">Perfil</label>
                                    <select
                                        value={selectedElementData.section_id}
                                        onChange={(e) => updateElement(selectedElementData.id, { section_id: e.target.value })}
                                        className="select-field text-sm"
                                    >
                                        <optgroup label="Vigas">
                                            <option value="W360X44">W360X44</option>
                                            <option value="W410X54">W410X54</option>
                                            <option value="W460X68">W460X68</option>
                                        </optgroup>
                                        <optgroup label="Columnas">
                                            <option value="W250X33">W250X33</option>
                                            <option value="W310X39">W310X39</option>
                                            <option value="W310X33">W310X33</option>
                                        </optgroup>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Loads List */}
                        <div className="glass-card p-4 space-y-3">
                            <h3 className="font-semibold text-sm">Cargas</h3>

                            {loads.length === 0 && (
                                <p className="text-xs text-text-tertiary text-center py-2">
                                    No hay cargas aplicadas
                                </p>
                            )}

                            {loads.map((load, index) => (
                                <div key={index} className="p-2 rounded bg-background-secondary space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium">
                                            {load.type === "nodal" ? `Nodo ${load.node_id}` :
                                             load.type === "distributed" ? `Elemento ${load.element_id} (Dist)` :
                                             `Elemento ${load.element_id} (Punto)`}
                                        </span>
                                        <button
                                            onClick={() => removeLoad(index)}
                                            className="p-1 text-error hover:bg-error/20 rounded"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>

                                    {load.type === "nodal" && (
                                        <div className="grid grid-cols-3 gap-1">
                                            <div>
                                                <label className="text-[10px] text-text-tertiary">Fx ({unitLabels.force})</label>
                                                <input
                                                    type="number"
                                                    value={load.Fx}
                                                    onChange={(e) => updateLoad(index, { Fx: Number(e.target.value) })}
                                                    className="input-field text-xs py-1"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-text-tertiary">Fy ({unitLabels.force})</label>
                                                <input
                                                    type="number"
                                                    value={load.Fy}
                                                    onChange={(e) => updateLoad(index, { Fy: Number(e.target.value) })}
                                                    className="input-field text-xs py-1"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-text-tertiary">Mz ({unitLabels.moment})</label>
                                                <input
                                                    type="number"
                                                    value={load.Mz}
                                                    onChange={(e) => updateLoad(index, { Mz: Number(e.target.value) })}
                                                    className="input-field text-xs py-1"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {load.type === "distributed" && (
                                        <div>
                                            <label className="text-[10px] text-text-tertiary">w ({unitLabels.force}/m)</label>
                                            <input
                                                type="number"
                                                value={load.w || 0}
                                                onChange={(e) => updateLoad(index, { w: Number(e.target.value) })}
                                                className="input-field text-xs py-1"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Add distributed load button */}
                            {selectedElement && (
                                <button
                                    onClick={() => {
                                        const newLoad: FrameLoad = {
                                            type: "distributed",
                                            element_id: selectedElement,
                                            Fx: 0,
                                            Fy: 0,
                                            Mz: 0,
                                            w: -10  // Default downward distributed load
                                        };
                                        setLoads([...loads, newLoad]);
                                    }}
                                    className="btn btn-secondary text-xs w-full"
                                >
                                    + Carga distribuida en elemento
                                </button>
                            )}
                        </div>

                        {/* Results Summary */}
                        {result && result.status === "success" && (
                            <>
                                <div className="glass-card p-4 space-y-3">
                                    <h3 className="font-semibold text-sm flex items-center gap-2">
                                        <Check className="w-4 h-4 text-success" />
                                        Análisis Completado
                                    </h3>

                                    <div className="text-xs space-y-1">
                                        <p className="text-text-secondary">
                                            Nodos: {Object.keys(result.nodes || {}).length}
                                        </p>
                                        <p className="text-text-secondary">
                                            Elementos: {Object.keys(result.elements || {}).length}
                                        </p>
                                        <p className="text-text-secondary">
                                            Reacciones calculadas ✓
                                        </p>
                                    </div>

                                    {/* Show reactions */}
                                    {result.reactions && (
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium">Reacciones:</p>
                                            {Object.entries(result.reactions).map(([nodeId, reaction]) => (
                                                <div key={nodeId} className="text-xs font-mono text-text-secondary">
                                                    N{nodeId}: Rx={reaction.Rx?.toFixed(1)} Ry={reaction.Ry?.toFixed(1)} {unitLabels.force}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Verification Summary */}
                                {result.verification_summary && (
                                    <div className={`glass-card p-4 space-y-3 ${
                                        result.verification_summary.all_ok
                                            ? "border-success/50 bg-success/5"
                                            : "border-error/50 bg-error/5"
                                    }`}>
                                        <h3 className="font-semibold text-sm flex items-center gap-2">
                                            {result.verification_summary.all_ok ? (
                                                <Check className="w-4 h-4 text-success" />
                                            ) : (
                                                <AlertTriangle className="w-4 h-4 text-error" />
                                            )}
                                            Verificación AISC 360
                                        </h3>

                                        <div className="text-xs space-y-1">
                                            <p className="text-text-secondary">
                                                Elementos verificados: {result.verification_summary.total_elements}
                                            </p>
                                            <p className="text-success">
                                                ✓ Aprobados: {result.verification_summary.passed_elements}
                                            </p>
                                            {result.verification_summary.failed_elements > 0 && (
                                                <p className="text-error">
                                                    ✗ Fallaron: {result.verification_summary.failed_elements}
                                                </p>
                                            )}
                                            <p className="text-text-secondary">
                                                Utilización máxima: {result.verification_summary.max_utilization.toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                    </div>
                </div>
            </div>
        </main>
    );
}

// Tool Button Component
function ToolButton({
    active,
    onClick,
    icon,
    label
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active
                    ? "bg-primary-600 text-white"
                    : "bg-surface text-text-secondary hover:text-text-primary"
                }`}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}

// Frame Canvas Component
import { forwardRef } from "react";

interface FrameCanvasProps {
    nodes: FrameNode[];
    elements: FrameElement[];
    loads: FrameLoad[];
    selectedNode: number | null;
    selectedElement: number | null;
    result: FrameAnalysisResult | null;
    onClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

const FrameCanvas = forwardRef<HTMLCanvasElement, FrameCanvasProps>(
    function FrameCanvas({ nodes, elements, loads, selectedNode, selectedElement, result, onClick }, ref) {
        const internalRef = useRef<HTMLCanvasElement>(null);

        // Merge refs safely
        const canvasRef = (ref || internalRef) as React.RefObject<HTMLCanvasElement>;

        // Draw on canvas
        useEffect(() => {
            const cvs = canvasRef.current;
            if (!cvs) return;

            const ctx = cvs.getContext("2d");
            if (!ctx) return;

            // Set canvas size
            const dpr = window.devicePixelRatio || 1;
            cvs.width = cvs.offsetWidth * dpr;
            cvs.height = cvs.offsetHeight * dpr;
            ctx.scale(dpr, dpr);

            const width = cvs.offsetWidth;
            const height = cvs.offsetHeight;

            // Clear
            ctx.fillStyle = "rgba(15, 23, 42, 0.5)";
            ctx.fillRect(0, 0, width, height);

            // Grid
            const margin = 60;
            const scale = 40;

            ctx.strokeStyle = "rgba(71, 85, 105, 0.3)";
            ctx.lineWidth = 0.5;

            for (let x = margin; x < width - margin; x += scale) {
                ctx.beginPath();
                ctx.moveTo(x, margin);
                ctx.lineTo(x, height - margin);
                ctx.stroke();
            }
            for (let y = margin; y < height - margin; y += scale) {
                ctx.beginPath();
                ctx.moveTo(margin, y);
                ctx.lineTo(width - margin, y);
                ctx.stroke();
            }

            // Draw elements
            elements.forEach(elem => {
                const ni = nodes.find(n => n.id === elem.node_i);
                const nj = nodes.find(n => n.id === elem.node_j);
                if (!ni || !nj) return;

                const x1 = margin + ni.x * scale;
                const y1 = height - margin - ni.y * scale;
                const x2 = margin + nj.x * scale;
                const y2 = height - margin - nj.y * scale;

                ctx.strokeStyle = elem.id === selectedElement ? "#f59e0b" :
                    elem.element_type === "column" ? "#10b981" : "#3b82f6";
                ctx.lineWidth = elem.id === selectedElement ? 6 : 4;
                ctx.lineCap = "round";

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            });

            // Draw nodes
            nodes.forEach(node => {
                const x = margin + node.x * scale;
                const y = height - margin - node.y * scale;

                // Support symbol
                if (node.support === "fixed") {
                    ctx.fillStyle = "#10b981";
                    ctx.fillRect(x - 10, y, 20, 8);
                } else if (node.support === "pinned") {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x - 10, y + 15);
                    ctx.lineTo(x + 10, y + 15);
                    ctx.closePath();
                    ctx.fillStyle = "#10b981";
                    ctx.fill();
                } else if (node.support === "roller") {
                    ctx.beginPath();
                    ctx.arc(x, y + 8, 5, 0, Math.PI * 2);
                    ctx.fillStyle = "#10b981";
                    ctx.fill();
                }

                // Node circle
                ctx.beginPath();
                ctx.arc(x, y, node.id === selectedNode ? 10 : 8, 0, Math.PI * 2);
                ctx.fillStyle = node.id === selectedNode ? "#f59e0b" : "#f8fafc";
                ctx.fill();
                ctx.strokeStyle = "#1e293b";
                ctx.lineWidth = 2;
                ctx.stroke();

                // Node label
                ctx.fillStyle = "#94a3b8";
                ctx.font = "10px Inter";
                ctx.textAlign = "center";
                ctx.fillText(`${node.id}`, x, y - 15);
            });

            // Draw loads
            loads.forEach(load => {
                if (load.type !== "nodal" || !load.node_id) return;
                const node = nodes.find(n => n.id === load.node_id);
                if (!node) return;

                const x = margin + node.x * scale;
                const y = height - margin - node.y * scale;

                // Horizontal load (Fx)
                if (Math.abs(load.Fx) > 0) {
                    const dir = load.Fx > 0 ? 1 : -1;
                    ctx.strokeStyle = "#ef4444";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x - dir * 30, y);
                    ctx.lineTo(x - dir * 5, y);
                    ctx.stroke();

                    // Arrow head
                    ctx.beginPath();
                    ctx.moveTo(x - dir * 5, y);
                    ctx.lineTo(x - dir * 15, y - 5);
                    ctx.lineTo(x - dir * 15, y + 5);
                    ctx.closePath();
                    ctx.fillStyle = "#ef4444";
                    ctx.fill();
                }

                // Vertical load (Fy)
                if (Math.abs(load.Fy) > 0) {
                    const dir = load.Fy > 0 ? 1 : -1;
                    ctx.strokeStyle = "#ef4444";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x, y + dir * 30);
                    ctx.lineTo(x, y + dir * 5);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(x, y + dir * 5);
                    ctx.lineTo(x - 5, y + dir * 15);
                    ctx.lineTo(x + 5, y + dir * 15);
                    ctx.closePath();
                    ctx.fillStyle = "#ef4444";
                    ctx.fill();
                }
            });

        }, [nodes, elements, loads, selectedNode, selectedElement, result]);

        return (
            <canvas
                ref={canvasRef}
                onClick={onClick}
                className="w-full h-[400px] rounded-lg cursor-crosshair"
                style={{ background: "rgba(15, 23, 42, 0.5)" }}
            />
        );
    }
);
