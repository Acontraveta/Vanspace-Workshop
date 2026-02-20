
import React from 'react';
import { ModuleDimensions, FrontPanel } from '../types';

interface IsoViewProps {
  module: ModuleDimensions;
  fronts: FrontPanel[];
}

export const IsoView: React.FC<IsoViewProps> = ({ module, fronts }) => {
  // Configuración de escala y ángulos
  const scale = 0.25;
  const isoAngle = Math.PI / 6; // 30 grados
  const cos = Math.cos(isoAngle);
  const sin = Math.sin(isoAngle);

  const w = module.width * scale;
  const h = module.height * scale;
  const d = module.depth * scale;
  const t = module.thickness * scale;

  // Función para proyectar coordenadas 3D (X: ancho, Y: alto, Z: fondo) a 2D (x, y)
  // Origen (0,0) en la esquina inferior frontal izquierda
  const project = (X: number, Y: number, Z: number) => {
    return {
      x: (X - Z) * cos,
      y: (X + Z) * sin - Y
    };
  };

  const p = (X: number, Y: number, Z: number) => {
    const pt = project(X, Y, Z);
    return `${pt.x},${pt.y}`;
  };

  // ViewBox dinámico
  const vbWidth = (w + d) * cos + 60;
  const vbHeight = (w + d) * sin + h + 80;
  const centerX = d * cos + 30;
  const centerY = h + 40;

  return (
    <div className="bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-700 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden">
      <div className="absolute top-4 left-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Previsualización 3D Realista</div>
      
      <svg 
        width="100%" 
        height="100%" 
        viewBox={`${-centerX} ${-centerY} ${vbWidth} ${vbHeight}`}
        className="max-h-[400px] drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      >
        <defs>
          <linearGradient id="gradTop" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="gradSide" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="gradFront" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>

        {/* --- ESTRUCTURA (SHELL) --- */}
        
        {/* Cara Lateral Derecha (Exterior) */}
        <polygon 
          points={`${p(w, 0, 0)} ${p(w, h, 0)} ${p(w, h, d)} ${p(w, 0, d)}`} 
          fill="url(#gradSide)" 
        />
        
        {/* Cara Superior (Tapa) */}
        <polygon 
          points={`${p(0, h, 0)} ${p(w, h, 0)} ${p(w, h, d)} ${p(0, h, d)}`} 
          fill="url(#gradTop)" 
          stroke="#cbd5e1"
          strokeWidth="0.5"
        />

        {/* Borde frontal de la tapa (grosor) */}
        <polygon 
          points={`${p(0, h, 0)} ${p(w, h, 0)} ${p(w, h-t, 0)} ${p(0, h-t, 0)}`} 
          fill="#cbd5e1" 
          stroke="#94a3b8"
          strokeWidth="0.5"
        />

        {/* Lateral Izquierdo (Borde frontal visible) */}
        <polygon 
          points={`${p(0, 0, 0)} ${p(t, 0, 0)} ${p(t, h-t, 0)} ${p(0, h-t, 0)}`} 
          fill="#94a3b8" 
        />

        {/* Lateral Derecho (Borde frontal visible) */}
        <polygon 
          points={`${p(w-t, 0, 0)} ${p(w, 0, 0)} ${p(w, h-t, 0)} ${p(w-t, h-t, 0)}`} 
          fill="#94a3b8" 
        />

        {/* Base Inferior (Borde frontal visible) */}
        <polygon 
          points={`${p(t, 0, 0)} ${p(w-t, 0, 0)} ${p(w-t, t, 0)} ${p(t, t, 0)}`} 
          fill="#64748b" 
        />

        {/* --- PANELES FRONTALES (CON RELIEVE) --- */}
        {fronts.map(f => {
          const fx = f.x * scale;
          const fy = (module.height - f.y - f.h) * scale; // Invertir Y para SVG
          const fw = f.w * scale;
          const fh = f.h * scale;
          const depthEffect = 2; // Pequeño relieve de la puerta hacia afuera

          return (
            <g key={f.id}>
              {/* Cara lateral del panel (grosor del panel) */}
              <polygon 
                points={`${p(fx + fw, fy, -depthEffect)} ${p(fx + fw, fy + fh, -depthEffect)} ${p(fx + fw, fy + fh, 0)} ${p(fx + fw, fy, 0)}`} 
                fill="#1d4ed8" 
              />
              {/* Cara superior del panel (grosor del panel) */}
              <polygon 
                points={`${p(fx, fy + fh, -depthEffect)} ${p(fx + fw, fy + fh, -depthEffect)} ${p(fx + fw, fy + fh, 0)} ${p(fx, fy + fh, 0)}`} 
                fill="#60a5fa" 
              />
              {/* Cara Frontal del Panel */}
              <rect
                transform={`matrix(${cos}, ${sin}, 0, 1, ${(fx - (-depthEffect)) * cos}, ${(fx + (-depthEffect)) * sin - (fy + fh)})`}
                width={fw}
                height={fh}
                fill="#3b82f6"
                stroke="#2563eb"
                strokeWidth="0.5"
              />
              {/* Brillo en el panel */}
              <rect
                transform={`matrix(${cos}, ${sin}, 0, 1, ${(fx - (-depthEffect)) * cos}, ${(fx + (-depthEffect)) * sin - (fy + fh)})`}
                width={fw}
                height={2}
                fill="rgba(255,255,255,0.2)"
              />
            </g>
          );
        })}

        {/* Líneas de contorno generales para definición */}
        <path 
          d={`M ${p(0,0,0)} L ${p(w,0,0)} L ${p(w,h,0)} L ${p(0,h,0)} Z`} 
          fill="none" 
          stroke="rgba(255,255,255,0.1)" 
          strokeWidth="0.5" 
        />
      </svg>

      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-1">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Vista de Cámara</span>
        <span className="text-[11px] font-black text-blue-500">ISOMÉTRICA 30°</span>
      </div>
    </div>
  );
};
