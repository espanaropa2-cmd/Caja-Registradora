
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  History,
  Users, 
  CreditCard, 
  Settings, 
  LogOut, 
  Menu, 
  TrendingDown,
  Warehouse,
  Shield,
  Clock,
  Lock,
  RefreshCw,
  Store,
  Loader2,
  X,
  CreditCard as CreditIcon,
  ShieldAlert
} from 'lucide-react';
import { ViewType, UserProfile } from './types';
import DashboardView from './views/DashboardView';
import InventoryView from './views/InventoryView';
import SalesView from './views/SalesView';
import SalesHistoryView from './views/SalesHistoryView';
import ClientsView from './views/ClientsView';
import CreditView from './views/CreditView';
import ExpensesView from './views/ExpensesView';
import SettingsView from './views/SettingsView';
import AuthView from './views/AuthView';
import AdminView from './views/AdminView';

const ADMIN_EMAIL = 'azliersylver@gmail.com';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('cajapro_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('sales');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fetchProfile = useCallback(async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (data) {
        // Si ya existe, lo cargamos
        const newProfile: UserProfile = {
          id: data.id,
          businessName: data.business_name || 'Mi Negocio',
          email: data.email,
          sheetsUrl: data.sheets_url,
          subscriptionExpires: data.subscription_expires,
          isBanned: data.is_banned,
          alias: data.alias,
          contactPhone: data.contact_phone,
          lastPaymentRef: data.last_payment_ref,
          useParallelRate: data.use_parallel_rate || false
        };
        setProfile(newProfile);
        localStorage.setItem('cajapro_profile', JSON.stringify(newProfile));
      } else {
        // Si no existe, lo creamos
        const isSuperUser = email === ADMIN_EMAIL;
        const newProfileData = {
          id: userId,
          email: email,
          business_name: 'Mi Negocio',
          is_banned: !isSuperUser // Los nuevos usuarios empiezan bloqueados, excepto el admin
        };
        
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert(newProfileData)
          .select()
          .single();

        if (created) {
          const newProfile: UserProfile = {
            id: created.id,
            businessName: created.business_name,
            email: created.email,
            isBanned: created.is_banned
          };
          setProfile(newProfile);
          localStorage.setItem('cajapro_profile', JSON.stringify(newProfile));
        }
      }
    } catch (err) {
      console.error("Error fetching/creating profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        await fetchProfile(session.user.id, session.user.email!);
      } else {
        localStorage.removeItem('cajapro_profile');
        setProfile(null);
        setLoading(false);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id, session.user.email!);
      } else {
        localStorage.removeItem('cajapro_profile');
        setProfile(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('cajapro_profile');
    setProfile(null);
    setSession(null);
  };

  const NavItem = ({ view, icon: Icon, label, mobile = false }: { view: ViewType, icon: any, label: string, mobile?: boolean }) => {
    const isActive = currentView === view;
    if (mobile) {
      return (
        <button
          onClick={() => setCurrentView(view)}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${
            isActive ? 'text-blue-600' : 'text-slate-400'
          }`}
        >
          <Icon size={20} strokeWidth={isActive ? 3 : 2} />
          <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">{label}</span>
        </button>
      );
    }
    return (
      <button
        onClick={() => { setCurrentView(view); setIsSidebarOpen(false); }}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
          isActive 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
            : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <Icon size={20} />
        <span className="font-bold">{label}</span>
      </button>
    );
  };

  const renderView = () => {
    if (!profile) return null;
    
    // Si la cuenta está bloqueada, forzamos esa vista
    const isSuperUser = profile.email === ADMIN_EMAIL;
    const expired = !isSuperUser && profile.subscriptionExpires && new Date(profile.subscriptionExpires) < new Date();
    const banned = !isSuperUser && profile.isBanned;

    if (banned) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center space-y-6">
          <div className="w-24 h-24 bg-rose-100 text-rose-600 rounded-[2rem] flex items-center justify-center shadow-lg">
            <Shield size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-800">Cuenta Suspendida</h2>
            <p className="text-slate-500 max-w-md mx-auto">Tu acceso al sistema ha sido restringido por un administrador. Contacta con soporte para más información.</p>
          </div>
        </div>
      );
    }

    if (expired && currentView !== 'settings') {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center space-y-10 min-h-[70vh] animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <div className="w-32 h-32 bg-amber-100 text-amber-600 rounded-[2.5rem] flex items-center justify-center shadow-lg">
              <Clock size={64} />
            </div>
            <div className="absolute -top-2 -right-2 bg-rose-600 text-white p-2 rounded-full border-4 border-white shadow-lg">
              <ShieldAlert size={20} />
            </div>
          </div>
          
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-slate-800 tracking-tight uppercase italic">Suscripción Vencida</h2>
            <div className="space-y-1">
              <p className="text-slate-500 font-bold max-w-sm mx-auto">Tu periodo de acceso ha expirado el <span className="text-rose-600 font-black">{new Date(profile.subscriptionExpires!).toLocaleDateString()}</span>.</p>
              <p className="text-slate-400 text-sm font-medium">Por favor renueva tu suscripción para continuar usando la plataforma.</p>
            </div>
          </div>

          <button 
            onClick={() => setCurrentView('settings')}
            className="group flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-2xl hover:scale-105 active:scale-95"
          >
            <CreditCard size={20} className="group-hover:rotate-12 transition-transform" />
            Renovar Ahora
          </button>

          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Podrás reportar tu pago en la sección de mantenimiento.</p>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard': return <DashboardView useParallelRate={profile.useParallelRate} />;
      case 'inventory': return <InventoryView useParallelRate={profile.useParallelRate} />;
      case 'sales': return <SalesView useParallelRate={profile.useParallelRate} />;
      case 'sales_history': return <SalesHistoryView />;
      case 'clients': return <ClientsView />;
      case 'credit': return <CreditView useParallelRate={profile.useParallelRate} />;
      case 'expenses': return <ExpensesView />;
      case 'admin': return isSuperUser ? <AdminView /> : <DashboardView useParallelRate={profile.useParallelRate} />;
      case 'settings': return <SettingsView user={profile} onUpdateUser={async (p) => {
        setProfile(p);
        localStorage.setItem('cajapro_profile', JSON.stringify(p));
        // Persistir en Supabase
        await supabase.from('profiles').update({
          business_name: p.businessName,
          email: p.email,
          sheets_url: p.sheetsUrl,
          use_parallel_rate: p.useParallelRate
        }).eq('id', p.id);
      }} />;
      default: return <DashboardView />;
    }
  };

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Cargando Sistema...</p>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthView onLogin={() => setLoading(true)} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar - Desktop & Tablet */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-72 bg-white border-r border-slate-200 z-[60] transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-100"><Store size={24} /></div>
              <h1 className="text-xl font-black tracking-tighter text-slate-800 break-words">{profile?.businessName || 'Caja Pro'}</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400"><X size={20}/></button>
          </div>
          
          <nav className="flex-1 space-y-1 overflow-y-auto hide-scrollbar">
            {profile?.email === ADMIN_EMAIL && (
              <NavItem view="admin" icon={Shield} label="Superusuario" />
            )}
            <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem view="sales" icon={ShoppingCart} label="Nueva Venta" />
            <NavItem view="sales_history" icon={History} label="Historial" />
            <NavItem view="inventory" icon={Package} label="Inventario" />
            <NavItem view="clients" icon={Users} label="Clientes" />
            <NavItem view="credit" icon={CreditCard} label="Crédito" />
            <NavItem view="expenses" icon={TrendingDown} label="Egresos" />
            <div className="my-6 border-t border-slate-100" />
            <NavItem view="settings" icon={Settings} label="Ajustes" />
          </nav>

          <div className="pt-6 border-t border-slate-100">
            <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors font-bold">
              <LogOut size={20} />
              <span>Salir del Sistema</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-10 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2.5 bg-slate-50 text-slate-600 rounded-xl"><Menu size={20} /></button>
            <div className="flex flex-col">
              <h2 className="text-sm lg:text-lg font-black text-slate-800 truncate max-w-[150px] lg:max-w-none">{profile?.businessName}</h2>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Terminal Online
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
             <button className="p-2.5 bg-blue-50 text-blue-600 rounded-xl lg:hidden" onClick={() => setCurrentView('settings')}>
                <Settings size={20} />
             </button>
             <div className="hidden lg:flex items-center space-x-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
               <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xs font-black">
                 {profile?.businessName.charAt(0)}
               </div>
               <span className="text-xs font-bold text-slate-600">{profile?.email}</span>
             </div>
          </div>
        </header>

        {/* CONTENEDOR DE VISTAS: Se aumentó el padding inferior para móvil (pb-32) */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-10 pb-32 lg:pb-10 bg-slate-50 hide-scrollbar">
          <div className="max-w-7xl mx-auto">{renderView()}</div>
        </div>

        {/* Bottom Navigation for Mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-[70] shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <NavItem view="sales" icon={ShoppingCart} label="Venta" mobile />
          <NavItem view="inventory" icon={Package} label="Stock" mobile />
          <NavItem view="sales_history" icon={History} label="Hist" mobile />
          <NavItem view="credit" icon={CreditCard} label="Cobro" mobile />
          <NavItem view="dashboard" icon={LayoutDashboard} label="Dash" mobile />
        </nav>
      </main>
    </div>
  );
};

export default App;
