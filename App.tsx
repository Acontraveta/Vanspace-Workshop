
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProjectDetail from './components/ProjectDetail';
import UserManagement from './components/UserManagement';
import Manual from './components/Manual';
import CalendarView from './components/CalendarView';
import Login from './components/Login';
import { Project, ProjectStatus, TaskStatus, User, Attachment, Phase, ProjectType, Appointment, Task, HomologationDoc } from './types';
import { INITIAL_PROJECTS, INITIAL_USERS, DEFAULT_TEMPLATES } from './constants';
import { supabase, db } from './services/supabase';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [templates, setTemplates] = useState<Record<ProjectType, Phase[]>>(DEFAULT_TEMPLATES);
  const [currentView, setCurrentView] = useState<'dashboard' | 'projects' | 'calendar' | 'manual' | 'users'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const user = INITIAL_USERS.find(u => u.username === session.user.email?.split('@')[0]) || INITIAL_USERS[0];
        setCurrentUser(user);
      }
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const user = INITIAL_USERS.find(u => u.username === session.user.email?.split('@')[0]) || INITIAL_USERS[0];
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const refreshProjects = async () => {
    if (!db.isConfigured) return;
    try {
      const remoteData = await db.projects.getAll();
      if (remoteData) setProjects(remoteData);
    } catch (e) {
      console.error("Error refreshing data:", e);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    refreshProjects();

    const channel = supabase.channel('workshop-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, refreshProjects)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, refreshProjects)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'phases' }, refreshProjects)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const handleLogin = async (username: string, pass: string): Promise<boolean> => {
    const cleanUsername = username.toLowerCase().trim();
    if (db.isConfigured) {
      try {
        const email = `${cleanUsername}@vanspace.com`;
        await db.auth.signIn(email, pass);
        return true;
      } catch (error) {
        console.warn("Fallback local activo...");
      }
    }
    const foundUser = users.find(u => u.username === cleanUsername && u.password === pass);
    if (foundUser) {
      setCurrentUser(foundUser);
      return true;
    }
    return false;
  };

  const handleLogout = async () => {
    try { await db.auth.signOut(); } catch (e) {}
    setSelectedProject(null);
    setCurrentUser(null);
  };

  const handleAddProject = async (data: Partial<Project>) => {
    const type = data.projectType || 'CAMPERIZACION';
    const project: Project = {
      id: Math.random().toString(36).substr(2, 9),
      clientName: data.clientName || 'Nuevo Cliente',
      vehicleModel: data.vehicleModel || 'Vehículo Desconocido',
      plate: data.plate || 'S/M',
      status: ProjectStatus.IN_PROGRESS,
      projectType: type,
      startDate: new Date().toISOString(),
      progress: 0,
      phases: JSON.parse(JSON.stringify(templates[type])),
      homologationDocs: []
    };
    setProjects([project, ...projects]);
    if (db.isConfigured) await supabase.from('projects').insert([project]);
  };

  const handleUpdateProject = (projectId: string, data: Partial<Project>) => {
    setProjects(projects.map(p => p.id === projectId ? { ...p, ...data } : p));
    if (selectedProject?.id === projectId) setSelectedProject(prev => prev ? { ...prev, ...data } : null);
    db.projects.update(projectId, data).catch(() => {});
  };

  const calculateProgress = (phases: Phase[]): number => {
    const totalTasks = phases.reduce((acc, ph) => acc + ph.tasks.length, 0);
    const completedTasks = phases.reduce((acc, ph) => acc + ph.tasks.filter(t => t.status === TaskStatus.COMPLETED).length, 0);
    return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  };

  const handleAssignTask = (projectId: string, phaseId: string, taskId: string, techId: string) => {
    const updated = projects.map(p => {
      if (p.id === projectId) {
        const updatedPhases = p.phases.map(ph => {
          if (ph.id === phaseId) {
            const updatedTasks = ph.tasks.map(t => {
              if (t.id === taskId) {
                const currentTechs = t.technicianIds || [];
                const newTechs = currentTechs.includes(techId) ? currentTechs : [...currentTechs, techId];
                db.tasks.update(taskId, { technicianIds: newTechs }).catch(() => {});
                return { ...t, technicianIds: newTechs };
              }
              return t;
            });
            return { ...ph, tasks: updatedTasks };
          }
          return ph;
        });
        return { ...p, phases: updatedPhases };
      }
      return p;
    });
    setProjects(updated);
    if (selectedProject?.id === projectId) {
      setSelectedProject(updated.find(p => p.id === projectId) || null);
    }
  };

  const handleToggleTask = (phaseId: string, taskId: string) => {
    if (!selectedProject || !currentUser) return;
    const updatedProjects = projects.map(p => {
      if (p.id === selectedProject.id) {
        const updatedPhases = p.phases.map(ph => {
          if (ph.id === phaseId) {
            const updatedTasks = ph.tasks.map(t => {
              if (t.id === taskId) {
                const now = new Date();
                let nextStatus = t.status === TaskStatus.PENDING ? TaskStatus.IN_PROGRESS : 
                             t.status === TaskStatus.IN_PROGRESS ? TaskStatus.ON_HOLD : TaskStatus.IN_PROGRESS;
                const update = { 
                  status: nextStatus, 
                  startedAt: nextStatus === TaskStatus.IN_PROGRESS ? now.toISOString() : t.startedAt,
                  technicianIds: t.technicianIds?.includes(currentUser.id) ? t.technicianIds : [...(t.technicianIds || []), currentUser.id]
                };
                db.tasks.update(taskId, update).catch(() => {});
                return { ...t, ...update };
              }
              return t;
            });
            return { ...ph, tasks: updatedTasks };
          }
          return ph;
        });
        return { ...p, phases: updatedPhases, progress: calculateProgress(updatedPhases) };
      }
      return p;
    });
    setProjects(updatedProjects);
    setSelectedProject(updatedProjects.find(p => p.id === selectedProject.id) || null);
  };

  const renderContent = () => {
    if (!currentUser) return null;
    if (selectedProject) {
      return (
        <ProjectDetail 
          project={selectedProject} 
          onBack={() => setSelectedProject(null)} 
          onToggleTask={handleToggleTask}
          onCompleteTask={(phId, tId, notes) => {
             const update = { status: TaskStatus.COMPLETED, completedAt: new Date().toISOString(), technicianNotes: notes };
             db.tasks.update(tId, update).catch(() => {});
             const updated = projects.map(p => p.id === selectedProject.id ? { ...p, phases: p.phases.map(ph => ph.id === phId ? { ...ph, tasks: ph.tasks.map(t => t.id === tId ? { ...t, ...update } : t) } : ph), progress: calculateProgress(p.phases) } : p);
             setProjects(updated);
             setSelectedProject(updated.find(p => p.id === selectedProject.id) || null);
          }}
          onAssignTask={(phId, tId, techId) => handleAssignTask(selectedProject.id, phId, tId, techId)}
          onAddTask={(phId, title) => {
             const newTask: Task = { id: Math.random().toString(36).substr(2, 9), title, status: TaskStatus.PENDING };
             if (db.isConfigured) db.tasks.create({ ...newTask, phase_id: phId }).catch(() => {});
             const updated = projects.map(p => p.id === selectedProject.id ? { ...p, phases: p.phases.map(ph => ph.id === phId ? { ...ph, tasks: [...ph.tasks, newTask] } : ph) } : p);
             setProjects(updated);
             setSelectedProject(updated.find(p => p.id === selectedProject.id) || null);
          }}
          onUpdateTask={(phId, tId, data) => {
             db.tasks.update(tId, data).catch(() => {});
             const updated = projects.map(p => p.id === selectedProject.id ? { ...p, phases: p.phases.map(ph => ph.id === phId ? { ...ph, tasks: ph.tasks.map(t => t.id === tId ? { ...t, ...data } : t) } : ph) } : p);
             setProjects(updated);
             setSelectedProject(updated.find(p => p.id === selectedProject.id) || null);
          }}
          onDeleteTask={(phId, tId) => {
             db.tasks.delete(tId).catch(() => {});
             const updated = projects.map(p => p.id === selectedProject.id ? { ...p, phases: p.phases.map(ph => ph.id === phId ? { ...ph, tasks: ph.tasks.filter(t => t.id !== tId) } : ph) } : p);
             setProjects(updated);
             setSelectedProject(updated.find(p => p.id === selectedProject.id) || null);
          }}
          onUpdateProject={(data) => handleUpdateProject(selectedProject.id, data)}
          currentUser={currentUser}
          allUsers={users}
        />
      );
    }
    switch (currentView) {
      case 'dashboard': return <Dashboard projects={projects} users={users} onProjectSelect={setSelectedProject} onAssignTask={handleAssignTask} currentUser={currentUser} />;
      case 'projects': return <Dashboard projects={projects} users={users} onProjectSelect={setSelectedProject} onAddProject={handleAddProject} onUpdateProject={handleUpdateProject} onDeleteProject={(id) => setProjects(projects.filter(p => p.id !== id))} onAssignTask={handleAssignTask} currentUser={currentUser} view="projects" />;
      case 'calendar': return <CalendarView appointments={appointments} projects={projects} onAddAppointment={(a) => setAppointments([...appointments, a])} onDeleteAppointment={(id) => setAppointments(appointments.filter(a => a.id !== id))} />;
      case 'users': return <UserManagement users={users} onAddUser={(u) => setUsers([...users, u])} onDeleteUser={(id) => setUsers(users.filter(u => u.id !== id))} onUpdateRole={(id, r) => setUsers(users.map(u => u.id === id ? { ...u, role: r } : u))} />;
      case 'manual': return <Manual templates={templates} onUpdateTemplates={setTemplates} currentUser={currentUser} />;
      default: return <Dashboard projects={projects} users={users} onProjectSelect={setSelectedProject} onAssignTask={handleAssignTask} currentUser={currentUser} />;
    }
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><div className="w-16 h-16 border-4 border-[#00AEEF]/20 border-t-[#00AEEF] rounded-full animate-spin"></div></div>;
  if (!currentUser) return <Login onLogin={handleLogin} />;

  return (
    <div className="min-h-screen flex bg-[#f8fafc] text-slate-900">
      <Sidebar currentView={currentView} currentUser={currentUser} onLogout={handleLogout} onViewChange={(view) => { setCurrentView(view); setSelectedProject(null); }} />
      <main className="flex-1 md:ml-64 min-h-screen relative">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-8 py-5 flex justify-between items-center print:hidden">
           <div className="md:hidden flex items-center gap-2">
              <svg className="w-6 h-6 text-[#00AEEF]" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16h1a2 2 0 0 0 2-2V9a3 3 0 0 0-3-3h-1V5a1 1 0 0 0-1-1H4a3 3 0 0 0-3 3v8a2 2 0 0 0 2 2h1a2 2 0 0 0 4 0h6a2 2 0 0 0 4 0zM6 15a1 1 0 1 1-1-1 1 1 0 0 1 1 1zm10 0a1 1 0 1 1-1-1 1 1 0 0 1 1 1zM3 9h11v3H3V9z"/></svg>
              <h1 className="text-xl font-black">VanSpace</h1>
           </div>
           <div className="flex-1 flex justify-end items-center gap-4">
              {db.isConfigured && (
                <div className="hidden lg:flex items-center gap-2 mr-4">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizado</span>
                </div>
              )}
              <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                 <div className="hidden sm:flex flex-col items-end">
                    <span className="text-xs font-black">{currentUser.name}</span>
                    <span className="text-[9px] font-black text-[#00AEEF] uppercase tracking-tighter">
                      {currentUser.role === 'ADMIN' ? 'Administración' :
                       currentUser.role === 'DESIGN' ? 'Diseño' :
                       currentUser.role === 'MARKETING' ? 'Marketing' :
                       currentUser.role === 'ORDERS' ? 'Pedidos' :
                       currentUser.role === 'PRODUCTION' ? 'Producción' : 'Equipo'}
                    </span>
                 </div>
                 <img src={currentUser.avatar} className="w-8 h-8 rounded-full border border-slate-200" alt="Avatar" />
              </div>
           </div>
        </header>
        <div className="p-8 md:p-12 max-w-7xl mx-auto">{renderContent()}</div>
      </main>
    </div>
  );
};

export default App;
