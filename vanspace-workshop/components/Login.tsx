
import React, { useState } from 'react';
import { db } from '../services/supabase';

interface LoginProps {
  onLogin: (username: string, pass: string) => Promise<boolean>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setIsAuthenticating(true);
    try {
      const success = await onLogin(username, password);
      if (!success) setError(true);
    } catch (err) {
      setError(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleReset = () => {
    if (confirm("¿Deseas eliminar la configuración de Supabase y volver al modo local?")) {
      db.resetConfig();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#020617] overflow-hidden relative">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
         <svg className="absolute bottom-0 left-0 w-full h-[60%] text-[#00AEEF]" viewBox="0 0 1440 320" fill="currentColor">
            <path d="M0,224L120,186.7C240,149,480,75,720,80C960,85,1200,171,1320,213.3L1440,256L1440,320L1320,320C1200,320,960,320,720,320C480,320,240,320,120,320L0,320Z"></path>
         </svg>
      </div>

      <div className="absolute inset-0 bg-radial-gradient from-[#00AEEF]/10 to-transparent pointer-events-none"></div>

      <div className="w-full max-w-md p-6 relative z-10">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-12 rounded-[50px] shadow-2xl">
          <div className="text-center mb-10">
            <div className="inline-block relative mb-6 group">
              <div className="absolute inset-0 bg-[#00AEEF] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <svg className="w-24 h-24 text-[#00AEEF] relative z-10 transform group-hover:scale-110 transition-transform duration-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 16h1a2 2 0 0 0 2-2V9a3 3 0 0 0-3-3h-1V5a1 1 0 0 0-1-1H4a3 3 0 0 0-3 3v8a2 2 0 0 0 2 2h1a2 2 0 0 0 4 0h6a2 2 0 0 0 4 0zM6 15a1 1 0 1 1-1-1 1 1 0 0 1 1 1zm10 0a1 1 0 1 1-1-1 1 1 0 0 1 1 1zM3 9h11v3H3V9z"/>
              </svg>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter leading-none">Van<span className="text-[#00AEEF]">Space</span></h1>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="h-0.5 w-4 bg-[#00AEEF]"></span>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">Workshop System</p>
              <span className="h-0.5 w-4 bg-[#00AEEF]"></span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Identificación</label>
              <div className="relative">
                 <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isAuthenticating}
                  className="w-full pl-12 pr-6 py-5 bg-white/5 border border-white/10 rounded-[24px] text-white outline-none focus:ring-2 focus:ring-[#00AEEF] transition-all placeholder:text-white/20 font-bold disabled:opacity-50"
                  placeholder="admin"
                  required
                />
                <svg className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Clave Técnica</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isAuthenticating}
                  className="w-full pl-12 pr-6 py-5 bg-white/5 border border-white/10 rounded-[24px] text-white outline-none focus:ring-2 focus:ring-[#00AEEF] transition-all placeholder:text-white/20 disabled:opacity-50"
                  placeholder="123"
                  required
                />
                <svg className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-2xl animate-shake">
                <p className="text-red-400 text-xs font-black text-center uppercase tracking-tighter">Credenciales incorrectas o fallo de conexión</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isAuthenticating}
              className="w-full py-5 bg-[#00AEEF] hover:bg-cyan-400 text-white rounded-[24px] font-black text-lg shadow-[0_10px_30px_-10px_rgba(0,174,239,0.5)] transition-all transform active:scale-95 mt-4 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isAuthenticating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Verificando...
                </>
              ) : 'Acceder al Taller'}
            </button>
          </form>

          <div className="mt-8 text-center">
             <button 
               onClick={() => setShowTroubleshoot(!showTroubleshoot)}
               className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
             >
               ¿Problemas de conexión?
             </button>
             
             {showTroubleshoot && (
               <div className="mt-4 p-4 bg-white/5 border border-white/5 rounded-2xl animate-fadeIn">
                 <p className="text-[9px] text-slate-400 mb-3 font-bold uppercase">Si has configurado Supabase mal, puedes resetear la app aquí:</p>
                 <button 
                   onClick={handleReset}
                   className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500/40 transition-all"
                 >
                   Limpiar Configuración Local
                 </button>
               </div>
             )}
          </div>

          <p className="text-center text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-8">
            Seguridad VanSpace v4.5 / Fallback Local Activo
          </p>
        </div>
      </div>

      <style>{`
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
};

export default Login;
