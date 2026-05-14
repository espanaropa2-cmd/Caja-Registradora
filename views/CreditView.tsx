
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dbService } from '../services/dbService';
import { SaleStatus, Sale, Client, CreditPayment, PaymentMethod } from '../types';
import { CreditCard, AlertCircle, RefreshCw, Loader2, DollarSign, CheckCircle2, Circle, Calendar, Hash, UserCircle, X, ChevronRight, History, Smartphone, Banknote } from 'lucide-react';

interface CreditViewProps {
  useParallelRate?: boolean;
}

const CreditView: React.FC<CreditViewProps> = ({ useParallelRate = false }) => {
  const [allClientsForLookup, setAllClientsForLookup] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);
  const [isAbonoOpen, setIsAbonoOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string>>(new Set());
  const [abonoAmountStr, setAbonoAmountStr] = useState<string>('');
  const [abonoAmountMode, setAbonoAmountMode] = useState<'USD' | 'VES'>('USD');
  const isTypingAbono = useRef(false);
  const [rate, setRate] = useState<number>(0);
  const [abonoMethod, setAbonoMethod] = useState<PaymentMethod>(PaymentMethod.EFECTIVO);
  const [abonoRef, setAbonoRef] = useState('');
  const [loading, setLoading] = useState(false);

  // Derived in-memory value in USD for processing
  const abonoAmountInUSD = useMemo(() => {
    const num = Number(abonoAmountStr || 0);
    return abonoAmountMode === 'USD' ? num : num / (rate || 1);
  }, [abonoAmountStr, abonoAmountMode, rate]);

  const fetchData = async () => {
    try {
      const [allSales, allClients, allPayments, currentRate] = await Promise.all([
        dbService.getSales(),
        dbService.getClients(),
        dbService.getCreditPayments(),
        import('../services/exchangeService').then(m => m.fetchExchangeRate(useParallelRate ? 'paralelo' : 'oficial'))
      ]);
      setSales(allSales.filter(s => s.status === SaleStatus.CREDIT && (s.total - s.amountPaid) > 0));
      setAllClientsForLookup(allClients); // Guardar todos para búsqueda de nombres
      setClients(allClients.filter(c => c.currentDebt > 0));
      setCreditPayments(allPayments);
      setRate(currentRate);
    } catch (err) {
      console.error("Error fetching credit data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [useParallelRate]);

  const handleRegisterAbono = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedClient || selectedSaleIds.size === 0 || abonoAmountInUSD <= 0) return;
    
    setLoading(true);
    try {
      await dbService.processDistributedAbono(
        selectedClient.id, 
        abonoAmountInUSD, 
        Array.from(selectedSaleIds),
        { method: abonoMethod, reference: abonoMethod === PaymentMethod.PAGOMOVIL ? abonoRef : undefined }
      );
      await fetchData();
      setIsAbonoOpen(false);
      resetModal();
      alert('Abono procesado con éxito.');
    } catch (err) {
      console.error(err);
      alert('Error al procesar el abono.');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setSelectedClient(null);
    setSelectedSaleIds(new Set());
    setAbonoAmountStr('');
    setAbonoAmountMode('USD');
    setAbonoMethod(PaymentMethod.EFECTIVO);
    setAbonoRef('');
  };

  const toggleSaleSelection = (id: string) => {
    const next = new Set(selectedSaleIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSaleIds(next);
  };

  const pendingSalesForClient = useMemo(() => {
    if (!selectedClient) return [];
    return sales.filter(s => s.clientId === selectedClient.id);
  }, [selectedClient, sales]);

  const totalOwedBySelection = useMemo(() => {
    return pendingSalesForClient
      .filter(s => selectedSaleIds.has(s.id))
      .reduce((acc, s) => acc + (s.total - s.amountPaid), 0);
  }, [pendingSalesForClient, selectedSaleIds]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Cobranzas</h1>
          <p className="text-xs lg:text-base text-slate-500 dark:text-slate-400 font-medium">Gestión de créditos y saldos pendientes.</p>
        </div>
        <button 
          onClick={() => { resetModal(); setIsAbonoOpen(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 lg:py-4 rounded-2xl font-black text-xs lg:text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 dark:shadow-none transition-all active:scale-95"
        >
          <DollarSign size={18} /> Registrar Abono
        </button>
      </div>

      {/* Vista de Tabla/Cards de Clientes Deudores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <UserCircle size={18} className="text-blue-500" /> Clientes con Deuda
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clients.map(client => (
              <div key={client.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-emerald-200 dark:hover:border-emerald-900 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-lg">
                    {client.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-black text-slate-800 dark:text-slate-100 leading-tight block">{client.name}</span>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{client.phone || 'Sin contacto'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Deuda Total</p>
                  <span className="font-black text-rose-600 dark:text-rose-400 text-lg tracking-tight">${client.currentDebt.toLocaleString()}</span>
                </div>
              </div>
            ))}
            {clients.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
                <CreditCard className="mx-auto text-slate-100 dark:text-slate-800 mb-2" size={48} />
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Sin deudas pendientes</p>
              </div>
            )}
          </div>
        </div>

        {/* Historial de Abonos Recientes */}
        <div className="space-y-4">
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <History size={18} className="text-emerald-500" /> Historial de Abonos
          </h2>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm overflow-hidden flex flex-col max-h-[500px]">
             <div className="overflow-y-auto hide-scrollbar p-4 space-y-3">
                {creditPayments.map(payment => {
                  const client = allClientsForLookup.find(c => c.id === payment.clientId);
                  return (
                    <div key={payment.id} className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-2xl flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-white dark:bg-slate-700 rounded-xl text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-100 dark:border-slate-600">
                             <DollarSign size={16} />
                          </div>
                          <div>
                             <p className="text-xs font-black text-slate-800 dark:text-slate-200">{client?.name || 'Cliente'}</p>
                             <div className="flex items-center gap-2">
                               <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{new Date(payment.date).toLocaleDateString()}</p>
                               <span className="text-[8px] font-black bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 uppercase tracking-tighter">
                                 {payment.method}
                                 {payment.reference ? ` (${payment.reference})` : ''}
                               </span>
                             </div>
                          </div>
                       </div>
                       <div className="text-right">
                          <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm tracking-tight">+${payment.amount.toLocaleString()}</span>
                       </div>
                    </div>
                  );
                })}
                {creditPayments.length === 0 && (
                  <div className="py-12 text-center">
                    <History className="mx-auto text-slate-100 dark:text-slate-800 mb-2" size={32} />
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">No hay abonos registrados</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Modal de Abono - RE-DISEÑADO PARA MÓVIL (Compacto) */}
      {isAbonoOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 text-slate-800 dark:text-slate-100">
          <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setIsAbonoOpen(false)} />
          <div className="relative bg-white dark:bg-slate-950 w-full max-w-xl h-[95vh] sm:h-auto sm:max-h-[90vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 flex flex-col border border-slate-100 dark:border-slate-800">
            
            {/* Cabecera Compacta */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10 transition-colors">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter flex items-center gap-2">
                <DollarSign className="text-emerald-500" size={18} /> Conciliación Rápida
              </h3>
              <button onClick={() => setIsAbonoOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleRegisterAbono} className="p-5 lg:p-8 space-y-4 overflow-y-auto hide-scrollbar flex-1 flex flex-col">
              
              {/* Inputs Principales Compactos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">1. Cliente</label>
                  <select 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 transition-colors"
                    onChange={(e) => {
                      setSelectedClient(clients.find(c => c.id === e.target.value) || null);
                      setSelectedSaleIds(new Set());
                    }}
                    value={selectedClient?.id || ''}
                  >
                    <option value="">Seleccionar Moroso</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (${c.currentDebt})</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">2. Monto Abono</label>
                    {rate > 0 && (
                      <button 
                        type="button"
                        onClick={() => {
                           const currentUSD = abonoAmountInUSD;
                           const newMode = abonoAmountMode === 'USD' ? 'VES' : 'USD';
                           setAbonoAmountMode(newMode);
                           if (newMode === 'VES') {
                             setAbonoAmountStr(currentUSD === 0 ? '' : (currentUSD * rate).toFixed(2));
                           } else {
                             setAbonoAmountStr(currentUSD === 0 ? '' : currentUSD.toFixed(2));
                           }
                        }}
                        className={`text-[8.5px] font-black uppercase flex items-center gap-1 transition-all ${abonoAmountMode === 'USD' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}
                      >
                         Modo: {abonoAmountMode === 'USD' ? 'USD ($)' : 'VES (Bs.)'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                      name="amount" 
                      type="number" 
                      step="0.01" 
                      required 
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-black text-lg transition-all focus:ring-2 ${abonoAmountMode === 'USD' ? 'text-slate-800 dark:text-slate-100 focus:ring-blue-500' : 'text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500'}`} 
                      placeholder="0.00"
                      value={abonoAmountStr}
                      onFocus={() => isTypingAbono.current = true}
                      onBlur={() => isTypingAbono.current = false}
                      onChange={(e) => setAbonoAmountStr(e.target.value)}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                       <p className={`text-[10px] font-black uppercase opacity-20 ${abonoAmountMode === 'USD' ? 'text-blue-500 dark:text-blue-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                         {abonoAmountMode === 'USD' ? 'USD' : 'Bs.'}
                       </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Método de Pago para Abono */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">3. Método de Pago</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    type="button"
                    onClick={() => setAbonoMethod(PaymentMethod.EFECTIVO)}
                    className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${abonoMethod === PaymentMethod.EFECTIVO ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'}`}
                  >
                    <Banknote size={18} />
                    <span className="text-[8px] font-black mt-1 uppercase">Efectivo</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAbonoMethod(PaymentMethod.PUNTO)}
                    className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${abonoMethod === PaymentMethod.PUNTO ? 'bg-blue-500 border-blue-400 text-white' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'}`}
                  >
                    <CreditCard size={18} />
                    <span className="text-[8px] font-black mt-1 uppercase">Punto</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAbonoMethod(PaymentMethod.PAGOMOVIL)}
                    className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${abonoMethod === PaymentMethod.PAGOMOVIL ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'}`}
                  >
                    <Smartphone size={18} />
                    <span className="text-[8px] font-black mt-1 uppercase">Móvil</span>
                  </button>
                </div>
              </div>

              {abonoMethod === PaymentMethod.PAGOMOVIL && (
                 <div className="animate-in slide-in-from-top-2">
                   <input 
                    type="text" 
                    placeholder="Referencia PagoMóvil (Opcional)" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-black text-sm text-slate-800 dark:text-slate-100 transition-colors" 
                    value={abonoRef} 
                    onChange={(e) => setAbonoRef(e.target.value)} 
                  />
                 </div>
              )}

              {selectedClient && (
                <div className="space-y-2 flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">4. Aplicar a Facturas</label>
                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">
                      {selectedSaleIds.size} seleccionada(s)
                    </span>
                  </div>
                  
                  {/* Lista de Facturas - ESTILO DENSO */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-y-auto p-2 space-y-1 flex-1 hide-scrollbar">
                    {pendingSalesForClient.map(sale => {
                      const isSelected = selectedSaleIds.has(sale.id);
                      const saldo = sale.total - sale.amountPaid;
                      
                      return (
                        <div 
                          key={sale.id}
                          onClick={() => toggleSaleSelection(sale.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected 
                              ? 'bg-white dark:bg-slate-800 border-emerald-500 dark:border-emerald-500 shadow-sm ring-2 ring-emerald-50 dark:ring-emerald-900/10' 
                              : 'bg-white/50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                             <div className={isSelected ? 'text-emerald-500' : 'text-slate-200 dark:text-slate-700'}>
                               {isSelected ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                             </div>
                             <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-800 dark:text-slate-100">#{sale.id.slice(0, 5)}</span>
                                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{new Date(sale.date).toLocaleDateString()}</span>
                                </div>
                                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Total: ${sale.total.toLocaleString()}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <span className={`text-sm font-black ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                               ${saldo.toLocaleString()}
                             </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Pie de Modal Compacto */}
              <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-4 text-white space-y-1">
                <div className="flex justify-between items-center opacity-50">
                   <span className="text-[8px] font-black uppercase tracking-widest">Deuda Seleccionada</span>
                   <span className="text-[10px] font-bold">${totalOwedBySelection.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Restante estimado</span>
                   <span className="text-xl font-black text-emerald-400">
                     ${Math.max(0, totalOwedBySelection - abonoAmountInUSD).toLocaleString()}
                   </span>
                 </div>
              </div>

              <button 
                disabled={loading || !selectedClient || selectedSaleIds.size === 0 || abonoAmountInUSD <= 0} 
                type="submit" 
                className="w-full bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-xl font-black text-base shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-30 uppercase tracking-widest"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Finalizar Pago'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditView;
