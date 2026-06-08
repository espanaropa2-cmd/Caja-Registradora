
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { dbService } from './services/dbService';
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
import PinGate from './views/PinGate';
import CierreCajaView from './views/CierreCajaView';

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDashboardUnlocked, setIsDashboardUnlocked] = useState(false);

  useEffect(() => {
    if (currentView !== 'dashboard') {
      setIsDashboardUnlocked(false);
    }
  }, [currentView]);

  // Determinar si es administrador
  const isAdmin = profile?.role === 'admin' || profile?.email === ADMIN_EMAIL;

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
          useParallelRate: data.use_parallel_rate || false,
          showTriplePrice: data.show_triple_price || false,
          aiAuditEnabled: data.ai_audit_enabled || false,
          isDarkMode: data.is_dark_mode || false,
          monthlyOperatingExpenses: data.monthly_operating_expenses || 0,
          monthlySalaries: data.monthly_salaries || 0,
          initialInvestmentAmount: data.initial_investment_amount || 0,
          initialInvestmentLifeMonths: data.initial_investment_life_months || 0,
          operatingExpensesList: data.operating_expenses_list || [],
          salariesList: data.salaries_list || [],
          dashboardPin: data.dashboard_pin || localStorage.getItem(`cajapro_pin_${userId}`) || undefined,
          recoveryQuestion: data.recovery_question || localStorage.getItem(`cajapro_rec_q_${userId}`) || undefined,
          recoveryAnswer: data.recovery_answer || localStorage.getItem(`cajapro_rec_a_${userId}`) || undefined
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

  useEffect(() => {
    if (profile?.isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      document.body.style.backgroundColor = '#020617';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      document.body.style.backgroundColor = '#f8fafc';
    }
  }, [profile?.isDarkMode]);



  const handleSyncSheets = async () => {
    if (!profile?.sheetsUrl) {
      alert("Por favor configura la URL de tu Google Sheets en Ajustes.");
      setCurrentView('settings');
      return;
    }

    setIsSyncing(true);
    try {
      const data = await dbService.getSales(); // O todos los datos que se quieran respaldar
      const response = await fetch(profile.sheetsUrl, {
        method: 'POST',
        mode: 'no-cors', // Google Apps Script suele requerir no-cors o redirecciones
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync_all',
          data: data,
          businessName: profile.businessName
        }),
      });
      alert("Sincronización enviada. Nota: Al usar Google Scripts 'no-cors', el resultado no es confirmable pero la data fue despachada.");
    } catch (err) {
      console.error("Error syncing sheets:", err);
      alert("Error al intentar sincronizar con Google Sheets.");
    } finally {
      setIsSyncing(false);
    }
  };

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
          className={`flex flex-col items-center justify-center flex-1 h-full transition-all relative ${
            isActive ? 'text-slate-900 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {isActive && <span className="absolute top-0 w-8 h-1 bg-slate-900 dark:bg-blue-500 rounded-full" />}
          <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
          <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">{label}</span>
        </button>
      );
    }
    return (
      <button
        onClick={() => { setCurrentView(view); setIsSidebarOpen(false); }}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
          isActive 
            ? 'bg-slate-900 dark:bg-blue-500/10 text-white dark:text-blue-400 border border-slate-800 dark:border-blue-500/20' 
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
      >
        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-white dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-600 transition-colors'} />
        <span className={`text-sm tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
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
      case 'dashboard': 
        if (!isDashboardUnlocked) {
          return (
            <PinGate 
              user={profile} 
              isUnlocked={isDashboardUnlocked} 
              onUnlock={() => setIsDashboardUnlocked(true)} 
              onUpdateUser={async (p) => {
                setProfile(p);
                localStorage.setItem('cajapro_profile', JSON.stringify(p));
                try {
                  const { error } = await supabase.from('profiles').update({
                    dashboard_pin: p.dashboardPin,
                    recovery_question: p.recoveryQuestion,
                    recovery_answer: p.recoveryAnswer
                  }).eq('id', p.id);
                  if (error) throw error;
                } catch (dbErr) {
                  console.warn("DB columns not updated yet or failed, saved locally as fallback:", dbErr);
                }
              }} 
            />
          );
        }
        return <DashboardView useParallelRate={profile.useParallelRate} businessName={profile.businessName} isDarkMode={profile.isDarkMode} aiAuditEnabled={profile.aiAuditEnabled} />;
      case 'inventory': return <InventoryView useParallelRate={profile.useParallelRate} />;
      case 'sales': return <SalesView useParallelRate={profile.useParallelRate} showTriplePrice={profile.showTriplePrice} />;
      case 'cierre_caja': return <CierreCajaView />;
      case 'sales_history': return <SalesHistoryView />;
      case 'clients': return <ClientsView />;
      case 'credit': return <CreditView useParallelRate={profile.useParallelRate} />;
      case 'expenses': return <ExpensesView user={profile} onUpdateUser={async (p) => {
        setProfile(p);
        localStorage.setItem('cajapro_profile', JSON.stringify(p));
        // Persistir en Supabase
        await supabase.from('profiles').update({
          business_name: p.businessName,
          email: p.email,
          sheets_url: p.sheetsUrl,
          use_parallel_rate: p.useParallelRate,
          is_dark_mode: p.isDarkMode,
          monthly_operating_expenses: p.monthlyOperatingExpenses || 0,
          monthly_salaries: p.monthlySalaries || 0,
          initial_investment_amount: p.initialInvestmentAmount || 0,
          initial_investment_life_months: p.initialInvestmentLifeMonths || 0,
          operating_expenses_list: p.operatingExpensesList || [],
          salaries_list: p.salariesList || []
        }).eq('id', p.id);
      }} />;
      case 'admin': return isAdmin ? <AdminView /> : <DashboardView useParallelRate={profile.useParallelRate} businessName={profile.businessName} isDarkMode={profile.isDarkMode} />;
      case 'settings': return <SettingsView user={profile} onLogout={handleLogout} onUpdateUser={async (p) => {
        setProfile(p);
        localStorage.setItem('cajapro_profile', JSON.stringify(p));
        // Persistir en Supabase
        await supabase.from('profiles').update({
          business_name: p.businessName,
          email: p.email,
          sheets_url: p.sheetsUrl,
          use_parallel_rate: p.useParallelRate,
          is_dark_mode: p.isDarkMode,
          monthly_operating_expenses: p.monthlyOperatingExpenses || 0,
          monthly_salaries: p.monthlySalaries || 0,
          initial_investment_amount: p.initialInvestmentAmount || 0,
          initial_investment_life_months: p.initialInvestmentLifeMonths || 0,
          operating_expenses_list: p.operatingExpensesList || [],
          salaries_list: p.salariesList || []
        }).eq('id', p.id);
      }} />;
      default: return <DashboardView />;
    }
  };

  if (loading && !profile) {
    const isDark = profile?.isDarkMode || (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    return (
      <div className={`min-h-screen ${isDark ? 'bg-[#020617] text-slate-100' : 'bg-slate-50 text-slate-900'} flex flex-col items-center justify-center p-6 text-center transition-colors duration-500`}>
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'} font-black uppercase tracking-widest text-xs`}>Iniciando Aplicación...</p>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthView onLogin={() => setLoading(true)} />;
  }

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-500 ${profile?.isDarkMode ? 'bg-[#020617] text-slate-100' : 'bg-[#f8fafc] text-slate-900'}`}>
      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-[2px] z-50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar - Desktop & Tablet */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-72 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800/60 z-[60] transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center space-x-3">
              <div className="bg-slate-900 dark:bg-blue-600/10 p-2.5 rounded-xl text-white dark:text-blue-400 border border-slate-800 dark:border-blue-500/20">
                <Store size={22} strokeWidth={2.5} />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 break-words">{profile?.businessName || 'Caja Pro'}</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
          </div>
          
          <nav className="flex-1 space-y-1 overflow-y-auto hide-scrollbar">
            {isAdmin && (
              <NavItem view="admin" icon={Shield} label="Superusuario" />
            )}
            <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem view="sales" icon={ShoppingCart} label="Nueva Venta" />
            <NavItem view="cierre_caja" icon={Lock} label="Cierre de Caja" />
            <NavItem view="sales_history" icon={History} label="Historial" />
            <NavItem view="inventory" icon={Package} label="Inventario" />
            <NavItem view="clients" icon={Users} label="Clientes" />
            <NavItem view="credit" icon={CreditCard} label="Crédito" />
            <NavItem view="expenses" icon={TrendingDown} label="Egresos" />
            <div className="my-6 border-t border-slate-100 dark:border-slate-800/50" />
            <NavItem view="settings" icon={Settings} label="Ajustes" />
          </nav>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800/50">
            <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all font-semibold text-sm">
              <LogOut size={18} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 lg:h-20 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/60 flex items-center justify-between px-6 lg:px-10 flex-shrink-0 z-40">
          <div className="flex items-center space-x-6">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2.5 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-700/50"><Menu size={20} /></button>
            <div className="flex flex-col">
              <h2 className="text-sm lg:text-base font-bold text-slate-900 dark:text-slate-100 truncate max-w-[150px] lg:max-w-none">{profile?.businessName}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.3)]"></span>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Servicio Activo</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {profile?.sheetsUrl && (
               <button 
                onClick={handleSyncSheets}
                disabled={isSyncing}
                title="Sincronizar con Google Sheets"
                className="hidden sm:flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all active:scale-95 disabled:opacity-50"
               >
                  <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
                  <span className="hidden xl:block text-[10px] font-black uppercase tracking-widest">Sincronizar</span>
               </button>
             )}
             <button className="p-2.5 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors lg:hidden" onClick={() => setCurrentView('settings')}>
                <Settings size={18} />
             </button>
             <div className="hidden lg:flex items-center space-x-3 bg-slate-50 dark:bg-slate-800/30 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700/50">
               <div className="w-7 h-7 rounded-lg bg-slate-800 dark:bg-blue-600/80 flex items-center justify-center text-white text-[10px] font-black tracking-tighter">
                 {profile?.businessName.charAt(0).toUpperCase()}
               </div>
               <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{profile?.email}</span>
             </div>
          </div>
        </header>

        {/* CONTENEDOR DE VISTAS */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-10 pb-32 lg:pb-10 bg-[#f8fafc] dark:bg-[#020617] hide-scrollbar transition-colors duration-500">
          <div className="max-w-7xl mx-auto">{renderView()}</div>
        </div>

        {/* Bottom Navigation for Mobile */}
        <nav className="lg:hidden fixed bottom-6 left-6 right-6 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-around px-2 z-[70] shadow-2xl shadow-slate-200/50 dark:shadow-black/60 rounded-[2rem] overflow-hidden">
          <NavItem view="sales" icon={ShoppingCart} label="Venta" mobile />
          <NavItem view="inventory" icon={Package} label="Stock" mobile />
          <NavItem view="sales_history" icon={History} label="Hist" mobile />
          <NavItem view="credit" icon={CreditCard} label="Cobro" mobile />
          <NavItem view="dashboard" icon={LayoutDashboard} label="Panel" mobile />
        </nav>
      </main>
    </div>
  );
};

export default App;
