
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ModuleDimensions, FrontPanel, InteractivePiece, Piece } from './types';
import { FrontView } from './components/FrontView';
import { ThreeDView } from './components/ThreeDView';
import { OptimizerView } from './components/OptimizerView';
import { StickersView } from './components/StickersView';
import { optimizeCutList } from './utils/geometry';
import { DEFAULT_THICKNESS, MATERIALS } from './constants';

const App: React.FC = () => {
  const [module, setModule] = useState<ModuleDimensions>({
    name: "Módulo Camper Pro",
    type: "armario",
    width: 800,
    height: 700,
    depth: 450,
    thickness: DEFAULT_THICKNESS,
    materialPrice: MATERIALS[0].price
  });

  const [pieces, setPieces] = useState<InteractivePiece[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'diseno' | 'optimizado' | 'pegatinas'>('diseno');

  const resetModule = useCallback(() => {
    const { width: w, height: h, depth: d, thickness: t } = module;
    const now = Date.now();

    const initial: InteractivePiece[] = [
      { id: 'shell-left', name: 'Lateral Izq', type: 'estructura', x: 0, y: 0, z: 0, w: t, h: h, d: d },
      { id: 'shell-right', name: 'Lateral Der', type: 'estructura', x: w - t, y: 0, z: 0, w: t, h: h, d: d },
      { id: 'shell-top', name: 'Tapa Sup', type: 'estructura', x: t, y: h - t, z: 0, w: w - t * 2, h: t, d: d },
      { id: 'shell-bottom', name: 'Base Inf', type: 'estructura', x: t, y: 0, z: 0, w: w - t * 2, h: t, d: d },
      { id: 'shell-back', name: 'Trasera', type: 'trasera', x: t, y: t, z: -4, w: w - t * 2, h: h - t * 2, d: 4 },
      { id: `f-${now}-1`, name: 'Puerta Principal', type: 'frontal', x: t, y: t, z: d, w: w - t * 2, h: h - t * 2, d: 16 }
    ];

    setPieces(initial);
  }, [module.width, module.height, module.depth, module.thickness]);

  useEffect(() => { resetModule(); }, []);

  const updatePiece = (id: string, updates: Partial<InteractivePiece>) => {
    setPieces(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const addPiece = (type: 'frontal' | 'estructura') => {
    const id = `${type}-${Date.now()}`;
    const newPiece: InteractivePiece = {
      id,
      name: type === 'frontal' ? 'Nuevo Panel' : 'Nuevo Tablero',
      type,
      x: 100, y: 100, z: type === 'frontal' ? module.depth : 0,
      w: 200, h: 200, d: type === 'frontal' ? 16 : module.thickness
    };
    setPieces([...pieces, newPiece]);
    setSelectedId(id);
  };

  const deletePiece = () => {
    if (!selectedId) return;
    setPieces(prev => prev.filter(p => p.id !== selectedId));
    setSelectedId(null);
  };

  const selectedPiece = useMemo(() => pieces.find(p => p.id === selectedId), [selectedId, pieces]);

  const allPiecesForCutlist = useMemo(() => {
    return pieces.map(p => ({
      ref: p.name,
      w: p.type === 'estructura' && p.w < p.d ? p.d : p.w, // Simplificación para listado
      h: p.h,
      type: p.type,
      id: p.id
    })) as Piece[];
  }, [pieces]);

  const optimized = useMemo(() => optimizeCutList(allPiecesForCutlist), [allPiecesForCutlist]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center no-print shadow-sm z-20">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 p-2 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <h1 className="text-lg font-black uppercase tracking-tighter">CamperBuild <span className="text-blue-600">PRO</span></h1>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          {['diseno', 'optimizado', 'pegatinas'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>
              {tab === 'diseno' ? 'Diseño' : tab === 'optimizado' ? 'Optimización' : 'Pegatinas'}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-8 max-w-[1600px] mx-auto w-full flex-grow space-y-8">
        {activeTab === 'diseno' && (
          <div className="grid lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-3 space-y-6">
              <section className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white space-y-6">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Herramientas</h3>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <button onClick={() => addPiece('frontal')} className="w-full py-3 bg-blue-600 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-900/40 hover:scale-105 transition-transform">+ Nuevo Frontal</button>
                  <button onClick={() => addPiece('estructura')} className="w-full py-3 bg-slate-800 rounded-xl text-[10px] font-black uppercase border border-slate-700 hover:bg-slate-700">+ Nuevo Tablero</button>
                </div>

                {selectedPiece && (
                  <div className="space-y-4 pt-4 border-t border-slate-800 animate-in fade-in slide-in-from-top-4">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Editando: {selectedPiece.name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['x', 'y', 'z', 'w', 'h', 'd'].map(k => (
                        <div key={k}>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">{k}</label>
                          <input type="number" className="w-full p-1.5 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-white" value={(selectedPiece as any)[k]} onChange={e => updatePiece(selectedPiece.id, { [k]: Number(e.target.value) })} />
                        </div>
                      ))}
                    </div>
                    <button onClick={deletePiece} className="w-full py-2 bg-red-500/10 border border-red-500/30 text-red-500 rounded text-[9px] font-black uppercase">Eliminar Pieza</button>
                  </div>
                )}

                {!selectedPiece && (
                  <button onClick={resetModule} className="w-full py-2 bg-slate-800/50 text-slate-400 text-[9px] font-black uppercase rounded-lg border border-slate-700">Reiniciar Todo</button>
                )}
              </section>
            </aside>

            <div className="lg:col-span-9 space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <FrontView 
                  pieces={pieces}
                  onUpdatePieces={setPieces}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
                <ThreeDView 
                  pieces={pieces}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
            </div>
          </div>
        )}
        {activeTab === 'optimizado' && <OptimizerView placements={optimized} />}
        {activeTab === 'pegatinas' && <StickersView pieces={allPiecesForCutlist} moduleName={module.name} />}
      </main>
    </div>
  );
};

export default App;
