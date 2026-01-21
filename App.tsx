
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
  RefreshCw,
  Store,
  Loader2,
  X
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

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (data) {
        const newProfile: UserProfile = {
          id: data.id,
          businessName: data.business_name || 'Mi Negocio',
          email: data.email,
          sheetsUrl: data.sheets_url
        };
        setProfile(newProfile);
        localStorage.setItem('cajapro_profile', JSON.stringify(newProfile));
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        await fetchProfile(session.user.id);
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
        fetchProfile(session.user.id);
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
    switch (currentView) {
      case 'dashboard': return <DashboardView />;
      case 'inventory': return <InventoryView />;
      case 'sales': return <SalesView />;
      case 'sales_history': return <SalesHistoryView />;
      case 'clients': return <ClientsView />;
      case 'credit': return <CreditView />;
      case 'expenses': return <ExpensesView />;
      case 'settings': return <SettingsView user={profile} onUpdateUser={(p) => {
        setProfile(p);
        localStorage.setItem('cajapro_profile', JSON.stringify(p));
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
              <h1 className="text-xl font-black tracking-tighter text-slate-800">Caja Pro</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400"><X size={20}/></button>
          </div>
          
          <nav className="flex-1 space-y-1 overflow-y-auto hide-scrollbar">
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
