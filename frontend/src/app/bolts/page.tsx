'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Tipos de verificacion
type VerificationType = 'shear' | 'tension' | 'combined' | 'bearing';

// Grados y diametros disponibles
const BOLT_GRADES = ['A325', 'A490', '4.6', '8.8', '10.9'];
const BOLT_DIAMETERS = ['M12', 'M16', 'M20', 'M22', 'M24', 'M27', 'M30', '3/4"', '7/8"', '1"'];

interface VerificationResult {
  type: string;
  ok: boolean;
  ratio: number;
  utilization: number;
  phi_Rn: number;
  Rn: number;
  phi: number;
  details: Record<string, unknown>;
  // For combined
  interaction?: {
    value: number;
    ok: boolean;
    utilization: number;
    formula: string;
  };
  shear_check?: VerificationResult;
  tension_check?: VerificationResult;
}

export default function BoltsPage() {
  const [verificationType, setVerificationType] = useState<VerificationType>('shear');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  // Inputs comunes
  const [boltGrade, setBoltGrade] = useState('A325');
  const [diameter, setDiameter] = useState('M20');
  const [numBolts, setNumBolts] = useState(4);
  const [shearPlanes, setShearPlanes] = useState(1);

  // Fuerzas
  const [Vu, setVu] = useState(100);
  const [Tu, setTu] = useState(50);

  // Bearing
  const [tPlate, setTPlate] = useState(12);
  const [FuPlate, setFuPlate] = useState(400);
  const [edgeDist, setEdgeDist] = useState(40);
  const [spacing, setSpacing] = useState(70);

  const handleVerify = async () => {
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      let endpoint = '';
      let body: Record<string, unknown> = {};

      switch (verificationType) {
        case 'shear':
          endpoint = '/api/connections/bolts/shear';
          body = { bolt_grade: boltGrade, diameter, num_bolts: numBolts, Vu, shear_planes: shearPlanes };
          break;
        case 'tension':
          endpoint = '/api/connections/bolts/tension';
          body = { bolt_grade: boltGrade, diameter, num_bolts: numBolts, Tu };
          break;
        case 'combined':
          endpoint = '/api/connections/bolts/combined';
          body = { bolt_grade: boltGrade, diameter, num_bolts: numBolts, Vu, Tu, shear_planes: shearPlanes };
          break;
        case 'bearing':
          endpoint = '/api/connections/bolts/bearing';
          body = {
            t_plate: tPlate,
            Fu_plate: FuPlate,
            diameter,
            num_bolts: numBolts,
            Vu,
            edge_dist: edgeDist,
            spacing,
            hole_type: 'STD'
          };
          break;
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error en verificacion');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            &larr; Volver
          </Link>
          <h1 className="text-lg font-semibold">Verificacion de Pernos</h1>
          <span className="text-xs text-slate-400">AISC J3</span>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Tipo de verificacion */}
        <div className="bg-slate-800 rounded-lg p-4">
          <label className="block text-sm text-slate-400 mb-2">Tipo de Verificacion</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'shear', label: 'Corte' },
              { id: 'tension', label: 'Tension' },
              { id: 'combined', label: 'Combinado' },
              { id: 'bearing', label: 'Aplastamiento' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setVerificationType(id as VerificationType)}
                className={`py-2 px-3 rounded text-sm font-medium transition-colors ${
                  verificationType === id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Datos del perno */}
        <div className="bg-slate-800 rounded-lg p-4 space-y-4">
          <h2 className="font-medium text-slate-200">Datos del Perno</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Grado</label>
              <select
                value={boltGrade}
                onChange={(e) => setBoltGrade(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              >
                {BOLT_GRADES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Diametro</label>
              <select
                value={diameter}
                onChange={(e) => setDiameter(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              >
                {BOLT_DIAMETERS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Numero de Pernos</label>
              <input
                type="number"
                value={numBolts}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setNumBolts(isNaN(value) || value < 1 ? 1 : value);
                }}
                min="1"
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              />
            </div>

            {(verificationType === 'shear' || verificationType === 'combined') && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Planos de Corte</label>
                <select
                  value={shearPlanes}
                  onChange={(e) => setShearPlanes(parseInt(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                >
                  <option value={1}>Simple (1)</option>
                  <option value={2}>Doble (2)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Fuerzas aplicadas */}
        <div className="bg-slate-800 rounded-lg p-4 space-y-4">
          <h2 className="font-medium text-slate-200">Fuerzas Aplicadas</h2>

          <div className="grid grid-cols-2 gap-4">
            {(verificationType === 'shear' || verificationType === 'combined' || verificationType === 'bearing') && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Vu (Corte) [kN]</label>
                <input
                  type="number"
                  value={Vu}
                  onChange={(e) => setVu(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>
            )}

            {(verificationType === 'tension' || verificationType === 'combined') && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tu (Tension) [kN]</label>
                <input
                  type="number"
                  value={Tu}
                  onChange={(e) => setTu(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* Datos de placa (solo bearing) */}
        {verificationType === 'bearing' && (
          <div className="bg-slate-800 rounded-lg p-4 space-y-4">
            <h2 className="font-medium text-slate-200">Datos de Placa</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Espesor [mm]</label>
                <input
                  type="number"
                  value={tPlate}
                  onChange={(e) => setTPlate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Fu [MPa]</label>
                <input
                  type="number"
                  value={FuPlate}
                  onChange={(e) => setFuPlate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Dist. Borde [mm]</label>
                <input
                  type="number"
                  value={edgeDist}
                  onChange={(e) => setEdgeDist(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Espaciamiento [mm]</label>
                <input
                  type="number"
                  value={spacing}
                  onChange={(e) => setSpacing(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Boton verificar */}
        <button
          onClick={handleVerify}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium py-3 rounded-lg transition-colors"
        >
          {loading ? 'Verificando...' : 'Verificar'}
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Resultados */}
        {result && (
          <div className={`rounded-lg p-4 ${
            (result.ok || result.interaction?.ok)
              ? 'bg-green-900/50 border border-green-700'
              : 'bg-red-900/50 border border-red-700'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-lg">
                {(result.ok || result.interaction?.ok) ? 'CUMPLE' : 'NO CUMPLE'}
              </h2>
              <span className={`text-2xl font-bold ${
                (result.ok || result.interaction?.ok) ? 'text-green-400' : 'text-red-400'
              }`}>
                {verificationType === 'combined'
                  ? `${result.interaction?.utilization}%`
                  : `${result.utilization}%`
                }
              </span>
            </div>

            {/* Barra de utilizacion */}
            <div className="w-full bg-slate-700 rounded-full h-3 mb-4">
              <div
                className={`h-3 rounded-full transition-all ${
                  (result.ok || result.interaction?.ok) ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{
                  width: `${Math.min(
                    verificationType === 'combined'
                      ? (result.interaction?.utilization || 0)
                      : result.utilization,
                    100
                  )}%`
                }}
              />
            </div>

            {/* Detalles */}
            <div className="space-y-2 text-sm">
              {verificationType !== 'combined' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Demanda:</span>
                    <span>{verificationType === 'tension' ? result.details?.Tu as number : Vu} kN</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Capacidad (phiRn):</span>
                    <span>{result.phi_Rn} kN</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ratio:</span>
                    <span>{result.ratio}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Interaccion:</span>
                    <span>{result.interaction?.value}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Formula:</span>
                    <span className="text-xs">{result.interaction?.formula}</span>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-slate-600">
                    <span className="text-slate-400">Corte individual:</span>
                    <span className={result.shear_check?.ok ? 'text-green-400' : 'text-red-400'}>
                      {result.shear_check?.utilization}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tension individual:</span>
                    <span className={result.tension_check?.ok ? 'text-green-400' : 'text-red-400'}>
                      {result.tension_check?.utilization}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Referencia normativa */}
        <div className="text-xs text-slate-500 text-center">
          Verificaciones segun AISC 360-16, Capitulo J
        </div>
      </main>
    </div>
  );
}
