
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Save, ExternalLink, Database } from 'lucide-react';

interface SettingsViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user, onUpdateUser }) => {
  const [formData, setFormData] = useState({
    businessName: user.businessName,
    email: user.email,
    sheetsUrl: user.sheetsUrl || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      ...user,
      ...formData
    });
    alert('Configuración guardada exitosamente.');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Configuración</h1>
        <p className="text-slate-500">Personaliza tu negocio y sincronización.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Database size={20} className="text-blue-500" />
            Información del Negocio
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Nombre Comercial</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.businessName}
                onChange={e => setFormData({...formData, businessName: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Email de Contacto</label>
              <input 
                type="email" 
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <ExternalLink size={20} className="text-emerald-500" />
            Sincronización con Google Sheets
          </h3>
          <p className="text-sm text-slate-500">Pega la URL de tu Web App de Google Apps Script para respaldar tus datos automáticamente.</p>
          <input 
            type="url" 
            placeholder="https://script.google.com/macros/s/.../exec"
            className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.sheetsUrl}
            onChange={e => setFormData({...formData, sheetsUrl: e.target.value})}
          />
        </div>

        <div className="flex items-center justify-end">
          <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg">
            <Save size={20} /> Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsView;
