import { Piece } from '../types/furniture.types'

interface FurnitureStickersViewProps {
  pieces: Piece[]
  moduleName: string
  projectInfo?: string   // e.g. "PRJ-001 · Mario García"
}

export function FurnitureStickersView({ pieces, moduleName, projectInfo }: FurnitureStickersViewProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
      {/* Toolbar – hidden when printing */}
      <div className="flex justify-between items-center mb-6 no-print">
        <div>
          <h3 className="text-base font-black uppercase tracking-tight text-slate-900">
            Etiquetas de Identificación
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Formato 70×42.4 mm · {pieces.length} piezas</p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all"
        >
          🖨️ Imprimir etiquetas
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 print-grid">
        {pieces.map((p, i) => (
          <div
            key={i}
            className="border-2 border-slate-900 p-3 flex flex-col justify-between bg-white overflow-hidden"
            style={{ height: '42.4mm' }}
          >
            <div>
              <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">
                {projectInfo ?? moduleName}
              </div>
              <div className="text-xs font-black text-slate-900 leading-tight uppercase border-b border-slate-100 pb-0.5 mt-0.5">
                {p.ref}
              </div>
              <div className="text-[7px] text-slate-400 mt-0.5">{moduleName}</div>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[6px] font-black text-slate-400 uppercase block">Medidas</span>
                <div className="text-lg font-black text-blue-600 font-mono leading-none">
                  {p.w}<span className="text-[9px] text-slate-300 mx-0.5">×</span>{p.h}mm
                </div>
              </div>
              <div className="text-[8px] font-bold text-slate-300">#{i + 1}</div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .print-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 2mm !important; }
          .rounded-2xl { border-radius: 0 !important; border: none !important; }
        }
      `}</style>
    </div>
  )
}
