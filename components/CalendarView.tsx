
import React, { useState } from 'react';
import { Appointment, Project, AppointmentType } from '../types';

interface CalendarViewProps {
  appointments: Appointment[];
  projects: Project[];
  onAddAppointment: (app: Appointment) => void;
  onDeleteAppointment: (id: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ appointments, projects, onAddAppointment, onDeleteAppointment }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(new Date().toISOString().split('T')[0]);
  const [isAdding, setIsAdding] = useState(false);

  // Appointment Form State
  const [newApp, setNewApp] = useState<Partial<Appointment>>({
    type: 'RECEPCION',
    time: '09:00',
    clientName: '',
    vehicleModel: ''
  });

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);
  
  // Adjusted for Monday start (Spain)
  const adjustedStartDay = (startDay === 0 ? 6 : startDay - 1);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getAppointmentsForDay = (dateStr: string) => {
    return appointments.filter(a => a.date === dateStr);
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDay(dateStr);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApp.clientName || !selectedDay) return;

    const app: Appointment = {
      id: Math.random().toString(36).substr(2, 9),
      clientName: newApp.clientName,
      vehicleModel: newApp.vehicleModel,
      date: selectedDay,
      time: newApp.time || '09:00',
      type: newApp.type as AppointmentType,
      projectId: newApp.projectId,
      notes: newApp.notes
    };

    onAddAppointment(app);
    setIsAdding(false);
    setNewApp({ type: 'RECEPCION', time: '09:00', clientName: '', vehicleModel: '' });
  };

  const typeColors: Record<AppointmentType, string> = {
    RECEPCION: 'bg-cyan-500',
    ENTREGA: 'bg-emerald-500',
    REVISION: 'bg-amber-500',
    OTROS: 'bg-slate-500'
  };

  const selectedDayAppointments = selectedDay ? getAppointmentsForDay(selectedDay) : [];

  return (
    <div className="animate-fadeIn space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none mb-1">Planificador Maestro</h2>
          <p className="text-slate-500 font-medium">Gestión de citas y flujo de entrada/salida de vehículos.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
           <button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-all">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
           </button>
           <h3 className="text-sm font-black uppercase tracking-widest px-4">{monthNames[month]} {year}</h3>
           <button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-all">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
        {/* Calendario Grid */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-x-auto p-4 md:p-8">
            <div className="grid grid-cols-7 mb-4 min-w-[560px] md:min-w-0">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: adjustedStartDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square"></div>
              ))}
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayApps = getAppointmentsForDay(dateStr);
                const isSelected = selectedDay === dateStr;
                const isToday = new Date().toISOString().split('T')[0] === dateStr;

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`aspect-square relative rounded-2xl border-2 transition-all p-2 flex flex-col items-center justify-center hover:border-[#00AEEF] group ${
                      isSelected ? 'border-[#00AEEF] bg-cyan-50/30 shadow-lg shadow-cyan-100/50' : 'border-slate-50 bg-white'
                    }`}
                  >
                    <span className={`text-sm font-black ${isSelected ? 'text-[#00AEEF]' : isToday ? 'text-slate-900 ring-2 ring-slate-900 rounded-full px-1.5' : 'text-slate-400'}`}>
                      {day}
                    </span>
                    {dayApps.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {dayApps.slice(0, 3).map(a => (
                          <div key={a.id} className={`w-1.5 h-1.5 rounded-full ${typeColors[a.type]}`}></div>
                        ))}
                        {dayApps.length > 3 && <div className="w-1 h-1 bg-slate-300 rounded-full"></div>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="flex gap-4">
             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-500"></div> <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recepción</span></div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entrega</span></div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revisión</span></div>
          </div>
        </div>

        {/* Detalle del Día */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 rounded-[40px] text-white p-8 shadow-2xl min-h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Agenda del día</h4>
                <p className="text-2xl font-black">{selectedDay ? new Date(selectedDay).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }) : 'Selecciona un día'}</p>
              </div>
              <button onClick={() => setIsAdding(true)} className="w-12 h-12 bg-[#00AEEF] rounded-2xl flex items-center justify-center hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>

            <div className="flex-1 space-y-4">
              {selectedDayAppointments.length > 0 ? (
                selectedDayAppointments.map(app => (
                  <div key={app.id} className="bg-white/5 border border-white/10 rounded-[28px] p-5 relative group hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-4">
                       <div className={`w-3 h-12 rounded-full ${typeColors[app.type]} shrink-0`}></div>
                       <div className="flex-1 overflow-hidden">
                          <div className="flex justify-between items-start">
                             <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-mono">{app.time}</span>
                             <button onClick={() => onDeleteAppointment(app.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all">
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             </button>
                          </div>
                          <p className="font-black text-sm truncate">{app.clientName}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-1">{app.vehicleModel || 'Sin vehículo'}</p>
                       </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-600 opacity-40">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-xs font-black uppercase tracking-widest">Libre de citas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nueva Cita */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-xl animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-[50px] shadow-2xl p-12 animate-slideUp">
            <h3 className="text-3xl font-black uppercase tracking-tighter mb-8 flex items-center gap-4">
               <div className="w-12 h-12 bg-cyan-100 text-[#00AEEF] rounded-2xl flex items-center justify-center">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               </div>
               Agendar Cita
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Tipo</label>
                  <select 
                    value={newApp.type} 
                    onChange={e => setNewApp({...newApp, type: e.target.value as AppointmentType})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#00AEEF] font-bold text-sm"
                  >
                    <option value="RECEPCION">Recepción de Vehículo</option>
                    <option value="ENTREGA">Entrega Final</option>
                    <option value="REVISION">Revisión Técnica</option>
                    <option value="OTROS">Otros</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Hora</label>
                  <input 
                    type="time" 
                    value={newApp.time} 
                    onChange={e => setNewApp({...newApp, time: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#00AEEF] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Cliente / Empresa</label>
                <input 
                  type="text" 
                  value={newApp.clientName} 
                  onChange={e => setNewApp({...newApp, clientName: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#00AEEF] font-bold"
                  placeholder="Ej: Oscar Camper"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Vinculación a Proyecto</label>
                <select 
                  value={newApp.projectId || ''} 
                  onChange={e => {
                    const proj = projects.find(p => p.id === e.target.value);
                    setNewApp({
                      ...newApp, 
                      projectId: e.target.value,
                      clientName: proj ? proj.clientName : newApp.clientName,
                      vehicleModel: proj ? proj.vehicleModel : newApp.vehicleModel
                    });
                  }}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#00AEEF] font-bold text-sm"
                >
                  <option value="">Cita Independiente (Nuevo)</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.plate} - {p.vehicleModel}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-6">
                 <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                 <button type="submit" className="flex-1 py-5 bg-[#00AEEF] text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-cyan-200 hover:scale-[1.02] active:scale-95 transition-all">Confirmar Cita</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
