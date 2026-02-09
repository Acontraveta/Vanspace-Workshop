
import React, { useState, useRef } from 'react';
import { ProjectType, Phase, User, TaskStatus, Task } from '../types';
import { generateId } from '../constants';
import { getTaskExpertGuidance } from '../services/geminiService';

const manualContent = [
  {
    id: "1",
    title: "1. Recepción y Protección",
    steps: [
      { name: "Recepción del vehículo", goal: "Registrar entrada y asegurar coincidencia con orden.", detail: "Aparcar, comprobar matrícula, verificar vacío, anotar entrada.", critical: "No iniciar sin identificación clara.", criteria: "Registrado y ubicado." },
      { name: "Protección de cabina", goal: "Evitar daños en zonas de conducción.", detail: "Cubrir asientos, volante y salpicadero con fundas protectoras.", critical: "Zonas de cuero requieren cuidado especial.", criteria: "Interior protegido." },
      { name: "Limpieza técnica", goal: "Superficies libres de grasa para adhesión.", detail: "Limpiar chapa con alcohol isopropílico en zonas de pegado.", critical: "No usar productos con siliconas.", criteria: "Chapa desengrasada." }
    ]
  },
  {
    id: "2",
    title: "2. Estructura y Cortes",
    steps: [
      { name: "Marcado de ventanas", goal: "Definir precisión evitando vigas.", detail: "Verificar plano técnico, presentar plantillas, marcar contorno.", critical: "Comprobar simetría exterior antes de cortar.", criteria: "Contornos marcados." },
      { name: "Corte y Tratamiento", goal: "Hueco limpio sin corrosión futura.", detail: "Corte con caladora de baja vibración, limado y pintura de imprimación.", critical: "Eliminar virutas inmediatamente (corrosión).", criteria: "Corte imprimado." },
      { name: "Rastrelado de suelo", goal: "Base nivelada y aislada.", detail: "Fijar listones de madera de pino/pvc con polímero elástico.", critical: "Dejar canales para el cableado.", criteria: "Suelo firme y nivelado." }
    ]
  },
  {
    id: "3",
    title: "3. Aislamiento Térmico",
    steps: [
      { name: "Instalación Kaiflex", goal: "Eliminar puentes térmicos.", detail: "Pegar elastómero de 20mm en paredes y techo, 10mm en vigas.", critical: "No dejar huecos de aire contra la chapa.", criteria: "Cobertura >95%." },
      { name: "Barrera de vapor", goal: "Evitar condensación interna.", detail: "Sellar uniones con cinta de aluminio de alta adherencia.", critical: "Sellar pasos de cables.", criteria: "Sistema estanco." }
    ]
  },
  {
    id: "4",
    title: "4. Instalaciones Técnicas",
    steps: [
      { name: "Cableado Eléctrico", goal: "Distribución segura y normalizada.", detail: "Pasar cables por corrugado, etiquetar extremos, fijar a estructura.", critical: "Separar cables de 12V y 230V.", criteria: "Cableado canalizado." },
      { name: "Fontanería (Aguas)", goal: "Circuito de agua sin fugas.", detail: "Instalar depósitos, bomba de presión y tubería alimentaria.", critical: "Probar presión antes de panelar.", criteria: "Cero fugas detectadas." },
      { name: "Circuito de Gas", goal: "Seguridad máxima operativa.", detail: "Tubería de cobre rígida, racores de compresión, caja estanca.", critical: "Solo instaladores autorizados.", criteria: "Certificado de gas OK." }
    ]
  },
  {
    id: "5",
    title: "5. Panelado y Mobiliario",
    steps: [
      { name: "Colocación de paredes", goal: "Superficie de acabado final.", detail: "Fijar friso o contrachapado a los rastreles previamente instalados.", critical: "Evitar tornillos visibles en zonas nobles.", criteria: "Paredes ajustadas." },
      { name: "Montaje de Muebles", goal: "Mobiliario funcional y resistente.", detail: "Anclar estructuras a la furgoneta mediante remaches roscados.", critical: "No usar tornillos autorroscantes a chapa.", criteria: "Muebles sin ruidos." }
    ]
  },
  {
    id: "6",
    title: "6. Homologación y Entrega",
    steps: [
      { name: "Pesaje Final", goal: "Verificar distribución de masas.", detail: "Pesar el vehículo en báscula certificada por ejes.", critical: "No exceder la MMA del vehículo.", criteria: "Peso dentro de margen." },
      { name: "Reportaje de Ingeniería", goal: "Documentar para el laboratorio.", detail: "Fotos detalle de anclajes, etiquetas CE y distancias.", critical: "Fotos nítidas de zonas ocultas.", criteria: "Expediente enviado." },
      { name: "Explicación al cliente", goal: "Usuario formado y satisfecho.", detail: "Demo de uso de centralita, depósitos y mantenimiento.", critical: "Entregar manual de usuario.", criteria: "Checklist de entrega firmado." }
    ]
  }
];

interface ManualProps {
  templates: Record<ProjectType, Phase[]>;
  onUpdateTemplates: (newTemplates: Record<ProjectType, Phase[]>) => void;
  currentUser: User | null;
}

const Manual: React.FC<ManualProps> = ({ templates, onUpdateTemplates, currentUser }) => {
  if (!currentUser) return null;

  const [activeTab, setActiveTab] = useState<'procedimientos' | 'checklists' | 'editor' | 'asistente-ia'>('procedimientos');
  const [activePhase, setActivePhase] = useState(manualContent[0].id);
  const [editorType, setEditorType] = useState<ProjectType>('CAMPERIZACION');
  const [iaType, setIaType] = useState<ProjectType>('CAMPERIZACION');
  const [iaCustomPrompts, setIaCustomPrompts] = useState<Record<ProjectType, string>>({
    CAMPERIZACION: "Enfoque en máxima optimización de espacio y acabados de lujo.",
    ACCESORIOS: "Priorizar rapidez en la instalación y sellado ultra-duradero.",
    REFORMA: "Integración perfecta con el diseño original y uso de materiales ligeros.",
    REPARACION: "Soluciones de bajo coste pero con garantía de por vida en estanqueidad."
  });
  
  const [selectedTaskForAi, setSelectedTaskForAi] = useState<{task: Task, phaseName: string} | null>(null);
  const [aiGuidance, setAiGuidance] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const isAdmin = currentUser.role === 'ADMIN';
  const [localTemplates, setLocalTemplates] = useState<Record<ProjectType, Phase[]>>(templates);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateLocalTemplate = (type: ProjectType, phases: Phase[]) => {
    setLocalTemplates({ ...localTemplates, [type]: phases });
  };

  const saveTemplates = () => {
    onUpdateTemplates(localTemplates);
    alert('Plantillas actualizadas correctamente.');
  };

  const exportTemplates = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localTemplates, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "vanspace-templates-backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importTemplates = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          // Validación básica de estructura
          if (json && typeof json === 'object' && json.CAMPERIZACION) {
            setLocalTemplates(json);
            alert('Plantillas importadas correctamente al editor. No olvides "Guardar Maestros" para aplicar los cambios permanentemente.');
          } else {
            alert('El archivo no tiene un formato de plantilla VanSpace válido.');
          }
        } catch (error) {
          alert('Error al leer el archivo JSON.');
        }
      };
      reader.readAsText(file);
    }
  };

  const generateGuidance = async (task: Task, phaseName: string) => {
    setSelectedTaskForAi({ task, phaseName });
    setAiGuidance(null);
    setIsAiLoading(true);
    try {
      const guidance = await getTaskExpertGuidance(
        task.title,
        iaType,
        phaseName,
        iaCustomPrompts[iaType]
      );
      setAiGuidance(guidance);
    } catch (error) {
      console.error(error);
      setAiGuidance("Error al conectar con la IA de VanSpace.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const addPhase = (type: ProjectType) => {
    const newPhases = [...localTemplates[type]];
    newPhases.push({
      id: generateId(),
      name: 'Nueva Fase',
      order: newPhases.length + 1,
      tasks: []
    });
    handleUpdateLocalTemplate(type, newPhases);
  };

  const removePhase = (type: ProjectType, phaseId: string) => {
    const newPhases = localTemplates[type].filter(p => p.id !== phaseId);
    handleUpdateLocalTemplate(type, newPhases);
  };

  const updatePhaseName = (type: ProjectType, phaseId: string, name: string) => {
    const newPhases = localTemplates[type].map(p => p.id === phaseId ? { ...p, name } : p);
    handleUpdateLocalTemplate(type, newPhases);
  };

  const addTask = (type: ProjectType, phaseId: string) => {
    const newPhases = localTemplates[type].map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          tasks: [...p.tasks, { id: generateId(), title: 'Nueva Tarea', status: TaskStatus.PENDING }]
        };
      }
      return p;
    });
    handleUpdateLocalTemplate(type, newPhases);
  };

  const removeTask = (type: ProjectType, phaseId: string, taskId: string) => {
    const newPhases = localTemplates[type].map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          tasks: p.tasks.filter(t => t.id !== taskId)
        };
      }
      return p;
    });
    handleUpdateLocalTemplate(type, newPhases);
  };

  const updateTaskTitle = (type: ProjectType, phaseId: string, taskId: string, title: string) => {
    const newPhases = localTemplates[type].map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          tasks: p.tasks.map(t => t.id === taskId ? { ...t, title } : t)
        };
      }
      return p;
    });
    handleUpdateLocalTemplate(type, newPhases);
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-6xl mx-auto pb-24">
      <div className="flex bg-white p-1.5 rounded-[24px] border border-slate-200 shadow-sm w-fit mx-auto overflow-hidden">
        {[
          { id: 'procedimientos', label: 'Procedimientos' },
          { id: 'checklists', label: 'Checklists' },
          { id: 'asistente-ia', label: 'Flujos IA', adminOnly: true },
          { id: 'editor', label: 'Editor', adminOnly: true }
        ].filter(tab => !tab.adminOnly || isAdmin).map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-8 py-3 rounded-[18px] text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-[#00AEEF] text-white shadow-lg shadow-cyan-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'procedimientos' && (
        <>
          <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-1 text-center md:text-left">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Procedimientos Maestros</h2>
              <p className="text-slate-500 font-medium">Documentación técnica estandarizada VanSpace para todos los operarios.</p>
            </div>
            <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto max-w-full no-scrollbar">
              {manualContent.map(phase => (
                <button
                  key={phase.id}
                  onClick={() => setActivePhase(phase.id)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all uppercase tracking-tighter ${
                    activePhase === phase.id ? 'bg-[#020617] text-[#00AEEF] shadow-md shadow-slate-200' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Fase {phase.id}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {manualContent.find(p => p.id === activePhase)?.steps.map((step, idx) => (
              <div key={idx} className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden hover:border-[#00AEEF]/50 transition-colors group">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-4">
                    <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#020617] text-[#00AEEF] text-sm font-black group-hover:scale-110 transition-all">
                      {idx + 1}
                    </span>
                    {step.name}
                  </h3>
                </div>
                <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Objetivo Final</h4>
                    <p className="text-sm text-slate-800 font-bold leading-relaxed">{step.goal}</p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operativa Detallada</h4>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">{step.detail}</p>
                  </div>
                  <div className="space-y-3 bg-orange-50 p-6 rounded-3xl border border-orange-100">
                    <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1-1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      Control Crítico
                    </h4>
                    <p className="text-xs text-orange-900 font-black leading-relaxed italic">{step.critical}</p>
                  </div>
                  <div className="space-y-3 bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                    <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Criterio de Aceptación</h4>
                    <div className="flex items-center gap-2 text-sm text-emerald-900 font-black">
                       <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                       {step.criteria}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'asistente-ia' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-fadeIn">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#020617] text-white p-8 rounded-[40px] shadow-2xl space-y-6">
              <div className="flex items-center gap-3">
                 <div className="w-12 h-12 bg-[#00AEEF] rounded-2xl flex items-center justify-center text-white">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                 </div>
                 <h3 className="text-2xl font-black uppercase tracking-tighter">Asistente Pro</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Tipo de Especialidad</label>
                  <select 
                    value={iaType}
                    onChange={(e) => setIaType(e.target.value as ProjectType)}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:ring-2 focus:ring-[#00AEEF]"
                  >
                    <option value="CAMPERIZACION">CAMPERIZACIÓN</option>
                    <option value="ACCESORIOS">ACCESORIOS</option>
                    <option value="REFORMA">REFORMA</option>
                    <option value="REPARACION">REPARACIÓN</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Personalización de IA</label>
                  <textarea 
                    value={iaCustomPrompts[iaType]}
                    onChange={(e) => setIaCustomPrompts({...iaCustomPrompts, [iaType]: e.target.value})}
                    placeholder="Escribe directrices para que la IA se adapte a tu taller..."
                    className="w-full h-32 p-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-medium text-slate-300 outline-none focus:ring-2 focus:ring-[#00AEEF] resize-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
               <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Lista de Tareas Inteligentes</h4>
               <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {templates[iaType].map(phase => (
                    <div key={phase.id} className="space-y-2">
                      <p className="text-[9px] font-black text-[#00AEEF] uppercase tracking-widest">{phase.name}</p>
                      <div className="space-y-1">
                        {phase.tasks.map(task => (
                          <button
                            key={task.id}
                            onClick={() => generateGuidance(task, phase.name)}
                            className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all border ${selectedTaskForAi?.task.id === task.id ? 'bg-[#020617] border-[#020617] text-[#00AEEF] shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-[#00AEEF] hover:bg-white'}`}
                          >
                            {task.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-col gap-6">
            {selectedTaskForAi ? (
              <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
                <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#00AEEF]/10 text-[#00AEEF] rounded-2xl flex items-center justify-center">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase leading-none">{selectedTaskForAi.task.title}</h3>
                      <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{iaType} • {selectedTaskForAi.phaseName}</p>
                    </div>
                  </div>
                  {isAiLoading && <div className="animate-pulse bg-[#00AEEF] px-4 py-1.5 rounded-full text-[10px] font-black text-white uppercase">Procesando...</div>}
                </div>
                
                <div className="flex-1 p-10 overflow-y-auto">
                  {isAiLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-6">
                      <div className="w-20 h-20 border-4 border-slate-100 border-t-[#00AEEF] rounded-full animate-spin"></div>
                      <p className="text-sm font-black uppercase tracking-widest animate-pulse">Generando guía técnica avanzada...</p>
                    </div>
                  ) : aiGuidance ? (
                    <div className="prose prose-slate max-w-none prose-p:text-slate-600 prose-p:leading-relaxed prose-headings:text-slate-900 prose-headings:font-black prose-li:text-slate-600 prose-strong:text-[#00AEEF] animate-fadeIn">
                       <div className="bg-[#00AEEF]/5 p-6 rounded-3xl border border-[#00AEEF]/10 mb-8">
                         <h4 className="flex items-center gap-2 text-[#00AEEF] mb-4 uppercase text-sm font-black tracking-widest">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                           Visión Experta Gemini
                         </h4>
                         <div className="whitespace-pre-line text-sm md:text-base font-medium">
                           {aiGuidance}
                         </div>
                       </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300">
                       <svg className="w-24 h-24 mb-6 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       <p className="text-xl font-black uppercase opacity-50">Esperando Selección...</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[40px] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center min-h-[600px] text-center p-10">
                <div className="w-24 h-24 bg-[#00AEEF]/5 text-[#00AEEF] rounded-full flex items-center justify-center mb-8">
                   <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.641.32a2 2 0 01-1.86 0l-.641-.32a6 6 0 00-3.86-.517l-2.387.477a2 2 0 00-1.022.547l-1.318 1.319a2 2 0 00-.566 1.104l-1.49 10.162a1 1 0 00.99 1.145h22.138a1 1 0 00.99-1.145l-1.49-10.162a2 2 0 00-.566-1.104l-1.318-1.319z" /></svg>
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">Ingeniería Aumentada</h3>
                <p className="text-slate-400 max-w-sm font-medium">Selecciona una tarea de la lista lateral para iniciar el asistente inteligente de procesos.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'checklists' && (
        <div className="space-y-8">
          <div className="bg-[#020617] text-white p-10 rounded-[40px] shadow-xl flex flex-col md:flex-row justify-between items-center gap-8">
             <div className="space-y-2 text-center md:text-left">
                <h2 className="text-3xl font-black uppercase tracking-tighter">Plantillas Maestras</h2>
                <p className="text-slate-400 font-medium">Esquema estructural de procesos automáticos por tipología de proyecto.</p>
             </div>
             <div className="w-20 h-20 bg-[#00AEEF]/20 rounded-full flex items-center justify-center animate-glow">
                <svg className="w-10 h-10 text-[#00AEEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {(Object.keys(templates) as ProjectType[]).map((type) => (
              <div key={type} className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm hover:border-[#00AEEF] transition-all group">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter group-hover:text-[#00AEEF] transition-colors">{type}</h3>
                  <span className="text-[10px] font-black text-[#00AEEF] bg-cyan-50 px-4 py-1.5 rounded-full uppercase tracking-widest border border-cyan-100">
                    {templates[type].length} Fases
                  </span>
                </div>
                <div className="space-y-8">
                  {templates[type].map((phase) => (
                    <div key={phase.id} className="space-y-4">
                      <p className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-[#00AEEF] rounded-full"></span>
                        {phase.name}
                      </p>
                      <ul className="space-y-3 pl-4">
                        {phase.tasks.map((task) => (
                          <li key={task.id} className="flex items-center gap-4 text-sm text-slate-600 font-medium">
                            <div className="w-5 h-5 border-2 border-slate-200 rounded-lg flex-shrink-0 group-hover:border-[#00AEEF]/30 transition-all"></div>
                            {task.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'editor' && isAdmin && (
        <div className="space-y-8 animate-fadeIn">
          <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-1 text-center md:text-left">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase tracking-tighter leading-none">Arquitecto de Procesos</h2>
              <p className="text-slate-400 font-medium">Edita las fases que se cargan por defecto en cada proyecto.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
               <select 
                  value={editorType}
                  onChange={(e) => setEditorType(e.target.value as ProjectType)}
                  className="px-6 py-4 bg-slate-100 border-none rounded-2xl text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-[#00AEEF] appearance-none uppercase tracking-widest"
               >
                 <option value="CAMPERIZACION">CAMPERIZACIÓN</option>
                 <option value="ACCESORIOS">ACCESORIOS</option>
                 <option value="REFORMA">REFORMA</option>
                 <option value="REPARACION">REPARACIÓN</option>
               </select>

               <div className="flex gap-2">
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".json" 
                    onChange={importTemplates} 
                 />
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    title="Importar Configuración"
                    className="p-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black hover:bg-slate-50 transition-all flex items-center justify-center"
                 >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                 </button>
                 <button 
                    onClick={exportTemplates}
                    title="Exportar Configuración"
                    className="p-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black hover:bg-slate-50 transition-all flex items-center justify-center"
                 >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 </button>
               </div>

               <button 
                  onClick={saveTemplates}
                  className="px-8 py-4 bg-[#00AEEF] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-cyan-200 hover:scale-105 active:scale-95 transition-all"
               >
                 Guardar Maestros
               </button>
            </div>
          </div>

          <div className="space-y-6">
            {localTemplates[editorType].map((phase, pIdx) => (
              <div key={phase.id} className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden group/phase">
                <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-6 flex-1">
                    <span className="text-xs font-black text-white uppercase bg-[#020617] px-4 py-1.5 rounded-xl">Fase {pIdx + 1}</span>
                    <input 
                      type="text" 
                      value={phase.name}
                      onChange={(e) => updatePhaseName(editorType, phase.id, e.target.value)}
                      className="bg-transparent border-none outline-none font-black text-[#020617] text-xl w-full focus:bg-white px-4 py-2 rounded-2xl transition-all"
                    />
                  </div>
                  <button 
                    onClick={() => removePhase(editorType, phase.id)}
                    className="p-3 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover/phase:opacity-100"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <div className="p-8 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {phase.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 group/task">
                        <input 
                          type="text" 
                          value={task.title}
                          onChange={(e) => updateTaskTitle(editorType, phase.id, task.id, e.target.value)}
                          className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-700"
                        />
                        <button 
                          onClick={() => removeTask(editorType, phase.id, task.id)}
                          className="text-slate-300 hover:text-red-500 opacity-0 group-hover/task:opacity-100 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => addTask(editorType, phase.id)}
                      className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 hover:text-[#00AEEF] hover:border-[#00AEEF]/50 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      <span className="text-xs font-black uppercase tracking-widest">Añadir Tarea</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button 
              onClick={() => addPhase(editorType)}
              className="w-full py-8 border-4 border-dashed border-slate-100 rounded-[40px] text-slate-300 hover:text-[#00AEEF] hover:border-[#00AEEF]/30 hover:bg-cyan-50/20 transition-all flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </div>
              <span className="text-sm font-black uppercase tracking-[0.2em]">Incorporar Nueva Fase Maestra</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Manual;
