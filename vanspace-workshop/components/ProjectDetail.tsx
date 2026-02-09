
import React, { useState, useRef } from 'react';
import { Project, Phase, TaskStatus, Task, User, ReformSheet, Attachment } from '../types';

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onToggleTask: (phaseId: string, taskId: string) => void;
  onCompleteTask: (phaseId: string, taskId: string, notes?: string) => void;
  onAssignTask: (phaseId: string, taskId: string, technicianId: string) => void;
  onAddTask: (phaseId: string, title: string) => void;
  onUpdateTask: (phaseId: string, taskId: string, data: Partial<Task>) => void;
  onDeleteTask: (phaseId: string, taskId: string) => void;
  onUpdateProject: (data: Partial<Project>) => void;
  currentUser: User;
  allUsers: User[];
}

const FURNITURE_OPTIONS = [
  { id: 'arm_bajo', label: 'Armario Bajo', cat: 'ARMARIOS' },
  { id: 'arm_altillo', label: 'Altillo', cat: 'ARMARIOS' },
  { id: 'arm_alto', label: 'Armario Alto', cat: 'ARMARIOS' },
  { id: 'fregadero', label: 'Fregadero', cat: 'ENCIMERA' },
  { id: 'cocina_fija', label: 'Cocina Fija', cat: 'ENCIMERA' },
  { id: 'wc', label: 'W.C.', cat: 'BAÑO' },
  { id: 'ducha', label: 'Ducha', cat: 'BAÑO' },
  { id: 'mesa_plegable', label: 'Mesa Plegable', cat: 'MESA' },
  { id: 'cama_baules', label: 'Cama sobre baúles', cat: 'CAMA' }
];

const ProjectDetail: React.FC<ProjectDetailProps> = ({ 
  project, onBack, onToggleTask, onCompleteTask, onUpdateTask, onUpdateProject, currentUser, allUsers 
}) => {
  const [activeTab, setActiveTab] = useState<'WORK' | 'REFORM_SHEET'>('WORK');
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set([project.phases[0]?.id]));
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTaskForUpload, setActiveTaskForUpload] = useState<{phaseId: string, taskId: string} | null>(null);

  const isAdmin = currentUser.role === 'ADMIN';

  const togglePhase = (id: string) => {
    const next = new Set(expandedPhases);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedPhases(next);
  };

  const toggleTaskDetails = (id: string) => {
    const next = new Set(expandedTasks);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedTasks(next);
  };

  const handleReformUpdate = (field: keyof ReformSheet, value: any) => {
    const currentSheet = project.reformSheet || { furniture: [], electrical12v: {}, electrical230v: {}, gas: {}, water: {}, measures: { height: '', taraIncrement: '' } };
    onUpdateProject({ reformSheet: { ...currentSheet, [field]: value } });
  };

  const toggleFurniture = (id: string) => {
    const furniture = project.reformSheet?.furniture || [];
    const next = furniture.includes(id) ? furniture.filter(f => f !== id) : [...furniture, id];
    handleReformUpdate('furniture', next);
  };

  const assignPhaseResponsible = (phaseId: string, techId: string) => {
    const updatedPhases = project.phases.map(ph => ph.id === phaseId ? { ...ph, responsibleTechId: techId } : ph);
    onUpdateProject({ phases: updatedPhases });
  };

  const handleFileAttach = (phaseId: string, task: Task) => {
    if ((task.attachments?.length || 0) >= 3) {
      alert("Límite máximo de 3 archivos alcanzado para esta tarea.");
      return;
    }
    setActiveTaskForUpload({ phaseId, taskId: task.id });
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeTaskForUpload) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newAttachment: Attachment = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          url: reader.result as string,
          type: file.type,
          size: file.size
        };

        const phase = project.phases.find(p => p.id === activeTaskForUpload.phaseId);
        const task = phase?.tasks.find(t => t.id === activeTaskForUpload.taskId);
        
        if (task) {
          const updatedAttachments = [...(task.attachments || []), newAttachment];
          onUpdateTask(activeTaskForUpload.phaseId, activeTaskForUpload.taskId, { attachments: updatedAttachments });
        }
        setActiveTaskForUpload(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = (phaseId: string, taskId: string, attachmentId: string) => {
    const phase = project.phases.find(p => p.id === phaseId);
    const task = phase?.tasks.find(t => t.id === taskId);
    if (task) {
      const updated = (task.attachments || []).filter(a => a.id !== attachmentId);
      onUpdateTask(phaseId, taskId, { attachments: updated });
    }
  };

  return (
    <div className="animate-fadeIn max-w-5xl mx-auto pb-24">
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,.pdf,.doc,.docx" 
        onChange={onFileChange} 
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{project.vehicleModel}</h2>
            <p className="text-[10px] font-black text-[#00AEEF] uppercase tracking-widest mt-1">{project.plate} • {project.projectType}</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
          <button onClick={() => setActiveTab('WORK')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'WORK' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>Seguimiento Taller</button>
          <button onClick={() => setActiveTab('REFORM_SHEET')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'REFORM_SHEET' ? 'bg-[#00AEEF] text-white shadow-md' : 'text-slate-400'}`}>Hoja de Reforma</button>
        </div>
      </div>

      {activeTab === 'WORK' ? (
        <div className="space-y-6">
          {project.phases.map(phase => {
            const isPhaseExpanded = expandedPhases.has(phase.id);
            const responsible = allUsers.find(u => u.id === phase.responsibleTechId);
            const progress = (phase.tasks.filter(t => t.status === TaskStatus.COMPLETED).length / phase.tasks.length) * 100;

            return (
              <div key={phase.id} className={`bg-white rounded-[32px] border transition-all overflow-hidden ${isPhaseExpanded ? 'border-[#00AEEF] shadow-xl' : 'border-slate-100'}`}>
                <div className="p-6 flex items-center justify-between group">
                  <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => togglePhase(phase.id)}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all ${progress === 100 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {progress === 100 ? '✓' : phase.order}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 uppercase tracking-tighter">{phase.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                         <div className="h-1 w-20 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#00AEEF]" style={{ width: `${progress}%` }}></div>
                         </div>
                         <span className="text-[9px] font-black text-slate-400 uppercase">{Math.round(progress)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsable</span>
                      <div className="flex items-center gap-2">
                         {isAdmin ? (
                           <select 
                             value={phase.responsibleTechId || ''} 
                             onChange={(e) => assignPhaseResponsible(phase.id, e.target.value)}
                             className="text-[10px] font-black bg-slate-50 border-none rounded-lg p-1 outline-none text-[#00AEEF] focus:ring-1 focus:ring-cyan-100"
                           >
                             <option value="">Sin asignar</option>
                             {allUsers.filter(u => u.role === 'TECHNICIAN').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                           </select>
                         ) : (
                           <span className="text-[10px] font-black text-slate-700 uppercase">{responsible?.name || 'Pendiente'}</span>
                         )}
                         {responsible && <img src={responsible.avatar} className="w-6 h-6 rounded-full border border-slate-200" alt="Res" />}
                      </div>
                    </div>
                    <button onClick={() => togglePhase(phase.id)} className={`text-slate-300 transition-transform ${isPhaseExpanded ? 'rotate-180' : ''}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                </div>

                {isPhaseExpanded && (
                  <div className="p-6 pt-0 space-y-3">
                    {phase.tasks.map(task => {
                      const isTaskExpanded = expandedTasks.has(task.id);
                      return (
                        <div key={task.id} className={`flex flex-col bg-slate-50/50 rounded-2xl border transition-all ${isTaskExpanded ? 'border-[#00AEEF]/30 bg-white' : 'border-slate-50'}`}>
                          <div className="flex items-center justify-between p-4 group">
                            <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => onToggleTask(phase.id, task.id)}>
                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${task.status === TaskStatus.COMPLETED ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200'}`}>
                                {task.status === TaskStatus.COMPLETED && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>}
                              </div>
                              <span className={`text-sm font-bold ${task.status === TaskStatus.COMPLETED ? 'text-slate-300 line-through font-medium' : 'text-slate-700'}`}>{task.title}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                               {task.attachments && task.attachments.length > 0 && (
                                 <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                                   <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                   {task.attachments.length}
                                 </span>
                               )}
                               <button 
                                 onClick={() => toggleTaskDetails(task.id)}
                                 className={`p-2 rounded-xl hover:bg-slate-100 transition-colors ${isTaskExpanded ? 'text-[#00AEEF] bg-cyan-50' : 'text-slate-300'}`}
                               >
                                 <svg className={`w-4 h-4 transition-transform ${isTaskExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                               </button>
                            </div>
                          </div>

                          {isTaskExpanded && (
                            <div className="px-14 pb-6 animate-fadeIn">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Documentación Adjunta</h4>
                                <button 
                                  onClick={() => handleFileAttach(phase.id, task)}
                                  className="flex items-center gap-2 text-[10px] font-black text-[#00AEEF] hover:text-cyan-600 transition-colors uppercase tracking-widest"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                  Adjuntar Archivo
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                {task.attachments && task.attachments.length > 0 ? (
                                  task.attachments.map(att => (
                                    <div key={att.id} className="group relative bg-white border border-slate-100 rounded-xl overflow-hidden aspect-video shadow-sm hover:border-[#00AEEF]/30 transition-all">
                                      {att.type.startsWith('image/') ? (
                                        <img src={att.url} className="w-full h-full object-cover" alt={att.name} />
                                      ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-2 text-center">
                                          <svg className="w-6 h-6 text-slate-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                          <span className="text-[8px] font-bold text-slate-500 truncate w-full px-2">{att.name}</span>
                                        </div>
                                      )}
                                      <button 
                                        onClick={() => removeAttachment(phase.id, task.id, att.id)}
                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                      <a 
                                        href={att.url} 
                                        download={att.name}
                                        className="absolute bottom-1 right-1 p-1 bg-white/80 backdrop-blur-sm text-[#00AEEF] rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                      </a>
                                    </div>
                                  ))
                                ) : (
                                  <div className="col-span-3 py-6 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-300">
                                    <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                    <span className="text-[9px] font-black uppercase tracking-widest">Sin archivos (Máx 3)</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-8">
           <div className="bg-[#020617] text-white p-10 rounded-[40px] shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">Hoja de Reforma Digital</h3>
                <p className="text-slate-400 font-medium">Digitalización oficial de componentes instalados para el laboratorio.</p>
              </div>
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-[#00AEEF] rounded-full blur-3xl opacity-20"></div>
           </div>

           {/* Checklist de Mobiliario */}
           <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
                <h4 className="text-lg font-black uppercase tracking-tighter">Inventario de Mobiliario (Pág. 2)</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                 {FURNITURE_OPTIONS.map(opt => (
                   <button 
                     key={opt.id} 
                     onClick={() => toggleFurniture(opt.id)}
                     className={`p-4 rounded-2xl border-2 text-left transition-all ${project.reformSheet?.furniture.includes(opt.id) ? 'bg-[#00AEEF] border-[#00AEEF] text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-300'}`}
                   >
                     <p className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-1">{opt.cat}</p>
                     <p className="text-xs font-black truncate">{opt.label}</p>
                   </button>
                 ))}
              </div>
           </div>

           {/* Datos Técnicos */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
                 <h4 className="text-sm font-black uppercase tracking-widest text-[#00AEEF] border-b border-slate-100 pb-4">Instalación Eléctrica 12V</h4>
                 <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Batería Auxiliar (Tipo)</label>
                       <input 
                         type="text" placeholder="Ej: AGM 150Ah" 
                         className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold"
                         onChange={(e) => handleReformUpdate('electrical12v', { ...project.reformSheet?.electrical12v, battery: e.target.value })}
                       />
                    </div>
                    <div className="flex flex-col gap-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Placa Solar (Marca/W)</label>
                       <input 
                         type="text" placeholder="Ej: Victron 175W" 
                         className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold"
                         onChange={(e) => handleReformUpdate('electrical12v', { ...project.reformSheet?.electrical12v, solar: e.target.value })}
                       />
                    </div>
                 </div>
              </div>

              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
                 <h4 className="text-sm font-black uppercase tracking-widest text-[#00AEEF] border-b border-slate-100 pb-4">Instalación de Agua</h4>
                 <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Depósito Limpias (Litros/Ubicación)</label>
                       <input 
                         type="text" placeholder="Ej: 90L Pasos de rueda" 
                         className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold"
                         onChange={(e) => handleReformUpdate('water', { ...project.reformSheet?.water, clean: e.target.value })}
                       />
                    </div>
                    <div className="flex flex-col gap-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bomba de Agua (Modelo)</label>
                       <input 
                         type="text" placeholder="Ej: Shurflo 10L" 
                         className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold"
                         onChange={(e) => handleReformUpdate('water', { ...project.reformSheet?.water, pump: e.target.value })}
                       />
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-slate-900 p-8 rounded-[40px] text-white flex flex-col md:flex-row gap-10 items-center">
              <div className="flex-1 space-y-6 w-full">
                 <h4 className="text-sm font-black uppercase tracking-widest border-b border-white/10 pb-4">Medidas Reales Tras Reforma (Pág. 5)</h4>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Altura Final (mm)</label>
                       <input 
                         type="number" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-1 focus:ring-[#00AEEF]"
                         onChange={(e) => handleReformUpdate('measures', { ...project.reformSheet?.measures, height: e.target.value })}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Incremento Tara (kg)</label>
                       <input 
                         type="number" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-1 focus:ring-[#00AEEF]"
                         onChange={(e) => handleReformUpdate('measures', { ...project.reformSheet?.measures, taraIncrement: e.target.value })}
                       />
                    </div>
                 </div>
              </div>
              <div className="w-full md:w-64 bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl text-center">
                 <svg className="w-10 h-10 text-emerald-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Verificación Técnica</p>
                 <p className="text-xs font-medium text-slate-300 mt-2">Al completar estos datos, la ingeniería podrá validar el proyecto.</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
