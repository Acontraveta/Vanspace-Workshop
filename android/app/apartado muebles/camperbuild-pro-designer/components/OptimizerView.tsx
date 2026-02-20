
import React from 'react';
import { PlacedPiece } from '../types';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants';

interface OptimizerViewProps {
  placements: PlacedPiece[];
}

export const OptimizerView: React.FC<OptimizerViewProps> = ({ placements }) => {
  const containerWidth = 800;
  const containerHeight = (BOARD_HEIGHT / BOARD_WIDTH) * containerWidth;
  const scale = containerWidth / BOARD_WIDTH;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <div className="mb-4 flex justify-between items-end">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Optimización de Corte</h3>
          <p className="text-sm text-slate-500">Tablero estándar: {BOARD_WIDTH} x {BOARD_HEIGHT} mm</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-400 uppercase">Piezas: {placements.length}</p>
        </div>
      </div>

      <div className="relative border-4 border-slate-300 rounded-lg bg-slate-50 overflow-hidden" style={{ width: containerWidth, height: containerHeight }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}>
          {placements.map((p, i) => (
            <g key={i}>
              <rect
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                fill="rgba(59, 130, 246, 0.1)"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              {p.w > 100 && p.h > 40 && (
                <text
                  x={p.x + p.w / 2}
                  y={p.y + p.h / 2}
                  fontSize="24"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-blue-700 font-medium"
                >
                  {p.ref}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {placements.map((p, i) => (
          <div key={i} className="text-xs p-2 bg-slate-50 border rounded flex justify-between">
            <span className="font-bold text-slate-600">{p.ref}</span>
            <span className="text-slate-500">{p.w} x {p.h} mm</span>
          </div>
        ))}
      </div>
    </div>
  );
};
