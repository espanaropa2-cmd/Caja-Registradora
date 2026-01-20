
import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/dbService';
import { SaleStatus, Sale, Client } from '../types';
import { CreditCard, AlertCircle, RefreshCw, Loader2, DollarSign, CheckCircle2, Circle, Calendar, Hash, UserCircle } from 'lucide-react';

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
      alert('Abono procesado y facturas conciliadas con éxito.');
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Control de Cobranzas</h1>
          <p className="text-slate-500 font-medium">Gestiona facturas pendientes y recibe pagos por conciliación.</p>
        </div>
        <button 
          onClick={() => { resetModal(); setIsAbonoOpen(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-emerald-100 transition-all active:scale-95"
        >
          <DollarSign size={18} /> Registrar Abono
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-6">Cliente Moroso</th>
                <th className="px-8 py-6 text-right">Saldo Deudor Acumulado</th>
                <th className="px-8 py-6 text-center">Última Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map(client => (
                <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-black text-sm">
                        {client.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-black text-slate-800">{client.name}</span>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{client.phone || 'Sin teléfono registrado'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className="font-black text-rose-600 text-xl tracking-tight">${client.currentDebt.toLocaleString()}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex justify-center">
                      <div className="p-2 bg-slate-50 text-slate-300 rounded-lg">
                        <UserCircle size={20} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-24 text-center">
                    <CreditCard className="mx-auto text-slate-100 mb-4" size={64} />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cartera de crédito limpia</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAbonoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAbonoOpen(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-2">
              <DollarSign className="text-emerald-500" /> Conciliación de Pagos
            </h3>
            
            <form onSubmit={handleRegisterAbono} className="space-y-6 overflow-hidden flex flex-col">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">1. Elegir Cliente</label>
                  <select 
                    required 
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                    onChange={(e) => {
                      setSelectedClient(clients.find(c => c.id === e.target.value) || null);
                      setSelectedSaleIds(new Set());
                    }}
                    value={selectedClient?.id || ''}
                  >
                    <option value="">-- Ver Morosos --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (Saldo: ${c.currentDebt})</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">2. Monto a Abonar ($)</label>
                  <input 
                    name="amount" 
                    type="number" 
                    step="0.01" 
                    required 
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-xl text-emerald-600" 
                    placeholder="0.00"
                    value={abonoAmount || ''}
                    onChange={(e) => setAbonoAmount(Number(e.target.value))}
                  />
                </div>
              </div>

              {selectedClient && (
                <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">3. Seleccionar Facturas para Conciliar</label>
                    <span className="text-[10px] font-black text-blue-600 uppercase">
                      {selectedSaleIds.size} seleccionada(s)
                    </span>
                  </div>
                  
                  <div className="bg-slate-50 rounded-3xl border border-slate-100 overflow-y-auto p-4 space-y-3 flex-1 hide-scrollbar">
                    {pendingSalesForClient.map(sale => {
                      const isSelected = selectedSaleIds.has(sale.id);
                      const saldo = sale.total - sale.amountPaid;
                      
                      return (
                        <div 
                          key={sale.id}
                          onClick={() => toggleSaleSelection(sale.id)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected 
                              ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-50' 
                              : 'bg-white/50 border-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                             <div className={isSelected ? 'text-blue-500' : 'text-slate-200'}>
                               {isSelected ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                             </div>
                             <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                                    <Hash size={12} /> {sale.id.slice(0, 8)}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                                    <Calendar size={10} /> {new Date(sale.date).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                  Total: ${sale.total.toLocaleString()} | Abonado: ${sale.amountPaid.toLocaleString()}
                                </p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black text-slate-400 uppercase">Saldo Pendiente</p>
                             <p className={`text-lg font-black ${isSelected ? 'text-blue-600' : 'text-slate-700'}`}>
                               ${saldo.toLocaleString()}
                             </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-1">
                <div className="flex justify-between items-center opacity-60">
                   <span className="text-[10px] font-black uppercase tracking-[0.2em]">Total Deuda Seleccionada</span>
                   <span className="text-xs font-bold">${totalOwedBySelection.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-xs font-black uppercase tracking-widest">Saldo Restante tras Abono</span>
                   <span className="text-2xl font-black text-emerald-400">
                     ${Math.max(0, totalOwedBySelection - abonoAmount).toLocaleString()}
                   </span>
                </div>
              </div>

              <button 
                disabled={loading || !selectedClient || selectedSaleIds.size === 0 || abonoAmount <= 0} 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-5 rounded-[1.5rem] font-black text-lg shadow-xl shadow-emerald-100 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Procesar Conciliación'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditView;
