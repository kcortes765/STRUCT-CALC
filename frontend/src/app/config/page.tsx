"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Save, Globe, AlertTriangle } from "lucide-react";
import { UnitSystem, DEFAULT_CONFIG } from "@/lib/types";

export default function ConfigPage() {
    const [units, setUnits] = useState<UnitSystem>("kN-m");
    const [defaultMaterial, setDefaultMaterial] = useState("A572_GR50");
    const [apiUrl, setApiUrl] = useState(DEFAULT_CONFIG.apiUrl);
    const [saved, setSaved] = useState(false);
    const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
    const [configError, setConfigError] = useState<string | null>(null);

    useEffect(() => {
        // Load saved config from localStorage
        const savedConfig = localStorage.getItem("struct-calc-config");
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                setUnits(config.units || "kN-m");
                setDefaultMaterial(config.defaultMaterial || "A572_GR50");
                setApiUrl(config.apiUrl || DEFAULT_CONFIG.apiUrl);
            } catch {
                setConfigError("No se pudo cargar la configuración guardada");
            }
        }

        // Check API status
        checkApiStatus();
    }, []);

    const checkApiStatus = async () => {
        setApiStatus("checking");
        try {
            const response = await fetch(`${apiUrl}/health`, {
                method: "GET",
                signal: AbortSignal.timeout(5000)
            });
            if (response.ok) {
                setApiStatus("online");
            } else {
                setApiStatus("offline");
            }
        } catch {
            setApiStatus("offline");
        }
    };

    const handleSave = () => {
        const config = {
            units,
            defaultMaterial,
            apiUrl
        };
        localStorage.setItem("struct-calc-config", JSON.stringify(config));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const MATERIALS = [
        { id: "A36", name: "A36 - Acero carbono (Fy=250 MPa)" },
        { id: "A572_GR50", name: "A572 Gr.50 - Alta resistencia (Fy=345 MPa)" },
        { id: "A992", name: "A992 - Para perfiles W (Fy=345 MPa)" },
        { id: "A42_27ES", name: "A42-27ES - NCh Chile (Fy=270 MPa)" },
        { id: "A52_34ES", name: "A52-34ES - NCh Chile (Fy=340 MPa)" },
    ];

    return (
        <main className="min-h-screen grid-background">
            {/* Header */}
            <header className="p-4 border-b border-border-subtle">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="p-2 rounded-lg hover:bg-surface transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold">Configuración</h1>
                            <p className="text-xs text-text-tertiary">Preferencias de la app</p>
                        </div>
                    </div>
                    <button onClick={handleSave} className="btn btn-primary text-sm">
                        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        <span>{saved ? "Guardado" : "Guardar"}</span>
                    </button>
                </div>
            </header>

            <div className="max-w-2xl mx-auto p-4 space-y-6">

                {/* Config Error Display */}
                {configError && (
                    <div className="glass-card p-4 border-error/50 bg-error/10">
                        <div className="flex items-center gap-2 text-error">
                            <AlertTriangle className="w-5 h-5" />
                            <span className="font-medium">Error de Configuración</span>
                        </div>
                        <p className="text-sm text-text-secondary mt-1">{configError}</p>
                    </div>
                )}

                {/* Units Section */}
                <section className="glass-card p-6">
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                        <span className="text-2xl">📐</span>
                        Sistema de Unidades
                    </h2>
                    <p className="text-sm text-text-secondary mb-4">
                        Selecciona el sistema de unidades que deseas usar en toda la aplicación.
                    </p>

                    <div className="grid grid-cols-1 gap-3">
                        <UnitOption
                            selected={units === "kN-m"}
                            onClick={() => setUnits("kN-m")}
                            title="kN-m (SI)"
                            description="Kilonewtons, metros • Sistema Internacional"
                            detail="Fuerzas: kN | Momentos: kN·m | Tensiones: MPa"
                        />
                        <UnitOption
                            selected={units === "tonf-m"}
                            onClick={() => setUnits("tonf-m")}
                            title="tonf-m"
                            description="Toneladas-fuerza, metros • Común en Chile"
                            detail="Fuerzas: tonf | Momentos: tonf·m | Tensiones: MPa"
                        />
                        <UnitOption
                            selected={units === "kgf-cm"}
                            onClick={() => setUnits("kgf-cm")}
                            title="kgf-cm"
                            description="Kilogramos-fuerza, centímetros • Tradicional"
                            detail="Fuerzas: kgf | Momentos: kgf·cm | Tensiones: kgf/cm²"
                        />
                    </div>
                </section>

                {/* Default Material Section */}
                <section className="glass-card p-6">
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                        <span className="text-2xl">🔩</span>
                        Material por Defecto
                    </h2>
                    <p className="text-sm text-text-secondary mb-4">
                        Material que se seleccionará automáticamente en nuevos cálculos.
                    </p>

                    <select
                        value={defaultMaterial}
                        onChange={(e) => setDefaultMaterial(e.target.value)}
                        className="select-field"
                    >
                        {MATERIALS.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </section>

                {/* API Connection Section */}
                <section className="glass-card p-6">
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        Conexión al Servidor
                    </h2>

                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-sm text-text-secondary">Estado:</span>
                        {apiStatus === "checking" && (
                            <span className="badge badge-info">Verificando...</span>
                        )}
                        {apiStatus === "online" && (
                            <span className="badge badge-success">Conectado</span>
                        )}
                        {apiStatus === "offline" && (
                            <span className="badge badge-error">Sin conexión</span>
                        )}
                        <button
                            onClick={checkApiStatus}
                            className="text-xs text-primary-400 hover:text-primary-300"
                        >
                            Reintentar
                        </button>
                    </div>

                    <div>
                        <label className="input-label">URL del API</label>
                        <input
                            type="text"
                            value={apiUrl}
                            onChange={(e) => setApiUrl(e.target.value)}
                            className="input-field font-mono text-sm"
                            placeholder="http://localhost:8000"
                        />
                        <p className="text-xs text-text-tertiary mt-2">
                            URL del servidor de cálculo.
                        </p>
                    </div>
                </section>

                {/* About Section */}
                <section className="glass-card p-6">
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                        <span className="text-2xl">ℹ️</span>
                        Acerca de
                    </h2>

                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-text-secondary">Versión:</span>
                            <span>1.0.0</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-secondary">Motor de cálculo:</span>
                            <span>FEM Engine</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-secondary">Normativas:</span>
                            <span>AISC 360-22, NCh 427</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-secondary">Target:</span>
                            <span>Ingeniería Estructural de Acero</span>
                        </div>
                    </div>

                </section>

            </div>
        </main>
    );
}

function UnitOption({
    selected,
    onClick,
    title,
    description,
    detail
}: {
    selected: boolean;
    onClick: () => void;
    title: string;
    description: string;
    detail: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`p-4 rounded-lg text-left transition-all ${selected
                    ? "bg-primary-900/50 border-2 border-primary-500"
                    : "bg-background-secondary border-2 border-transparent hover:border-border"
                }`}
        >
            <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">{title}</span>
                {selected && <Check className="w-5 h-5 text-primary-400" />}
            </div>
            <p className="text-sm text-text-secondary">{description}</p>
            <p className="text-xs text-text-tertiary mt-1 font-mono">{detail}</p>
        </button>
    );
}
