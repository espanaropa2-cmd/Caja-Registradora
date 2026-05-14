
import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { UserProfile, AppConfig, SubscriptionRequest, SubscriptionStatus } from '../types';
import { 
  Users, 
  ShieldAlert, 
  Calendar, 
  Phone, 
  Tag, 
  CheckCircle2, 
  Search,
  Loader2,
  Clock,
  Lock,
  Unlock,
  Building,
  CreditCard,
  Save,
  IdCard,
  CircleDollarSign,
  PlusCircle,
  XCircle,
  Bell,
  Activity,
  History as HistoryIcon,
  DollarSign,
  Archive,
  RotateCcw
} from 'lucide-react';

const AdminView: React.FC = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profiles' | 'requests' | 'archived'>('requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const fetchData = async () => {
    try {
      const [profilesData, configData] = await Promise.all([
        dbService.getAllProfiles(),
        dbService.getAppConfig()
      ]);
      setProfiles(profilesData);
      setAppConfig(configData);
      
      // Intentar cargar solicitudes (puede fallar si la tabla no existe)
      try {
        const requestsData = await dbService.getSubscriptionRequests();
        setRequests(requestsData);
      } catch (e) {
        console.warn("Tabla subscription_requests no encontrada o inaccesible");
      }
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdate = async (id: string, updates: Partial<UserProfile>) => {
    setUpdatingId(id);
    try {
      await dbService.updateProfileByAdmin(id, updates);
      await fetchData();
    } catch (err: any) {
      console.error("Error al actualizar:", err);
      alert("Error al actualizar perfil: " + (err.message || String(err)));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleProcessRequest = async (requestId: string, status: SubscriptionStatus) => {
    setUpdatingId(requestId);
    try {
      await dbService.updateSubscriptionRequestStatus(requestId, status);
      await fetchData();
    } catch (err: any) {
      console.error("Error al procesar:", err);
      alert("Error al procesar solicitud: " + (err.message || String(err)));
    } finally {
      setUpdatingId(null);
    }
  };

  const addMonths = (id: string, currentExp: string | undefined, months: number) => {
    // Si la fecha actual es mayor a hoy, sumamos a partir de esa fecha
    // Si ya expiró o no tiene, sumamos a partir de HOY
    const baseDate = (currentExp && new Date(currentExp) > new Date()) 
      ? new Date(currentExp) 
      : new Date();
    
    const newDate = new Date(baseDate);
    newDate.setMonth(newDate.getMonth() + months);
    newDate.setHours(23, 59, 59, 999);
    handleUpdate(id, { subscriptionExpires: newDate.toISOString() });
  };

  const handleSaveConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!appConfig) return;
    setIsSavingConfig(true);
    try {
      await dbService.saveAppConfig(appConfig);
      alert("Configuración global guardada correctamente");
      const config = await dbService.getAppConfig();
      setAppConfig(config);
    } catch (err) {
      alert("Error al guardar configuración");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.alias?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isExpired = (expiry: string | undefined) => {
    if (!expiry) return true;
    return new Date(expiry) < new Date();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest text-xs">Cargando Tablero de Control...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <ShieldAlert className="text-rose-600" size={32} />
            Panel Superusuario
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">Gestión global de negocios y suscripciones.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white dark:bg-slate-900 px-6 py-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Negocios</p>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{profiles.length}</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Building size={24} />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 px-6 py-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pendientes</p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-500">{requests.filter(r => r.status === SubscriptionStatus.PENDING).length}</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 rounded-2xl">
              <Bell size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 bg-slate-200/50 dark:bg-slate-800/50 rounded-2xl w-full max-w-xl mx-auto lg:mx-0">
        <button 
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'requests' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          <CreditCard size={16} /> Pagos {requests.filter(r => r.status === SubscriptionStatus.PENDING).length > 0 && `(${requests.filter(r => r.status === SubscriptionStatus.PENDING).length})`}
        </button>
        <button 
          onClick={() => setActiveTab('profiles')}
          className={`flex-1 py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'profiles' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          <Users size={16} /> Negocios
        </button>
        <button 
          onClick={() => setActiveTab('archived')}
          className={`flex-1 py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'archived' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          <Archive size={16} /> Archivados {profiles.filter(p => p.archived).length > 0 && `(${profiles.filter(p => p.archived).length})`}
        </button>
      </div>

      {activeTab === 'requests' ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-xl">
             <div className="p-8 border-b border-slate-100 dark:border-slate-800">
               <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter flex items-center gap-2">
                 <HistoryIcon size={22} className="text-blue-500" />
                 Solicitudes de Suscripción
               </h3>
             </div>
             
             <div className="divide-y divide-slate-100 dark:divide-slate-800">
               {requests.map(req => (
                 <div key={req.id} className={`p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-all ${req.status === SubscriptionStatus.PENDING ? 'bg-amber-50/20 dark:bg-amber-900/10' : 'opacity-60'}`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-4 rounded-3xl shrink-0 ${req.status === SubscriptionStatus.PENDING ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : req.status === SubscriptionStatus.CONFIRMED ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                         <DollarSign size={28} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                           <h4 className="font-black text-slate-800 dark:text-slate-100 text-lg uppercase tracking-tight">{req.businessName}</h4>
                           <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                             req.status === SubscriptionStatus.PENDING ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                             req.status === SubscriptionStatus.CONFIRMED ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                             'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                           }`}>
                             {req.status}
                           </span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-2">
                           <div>
                             <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Plan</p>
                             <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{req.months} Mes{req.months > 1 ? 'es' : ''}</p>
                           </div>
                           <div>
                             <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Monto</p>
                             <p className="text-xs font-black text-slate-800 dark:text-slate-100">${req.amountUsd}</p>
                           </div>
                           <div>
                             <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Método</p>
                             <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase">{req.method}</p>
                           </div>
                           <div>
                             <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Referencia</p>
                             <p className="text-xs font-black text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg inline-block font-mono">{req.reference}</p>
                           </div>
                        </div>
                        <p className="text-[9px] font-bold text-slate-300 dark:text-slate-600 mt-3 uppercase tracking-widest">{new Date(req.date).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                       {req.status === SubscriptionStatus.PENDING && (
                         <>
                           <button 
                             onClick={() => handleProcessRequest(req.id, SubscriptionStatus.DECLINED)}
                             className="flex-1 lg:flex-none px-6 py-3 bg-white dark:bg-slate-800 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all shadow-sm"
                           >
                             Declinar
                           </button>
                           <button 
                             onClick={() => handleProcessRequest(req.id, SubscriptionStatus.CONFIRMED)}
                             className="flex-1 lg:flex-none px-8 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none hover:shadow-xl transition-all active:scale-95"
                           >
                             Confirmar Pago
                           </button>
                         </>
                       )}
                       {req.status !== SubscriptionStatus.PENDING && (
                         <div className="flex items-center gap-2 text-slate-400 dark:text-slate-600">
                           {req.status === SubscriptionStatus.CONFIRMED ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                           <span className="text-[10px] font-black uppercase tracking-widest">Procesado</span>
                         </div>
                       )}
                    </div>
                  </div>
               ))}
               {requests.length === 0 && (
                 <div className="p-20 text-center">
                    <Activity className="mx-auto text-slate-100 dark:text-slate-800 mb-4" size={48} />
                    <p className="text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest text-xs">No hay solicitudes de pago aún</p>
                 </div>
               )}
             </div>
          </div>
        </div>
      ) : (activeTab === 'profiles' || activeTab === 'archived') ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Configuración de Pagos Global (Solo en tab de perfiles activos) */}
          {activeTab === 'profiles' && appConfig && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-xl">
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter mb-6 flex items-center gap-2">
                <CreditCard className="text-emerald-500" size={24} />
                Datos de Pago para Clientes
              </h2>
              <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Banco</label>
                  <input 
                    type="text" 
                    value={appConfig.bankName}
                    onChange={(e) => setAppConfig({...appConfig, bankName: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nro de Cuenta</label>
                  <input 
                    type="text" 
                    value={appConfig.accountNumber}
                    onChange={(e) => setAppConfig({...appConfig, accountNumber: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nro de Teléfono</label>
                  <input 
                    type="text" 
                    value={appConfig.phone}
                    onChange={(e) => setAppConfig({...appConfig, phone: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Cédula de Identidad</label>
                  <input 
                    type="text" 
                    value={appConfig.idNumber}
                    onChange={(e) => setAppConfig({...appConfig, idNumber: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Binance User/ID</label>
                  <input 
                    type="text" 
                    value={appConfig.binanceUser}
                    onChange={(e) => setAppConfig({...appConfig, binanceUser: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200" 
                  />
                </div>
                <div className="flex items-end">
                  <button 
                    type="submit" 
                    disabled={isSavingConfig}
                    className="w-full bg-slate-900 dark:bg-blue-600 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
                  >
                    {isSavingConfig ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Guardar Datos de Pago
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" size={20} />
            <input 
              type="text" 
              placeholder={`Buscar en ${activeTab === 'profiles' ? 'negocios activos' : 'archivados'}...`}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 transition-all font-medium shadow-sm outline-none text-slate-900 dark:text-slate-100"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredProfiles
              .filter(p => activeTab === 'archived' ? p.archived : !p.archived)
              .map(profile => {
              const expired = isExpired(profile.subscriptionExpires);
              const isUpdating = updatingId === profile.id;

              return (
                <div key={profile.id} className={`bg-white dark:bg-slate-900 border rounded-[2.5rem] p-6 lg:p-8 shadow-xl transition-all relative overflow-hidden ${profile.isBanned ? 'border-rose-200 dark:border-rose-900/30 bg-rose-50/10 dark:bg-rose-900/10' : 'border-slate-100 dark:border-slate-800 hover:border-blue-100 dark:hover:border-blue-900/50'}`}>
                  
                  {isUpdating && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
                      <Loader2 className="animate-spin text-blue-600" size={32} />
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Info principal */}
                    <div className="lg:col-span-4 space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 truncate">{profile.businessName}</h2>
                          {profile.isBanned && <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Baneado</span>}
                          {profile.archived && <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Archivado</span>}
                        </div>
                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500">{profile.email}</p>
                        <p className="text-[10px] text-slate-300 dark:text-slate-600 font-mono mt-1 select-all">{profile.id}</p>
                      </div>

                      <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Alias del Negocio</label>
                          <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-700" size={14} />
                            <input 
                              type="text" 
                              placeholder="Sin alias" 
                              defaultValue={profile.alias}
                              onBlur={(e) => {
                                if (e.target.value !== profile.alias) handleUpdate(profile.id, { alias: e.target.value });
                              }}
                              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl outline-none font-bold text-slate-700 dark:text-slate-200 text-sm focus:bg-white dark:focus:bg-slate-800 focus:border-blue-200 dark:focus:border-blue-800 transition-all"
                            />
                          </div>
                        </div>
                        {profile.lastPaymentRef && (
                          <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-xl p-3">
                            <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Última Referencia de Pago</p>
                            <p className="text-xs font-black text-emerald-800 dark:text-emerald-200">{profile.lastPaymentRef}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Suscripción */}
                    <div className="lg:col-span-4 flex flex-col justify-center border-l border-r border-slate-100 dark:border-slate-800 px-8">
                      <div className="text-center space-y-4">
                        <div className={`mx-auto w-16 h-16 rounded-3xl flex items-center justify-center ${expired ? 'bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
                          {expired ? <Clock size={32} /> : <CheckCircle2 size={32} />}
                        </div>
                        <div>
                          <p className={`text-xs font-black uppercase tracking-widest ${expired ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {expired ? 'Suscripción Expirada' : 'Suscripción Activa'}
                          </p>
                          <input 
                            type="date" 
                            defaultValue={profile.subscriptionExpires ? new Date(profile.subscriptionExpires).toISOString().split('T')[0] : ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                const date = new Date(val);
                                date.setHours(23, 59, 59, 999);
                                handleUpdate(profile.id, { subscriptionExpires: date.toISOString() });
                              }
                            }}
                            className="w-full text-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl py-2 font-black text-slate-800 dark:text-slate-100 mt-2 outline-none focus:border-blue-200 dark:focus:border-blue-800 transition-all"
                          />
                          <button 
                            onClick={() => addMonths(profile.id, profile.subscriptionExpires, 1)}
                            className="w-full mt-2 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 py-2 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 border border-emerald-100 dark:border-emerald-800"
                          >
                            <PlusCircle size={14} /> +1 MES
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Acciones Rápidas */}
                    <div className="lg:col-span-4 flex flex-col justify-center space-y-3">
                        <button 
                          onClick={() => handleUpdate(profile.id, { isBanned: !profile.isBanned })}
                          className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm ${profile.isBanned ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40'}`}
                        >
                          {profile.isBanned ? <Unlock size={18} /> : <Lock size={18} />}
                          {profile.isBanned ? 'Activar Cuenta' : 'Suspender Cuenta'}
                        </button>
                        
                        <button 
                          onClick={() => handleUpdate(profile.id, { archived: !profile.archived })}
                          className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm ${profile.archived ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                          {profile.archived ? <RotateCcw size={18} /> : <Archive size={18} />}
                          {profile.archived ? 'Restaurar Negocio' : 'Archivar Negocio'}
                        </button>
                        
                        <button 
                          onClick={() => handleUpdate(profile.id, { lastPaymentRef: '' })}
                          className="w-full py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                        >
                          Limpiar Referencia
                        </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredProfiles.filter(p => activeTab === 'archived' ? p.archived : !p.archived).length === 0 && (
              <div className="py-32 text-center bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
                {activeTab === 'archived' ? <Archive className="mx-auto text-slate-100 dark:text-slate-800 mb-4" size={64} /> : <Users className="mx-auto text-slate-100 dark:text-slate-800 mb-4" size={64} />}
                <p className="text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest text-sm">
                  {activeTab === 'archived' ? 'No hay negocios archivados' : 'No se encontraron negocios'}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminView;
