
import React, { useState, useEffect } from 'react';
import { UserProfile, AppConfig } from '../types';
import { Save, ExternalLink, Database, CreditCard, Banknote, Hash, Loader2, Send } from 'lucide-react';
import { dbService } from '../services/dbService';

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

  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [rate, setRate] = useState<number>(0);
  const [paymentData, setPaymentData] = useState({
    months: 1,
    reference: '',
    method: 'Pago Móvil'
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  useEffect(() => {
    dbService.getAppConfig().then(setAppConfig);
    import('../services/exchangeService').then(m => m.fetchExchangeRate().then(setRate));
  }, []);

  const calculatePrice = (months: number) => {
    if (months === 12) return 100;
    return months * 10;
  };

  const totalPriceUsd = calculatePrice(paymentData.months);
  const totalPriceVes = rate > 0 ? totalPriceUsd * rate : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      ...user,
      ...formData
    });
    alert('Configuración guardada exitosamente.');
  };

  const handleDeclarePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentData.reference) return alert("Por favor ingresa la referencia del pago");
    
    setIsSubmittingPayment(true);
    try {
      await dbService.createSubscriptionRequest({
        id: crypto.randomUUID(),
        userId: user.id,
        businessName: user.businessName,
        months: paymentData.months,
        amountUsd: totalPriceUsd,
        method: paymentData.method,
        reference: paymentData.reference,
        date: new Date().toISOString()
      });
      alert("Reporte enviado exitosamente. Un administrador revisará tu pago en breve.");
      setPaymentData({ months: 1, reference: '', method: 'Pago Móvil' });
    } catch (err: any) {
      console.error("Error al enviar reporte:", err);
      alert("Error al enviar reporte de pago: " + (err.message || String(err)) + ". Asegúrate de que la tabla 'subscription_requests' exista en Supabase.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Configuración</h1>
        <p className="text-slate-500 font-medium">Personaliza tu negocio y suscripción.</p>
      </div>

      {/* Declarar Pago */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
            <CreditCard size={24} className="text-emerald-500" />
            Renovar Suscripción
          </h3>
          <div className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
            {user.subscriptionExpires ? `Vence: ${new Date(user.subscriptionExpires).toLocaleDateString()}` : 'Sin Activar'}
          </div>
        </div>

        {appConfig && (
          <div className="bg-slate-50 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4 border border-slate-100">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1">Datos de Pago</h4>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-600 flex justify-between"><span>Banco:</span> <span className="text-slate-900">{appConfig.bankName}</span></p>
                <p className="text-xs font-bold text-slate-600 flex justify-between"><span>Cuenta:</span> <span className="text-slate-900">{appConfig.accountNumber}</span></p>
                <p className="text-xs font-bold text-slate-600 flex justify-between"><span>Teléfono:</span> <span className="text-slate-900">{appConfig.phone}</span></p>
                <p className="text-xs font-bold text-slate-600 flex justify-between"><span>Cédula:</span> <span className="text-slate-900">{appConfig.idNumber}</span></p>
                <p className="text-xs font-bold text-slate-600 flex justify-between"><span>Binance:</span> <span className="text-emerald-600">{appConfig.binanceUser}</span></p>
              </div>
            </div>
            <form onSubmit={handleDeclarePayment} className="space-y-4 pt-4 md:pt-0 md:pl-6 md:border-l border-slate-200">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1">Reportar Pago</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plan</label>
                    <select 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs outline-none focus:border-emerald-300"
                      value={paymentData.months}
                      onChange={e => setPaymentData({...paymentData, months: parseInt(e.target.value)})}
                    >
                      {[1, 2, 3, 4, 5, 6, 12].map(m => (
                        <option key={m} value={m}>{m} Mes{m > 1 ? 'es' : ''} {m === 12 ? '(PROMO)' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Método</label>
                    <select 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs outline-none focus:border-emerald-300"
                      value={paymentData.method}
                      onChange={e => setPaymentData({...paymentData, method: e.target.value})}
                    >
                      <option value="Pago Móvil">Pago Móvil</option>
                      <option value="Binance">Binance (USDT)</option>
                      <option value="Efectivo">Efectivo</option>
                    </select>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex flex-col items-center justify-center">
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total a Pagar</p>
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-black text-emerald-700">${totalPriceUsd.toLocaleString()}</span>
                    {rate > 0 && paymentData.method === 'Pago Móvil' && (
                      <span className="text-[10px] font-bold text-emerald-500">Bs. {totalPriceVes.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nro de Referencia / ID</label>
                  <div className="relative">
                     <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                     <input 
                      type="text" 
                      placeholder="Ejem: 123456"
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-sm outline-none focus:border-emerald-300"
                      value={paymentData.reference}
                      onChange={e => setPaymentData({...paymentData, reference: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isSubmittingPayment}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                >
                  {isSubmittingPayment ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  Enviar Reporte de Pago
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-4">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
            <Database size={24} className="text-blue-500" />
            Información del Negocio
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Comercial</label>
              <input 
                type="text" 
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white focus:border-blue-200 transition-all"
                value={formData.businessName}
                onChange={e => setFormData({...formData, businessName: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email de Contacto</label>
              <input 
                type="email" 
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white focus:border-blue-200 transition-all"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-4">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
            <ExternalLink size={24} className="text-indigo-500" />
            Sincronización con Google Sheets
          </h3>
          <p className="text-sm text-slate-500 font-medium">Pega la URL de tu Web App de Google Apps Script para respaldar tus datos automáticamente.</p>
          <input 
            type="url" 
            placeholder="https://script.google.com/macros/s/.../exec"
            className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white focus:border-blue-200 transition-all"
            value={formData.sheetsUrl}
            onChange={e => setFormData({...formData, sheetsUrl: e.target.value})}
          />
        </div>

        <div className="flex items-center justify-end">
          <button type="submit" className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl">
            <Save size={18} /> Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsView;
