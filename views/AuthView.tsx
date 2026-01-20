
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Store, ArrowRight, ShieldCheck, Loader2, Mail, Lock, Building2, ChevronLeft } from 'lucide-react';

type AuthStep = 'initial' | 'login' | 'profile_setup';

const AuthView: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [step, setStep] = useState<AuthStep>('initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      if (data.session) {
        setStep('profile_setup');
      } else {
        setError('Registro exitoso. Revisa tu correo o intenta iniciar sesión.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
      
      const { data: profile } = await supabase.from('profiles').select('id').eq('id', data.user.id).single();
      if (!profile) {
        setStep('profile_setup');
      } else {
        onLogin();
      }
    } catch (err: any) {
      setError(err.message === "Invalid login credentials" ? "Correo o clave incorrectos" : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no encontrada");

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          business_name: businessName,
          email: user.email,
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;
      
      onLogin();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-slate-900">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 border border-slate-100 relative overflow-hidden">
        
        <div className="relative z-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 text-white rounded-3xl mb-6 shadow-xl shadow-blue-200 animate-bounce-short">
              <Store size={40} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Caja Registradora</h1>
            <p className="text-slate-500 mt-2 font-medium">
              {step === 'initial' && 'Gestión comercial para Venezuela 🇻🇪'}
              {step === 'login' && 'Entra a tu panel administrativo'}
              {step === 'profile_setup' && 'Configura tu marca'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-2 leading-relaxed">
              {error}
            </div>
          )}

          {step === 'initial' && (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input required type="email" placeholder="ej: ventas@negocio.com" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input required type="password" placeholder="Mínimo 6 caracteres" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" /> : 'Crear Cuenta'}
                {!loading && <ArrowRight size={22} />}
              </button>
              <p className="text-center text-sm text-slate-500 mt-6 font-medium">
                ¿Ya tienes cuenta? <button type="button" onClick={() => setStep('login')} className="text-blue-600 font-bold hover:underline">Inicia sesión</button>
              </p>
            </form>
          )}

          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <button type="button" onClick={() => setStep('initial')} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest mb-2 transition-colors">
                <ChevronLeft size={16} /> Volver
              </button>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Tu Correo</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input required type="email" placeholder="ej: gerente@negocio.com" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input required type="password" placeholder="••••••••" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <button disabled={loading} type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98] disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" /> : 'Entrar'}
                {!loading && <ArrowRight size={22} />}
              </button>
            </form>
          )}

          {step === 'profile_setup' && (
            <form onSubmit={handleCompleteProfile} className="space-y-6 animate-in slide-in-from-right duration-500">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de tu Negocio</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input required type="text" placeholder="Ej: Abasto La Bendición" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={businessName} onChange={(e) => setBusinessName(e.target.value)} autoFocus />
                </div>
              </div>
              <button disabled={loading || !businessName} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-2 shadow-xl shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" /> : 'Finalizar Configuración'}
                {!loading && <ArrowRight size={24} />}
              </button>
            </form>
          )}

          <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck size={14} className="text-emerald-400" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Protección por Supabase Auth</p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-8 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Hecho para emprendedores 🇻🇪</p>
    </div>
  );
};

export default AuthView;
