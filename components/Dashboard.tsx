
import React, { useState } from 'react';
import { Project, ProjectStatus, User, ProjectType } from '../types';
import OperationsControl from './OperationsControl';

interface DashboardProps {
  projects: Project[];
  users: User[];
  onProjectSelect: (project: Project) => void;
  onAddProject?: (project: Partial<Project>) => void;
  onUpdateProject?: (projectId: string, data: Partial<Project>) => void;
  onDeleteProject?: (projectId: string) => void;
  onAssignTask: (projectId: string, phaseId: string, taskId: string, technicianId: string) => void;
  currentUser: User | null;
  view?: 'dashboard' | 'projects';
}

const ProjectTypeLabels: Record<ProjectType, { label: string, color: string, bg: string, progressTitle: string }> = {
  CAMPERIZACION: { 
    label: 'Camperización', 
    color: 'text-[#00AEEF]', 
    bg: 'bg-cyan-50',
    progressTitle: 'Progreso de Camperización'
  },
  ACCESORIOS: { 
    label: 'Instalación Accesorios', 
    color: 'text-purple-600', 
    bg: 'bg-purple-50',
    progressTitle: 'Estado de Instalación'
  },
  REFORMA: { 
    label: 'Reforma', 
    color: 'text-orange-600', 
    bg: 'bg-orange-50',
    progressTitle: 'Avance de Reforma'
  },
  REPARACION: { 
    label: 'Reparación', 
    color: 'text-red-600', 
    bg: 'bg-red-50',
    progressTitle: 'Estado de Reparación'
  }
};

const Dashboard: React.FC<DashboardProps> = ({ 
  projects, 
  users,
  onProjectSelect, 
  onAddProject, 
  onUpdateProject, 
  onDeleteProject, 
  onAssignTask,
  currentUser, 
  view = 'dashboard' 
}) => {
  if (!currentUser) return null;

  const [searchTerm, setSearchTerm] = useState('');
  const [isAdminView, setIsAdminView] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  const [newProject, setNewProject] = useState<{ clientName: string, vehicleModel: string, plate: string, projectType: ProjectType }>({ 
    clientName: '', 
    vehicleModel: '', 
    plate: '',
    projectType: 'CAMPERIZACION'
  });
  
  const isAdmin = currentUser.role === 'ADMIN';
  const isOnlyProjects = view === 'projects';

  // Lógica de Filtrado por Rol mejorada
  const isProjectAssignedToTech = (project: Project) => {
    return project.phases.some(ph => 
      ph.responsibleTechId === currentUser.id || 
      ph.tasks.some(t => t.technicianIds?.includes(currentUser.id))
    );
  };

  const visibleProjects = isAdmin 
    ? projects 
    : projects.filter(isProjectAssignedToTech);

  const MAX_WORKSHOP_BAYS = 4;
  const activeCount = visibleProjects.filter(p => p.status === ProjectStatus.IN_PROGRESS).length;
  const workshopCapacityPercent = Math.min(Math.round((activeCount / MAX_WORKSHOP_BAYS) * 100), 100);
  const completedCount = visibleProjects.filter(p => p.status === ProjectStatus.COMPLETED).length;

  const filteredProjects = visibleProjects.filter(p => 
    p.vehicleModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.plate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAddProject) {
      onAddProject(newProject);
      setNewProject({ clientName: '', vehicleModel: '', plate: '', projectType: 'CAMPERIZACION' });
      setIsAddingProject(false);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProject && onUpdateProject) {
      onUpdateProject(editingProject.id, {
        clientName: editingProject.clientName,
        vehicleModel: editingProject.vehicleModel,
        plate: editingProject.plate,
        projectType: editingProject.projectType
      });
      setEditingProject(null);
    }
  };

  const renderProjectCard = (project: Project) => {
    const typeInfo = ProjectTypeLabels[project.projectType || 'CAMPERIZACION'];
    const myTasksCount = project.phases.reduce((acc, ph) => 
      acc + ph.tasks.filter(t => t.technicianIds?.includes(currentUser.id)).length, 0
    );
    const isResponsible = project.phases.some(ph => ph.responsibleTechId === currentUser.id);

    return (
      <div 
        key={project.id}
        onClick={() => onProjectSelect(project)}
        className="group relative bg-white rounded-[32px] border border-slate-100 hover:border-[#00AEEF] transition-all cursor-pointer shadow-sm hover:shadow-xl hover:shadow-cyan-100/30 overflow-hidden animate-fadeIn"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-slate-900 rounded-[20px] flex items-center justify-center text-white group-hover:bg-[#00AEEF] transition-all shadow-lg group-hover:-rotate-2">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <div>
                <h4 className="font-black text-lg text-slate-900 leading-tight group-hover:text-[#00AEEF] transition-colors">{project.vehicleModel}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-tighter">{project.plate}</span>
                  {!isAdmin && (
                    <div className="flex gap-1">
                      {isResponsible && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter bg-indigo-50 text-indigo-600">
                          Responsable
                        </span>
                      )}
                      {myTasksCount > 0 && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter bg-emerald-50 text-emerald-600">
                          {myTasksCount} Tareas
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {isAdmin && (
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); setEditingProject(project); }} className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{typeInfo.progressTitle}</p>
              <p className="text-sm font-black text-[#00AEEF]">{project.progress}%</p>
            </div>
            <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out ${project.status === ProjectStatus.COMPLETED ? 'bg-emerald-500' : 'bg-[#00AEEF]'}`} 
                style={{ width: `${project.progress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase px-1 pt-1">
              <span>Desde: {new Date(project.startDate).toLocaleDateString()}</span>
              <span className={`font-black ${project.status === ProjectStatus.COMPLETED ? 'text-emerald-500' : 'text-slate-400'}`}>
                {project.status === ProjectStatus.COMPLETED ? 'FINALIZADO' : (isAdmin ? project.clientName : 'ASIGNADO A TI')}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="w-8 h-1 bg-[#00AEEF] rounded-full"></span>
            <span className="text-[11px] font-black text-[#00AEEF] uppercase tracking-[0.3em]">
              {isAdmin ? 'Gestión de Producción' : 'Mi Plan de Trabajo'}
            </span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">
            {isAdmin && isAdminView ? 'Centro de Control' : (isAdmin ? 'Línea de Montaje' : 'Mis Vehículos')}
          </h2>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          {isAdmin && !isOnlyProjects && (
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
               <button onClick={() => setIsAdminView(false)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isAdminView ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Proyectos</button>
               <button onClick={() => setIsAdminView(true)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isAdminView ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>En Vivo</button>
            </div>
          )}
          
          <div className="relative flex-1 md:w-80">
            <input 
              type="text" 
              placeholder="Buscar vehículo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[20px] text-sm focus:outline-none focus:ring-2 focus:ring-[#00AEEF] transition-all shadow-sm font-medium"
            />
            <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          
          {isAdmin && isOnlyProjects && (
            <button onClick={() => setIsAddingProject(true)} className="bg-[#00AEEF] text-white p-4 rounded-[20px] hover:scale-105 transition-all shadow-xl shadow-cyan-200"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg></button>
          )}
        </div>
      </div>

      {isAdmin && isAdminView ? (
        <OperationsControl projects={projects} users={users} onAssignTask={onAssignTask} onProjectSelect={onProjectSelect} />
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: isAdmin ? 'Proyectos Activos' : 'Mis Proyectos', val: activeCount, color: 'text-[#00AEEF]', bg: 'bg-cyan-50', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
              { label: 'Entregas', val: completedCount, color: 'text-emerald-500', bg: 'bg-emerald-50', icon: 'M5 13l4 4L19 7' },
              { label: isAdmin ? 'Capacidad Taller' : 'Ocupación Personal', val: `${workshopCapacityPercent}%`, color: workshopCapacityPercent > 90 ? 'text-red-500' : 'text-orange-500', bg: workshopCapacityPercent > 90 ? 'bg-red-50' : 'bg-orange-50', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10' },
              { label: 'Eficiencia', val: '94%', color: 'text-indigo-500', bg: 'bg-indigo-50', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-[#00AEEF] transition-all">
                <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} /></svg></div>
                <div><h3 className="text-3xl font-black text-slate-900 tracking-tighter">{stat.val}</h3><p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p></div>
              </div>
            ))}
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-3">
               <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">
                 {isAdmin ? 'Vehículos en Gestión' : 'Mis Asignaciones Actuales'}
               </h3>
               <div className="h-px flex-1 bg-slate-100"></div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProjects.length > 0 ? filteredProjects.map(renderProjectCard) : (
                <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-[40px] text-slate-400 font-bold uppercase tracking-widest text-xs flex flex-col items-center gap-4">
                  <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  {isAdmin ? 'No se han encontrado vehículos' : 'No tienes vehículos asignados hoy'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isAddingProject && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-[40px] p-10 shadow-2xl animate-slideUp">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-[#00AEEF] text-white rounded-2xl flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Apertura de Orden</h3>
            </div>
            
            <form onSubmit={handleAddSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Cliente / Empresa</label>
                <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:ring-2 focus:ring-[#00AEEF] font-bold" placeholder="Nombre del cliente" value={newProject.clientName} onChange={e => setNewProject({...newProject, clientName: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Vehículo</label>
                  <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:ring-2 focus:ring-[#00AEEF] font-bold" placeholder="Ej: VW T6" value={newProject.vehicleModel} onChange={e => setNewProject({...newProject, vehicleModel: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Matrícula</label>
                  <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:ring-2 focus:ring-[#00AEEF] font-mono font-bold" placeholder="0000XXX" value={newProject.plate} onChange={e => setNewProject({...newProject, plate: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Plantilla Maestra</label>
                <div className="relative">
                  <select 
                    value={newProject.projectType}
                    onChange={(e) => setNewProject({...newProject, projectType: e.target.value as ProjectType})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:ring-2 focus:ring-[#00AEEF] font-black text-sm appearance-none uppercase tracking-widest text-[#00AEEF]"
                  >
                    {(Object.keys(ProjectTypeLabels) as ProjectType[]).map(type => (
                      <option key={type} value={type}>{ProjectTypeLabels[type].label}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#00AEEF]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsAddingProject(false)} className="flex-1 py-4 font-black text-xs uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-[#00AEEF] text-white font-black rounded-[20px] text-xs uppercase tracking-widest shadow-xl shadow-cyan-100 hover:bg-cyan-500 transition-all">Crear Proyecto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingProject && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-[40px] p-10 shadow-2xl animate-slideUp">
            <h3 className="text-2xl font-black text-slate-900 mb-8 uppercase tracking-tighter">Editar Expediente</h3>
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Cliente / Empresa</label>
                <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:ring-2 focus:ring-[#00AEEF] font-bold" placeholder="Cliente" value={editingProject.clientName} onChange={e => setEditingProject({...editingProject, clientName: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Vehículo</label>
                   <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:ring-2 focus:ring-[#00AEEF] font-bold" placeholder="Vehículo" value={editingProject.vehicleModel} onChange={e => setEditingProject({...editingProject, vehicleModel: e.target.value})} />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Matrícula</label>
                   <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:ring-2 focus:ring-[#00AEEF] font-mono font-bold" placeholder="Matrícula" value={editingProject.plate} onChange={e => setEditingProject({...editingProject, plate: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setEditingProject(null)} className="flex-1 py-4 font-black text-xs uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-[20px] text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
