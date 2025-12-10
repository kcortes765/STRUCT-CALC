"use client";

import Link from "next/link";
import {
  Square,
  Columns,
  LayoutGrid,
  Settings,
  Zap,
  ChevronRight,
  Ruler,
  Shield
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen grid-background">
      {/* Header */}
      <header className="p-6 border-b border-border-subtle">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gradient">STRUCT-CALC</h1>
              <p className="text-xs text-text-tertiary">ACERO INDUSTRIAL</p>
            </div>
          </div>
          <Link href="/config" className="btn btn-secondary text-sm">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Configuración</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6 space-y-8">

        {/* Hero Section */}
        <section className="text-center py-8">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Cálculo <span className="text-gradient">Estructural</span>
          </h2>
          <p className="text-text-secondary max-w-md mx-auto">
            Diseño y verificación de estructuras de acero según normativa AISC 360 y NCh.
          </p>
        </section>

        {/* Calculator Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Beam Calculator */}
          <Link href="/beam" className="group">
            <div className="glass-card p-6 h-full transition-all duration-300 cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Square className="w-7 h-7 text-white rotate-90" />
                </div>
                <ChevronRight className="w-5 h-5 text-text-tertiary group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Vigas</h3>
              <p className="text-sm text-text-secondary mb-4">
                Análisis de vigas de acero: momentos, cortantes, deflexiones y verificación AISC.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-info">Flexión</span>
                <span className="badge badge-info">Corte</span>
                <span className="badge badge-success">AISC 360</span>
              </div>
            </div>
          </Link>

          {/* Column Calculator */}
          <Link href="/column" className="group">
            <div className="glass-card p-6 h-full transition-all duration-300 cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Columns className="w-7 h-7 text-white" />
                </div>
                <ChevronRight className="w-5 h-5 text-text-tertiary group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Columnas</h3>
              <p className="text-sm text-text-secondary mb-4">
                Verificación de columnas: compresión, pandeo, flexo-compresión.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-info">Pandeo</span>
                <span className="badge badge-info">P-M</span>
                <span className="badge badge-success">AISC E</span>
              </div>
            </div>
          </Link>

          {/* Frame Calculator */}
          <Link href="/frame" className="group sm:col-span-2 lg:col-span-1">
            <div className="glass-card p-6 h-full transition-all duration-300 cursor-pointer border-primary-600/30">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center group-hover:scale-110 transition-transform animate-pulse-slow">
                  <LayoutGrid className="w-7 h-7 text-white" />
                </div>
                <ChevronRight className="w-5 h-5 text-text-tertiary group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Pórticos 2D</h3>
              <p className="text-sm text-text-secondary mb-4">
                Análisis completo de marcos: geometría visual, cargas, resultados 3D.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-warning">Visual</span>
                <span className="badge badge-info">Sísmico</span>
                <span className="badge badge-success">NCh 433</span>
              </div>
            </div>
          </Link>

        </section>

        {/* Features Section */}
        <section className="py-8">
          <h3 className="text-lg font-semibold mb-4 text-center text-text-secondary">Características</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FeatureItem
              icon={<Zap className="w-5 h-5" />}
              title="Rápido"
              description="Análisis FEM"
            />
            <FeatureItem
              icon={<Ruler className="w-5 h-5" />}
              title="Perfiles"
              description="AISC + Chilenos"
            />
            <FeatureItem
              icon={<Shield className="w-5 h-5" />}
              title="Normativa"
              description="AISC 360 / NCh"
            />
            <FeatureItem
              icon={<LayoutGrid className="w-5 h-5" />}
              title="Visual"
              description="3D interactivo"
            />
          </div>
        </section>

        {/* Unit Selector CTA */}
        <section className="glass-card p-6 text-center">
          <p className="text-text-secondary mb-4">
            Sistema de unidades actual: <span className="font-mono text-primary-400">kN-m</span>
          </p>
          <Link href="/config" className="btn btn-primary">
            Cambiar unidades
          </Link>
        </section>

      </div>

      {/* Footer */}
      <footer className="mt-12 p-6 border-t border-border-subtle text-center">
        <p className="text-sm text-text-tertiary">
          STRUCT-CALC ACERO v1.0
        </p>
      </footer>
    </main>
  );
}

function FeatureItem({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="card p-4 text-center">
      <div className="w-10 h-10 rounded-lg bg-primary-900/50 flex items-center justify-center mx-auto mb-2 text-primary-400">
        {icon}
      </div>
      <h4 className="font-medium text-sm">{title}</h4>
      <p className="text-xs text-text-tertiary">{description}</p>
    </div>
  );
}
