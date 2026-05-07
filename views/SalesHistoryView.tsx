
import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/dbService';
import { Sale, Client } from '../types';
import { History, Calendar, Search, Trash2, ArrowUpRight, ShoppingBag, User, Loader2, X, AlertTriangle, RefreshCw, DollarSign } from 'lucide-react';

type TimeRange = 'hoy' | 'semana' | 'mes' | 'año' | 'todos';

const SalesHistoryView: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('semana');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Estados para el modal de confirmación
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);

  // Estados para el modal de detalles
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const fetchData = async () => {
    try {
      const [allSales, allClients] = await Promise.all([
        dbService.getSales(),
        dbService.getClients()
      ]);
      setSales(allSales);
      setClients(allClients);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredSales = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return sales.filter(sale => {
      const saleDate = new Date(sale.date);
      let rangeMatch = true;

      if (timeRange === 'hoy') rangeMatch = saleDate >= startOfToday;
      else if (timeRange === 'semana') {
        const lastWeek = new Date();
        lastWeek.setDate(now.getDate() - 7);
        rangeMatch = saleDate >= lastWeek;
      } else if (timeRange === 'mes') {
        const lastMonth = new Date();
        lastMonth.setMonth(now.getMonth() - 1);
        rangeMatch = saleDate >= lastMonth;
      } else if (timeRange === 'año') {
        const lastYear = new Date();
        lastYear.setFullYear(now.getFullYear() - 1);
        rangeMatch = saleDate >= lastYear;
      }

      const client = clients.find(c => c.id === sale.clientId);
      const clientName = client ? client.name.toLowerCase() : 'contado';
      const searchMatch = clientName.includes(searchTerm.toLowerCase()) || 
                          sale.id.includes(searchTerm);

      return rangeMatch && searchMatch;
    });
  }, [sales, timeRange, searchTerm, clients]);

  const confirmDeleteSale = async () => {
    if (!saleToDelete) return;
    setLoading(true);
    try {
      await dbService.deleteSale(saleToDelete.id);
      await fetchData();
      setIsDeleteModalOpen(false);
      setSaleToDelete(null);
    } catch (err) {
      alert('Error al anular venta.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (sale: Sale) => {
    setSaleToDelete(sale);
    setIsDeleteModalOpen(true);
  };

  const openDetailsModal = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailsModalOpen(true);
  };

  const getClientName = (id?: string) => {
    if (!id) return 'Venta Pagada';
    return clients.find(c => c.id === id)?.name || 'Desconocido';
  };

  const totals = useMemo(() => filteredSales.reduce((acc, s) => acc + s.total, 0), [filteredSales]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Historial de Operaciones</h1>
          <p className="text-slate-500 font-medium">Control y auditoría de ventas registradas.</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <ShoppingBag size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Facturación Periodo</p>
            <p className="text-xl font-black text-slate-800">${totals.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Nº Factura o Cliente..." 
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto hide-scrollbar">
          {(['hoy', 'semana', 'mes', 'año', 'todos'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 min-w-[80px] px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                timeRange === range ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-6">Fecha & Registro</th>
                <th className="px-8 py-6">Comprador</th>
                <th className="px-8 py-6">Monto Total</th>
                <th className="px-8 py-6">Estado</th>
                <th className="px-8 py-6">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((sale) => (
                <tr 
                  key={sale.id} 
                  className="hover:bg-slate-50/80 transition-all group cursor-pointer"
                  onClick={() => openDetailsModal(sale)}
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-400">
                        <Calendar size={14} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">{new Date(sale.date).toLocaleDateString()}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">ID: {sale.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${sale.clientId ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                        {sale.clientId ? <User size={14} /> : <ArrowUpRight size={14} />}
                      </div>
                      <p className="text-sm font-black text-slate-700">{getClientName(sale.clientId)}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6 font-black text-slate-900 text-lg tracking-tight">
                    ${sale.total.toLocaleString()}
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                      sale.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {sale.status === 'COMPLETED' ? 'PAGADO' : 'CRÉDITO'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                     <button 
                       disabled={loading}
                       onClick={(e) => {
                         e.stopPropagation();
                         openDeleteModal(sale);
                       }}
                       className="p-3 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all shadow-sm group-hover:shadow group-hover:scale-105 active:scale-95"
                       title="Anular Transacción"
                     >
                       <Trash2 size={20} />
                     </button>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <History size={64} className="mx-auto text-slate-100 mb-4" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sin registros encontrados</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmación de Anulación */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute right-6 top-6 text-slate-300 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>
            
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-rose-50/50">
              <AlertTriangle size={40} />
            </div>
            
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">¿Anular Operación?</h3>
              <p className="text-slate-500 font-medium">Esta acción es irreversible y tendrá el siguiente impacto:</p>
            </div>

            <div className="bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100 mb-8">
              <div className="flex items-start gap-3">
                <div className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg mt-0.5">
                  <RefreshCw size={14} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-700 uppercase">Reversión de Inventario</p>
                  <p className="text-[10px] text-slate-500 font-medium">Los productos comprados se sumarán nuevamente al stock disponible.</p>
                </div>
              </div>
              
              {saleToDelete?.status === 'CREDIT' && (
                <div className="flex items-start gap-3">
                  <div className="bg-amber-100 text-amber-600 p-1.5 rounded-lg mt-0.5">
                    <ArrowUpRight size={14} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-700 uppercase">Ajuste de Cuentas</p>
                    <p className="text-[10px] text-slate-500 font-medium">La deuda pendiente de este cliente se reducirá en el monto de esta factura.</p>
                  </div>
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-200 flex justify-between items-end">
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Factura a anular</p>
                   <p className="text-sm font-black text-slate-800">Nº {saleToDelete?.id.slice(0, 8)}</p>
                </div>
                <p className="text-2xl font-black text-rose-600">${saleToDelete?.total.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmDeleteSale}
                disabled={loading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-rose-100 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Sí, Confirmar Anulación'}
              </button>
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setSaleToDelete(null); }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
            </div>
            
            <p className="mt-8 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] text-center">Seguridad de integridad de datos habilitada</p>
          </div>
        </div>
      )}

      {/* Modal de Detalles de Venta */}
      {isDetailsModalOpen && selectedSale && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsDetailsModalOpen(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Detalle de Factura</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Nº {selectedSale.id.slice(0, 8)} • {new Date(selectedSale.date).toLocaleString()}</p>
              </div>
              <button onClick={() => setIsDetailsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto hide-scrollbar space-y-8">
              {/* Información del Cliente */}
              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${selectedSale.clientId ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                    {selectedSale.clientId ? <User size={24} /> : <ArrowUpRight size={24} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente / Tipo</p>
                    <p className="text-lg font-black text-slate-800">{getClientName(selectedSale.clientId)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                    selectedSale.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedSale.status === 'COMPLETED' ? 'PAGADA' : 'CRÉDITO'}
                  </span>
                </div>
              </div>

              {/* Desglose de Productos */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Productos Vendidos</h4>
                <div className="border border-slate-100 rounded-3xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Producto</th>
                        <th className="px-6 py-4 text-center">Cant.</th>
                        <th className="px-6 py-4 text-right">Precio</th>
                        <th className="px-6 py-4 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {selectedSale.items.map((item, idx) => (
                        <tr key={idx} className="text-sm">
                          <td className="px-6 py-4 font-bold text-slate-700">{item.name}</td>
                          <td className="px-6 py-4 text-center font-black text-slate-500">{item.quantity}</td>
                          <td className="px-6 py-4 text-right font-bold text-slate-600">${item.price.toLocaleString()}</td>
                          <td className="px-6 py-4 text-right font-black text-slate-800">${(item.price * item.quantity).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumen Financiero */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <ShoppingBag size={64} />
                  </div>
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Total de la Factura</p>
                  <p className="text-4xl font-black text-white">${selectedSale.total.toLocaleString()}</p>
                </div>

                {selectedSale.status === 'CREDIT' && (
                  <div className="bg-emerald-50 rounded-[2rem] p-8 border border-emerald-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-600">
                      <RefreshCw size={64} />
                    </div>
                    <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest mb-1">Pagado hasta hoy</p>
                    <p className="text-4xl font-black text-emerald-600">${selectedSale.amountPaid.toLocaleString()}</p>
                    <div className="mt-4 pt-4 border-t border-emerald-200/50">
                      <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest mb-1">Saldo Pendiente</p>
                      <p className="text-xl font-black text-rose-500">${(selectedSale.total - selectedSale.amountPaid).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Historial de Pagos / Abonos */}
              {selectedSale.payments && selectedSale.payments.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Historial de Pagos</h4>
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl overflow-hidden">
                    <div className="p-4 space-y-3">
                      {selectedSale.payments.map((payment, idx) => (
                        <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center shadow-inner">
                              <DollarSign size={18} />
                            </div>
                            <div>
                               <p className="text-xs font-black text-slate-800 uppercase space-x-2">
                                 <span>{payment.method}</span>
                                 {payment.reference && <span className="text-slate-400 font-bold ml-2">#{payment.reference}</span>}
                               </p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{new Date(payment.date).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                             <p className="text-lg font-black text-emerald-600">+${payment.amount.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95 shadow-sm"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistoryView;
