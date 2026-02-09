
import React from 'react';
import { User } from '../types';

interface SidebarProps {
  currentView: 'dashboard' | 'projects' | 'calendar' | 'manual' | 'users';
  onViewChange: (view: 'dashboard' | 'projects' | 'calendar' | 'manual' | 'users') => void;
  currentUser: User | null;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, currentUser, onLogout }) => {
  if (!currentUser) return null;

  const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
    ), roles: ['ADMIN', 'DESIGN', 'MARKETING', 'ORDERS', 'PRODUCTION'] },
    { id: 'projects', label: 'Proyectos', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
    ), roles: ['ADMIN', 'DESIGN', 'MARKETING', 'ORDERS', 'PRODUCTION'] },
    { id: 'calendar', label: 'Calendario', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    ), roles: ['ADMIN', 'ORDERS'] },
    { id: 'users', label: 'Equipo', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    ), roles: ['ADMIN'] },
    { id: 'manual', label: 'Procedimientos', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    ), roles: ['ADMIN'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(currentUser.role));

  return (
    <aside className="w-72 bg-[#020617] text-slate-300 hidden md:flex flex-col h-screen fixed z-40 border-r border-slate-800/50">
      <div className="p-8">
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="w-10 h-10 text-[#00AEEF]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 16h1a2 2 0 0 0 2-2V9a3 3 0 0 0-3-3h-1V5a1 1 0 0 0-1-1H4a3 3 0 0 0-3 3v8a2 2 0 0 0 2 2h1a2 2 0 0 0 4 0h6a2 2 0 0 0 4 0zM6 15a1 1 0 1 1-1-1 1 1 0 0 1 1 1zm10 0a1 1 0 1 1-1-1 1 1 0 0 1 1 1zM3 9h11v3H3V9z"/>
            </svg>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#00AEEF] rounded-full border-2 border-[#020617] animate-pulse"></div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tighter leading-none">
              Van<span className="text-[#00AEEF]">Space</span>
            </h1>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Workshop</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 mt-4 space-y-1">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id as any)}
            className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 group ${
              currentView === item.id 
              ? 'bg-[#00AEEF] text-white shadow-[0_8px_20px_-4px_rgba(0,174,239,0.4)]' 
              : 'hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className={`${currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-[#00AEEF]'} transition-colors`}>
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-6 mt-auto">
        <div className="bg-white/5 rounded-[24px] p-4 border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <img src={currentUser.avatar} className="w-10 h-10 rounded-2xl object-cover ring-2 ring-slate-800" alt="User" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#020617]"></div>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-black text-white truncate">{currentUser.name}</p>
              <p className="text-[10px] font-bold text-[#00AEEF] uppercase">
                {currentUser.role === 'ADMIN' ? 'Administración' : 
                 currentUser.role === 'DESIGN' ? 'Diseño' :
                 currentUser.role === 'MARKETING' ? 'Marketing' :
                 currentUser.role === 'ORDERS' ? 'Pedidos' :
                 currentUser.role === 'PRODUCTION' ? 'Producción' : 'Equipo'}
              </p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all border border-transparent hover:border-red-400/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Cerrar Sesión
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
