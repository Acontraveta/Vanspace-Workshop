
import React, { useState } from 'react';
import { User } from '../types';
import { db } from '../services/supabase';

interface UserManagementProps {
  users: User[];
  onAddUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onUpdateRole: (userId: string, newRole: 'ADMIN' | 'DESIGN' | 'MARKETING' | 'ORDERS' | 'PRODUCTION') => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ users, onAddUser, onDeleteUser, onUpdateRole }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'DESIGN' | 'MARKETING' | 'ORDERS' | 'PRODUCTION'>('PRODUCTION');
  
  // Supabase Config States
  const [sUrl, setSUrl] = useState(localStorage.getItem('VS_SUPABASE_URL') || '');
  const [sKey, setSKey] = useState(localStorage.getItem('VS_SUPABASE_KEY') || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim() || !newPassword.trim()) return;

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: newName,
      username: newUsername.toLowerCase().trim(),
      password: newPassword,
      role: newRole,
      avatar: `https://picsum.photos/seed/${newName}/100/100`
    };

    onAddUser(newUser);
    setNewName('');
    setNewUsername('');
    setNewPassword('');
    setIsAdding(false);
  };

  const handleSaveConfig = () => {
    if (sUrl && sKey) {
      db.saveConfig(sUrl, sKey);
    }
  };

  return (
    <div className="space-y-12 animate-fadeIn max-w-5xl mx-auto pb-20">
      {/* Sección Configuración Supabase */}
      <div className="bg-[#020617] text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-4">Conexión a la Nube</h3>
            <p className="text-slate-400 text-sm font-medium mb-6">Conecta tu propia base de datos de Supabase para sincronización en tiempo real entre dispositivos.</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Supabase URL</label>
                <input 
                  type="text" 
                  value={sUrl}
                  onChange={(e) => setSUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-mono outline-none focus:ring-1 focus:ring-[#00AEEF]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Anon Public Key</label>
                <input 
                  type="password" 
                  value={sKey}
                  onChange={(e) => setSKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-mono outline-none focus:ring-1 focus:ring-[#00AEEF]"
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button onClick={handleSaveConfig} className="flex-1 py-4 bg-[#00AEEF] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-cyan-900/20 hover:bg-cyan-500 transition-all">
                  Guardar y Conectar
                </button>
                {db.isConfigured && (
                  <button onClick={() => db.resetConfig()} className="px-6 py-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="hidden lg:flex flex-col justify-center items-center border-l border-white/5 pl-10">
             <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${db.isConfigured ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-slate-800 text-slate-600'}`}>
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
             <p className="text-[10px] font-black uppercase tracking-widest text-center">
               {db.isConfigured ? 'Sistema Sincronizado' : 'Modo Local (Offline)'}
             </p>
             <p className="text-[9px] text-slate-500 mt-2 text-center max-w-xs">Introduce tus credenciales de Supabase para activar las notificaciones en tiempo real y la base de datos persistente.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter">
            <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </span>
            Equipo de Taller
          </h2>
          <p className="text-slate-500 mt-1 font-medium">Control de acceso y credenciales de técnicos.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          {isAdding ? 'Cerrar' : 'Nuevo Alta'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-2xl animate-slideUp">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nombre Completo</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Rol de Usuario</label>
                <select 
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-black text-xs uppercase appearance-none"
                >
                  <option value="DESIGN">Diseño</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="ORDERS">Pedidos</option>
                  <option value="PRODUCTION">Producción</option>
                  <option value="ADMIN">Administración</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-slate-50/50 rounded-3xl border border-slate-100">
               <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-2">Identificador de Acceso</label>
                <input 
                  type="text" 
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="juan.taller"
                  className="w-full p-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-2">Clave Maestra</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
              Registrar en Sistema
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Especialista</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Identificación</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Permisos</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <img src={user.avatar} className="w-12 h-12 rounded-2xl border border-slate-100 shadow-sm" alt={user.name} />
                      <div>
                        <span className="font-black text-slate-900 block">{user.name}</span>
                        <span className="text-[9px] font-black text-emerald-500 flex items-center gap-1.5 uppercase tracking-widest mt-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Operativo
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-slate-500">
                      <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                      <span className="text-sm font-bold">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <select 
                      value={user.role}
                      onChange={(e) => onUpdateRole(user.id, e.target.value as any)}
                      className={`text-[10px] font-black px-4 py-2 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-100 ${
                        user.role === 'ADMIN' ? 'bg-purple-50 text-purple-700' :
                        user.role === 'DESIGN' ? 'bg-pink-50 text-pink-700' :
                        user.role === 'MARKETING' ? 'bg-blue-50 text-blue-700' :
                        user.role === 'ORDERS' ? 'bg-amber-50 text-amber-700' :
                        user.role === 'PRODUCTION' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      <option value="ADMIN">ADMINISTRACIÓN</option>
                      <option value="DESIGN">DISEÑO</option>
                      <option value="MARKETING">MARKETING</option>
                      <option value="ORDERS">PEDIDOS</option>
                      <option value="PRODUCTION">PRODUCCIÓN</option>
                    </select>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => onDeleteUser(user.id)}
                      disabled={users.length <= 1}
                      className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
