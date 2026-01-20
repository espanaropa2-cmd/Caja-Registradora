
import React, { useState, useEffect } from 'react';
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
  Loader2
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
  // Carga inicial desde localStorage para evitar parpadeos y login innecesario
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('cajapro_profile');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Verificar sesión existente al arrancar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        localStorage.removeItem('cajapro_profile');
        setProfile(null);
        setLoading(false);
      }
    });

    // Escuchar cambios de estado (Login/Logout)
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
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (data) {
        const newProfile: UserProfile = {
          id: data.id,
          businessName: data.business_name,
          email: data.email,
          sheetsUrl: data.sheets_url
        };
        setProfile(newProfile);
        // Guardar en disco para la próxima vez
        localStorage.setItem('cajapro_profile', JSON.stringify(newProfile));
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('cajapro_profile');
    setProfile(null);
    setSession(null);
  };

  // Si tenemos sesión y perfil (aunque sea de cache), no mostramos el loader
  const isUserAuthenticated = session && profile;

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!session || (!profile && session)) {
    return <AuthView onLogin={() => setLoading(true)} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView />;
      case 'inventory': return <InventoryView />;
      case 'sales': return <SalesView />;
      case 'sales_history': return <SalesHistoryView />;
      case 'clients': return <ClientsView />;
      case 'credit': return <CreditView />;
      case 'expenses': return <ExpensesView />;
      case 'settings': return <SettingsView user={profile!} onUpdateUser={(p) => {
        setProfile(p);
        localStorage.setItem('cajapro_profile', JSON.stringify(p));
      }} />;
      default: return <DashboardView />;
    }
  };

  const NavItem = ({ view, icon: Icon, label }: { view: ViewType, icon: any, label: string }) => (
    <button
      onClick={() => { setCurrentView(view); setIsSidebarOpen(false); }}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
        currentView === view 
          ? 'bg-blue-600 text-white shadow-lg' 
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center space-x-2 px-2 mb-8">
            <div className="bg-blue-600 p-2 rounded-lg text-white"><Store size={24} /></div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Caja Pro</h1>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto hide-scrollbar">
            <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem view="sales" icon={ShoppingCart} label="Nueva Venta" />
            <NavItem view="sales_history" icon={History} label="Historial Ventas" />
            <NavItem view="inventory" icon={Package} label="Inventario" />
            <NavItem view="clients" icon={Users} label="Clientes" />
            <NavItem view="credit" icon={CreditCard} label="Crédito & Deudas" />
            <NavItem view="expenses" icon={TrendingDown} label="Egresos" />
            <div className="my-4 border-t border-slate-100" />
            <NavItem view="settings" icon={Settings} label="Configuración" />
          </nav>
          <div className="pt-4 border-t border-slate-100">
            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Tu Negocio</p>
              <p className="text-sm font-bold text-slate-800 truncate">{profile?.businessName}</p>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
              <LogOut size={20} />
              <span className="font-medium">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-md"><Menu size={24} /></button>
            <h2 className="text-lg font-bold text-slate-800 lg:text-xl">{profile?.businessName}</h2>
          </div>
          <div className="flex items-center space-x-3">
             <button disabled={syncing} className="flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-emerald-100 transition-colors">
                <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Sesión Activa</span>
             </button>
             <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold uppercase">{profile?.businessName.charAt(0)}</div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-50 hide-scrollbar">
          <div className="max-w-6xl mx-auto h-full">{renderView()}</div>
        </div>
      </main>
    </div>
  );
};

export default App;
