
import React from 'react';
import { Piece } from '../types';

interface StickersViewProps {
  pieces: Piece[];
  moduleName: string;
}

export const StickersView: React.FC<StickersViewProps> = ({ pieces, moduleName }) => {
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm no-print-shadow">
      <div className="flex justify-between items-center mb-8 no-print">
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Pegatinas de Identificación</h3>
          <p className="text-xs text-slate-500">Formato estándar 70x42.4mm para taller</p>
        </div>
        <button 
          onClick={() => window.print()}
          className="bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all"
        >
          Imprimir Etiquetas
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 print-grid">
        {pieces.map((p, i) => (
          <div 
            key={i} 
            className="border-2 border-slate-900 p-3 flex flex-col justify-between h-[42.4mm] bg-white overflow-hidden"
          >
            <div>
              <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{moduleName}</div>
              <div className="text-sm font-black text-slate-900 leading-tight uppercase border-b-2 border-slate-100 pb-1">{p.ref}</div>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[7px] font-black text-slate-400 uppercase block">Medidas</span>
                <div className="text-xl font-black text-blue-600 font-mono">
                  {p.w} <span className="text-[10px] text-slate-300">x</span> {p.h}
                </div>
              </div>
              <div className="text-[8px] font-bold text-slate-300"># {i + 1}</div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .print-grid { 
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 2mm !important;
          }
          .rounded-2xl { border-radius: 0 !important; border: none !important; }
        }
      `}</style>
    </div>
  );
};
