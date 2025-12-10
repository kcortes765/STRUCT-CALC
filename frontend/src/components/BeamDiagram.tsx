"use client";

import { useRef, useEffect } from "react";
import { PointLoad, DistributedLoad, SupportType, DisplacementPoint } from "@/lib/types";

interface BeamDiagramProps {
    length: number;
    supportLeft: SupportType;
    supportRight: SupportType;
    pointLoads: PointLoad[];
    distributedLoads: DistributedLoad[];
    deformed?: DisplacementPoint[];
    showDeformed?: boolean;
}

export default function BeamDiagram({
    length,
    supportLeft,
    supportRight,
    pointLoads,
    distributedLoads,
    deformed,
    showDeformed = true
}: BeamDiagramProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // High DPI support
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Margins and scale
        const margin = { left: 40, right: 40, top: 60, bottom: 40 };
        const beamWidth = width - margin.left - margin.right;
        const beamY = height / 2 + 20;
        const scale = beamWidth / length;

        // Helper function to convert x position to canvas x
        const toCanvasX = (x: number) => margin.left + x * scale;

        // ===== Draw Grid =====
        ctx.strokeStyle = "rgba(71, 85, 105, 0.3)";
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= length; i++) {
            const x = toCanvasX(i);
            ctx.beginPath();
            ctx.moveTo(x, margin.top);
            ctx.lineTo(x, height - margin.bottom + 20);
            ctx.stroke();
        }

        // ===== Draw Distributed Loads =====
        distributedLoads.forEach(load => {
            const x1 = toCanvasX(load.start);
            const x2 = toCanvasX(load.end || length);
            const loadHeight = Math.min(Math.abs(load.w_start) * 2, 40);

            // Gradient fill
            const gradient = ctx.createLinearGradient(x1, beamY - loadHeight - 20, x1, beamY);
            gradient.addColorStop(0, "rgba(59, 130, 246, 0.3)");
            gradient.addColorStop(1, "rgba(59, 130, 246, 0.1)");

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(x1, beamY);
            ctx.lineTo(x1, beamY - loadHeight - 20);
            ctx.lineTo(x2, beamY - loadHeight - 20);
            ctx.lineTo(x2, beamY);
            ctx.closePath();
            ctx.fill();

            // Arrows
            ctx.strokeStyle = "#3b82f6";
            ctx.lineWidth = 1.5;
            const arrowSpacing = 20;
            const numArrows = Math.max(3, Math.floor((x2 - x1) / arrowSpacing));

            for (let i = 0; i <= numArrows; i++) {
                const x = x1 + (i / numArrows) * (x2 - x1);
                const y1 = beamY - loadHeight - 15;
                const y2 = beamY - 5;

                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.stroke();

                // Arrow head
                ctx.beginPath();
                ctx.moveTo(x, y2);
                ctx.lineTo(x - 3, y2 - 6);
                ctx.lineTo(x + 3, y2 - 6);
                ctx.closePath();
                ctx.fillStyle = "#3b82f6";
                ctx.fill();
            }

            // Load value label
            ctx.fillStyle = "#60a5fa";
            ctx.font = "bold 11px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`${load.w_start} kN/m`, (x1 + x2) / 2, beamY - loadHeight - 25);
        });

        // ===== Draw Point Loads =====
        pointLoads.forEach(load => {
            const x = toCanvasX(load.position);
            const arrowLength = 40;

            // Arrow
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, beamY - arrowLength - 10);
            ctx.lineTo(x, beamY - 5);
            ctx.stroke();

            // Arrow head
            ctx.beginPath();
            ctx.moveTo(x, beamY - 5);
            ctx.lineTo(x - 5, beamY - 15);
            ctx.lineTo(x + 5, beamY - 15);
            ctx.closePath();
            ctx.fillStyle = "#ef4444";
            ctx.fill();

            // Force value
            ctx.fillStyle = "#ef4444";
            ctx.font = "bold 11px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`${load.Fy} kN`, x, beamY - arrowLength - 15);
        });

        // ===== Draw Deformed Shape =====
        if (showDeformed && deformed && deformed.length > 0) {
            // Find max displacement for scaling
            const maxDisp = Math.max(...deformed.map(d => Math.abs(d.uy)));
            const dispScale = maxDisp > 0 ? 30 / maxDisp : 1;

            ctx.strokeStyle = "rgba(245, 158, 11, 0.8)";
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();

            deformed.forEach((point, i) => {
                const x = toCanvasX(point.x);
                // uy ya viene en metros, dispScale normaliza a ~30px máximo
                const y = beamY - point.uy * dispScale;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
            ctx.setLineDash([]);
        }

        // ===== Draw Beam =====
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(margin.left, beamY);
        ctx.lineTo(margin.left + beamWidth, beamY);
        ctx.stroke();

        // Beam gradient overlay
        const beamGradient = ctx.createLinearGradient(margin.left, beamY - 4, margin.left, beamY + 4);
        beamGradient.addColorStop(0, "rgba(148, 163, 184, 0.5)");
        beamGradient.addColorStop(1, "rgba(71, 85, 105, 0.5)");
        ctx.strokeStyle = beamGradient;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(margin.left, beamY);
        ctx.lineTo(margin.left + beamWidth, beamY);
        ctx.stroke();

        // ===== Draw Supports =====
        drawSupport(ctx, margin.left, beamY, supportLeft);
        drawSupport(ctx, margin.left + beamWidth, beamY, supportRight);

        // ===== Draw Dimension =====
        const dimY = beamY + 35;
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 1;

        // Dimension line
        ctx.beginPath();
        ctx.moveTo(margin.left, dimY);
        ctx.lineTo(margin.left + beamWidth, dimY);
        ctx.stroke();

        // End ticks
        ctx.beginPath();
        ctx.moveTo(margin.left, dimY - 5);
        ctx.lineTo(margin.left, dimY + 5);
        ctx.moveTo(margin.left + beamWidth, dimY - 5);
        ctx.lineTo(margin.left + beamWidth, dimY + 5);
        ctx.stroke();

        // Dimension text
        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`L = ${length} m`, width / 2, dimY + 18);

        // Position markers
        for (let i = 0; i <= length; i++) {
            const x = toCanvasX(i);
            ctx.fillStyle = "#64748b";
            ctx.font = "10px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`${i}`, x, dimY + 32);
        }

    }, [length, supportLeft, supportRight, pointLoads, distributedLoads, deformed, showDeformed]);

    return (
        <div className="relative">
            <canvas
                ref={canvasRef}
                className="w-full h-[200px] rounded-lg"
                style={{ background: "rgba(15, 23, 42, 0.5)" }}
            />
            {deformed && (
                <div className="absolute top-2 right-2 flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1">
                        <span className="w-4 h-0.5 bg-white rounded" />
                        Original
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-4 h-0.5 bg-orange-400 rounded" style={{ borderStyle: "dashed" }} />
                        Deformada
                    </span>
                </div>
            )}
        </div>
    );
}

function drawSupport(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    type: SupportType
) {
    const size = 15;

    ctx.fillStyle = "#10b981";
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;

    switch (type) {
        case "fixed":
            // Fixed support - hatched rectangle
            ctx.fillRect(x - 4, y, 8, size + 5);

            // Hatching
            ctx.strokeStyle = "#0f172a";
            ctx.lineWidth = 1;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(x - 4 + i * 3, y);
                ctx.lineTo(x - 4 + i * 3 - 5, y + size + 5);
                ctx.stroke();
            }
            break;

        case "pinned":
            // Pinned support - triangle
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - size, y + size);
            ctx.lineTo(x + size, y + size);
            ctx.closePath();
            ctx.fill();

            // Circle at top
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#0f172a";
            ctx.fill();
            ctx.strokeStyle = "#10b981";
            ctx.stroke();
            break;

        case "roller":
            // Roller support - triangle with circle
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - size + 3, y + size - 5);
            ctx.lineTo(x + size - 3, y + size - 5);
            ctx.closePath();
            ctx.fill();

            // Roller circle
            ctx.beginPath();
            ctx.arc(x, y + size + 2, 6, 0, Math.PI * 2);
            ctx.fillStyle = "#10b981";
            ctx.fill();

            // Base line
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - size, y + size + 10);
            ctx.lineTo(x + size, y + size + 10);
            ctx.stroke();
            break;

        case "free":
            // No support drawn
            break;
    }
}
