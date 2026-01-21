
import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/dbService';
import { SaleStatus, Sale, Client } from '../types';
import { CreditCard, AlertCircle, RefreshCw, Loader2, DollarSign, CheckCircle2, Circle, Calendar, Hash, UserCircle, X, ChevronRight } from 'lucide-react';

const CreditView: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isAbonoOpen, setIsAbonoOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string>>(new Set());
  const [abonoAmount, setAbonoAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [allSales, allClients] = await Promise.all([
        dbService.getSales(),
        dbService.getClients()
      ]);
      setSales(allSales.filter(s => s.status === SaleStatus.CREDIT && (s.total - s.amountPaid) > 0));
      setClients(allClients.filter(c => c.currentDebt > 0));
    } catch (err) {
      console.error("Error fetching credit data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRegisterAbono = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedClient || selectedSaleIds.size === 0 || abonoAmount <= 0) return;
    
    setLoading(true);
    try {
      await dbService.processDistributedAbono(
        selectedClient.id, 
        abonoAmount, 
        Array.from(selectedSaleIds)
      );
      await fetchData();
      setIsAbonoOpen(false);
      resetModal();
      alert('Abono procesado con éxito.');
    } catch (err) {
      alert('Error al procesar el abono.');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setSelectedClient(null);
    setSelectedSaleIds(new Set());
    setAbonoAmount(0);
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
          <h1 className="text-xl lg:text-3xl font-black text-slate-800 tracking-tight">Cobranzas</h1>
          <p className="text-xs lg:text-base text-slate-500 font-medium">Gestión de créditos y saldos pendientes.</p>
        </div>
        <button 
          onClick={() => { resetModal(); setIsAbonoOpen(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 lg:py-4 rounded-2xl font-black text-xs lg:text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95"
        >
          <DollarSign size={18} /> Registrar Abono
        </button>
      </div>

      {/* Vista de Tabla/Cards de Clientes Deudores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map(client => (
          <div key={client.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-lg">
                {client.name.charAt(0)}
              </div>
              <div>
                <span className="font-black text-slate-800 leading-tight block">{client.name}</span>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{client.phone || 'Sin contacto'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Deuda Total</p>
              <span className="font-black text-rose-600 text-lg tracking-tight">${client.currentDebt.toLocaleString()}</span>
            </div>
          </div>
        ))}
        {clients.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
            <CreditCard className="mx-auto text-slate-100 mb-2" size={48} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin deudas pendientes</p>
          </div>
        )}
      </div>

      {/* Modal de Abono - RE-DISEÑADO PARA MÓVIL (Compacto) */}
      {isAbonoOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAbonoOpen(false)} />
          <div className="relative bg-white w-full max-w-xl h-[95vh] sm:h-auto sm:max-h-[90vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 flex flex-col">
            
            {/* Cabecera Compacta */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                <DollarSign className="text-emerald-500" size={18} /> Conciliación Rápida
              </h3>
              <button onClick={() => setIsAbonoOpen(false)} className="p-2 text-slate-400"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleRegisterAbono} className="p-5 lg:p-8 space-y-4 overflow-y-auto hide-scrollbar flex-1 flex flex-col">
              
              {/* Inputs Principales Compactos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">1. Cliente</label>
                  <select 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm focus:ring-2 focus:ring-emerald-500"
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
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">2. Monto Abono ($)</label>
                  <input 
                    name="amount" 
                    type="number" 
                    step="0.01" 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-black text-lg text-emerald-600 focus:ring-2 focus:ring-emerald-500" 
                    placeholder="0.00"
                    value={abonoAmount || ''}
                    onChange={(e) => setAbonoAmount(Number(e.target.value))}
                  />
                </div>
              </div>

              {selectedClient && (
                <div className="space-y-2 flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">3. Aplicar a Facturas</label>
                    <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-md">
                      {selectedSaleIds.size} seleccionada(s)
                    </span>
                  </div>
                  
                  {/* Lista de Facturas - ESTILO DENSO */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-y-auto p-2 space-y-1 flex-1 hide-scrollbar">
                    {pendingSalesForClient.map(sale => {
                      const isSelected = selectedSaleIds.has(sale.id);
                      const saldo = sale.total - sale.amountPaid;
                      
                      return (
                        <div 
                          key={sale.id}
                          onClick={() => toggleSaleSelection(sale.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected 
                              ? 'bg-white border-emerald-500 shadow-sm ring-2 ring-emerald-50' 
                              : 'bg-white/50 border-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                             <div className={isSelected ? 'text-emerald-500' : 'text-slate-200'}>
                               {isSelected ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                             </div>
                             <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-800">#{sale.id.slice(0, 5)}</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(sale.date).toLocaleDateString()}</span>
                                </div>
                                <p className="text-[9px] text-slate-400 font-medium">Total: ${sale.total.toLocaleString()}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <span className={`text-sm font-black ${isSelected ? 'text-emerald-600' : 'text-slate-600'}`}>
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
              <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-1">
                <div className="flex justify-between items-center opacity-50">
                   <span className="text-[8px] font-black uppercase tracking-widest">Deuda Seleccionada</span>
                   <span className="text-[10px] font-bold">${totalOwedBySelection.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Restante estimado</span>
                   <span className="text-xl font-black text-emerald-400">
                     ${Math.max(0, totalOwedBySelection - abonoAmount).toLocaleString()}
                   </span>
                </div>
              </div>

              <button 
                disabled={loading || !selectedClient || selectedSaleIds.size === 0 || abonoAmount <= 0} 
                type="submit" 
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-base shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-30 uppercase tracking-widest"
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
