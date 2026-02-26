// TaskStartModal.tsx
// Modal para iniciar tarea con checklist, stock, instrucciones, tabs

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { fmtHours } from '@/shared/utils/formatters'

export default function TaskStartModal({
  task,
  onConfirm,
  onCancel
}) {
  // --- PROPS ---

  // Estados para datos del catálogo/tarea
  const [catalogMaterials, setCatalogMaterials] = useState(task.materials || []);
  const [catalogConsumables, setCatalogConsumables] = useState(task.consumables || []);
  const [catalogInstructions, setCatalogInstructions] = useState(task.instructions_design || '');
  const [catalogTipoDiseno, setCatalogTipoDiseno] = useState(task.tipo_diseno || '');
  const [catalogRequiereDiseno, setCatalogRequiereDiseno] = useState(task.requiere_diseno || false);

  const [activeTab, setActiveTab] = useState('materiales');
  const [checked, setChecked] = useState({});
  const [stockLocations, setStockLocations] = useState({});
  const [loading, setLoading] = useState(false);
  const materials = catalogMaterials;
  const consumables = catalogConsumables;
  const hasDesign = catalogRequiereDiseno;
  const instructions = catalogInstructions;
  const allItems = [...materials, ...consumables];
  const tabs = [
    { id: 'materiales', label: 'Materiales', count: materials.length },
    { id: 'consumibles', label: 'Consumibles', count: consumables.length },
    { id: 'ubicacion', label: 'Ubicación', count: allItems.length },
    { id: 'instrucciones', label: 'Instrucciones', count: hasDesign ? 1 : 0 }
  ];
  const locationsFound = Object.keys(stockLocations).length;
  const allChecked = allItems.length > 0 && Object.values(checked).filter(Boolean).length === allItems.length;

  useEffect(() => {
    setChecked({});
    setActiveTab('materiales');
    setStockLocations({});
    setLoading(true);

    const fetchData = async () => {
      try {
        // Buscar el producto en catalog_products por nombre
        const { data: catalogProduct } = await supabase
          .from('catalog_products')
          .select('materiales, consumibles, instrucciones_diseno, tipo_diseno, requiere_diseno')
          .ilike('nombre', `%${task.product_name}%`)
          .single();

        console.log('📦 Catálogo encontrado:', catalogProduct);

        if (catalogProduct) {
          // Extraer materiales del catálogo
          const mats = (catalogProduct.materiales || []).map((m) => ({
            name: m.name || m.nombre,
            quantity: m.quantity || m.cantidad,
            unit: m.unit || m.unidad || 'ud'
          }));
          // Extraer consumibles del catálogo
          const cons = (catalogProduct.consumibles || []).map((c) => ({
            name: c.name || c.nombre,
            quantity: c.quantity || c.cantidad,
            unit: c.unit || c.unidad || 'ud'
          }));
          // Sobreescribir con datos del catálogo si la tarea no los tiene
          const finalMaterials = (task.materials && task.materials.length > 0) ? task.materials : mats;
          const finalConsumables = (task.consumables && task.consumables.length > 0) ? task.consumables : cons;
          setCatalogMaterials(finalMaterials);
          setCatalogConsumables(finalConsumables);
          setCatalogInstructions(catalogProduct.instrucciones_diseno || '');
          setCatalogTipoDiseno(catalogProduct.tipo_diseno || '');
          setCatalogRequiereDiseno(catalogProduct.requiere_diseno === true || catalogProduct.requiere_diseno === 'SÍ');

          // Buscar ubicaciones en stock para cada item
          const allItems = [...finalMaterials, ...finalConsumables];
          if (allItems.length > 0) {
            const searches = allItems.map(item =>
              supabase
                .from('stock_items')
                .select('articulo, referencia, ubicacion, cantidad, unidad')
                .ilike('articulo', `%${item.name}%`)
                .not('ubicacion', 'is', null)
                .limit(1)
            );
            const results = await Promise.all(searches);
            const locations = {};
            allItems.forEach((item, idx) => {
              const found = results[idx]?.data?.[0];
              if (found) locations[item.name] = found;
            });
            setStockLocations(locations);
          }
        }
      } catch (err) {
        console.error('Error cargando catálogo:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [task]);

  const toggleCheck = (key) => {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const parseUbicacion = (ubicacion) => {
    // Example: 'A-1-2' => { estanteria: 'A', nivel: '1', hueco: '2' }
    if (!ubicacion) return null;
    const parts = ubicacion.split('-');
    return {
      estanteria: parts[0], nivel: parts[1], hueco: parts[2]
    };
  };
  const minutesToHours = (min) => `${fmtHours(min / 60)}h`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* HEADER */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg mb-1">{task.task_name}</h2>
              {task.product_name && (
                <p className="text-sm text-gray-600">{task.product_name}</p>
              )}
            </div>
            <div className="flex-shrink-0 text-center px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <p className="text-2xl font-bold font-mono leading-none">{minutesToHours(task.estimated_hours * 60)}</p>
              <p className="text-xs opacity-70 mt-0.5">duración</p>
            </div>
          </div>
          {/* Pills de estado */}
          <div className="flex gap-2 mt-3 mb-4">
            {materials.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(251,191,36,0.25)', color: '#fcd34d' }}>🧱 {materials.length} material{materials.length > 1 ? 'es' : ''}</span>
            )}
            {consumables.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(52,211,153,0.25)', color: '#6ee7b7' }}>🔧 {consumables.length} consumible{consumables.length > 1 ? 's' : ''}</span>
            )}
            {hasDesign && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(167,139,250,0.25)', color: '#c4b5fd' }}>📐 Requiere diseño</span>
            )}
          </div>
          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-sm rounded-t-lg transition-all relative font-semibold ${activeTab === tab.id ? 'shadow-lg border-b-2 border-blue-600 font-bold' : 'hover:bg-blue-50 hover:text-blue-700'}`}
                style={{
                  background: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.1)',
                  color: activeTab === tab.id ? '#1e3a5f' : '#1e293b',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: activeTab === tab.id ? '#2563eb' : 'rgba(255,255,255,0.2)', color: 'white' }}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {/* TAB: MATERIALES */}
          {activeTab === 'materiales' && (
            <div className="space-y-3">
              {materials.length > 0 ? (
                <>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Recoge estos materiales antes de empezar</p>
                  {materials.map((mat, idx) => {
                    const loc = stockLocations[mat.name];
                    const key = mat.name;
                    return (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all" style={{ background: checked[key] ? '#f0fdf4' : 'white', borderColor: checked[key] ? '#86efac' : '#e5e7eb' }}>
                        <button onClick={() => toggleCheck(key)} className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all" style={{ background: checked[key] ? '#22c55e' : 'white', borderColor: checked[key] ? '#22c55e' : '#d1d5db' }}>
                          {checked[key] && <span className="text-white text-xs">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm ${checked[key] ? 'line-through text-gray-400' : 'text-gray-800'}`}>{mat.name}</p>
                          {loc && (<p className="text-xs text-blue-600 mt-0.5">📍 {loc.ubicacion}</p>)}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <span className="inline-block text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#dbeafe', color: '#1d4ed8' }}>{mat.quantity} {mat.unit}</span>
                          {loc && (<p className="text-xs text-gray-400 mt-1">Stock: {loc.cantidad} {loc.unidad}</p>)}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <Empty icon="🧱" text="Esta tarea no requiere materiales específicos" />
              )}
            </div>
          )}
          {/* TAB: CONSUMIBLES */}
          {activeTab === 'consumibles' && (
            <div className="space-y-3">
              {consumables.length > 0 ? (
                <>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Consumibles necesarios para la tarea</p>
                  {consumables.map((cons, idx) => {
                    const loc = stockLocations[cons.name];
                    const key = `cons_${cons.name}`;
                    return (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all" style={{ background: checked[key] ? '#f0fdf4' : 'white', borderColor: checked[key] ? '#86efac' : '#e5e7eb' }}>
                        <button onClick={() => toggleCheck(key)} className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all" style={{ background: checked[key] ? '#22c55e' : 'white', borderColor: checked[key] ? '#22c55e' : '#d1d5db' }}>
                          {checked[key] && <span className="text-white text-xs">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm ${checked[key] ? 'line-through text-gray-400' : 'text-gray-800'}`}>{cons.name}</p>
                          {loc && (<p className="text-xs text-green-600 mt-0.5">📍 {loc.ubicacion}</p>)}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <span className="inline-block text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#dcfce7', color: '#15803d' }}>{cons.quantity} {cons.unit}</span>
                          {loc && (<p className="text-xs text-gray-400 mt-1">Stock: {loc.cantidad} {loc.unidad}</p>)}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <Empty icon="🔧" text="Esta tarea no requiere consumibles" />
              )}
            </div>
          )}
          {/* TAB: UBICACIÓN */}
          {activeTab === 'ubicacion' && (
            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
              ) : locationsFound > 0 ? (
                <>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Dirígete a estas ubicaciones en el almacén</p>
                  {allItems.filter(item => stockLocations[item.name]).map((item, idx) => {
                    const loc = stockLocations[item.name];
                    const parsed = parseUbicacion(loc.ubicacion);
                    const isMaterial = materials.some(m => m.name === item.name);
                    return (
                      <div key={idx} className="rounded-2xl overflow-hidden border-2" style={{ borderColor: isMaterial ? '#bfdbfe' : '#bbf7d0' }}>
                        <div className="px-4 py-3 flex items-center justify-between" style={{ background: isMaterial ? '#eff6ff' : '#f0fdf4' }}>
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mr-2" style={{ background: isMaterial ? '#bfdbfe' : '#bbf7d0', color: isMaterial ? '#1d4ed8' : '#15803d' }}>{isMaterial ? 'Material' : 'Consumible'}</span>
                            <span className="font-semibold text-gray-800 text-sm">{item.name}</span>
                          </div>
                          <span className="text-sm font-bold text-gray-600">{item.quantity} {item.unit}</span>
                        </div>
                        <div className="px-4 py-4 bg-white">
                          {parsed ? (
                            <div className="flex items-center gap-3">
                              <div className="text-4xl select-none">🗄️</div>
                              <div className="flex gap-2 flex-1">
                                <LocationBlock label="Estantería" value={parsed.estanteria} color="#dbeafe" textColor="#1d4ed8" />
                                {parsed.nivel && (<LocationBlock label="Nivel" value={parsed.nivel} color="#ede9fe" textColor="#6d28d9" />)}
                                {parsed.hueco && (<LocationBlock label="Hueco" value={parsed.hueco} color="#fce7f3" textColor="#be185d" />)}
                              </div>
                            </div>
                          ) : (<p className="text-sm text-gray-500 font-mono">📍 {loc.ubicacion}</p>)}
                          <div className="mt-3 flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#e5e7eb' }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (loc.cantidad / (item.quantity * 2)) * 100)}%`, background: loc.cantidad >= item.quantity ? '#22c55e' : '#f59e0b' }} />
                            </div>
                            <span className="text-xs text-gray-500 flex-shrink-0">{loc.cantidad >= item.quantity ? `✅ Stock OK (${loc.cantidad} ${loc.unidad})` : `⚠️ Stock bajo (${loc.cantidad}/${item.quantity} ${loc.unidad})`}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <Empty icon="📍" text="No se encontraron ubicaciones registradas para los materiales de esta tarea" sub="Asigna ubicaciones en el módulo de almacén" />
              )}
            </div>
          )}
          {/* TAB: INSTRUCCIONES */}
          {activeTab === 'instrucciones' && (
            <div className="space-y-4">
              {hasDesign && instructions ? (
                  <>
                    {catalogTipoDiseno && (<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold mb-1" style={{ background: '#ede9fe', color: '#6d28d9' }}>📐 Tipo: {catalogTipoDiseno}</div>)}
                    <div className="rounded-2xl p-5 border-l-4" style={{ background: '#fffbeb', borderLeftColor: '#f59e0b' }}>
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-3">⚠️ Instrucciones de diseño / instalación</p>
                      <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{instructions}</p>
                    </div>
                    <div className="rounded-xl p-4 border" style={{ background: '#f5f3ff', borderColor: '#ddd6fe' }}>
                      <p className="text-xs text-purple-700 font-semibold mb-1">📐 Requiere diseño previo</p>
                      <p className="text-xs text-purple-600">Antes de comenzar esta tarea asegúrate de tener los planos o indicaciones de diseño aprobadas.</p>
                    </div>
                  </>
                ) : hasDesign ? (
                  <div className="rounded-2xl p-5 border-l-4" style={{ background: '#fffbeb', borderLeftColor: '#f59e0b' }}>
                    <p className="text-sm font-semibold text-amber-700">⚠️ Esta tarea requiere diseño previo</p>
                    <p className="text-xs text-amber-600 mt-1">No hay instrucciones específicas registradas en el catálogo.</p>
                  </div>
                ) : (
                  <Empty icon="📋" text="Esta tarea no requiere instrucciones especiales de diseño" />
                )}
            </div>
          )}
        </div>
        {/* FOOTER */}
        <div className="flex-shrink-0 px-6 py-4 flex gap-3 items-center border-t" style={{ background: 'white' }}>
          {allItems.length > 0 && (
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Items recogidos</span><span>{Object.values(checked).filter(Boolean).length}/{allItems.length}</span></div>
              <div className="w-full h-1.5 rounded-full" style={{ background: '#e5e7eb' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(Object.values(checked).filter(Boolean).length / allItems.length) * 100}%`, background: allChecked ? '#22c55e' : '#2563eb' }} />
              </div>
            </div>
          )}
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>Cancelar</button>
          <button onClick={onConfirm} className="px-6 py-2 rounded-xl text-sm font-bold text-white transition-all flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>▶ Iniciar Tarea</button>
        </div>
      </div>
    </div>
  );
}

function LocationBlock({ label, value, color, textColor }) {
  return (
    <div className="flex-1 text-center py-3 px-2 rounded-xl" style={{ background: color }}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-black" style={{ color: textColor }}>{value}</p>
    </div>
  );
}
function Empty({ icon, text, sub = '' }: { icon: string; text: string; sub?: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-3">{icon}</div>
      <p className="text-gray-500 font-medium text-sm">{text}</p>
      {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
    </div>
  );
}
