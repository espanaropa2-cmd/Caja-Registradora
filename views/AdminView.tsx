
import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { UserProfile } from '../types';
import { 
  Users, 
  ShieldAlert, 
  Calendar, 
  Phone, 
  Tag, 
  CheckCircle2, 
  XCircle, 
  PlusCircle,
  Search,
  Loader2,
  Clock,
  Lock,
  Unlock,
  Building
} from 'lucide-react';

const AdminView: React.FC = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchProfiles = async () => {
    try {
      const data = await dbService.getAllProfiles();
      setProfiles(data);
    } catch (err) {
      console.error("Error fetching profiles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleUpdate = async (id: string, updates: Partial<UserProfile>) => {
    setUpdatingId(id);
    try {
      await dbService.updateProfileByAdmin(id, updates);
      await fetchProfiles();
    } catch (err) {
      alert("Error al actualizar perfil");
    } finally {
      setUpdatingId(null);
    }
  };

  const addMonths = (id: string, currentExp: string | undefined, months: number) => {
    const baseDate = currentExp ? new Date(currentExp) : new Date();
    // Si la suscripción ya expiró, empezamos desde hoy
    const startDate = baseDate < new Date() ? new Date() : baseDate;
    
    const newDate = new Date(startDate);
    newDate.setMonth(newDate.getMonth() + months);
    handleUpdate(id, { subscriptionExpires: newDate.toISOString() });
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
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Cargando Tablero de Control...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <ShieldAlert className="text-rose-600" size={32} />
            Panel Superusuario
          </h1>
          <p className="text-slate-500 font-medium tracking-tight">Gestión global de negocios y suscripciones.</p>
        </div>
        <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Negocios Registrados</p>
            <p className="text-2xl font-black text-slate-800">{profiles.length}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Building size={24} />
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar negocio por nombre, email o alias..." 
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-3xl focus:ring-4 focus:ring-blue-50 transition-all font-medium shadow-sm outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredProfiles.map(profile => {
          const expired = isExpired(profile.subscriptionExpires);
          const isUpdating = updatingId === profile.id;

          return (
            <div key={profile.id} className={`bg-white border rounded-[2.5rem] p-6 lg:p-8 shadow-xl transition-all relative overflow-hidden ${profile.isBanned ? 'border-rose-200 bg-rose-50/10' : 'border-slate-100 hover:border-blue-100'}`}>
              
              {isUpdating && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
                  <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Info principal */}
                <div className="lg:col-span-4 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-black text-slate-800 truncate">{profile.businessName}</h2>
                      {profile.isBanned && <span className="bg-rose-100 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Baneado</span>}
                    </div>
                    <p className="text-sm font-bold text-slate-400">{profile.email}</p>
                    <p className="text-[10px] text-slate-300 font-mono mt-1 select-all">{profile.id}</p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Alias del Negocio</label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                        <input 
                          type="text" 
                          placeholder="Sin alias" 
                          defaultValue={profile.alias}
                          onBlur={(e) => {
                            if (e.target.value !== profile.alias) handleUpdate(profile.id, { alias: e.target.value });
                          }}
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-slate-700 text-sm focus:bg-white focus:border-blue-200 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono Contacto</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                        <input 
                          type="text" 
                          placeholder="Sin teléfono" 
                          defaultValue={profile.contactPhone}
                          onBlur={(e) => {
                            if (e.target.value !== profile.contactPhone) handleUpdate(profile.id, { contactPhone: e.target.value });
                          }}
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-slate-700 text-sm focus:bg-white focus:border-blue-200 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Suscripción */}
                <div className="lg:col-span-4 flex flex-col justify-center border-l border-r border-slate-100 px-8">
                  <div className="text-center space-y-4">
                    <div className={`mx-auto w-16 h-16 rounded-3xl flex items-center justify-center ${expired ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {expired ? <Clock size={32} /> : <CheckCircle2 size={32} />}
                    </div>
                    <div>
                      <p className={`text-xs font-black uppercase tracking-widest ${expired ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {expired ? 'Suscripción Expirada' : 'Suscripción Activa'}
                      </p>
                      <p className="text-lg font-black text-slate-800 mt-1">
                        {profile.subscriptionExpires ? new Date(profile.subscriptionExpires).toLocaleDateString() : 'NUNCA'}
                      </p>
                      {!expired && profile.subscriptionExpires && (
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                          Vence en {Math.ceil((new Date(profile.subscriptionExpires).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} días
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones Rápidas */}
                <div className="lg:col-span-4 flex flex-col justify-between space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Extender Suscripción</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => addMonths(profile.id, profile.subscriptionExpires, 1)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border border-emerald-100 shadow-sm"
                      >
                        <PlusCircle size={14} /> +1 MES
                      </button>
                      <button 
                        onClick={() => addMonths(profile.id, profile.subscriptionExpires, 3)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border border-blue-100 shadow-sm"
                      >
                        <PlusCircle size={14} /> +3 MESES
                      </button>
                      <button 
                        onClick={() => addMonths(profile.id, profile.subscriptionExpires, 6)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border border-indigo-100 shadow-sm"
                      >
                        <PlusCircle size={14} /> +6 MESES
                      </button>
                      <button 
                        onClick={() => addMonths(profile.id, profile.subscriptionExpires, 12)}
                        className="bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg"
                      >
                        <PlusCircle size={14} /> +1 AÑO
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleUpdate(profile.id, { isBanned: !profile.isBanned })}
                      className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm ${profile.isBanned ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
                    >
                      {profile.isBanned ? <Unlock size={16} /> : <Lock size={16} />}
                      {profile.isBanned ? 'Quitar Ban' : 'Añadir Ban'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredProfiles.length === 0 && (
          <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
            <Users className="mx-auto text-slate-100 mb-4" size={64} />
            <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No se encontraron negocios</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminView;
