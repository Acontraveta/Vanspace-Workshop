
import React, { useState, useEffect } from 'react';
import { Project, User, TaskStatus, Task, ProjectType } from '../types';

interface OperationsControlProps {
  projects: Project[];
  users: User[];
  onAssignTask: (projectId: string, phaseId: string, taskId: string, technicianId: string) => void;
  onProjectSelect: (project: Project) => void;
}

const OperationsControl: React.FC<OperationsControlProps> = ({ projects, users, onAssignTask, onProjectSelect }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const technicians = users.filter(u => u.role !== 'ADMIN');

  const getActiveTaskForTech = (techId: string) => {
    for (const project of projects) {
      for (const phase of project.phases) {
        for (const task of phase.tasks) {
          if (task.technicianIds?.includes(techId) && 
             (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.ON_HOLD)) {
            return { project, phase, task };
          }
        }
      }
    }
    return null;
  };

  const formatDuration = (task: Task) => {
    let totalMs = task.totalDurationMs || 0;
    if (task.status === TaskStatus.IN_PROGRESS && task.startedAt) {
      totalMs += (now - new Date(task.startedAt).getTime());
    }
    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const unassignedTasks = projects.flatMap(p => 
    p.phases.flatMap(ph => 
      ph.tasks
        .filter(t => (!t.technicianIds || t.technicianIds.length === 0) && t.status !== TaskStatus.COMPLETED)
        .map(t => ({ project: p, phase: ph, task: t }))
    )
  ).slice(0, 5);

  // Obtener tareas recientemente completadas para el Feed
  const recentCompletions = projects.flatMap(p => 
    p.phases.flatMap(ph => 
      ph.tasks
        .filter(t => t.status === TaskStatus.COMPLETED && t.completedAt)
        .map(t => ({ project: p, phase: ph, task: t }))
    )
  ).sort((a, b) => new Date(b.task.completedAt!).getTime() - new Date(a.task.completedAt!).getTime())
  .slice(0, 8);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
      <div className="lg:col-span-8 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
            <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span>
            Monitor de Personal en Vivo
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {technicians.map(tech => {
            const active = getActiveTaskForTech(tech.id);
            return (
              <div key={tech.id} className={`p-6 rounded-[32px] border-2 transition-all ${active ? 'bg-white border-indigo-100 shadow-xl shadow-indigo-50' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <img src={tech.avatar} className="w-14 h-14 rounded-2xl object-cover ring-4 ring-white" alt={tech.name} />
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${active?.task.status === TaskStatus.IN_PROGRESS ? 'bg-amber-500 animate-pulse' : active?.task.status === TaskStatus.ON_HOLD ? 'bg-slate-400' : 'bg-emerald-500'}`}></div>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 leading-none">{tech.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">
                      {active ? (active.task.status === TaskStatus.IN_PROGRESS ? 'Trabajando' : 'En Pausa') : 'Disponible'}
                    </p>
                  </div>
                </div>

                {active ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-900 rounded-2xl text-white">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{active.project.plate}</span>
                        <span className="text-[10px] font-mono font-bold text-indigo-300">{formatDuration(active.task)}</span>
                      </div>
                      <p className="text-sm font-black truncate">{active.task.title}</p>
                    </div>
                    <button onClick={() => onProjectSelect(active.project)} className="w-full py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all">Ver Proyecto</button>
                  </div>
                ) : (
                  <div className="h-28 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-300 uppercase tracking-widest">Esperando Asignación</div>
                )}
              </div>
            );
          })}
        </div>

        {/* FEED DE ACTIVIDAD - NUEVO */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center gap-3">
             <svg className="w-5 h-5 text-[#00AEEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             Registro de Cierres Recientes
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {recentCompletions.length > 0 ? recentCompletions.map(({ project, task }, idx) => (
              <div key={idx} className="flex items-start gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100 animate-fadeIn">
                 <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0">
                   <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                 </div>
                 <div className="flex-1 overflow-hidden">
                   <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-black text-slate-900">{task.title}</p>
                      <span className="text-[9px] font-bold text-slate-400">{new Date(task.completedAt!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                   </div>
                   <p className="text-[9px] font-black text-[#00AEEF] uppercase tracking-widest mb-2">{project.plate} • {project.vehicleModel}</p>
                   {task.technicianNotes && (
                     <div className="bg-white p-3 rounded-xl border border-slate-100 text-[10px] font-medium text-slate-600 italic">
                       "{task.technicianNotes}"
                     </div>
                   )}
                 </div>
              </div>
            )) : (
              <p className="text-center py-10 text-[10px] font-black text-slate-300 uppercase tracking-widest">No hay cierres registrados hoy</p>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm h-full flex flex-col">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center gap-3">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Cola de Despacho
          </h3>
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {unassignedTasks.length > 0 ? unassignedTasks.map(({ project, phase, task }) => (
              <div key={task.id} className="p-5 bg-slate-50 border border-slate-100 rounded-3xl hover:border-indigo-500 transition-all">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{project.plate}</p>
                <p className="text-xs font-black text-slate-900 mb-4">{task.title}</p>
                <div className="flex flex-wrap gap-1">
                  {technicians.filter(t => !getActiveTaskForTech(t.id)).map(tech => (
                    <button key={tech.id} onClick={() => onAssignTask(project.id, phase.id, task.id, tech.id)} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-600 hover:bg-indigo-600 hover:text-white transition-all">+ {tech.name.split(' ')[0]}</button>
                  ))}
                </div>
              </div>
            )) : <p className="text-center py-20 text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin tareas pendientes</p>}
          </div>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default OperationsControl;
