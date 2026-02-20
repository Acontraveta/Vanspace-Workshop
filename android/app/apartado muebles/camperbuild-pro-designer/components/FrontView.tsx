
import React, { useRef, useState, useMemo } from 'react';
import { InteractivePiece } from '../types';
import { SNAP_DISTANCE } from '../constants';

interface FrontViewProps {
  pieces: InteractivePiece[];
  onUpdatePieces: (pieces: InteractivePiece[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

type ViewType = 'frontal' | 'lateral' | 'planta';
type DragMode = 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br';

export const FrontView: React.FC<FrontViewProps> = ({ 
  pieces, 
  onUpdatePieces, 
  selectedId, 
  onSelect 
}) => {
  const [view, setView] = useState<ViewType>('frontal');
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const dragRef = useRef<{ id: string; initial: InteractivePiece; mx: number; my: number } | null>(null);

  // Mapeo de dimensiones a coordenadas 2D según la vista actual
  const get2DCoords = (p: InteractivePiece) => {
    switch (view) {
      case 'frontal': return { x: p.x, y: p.y, w: p.w, h: p.h, labelX: 'X', labelY: 'Y' };
      case 'lateral': return { x: p.z, y: p.y, w: p.d, h: p.h, labelX: 'Z', labelY: 'Y' };
      case 'planta':  return { x: p.x, y: p.z, w: p.w, h: p.d, labelX: 'X', labelY: 'Z' };
    }
  };

  const workspace = useMemo(() => {
    const all = pieces.map(get2DCoords);
    const maxW = Math.max(...all.map(p => p.x + p.w), 800);
    const maxH = Math.max(...all.map(p => p.y + p.h), 800);
    return { w: maxW + 100, h: maxH + 100 };
  }, [pieces, view]);

  const scale = Math.min(500 / workspace.w, 500 / workspace.h);

  const applySnapping = (val: number, targets: number[]) => {
    for (const target of targets) {
      if (Math.abs(val - target) < SNAP_DISTANCE) return target;
    }
    return val;
  };

  const handleMouseDown = (e: React.MouseEvent, id: string, mode: DragMode) => {
    e.stopPropagation();
    const p = pieces.find(x => x.id === id);
    if (!p) return;
    dragRef.current = { id, initial: { ...p }, mx: e.clientX, my: e.clientY };
    setDragMode(mode);
    onSelect(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current || !dragMode) return;
    
    const dx = (e.clientX - dragRef.current.mx) / scale;
    const dy = (e.clientY - dragRef.current.my) / scale;

    const others = pieces.filter(p => p.id !== dragRef.current?.id).map(get2DCoords);
    const snapX = others.flatMap(o => [o.x, o.x + o.w]);
    const snapY = others.flatMap(o => [o.y, o.y + o.h]);

    onUpdatePieces(pieces.map(p => {
      if (p.id !== dragRef.current?.id) return p;
      const init = dragRef.current!.initial;
      let { x, y, z, w, h, d } = init;

      // Invertimos el signo de dy porque en SVG el eje Y crece hacia abajo
      const realDy = -dy; 

      if (view === 'frontal') {
        if (dragMode === 'move') {
          x = applySnapping(init.x + dx, snapX);
          y = applySnapping(init.y + realDy, snapY);
        } else if (dragMode === 'resize-br') {
          w = Math.max(10, applySnapping(init.w + dx, snapX.map(sx => sx - x)));
          h = Math.max(10, applySnapping(init.h + realDy, snapY.map(sy => sy - y)));
        } else if (dragMode === 'resize-tl') {
          const newX = applySnapping(init.x + dx, snapX);
          const newY = applySnapping(init.y + realDy, snapY);
          w = Math.max(10, init.w + (init.x - newX));
          h = Math.max(10, init.h + (init.y - newY));
          x = newX; y = newY;
        }
      } else if (view === 'lateral') {
        if (dragMode === 'move') {
          z = applySnapping(init.z + dx, snapX);
          y = applySnapping(init.y + realDy, snapY);
        } else if (dragMode === 'resize-br') {
          d = Math.max(10, applySnapping(init.d + dx, snapX.map(sx => sx - z)));
          h = Math.max(10, applySnapping(init.h + realDy, snapY.map(sy => sy - y)));
        }
      } else { // Planta
        if (dragMode === 'move') {
          x = applySnapping(init.x + dx, snapX);
          z = applySnapping(init.z + realDy, snapY);
        } else if (dragMode === 'resize-br') {
          w = Math.max(10, applySnapping(init.w + dx, snapX.map(sx => sx - x)));
          d = Math.max(10, applySnapping(init.d + realDy, snapY.map(sz => sz - z)));
        }
      }

      return { ...p, x, y, z, w, h, d };
    }));
  };

  const handleMouseUp = () => {
    setDragMode(null);
    dragRef.current = null;
  };

  return (
    <div className="flex flex-col items-center p-6 bg-slate-950 rounded-[40px] shadow-2xl border border-slate-800 min-h-[600px] relative overflow-hidden select-none">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px]" />
      
      {/* Selector de Vistas */}
      <div className="absolute top-6 left-8 flex items-center gap-2 z-10 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-700 backdrop-blur-md">
        {(['frontal', 'lateral', 'planta'] as ViewType[]).map(v => (
          <button
            key={v}
            onClick={() => { setView(v); onSelect(null); }}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === v ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            {v === 'frontal' ? 'Alzado' : v === 'lateral' ? 'Perfil' : 'Planta'}
          </button>
        ))}
      </div>

      <svg 
        width="100%" 
        height="500" 
        viewBox={`-50 ${-workspace.h * scale + 50} ${workspace.w * scale + 100} ${workspace.h * scale + 100}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => onSelect(null)}
        className="mt-12 cursor-crosshair"
      >
        {/* Rejilla de fondo */}
        <defs>
          <pattern id="grid" width={50 * scale} height={50 * scale} patternUnits="userSpaceOnUse">
            <path d={`M ${50 * scale} 0 L 0 0 0 ${50 * scale}`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="-100" y={-workspace.h * scale - 100} width={workspace.w * scale + 200} height={workspace.h * scale + 200} fill="url(#grid)" />

        {/* Ejes */}
        <line x1="0" y1="0" x2={workspace.w * scale} y2="0" stroke="#334155" strokeWidth="2" />
        <line x1="0" y1="0" x2="0" y2={-workspace.h * scale} stroke="#334155" strokeWidth="2" />

        {pieces.map(p => {
          const isSelected = selectedId === p.id;
          const coords = get2DCoords(p);
          const px = coords.x * scale;
          const py = -coords.y * scale - (coords.h * scale); // Invertir Y para SVG
          const pw = coords.w * scale;
          const ph = coords.h * scale;

          return (
            <g key={p.id} onClick={(e) => { e.stopPropagation(); onSelect(p.id); }}>
              <rect
                x={px} y={py} width={pw} height={ph}
                fill={isSelected ? "rgba(59, 130, 246, 0.3)" : p.type === 'estructura' ? "rgba(255,255,255,0.05)" : "rgba(59, 130, 246, 0.1)"}
                stroke={isSelected ? "#3b82f6" : p.type === 'estructura' ? "#475569" : "#3b82f6"}
                strokeWidth={isSelected ? 3 : 1}
                onMouseDown={(e) => handleMouseDown(e, p.id, 'move')}
                className="cursor-move transition-all"
              />
              {isSelected && (
                <g>
                  {/* Tiradores */}
                  <circle cx={px} cy={py} r={6} fill="white" stroke="#3b82f6" className="cursor-nwse-resize" onMouseDown={(e) => handleMouseDown(e, p.id, 'resize-tl')} />
                  <circle cx={px + pw} cy={py + ph} r={6} fill="white" stroke="#3b82f6" className="cursor-nwse-resize" onMouseDown={(e) => handleMouseDown(e, p.id, 'resize-br')} />
                  
                  {/* Dimensiones flotantes */}
                  <text x={px + pw/2} y={py + ph/2} textAnchor="middle" dominantBaseline="middle" className="fill-blue-400 text-[10px] font-black font-mono pointer-events-none">
                    {Math.round(coords.w)} x {Math.round(coords.h)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-8 flex gap-6 px-6 py-3 bg-slate-900/50 rounded-full border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Magnetismo Activo (5mm)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Arrastra piezas o esquinas</span>
        </div>
      </div>
    </div>
  );
};
