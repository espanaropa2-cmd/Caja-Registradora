
import React, { useState, useEffect } from 'react';
import { UserProfile, AppConfig, AppChangelog } from '../types';
import { Save, ExternalLink, Database, CreditCard, Hash, Loader2, Send, Sun, Moon, LogOut, Sparkles, Clock, Check, BookOpen } from 'lucide-react';
import { dbService } from '../services/dbService';

interface SettingsViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  onLogout: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user, onUpdateUser, onLogout }) => {
  const [formData, setFormData] = useState({
    businessName: user.businessName,
    email: user.email,
    sheetsUrl: user.sheetsUrl || '',
    useParallelRate: user.useParallelRate || false,
    isDarkMode: user.isDarkMode || false
  });

  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [rates, setRates] = useState<{ oficial: number; paralelo: number }>({ oficial: 0, paralelo: 0 });
  const [rate, setRate] = useState<number>(0);
  const [paymentData, setPaymentData] = useState({
    months: 1,
    reference: '',
    method: 'Pago Móvil'
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [changelogs, setChangelogs] = useState<AppChangelog[]>([]);

  useEffect(() => {
    dbService.getAppChangelogs().then(setChangelogs);
  }, []);

  useEffect(() => {
    dbService.getAppConfig().then(config => {
      setAppConfig(config);
      import('../services/exchangeService').then(m => {
        Promise.all([
          m.fetchExchangeRate('oficial'),
          m.fetchExchangeRate('paralelo')
        ]).then(([oficial, paralelo]) => {
          setRates({ oficial, paralelo });
          // Seteamos la tasa general para el resto de la vista de configuración
          setRate(user.useParallelRate ? paralelo : oficial);
        });
      });
    });
  }, [user.useParallelRate]);

  const calculateDisplayPrices = () => {
    const months = paymentData.months;
    const effectiveMonths = months === 12 ? 10 : months;
    
    const totalPriceUsd = 12 * effectiveMonths;
    const oficialRate = rates.oficial || 36.55;
    const totalPriceVes = totalPriceUsd * oficialRate;

    return {
      usd: totalPriceUsd,
      ves: totalPriceVes
    };
  };

  const { usd: totalPriceUsd, ves: totalPriceVes } = calculateDisplayPrices();

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

  const defaultChangelogs: AppChangelog[] = [
    {
      id: 'v1.3.0',
      version: 'v1.3.0',
      releaseDate: '2026-05-21',
      title: 'Auditoría Inteligente con IA y Changelog Integrado',
      description: 'Lanzamiento de la suite de análisis de datos financieros con Gemini AI y administración inteligente del sistema.',
      changes: [
        'Auditoría Financiera por IA: El sistema cruza productos, costos, ventas y egresos históricos para detectar errores de tipeo y utilidades negativas.',
        'Control de Acceso Superusuario: Opción inteligente en el panel de administración para habilitar/deshabilitar la IA para cada negocio.',
        'Registro de Actualizaciones (Changelog): Nueva interfaz unificada para supervisar el historial de mejoras de Caja Pro.',
        'Soporte Avanzado de Almacenamiento: Capacidad mejorada en Express para procesar solicitudes de auditoría de gran escala.'
      ]
    },
    {
      id: 'v1.2.0',
      version: 'v1.2.0',
      releaseDate: '2026-04-10',
      title: 'Fidelidad Histórica y Reajuste de Utilidad Real',
      description: 'Optimizaciones en la contabilidad general para mejorar el cálculo de caja chica y registros de precios históricos.',
      changes: [
        'Cálculo Preciso de Utilidad Neta: Rediseñado para basarse estrictamente en la suma de la ganancia real de cada unidad vendida (precio de venta - costo de compra).',
        'Fijación permanente de costos de compra: Cada venta guarda el coste por unidad al instante de realizarse, evitando que cambios futuros en inventario alteren el pasado.',
        'Efectivo Real Histórico: La fórmula de caja principal ahora descuenta los egresos e importes por cobrar hasta la fecha exacta analizada por el filtro del dashboard.'
      ]
    },
    {
      id: 'v1.1.0',
      version: 'v1.1.0',
      releaseDate: '2026-02-15',
      title: 'Doble Tasa Interactiva y Puerta de Seguridad PIN',
      description: 'Actualizaciones de seguridad y soporte multomoneda avanzadas.',
      changes: [
        'Capa de Bloqueo PIN: Puerta de seguridad para proteger el acceso a las visualizaciones de reportes de utilidades del dashboard.',
        'Preguntas de Recuperación Secretas: Pregunta y respuesta secreta en el panel de configuración para recuperar accesos rápidamente.',
        'Tasa Triple en Punto de Venta: Soporte mejorado que desglosa en tiempo real pagos equivalentes en Dólares, Bolívares y Combinados.'
      ]
    },
    {
      id: 'v1.0.0',
      version: 'v1.0.0',
      releaseDate: '2026-01-01',
      title: 'Lanzamiento Oficial de Caja Registradora Cloud',
      description: 'Plataforma premium para la administración integral de ventas, control de inventario, pasarela de cobros en dólares/bolívares, y nube integrada en Supabase.',
      changes: [
        'Sincronización en la Nube: Copias de seguridad automáticas de base de datos bidireccionales mediante Supabase y Google Sheets.',
        'Gestión Integral: Inventario en tiempo real, catálogo de productos, cuentas por cobrar, control de fiados y egresos.',
        'Estadísticas Dinámicas: Paneles ejecutivos con charts interactivos de rendimiento semanal, mensual y anual.'
      ]
    }
  ];

  const allChangelogs = [...changelogs, ...defaultChangelogs];

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Configuración</h1>
          <p className="text-sm lg:text-lg text-slate-500 dark:text-slate-400 font-medium">Personaliza tu negocio y gestiona tu suscripción.</p>
        </div>
      </div>

      {/* Declarar Pago */}
      <div className="bg-white dark:bg-slate-900 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
              <CreditCard size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Renovar Suscripción</h3>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-1">Suscripción Premium</p>
            </div>
          </div>
          <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${user.subscriptionExpires ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400'}`}>
            {user.subscriptionExpires ? `Vence: ${new Date(user.subscriptionExpires).toLocaleDateString()}` : 'Sin Suscripción'}
          </div>
        </div>

        {appConfig ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 transition-colors flex flex-col">
              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> Datos de Pago
              </h4>
              <div className="space-y-4 flex-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Banco Receptor</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{appConfig.bankName}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Número de Cuenta</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono">{appConfig.accountNumber}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Teléfono / PagoMóvil</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{appConfig.phone}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Cédula / RIF</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{appConfig.idNumber}</span>
                  </div>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700/50">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest leading-none mb-1">Binance Pay (ID)</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">{appConfig.binanceUser}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleDeclarePayment} className="flex flex-col h-full bg-slate-900 dark:bg-slate-800 rounded-[2rem] p-8 text-white shadow-xl shadow-slate-200 dark:shadow-none space-y-6">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Send size={14} /> Reportar mi Pago
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Plan</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-800 dark:bg-slate-900 border border-slate-700 dark:border-slate-800 rounded-xl font-bold text-white text-xs outline-none focus:border-blue-400 transition-colors"
                    value={paymentData.months}
                    onChange={e => setPaymentData({...paymentData, months: parseInt(e.target.value)})}
                  >
                    {[1, 2, 3, 4, 5, 6, 12].map(m => (
                      <option key={m} value={m} className="bg-slate-900">{m} Mes{m > 1 ? 'es' : ''} {m === 12 ? '(Paga 10)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Método</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-800 dark:bg-slate-900 border border-slate-700 dark:border-slate-800 rounded-xl font-bold text-white text-xs outline-none focus:border-blue-400 transition-colors"
                    value={paymentData.method}
                    onChange={e => setPaymentData({...paymentData, method: e.target.value})}
                  >
                    <option value="Pago Móvil" className="bg-slate-900">Pago Móvil</option>
                    <option value="Binance" className="bg-slate-900">Binance (USDT)</option>
                    <option value="Efectivo" className="bg-slate-900">Efectivo</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-5 flex flex-col items-center justify-center">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Monto a Reportar</p>
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-black text-white">${totalPriceUsd.toFixed(2)}</span>
                  {rates.oficial > 0 && paymentData.method === 'Pago Móvil' && (
                    <span className="text-xs font-bold text-blue-300 opacity-80 mt-1">≈ Bs. {totalPriceVes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Referencia o ID Transacción</label>
                <div className="relative">
                   <Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                   <input 
                    type="text" 
                    placeholder="Ejem: 123456"
                    className="w-full pl-12 pr-4 py-4 bg-slate-800 dark:bg-slate-900 border border-slate-700 dark:border-slate-800 rounded-2xl outline-none font-bold text-white text-sm focus:border-blue-500 transition-colors"
                    value={paymentData.reference}
                    onChange={e => setPaymentData({...paymentData, reference: e.target.value})}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmittingPayment}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-900/20 active:scale-95"
              >
                {isSubmittingPayment ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                Reportar Pago Ahora
              </button>
            </form>
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="animate-spin mb-4" size={32} />
            <p className="font-bold uppercase tracking-widest text-[10px]">Cargando configuración de pagos...</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white dark:bg-slate-900 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors space-y-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/20">
              <Database size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Negocio</h3>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-1">Configuración del Perfil</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nombre Comercial</label>
              <input 
                type="text" 
                placeholder="Ej: Inversiones El Exito"
                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-500/10 transition-all"
                value={formData.businessName}
                onChange={e => setFormData({...formData, businessName: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Correo Administrador</label>
              <input 
                type="email" 
                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-slate-400 dark:text-slate-500 cursor-not-allowed"
                value={formData.email}
                readOnly
              />
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-900 dark:text-white dark:text-slate-100 uppercase tracking-widest ml-1">Tema del Sistema</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-1">Personaliza la apariencia visual de la aplicación.</p>
            </div>
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-700">
               <button
                type="button"
                onClick={() => setFormData({...formData, isDarkMode: false})}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!formData.isDarkMode ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 <Sun size={14} /> Claro
               </button>
               <button
                type="button"
                onClick={() => setFormData({...formData, isDarkMode: true})}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.isDarkMode ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 <Moon size={14} /> Oscuro
               </button>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-900 dark:text-white dark:text-slate-100 uppercase tracking-widest ml-1">Tasa de Cambio Preferida</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-1">Elige entre tasa oficial BCV o monitor paralelo.</p>
            </div>
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-700">
               <button
                type="button"
                onClick={() => setFormData({...formData, useParallelRate: false})}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!formData.useParallelRate ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 {/* Lucide Landmark icon might not be imported, let me check imports */}
                 <div className="w-3.5 h-3.5 rounded-full border-2 border-current flex items-center justify-center font-black text-[7px]">B</div> BCV
               </button>
               <button
                type="button"
                onClick={() => setFormData({...formData, useParallelRate: true})}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.useParallelRate ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 <div className="w-3.5 h-3.5 rounded-full border-2 border-current flex items-center justify-center font-black text-[8px]">$</div> Paralela
               </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
              <ExternalLink size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Sincronización</h3>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-1">Google Sheets API</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium px-1">Respalda tus datos automáticamente pegando la URL de tu Web App de Google.</p>
          <input 
            type="url" 
            placeholder="https://script.google.com/macros/s/.../exec"
            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-500/10 transition-all text-sm"
            value={formData.sheetsUrl}
            onChange={e => setFormData({...formData, sheetsUrl: e.target.value})}
          />
        </div>

        {/* REGISTRO DE ACTUALIZACIONES (CHANGELOG) */}
        <div className="bg-white dark:bg-slate-900 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-violet-600 rounded-2xl text-white shadow-lg shadow-violet-500/20">
              <BookOpen size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Historial de Actualizaciones</h3>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-1">Changelog del Sistema</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
            Supervisa las mejoras de rendimiento, parches de seguridad y nuevas integraciones de Inteligencia Artificial aplicadas al software.
          </p>

          <div className="mt-8 space-y-8 pl-1 max-h-[500px] overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            {allChangelogs.map((cl, i) => (
              <div key={cl.id || i} className="relative pl-6 border-l border-slate-100 dark:border-slate-800 space-y-3 pb-2 last:pb-0">
                {/* Timeline bullet dot */}
                <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 bg-violet-600 dark:bg-violet-400 rounded-full border border-white dark:border-slate-900 shadow-sm" />
                
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 text-xs font-black px-2.5 py-1 rounded-lg">
                    {cl.version}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Clock size={12} /> {new Date(cl.releaseDate).toLocaleDateString()}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 leading-tight">
                    {cl.title}
                  </h4>
                  {cl.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                      {cl.description}
                    </p>
                  )}
                </div>

                <ul className="space-y-1.5 pt-1">
                  {cl.changes.map((change, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                      <Check size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <button 
            type="button"
            onClick={onLogout}
            className="flex items-center gap-3 px-8 py-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-all border border-rose-100 dark:border-rose-800 shadow-sm"
          >
            <LogOut size={18} /> Cerrar Sesión
          </button>
          
          <button type="submit" className="w-full sm:w-auto bg-slate-900 dark:bg-blue-600 text-white px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-200 dark:shadow-none">
            <Save size={20} /> Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsView;
