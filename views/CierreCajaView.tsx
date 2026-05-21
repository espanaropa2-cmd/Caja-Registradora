import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dbService } from '../services/dbService';
import { fetchExchangeRate } from '../services/exchangeService';
import { PaymentMethod, SalePayment, Client } from '../types';
import { 
  Lock, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  DollarSign, 
  TrendingUp, 
  RefreshCw, 
  Info, 
  User, 
  FileText, 
  CreditCard, 
  Smartphone, 
  Clock, 
  HelpCircle,
  Hash
} from 'lucide-react';

const CierreCajaView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [payments, setPayments] = useState<SalePayment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [rate, setRate] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [allPayments, allClients, currentRate] = await Promise.all([
        dbService.getAllSalePayments(),
        dbService.getClients(),
        fetchExchangeRate()
      ]);
      setPayments(allPayments);
      setClients(allClients);
      setRate(currentRate);
    } catch (err) {
      console.error("Error loading Cierre de Caja details:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // Convert client id to client name map
  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => map.set(c.id, c.name));
    return map;
  }, [clients]);

  // Adjust Date functions
  const handlePrevDay = () => {
    setSelectedDate(prev => {
      const newD = new Date(prev);
      newD.setDate(newD.getDate() - 1);
      return newD;
    });
  };

  const handleNextDay = () => {
    setSelectedDate(prev => {
      const newD = new Date(prev);
      newD.setDate(newD.getDate() + 1);
      return newD;
    });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      // Avoid timezone issues by using the date string directly
      const [year, month, day] = e.target.value.split('-').map(Number);
      setSelectedDate(new Date(year, month - 1, day));
    }
  };

  // Format Date ISO part: YYYY-MM-DD
  const formattedSelectedDateStr = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [selectedDate]);

  // Filter payments for the selected day (compares in local timezone)
  const dailyPaymentsFiltered = useMemo(() => {
    return payments.filter(p => {
      if (!p.date) return false;
      const localDate = new Date(p.date);
      const year = localDate.getFullYear();
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const day = String(localDate.getDate()).padStart(2, '0');
      const localDateStr = `${year}-${month}-${day}`;
      return localDateStr === formattedSelectedDateStr;
    });
  }, [payments, formattedSelectedDateStr]);

  // Split payments into the 3 columns
  const efectivoPayments = useMemo(() => {
    return dailyPaymentsFiltered.filter(p => p.method === PaymentMethod.EFECTIVO);
  }, [dailyPaymentsFiltered]);

  const puntoPayments = useMemo(() => {
    return dailyPaymentsFiltered.filter(p => p.method === PaymentMethod.PUNTO);
  }, [dailyPaymentsFiltered]);

  const pagomovilPayments = useMemo(() => {
    return dailyPaymentsFiltered.filter(p => p.method === PaymentMethod.PAGOMOVIL);
  }, [dailyPaymentsFiltered]);

  // Totals calculations
  const totalEfectivoUsd = useMemo(() => {
    return efectivoPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [efectivoPayments]);

  const totalPuntoBs = useMemo(() => {
    return puntoPayments.reduce((sum, p) => {
      // Use exact amountBs if saved, or fall back to amount * exchangeRate, or amount * rate
      const valBs = p.amountBs ?? (p.amount * (p.exchangeRate ?? rate));
      return sum + valBs;
    }, 0);
  }, [puntoPayments, rate]);

  const totalPagomovilBs = useMemo(() => {
    return pagomovilPayments.reduce((sum, p) => {
      const valBs = p.amountBs ?? (p.amount * (p.exchangeRate ?? rate));
      return sum + valBs;
    }, 0);
  }, [pagomovilPayments, rate]);

  // General Summary totals
  const totalPagosBs = totalPuntoBs + totalPagomovilBs;
  const totalPagosBsInUsd = rate > 0 ? totalPagosBs / rate : 0;
  const combinedTotalUsd = totalEfectivoUsd + totalPagosBsInUsd;

  // Render format time
  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '--:--';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
        <div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic flex items-center gap-3">
            <Lock className="text-blue-500" size={28} /> Cierre de Caja
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Desglose diario detallado de ingresos por método de pago de 00:00 a 23:59.
          </p>
        </div>
        
        {/* Rate indicator & Refresh action */}        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-3 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
            title="Actualizar Datos"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin text-blue-500" : ""} />
          </button>
          <div className="bg-white dark:bg-slate-900 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-end">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">
              Cotización Activa
            </span>
            <span className="text-xs font-black text-blue-600 dark:text-blue-400">1 USD = {rate.toLocaleString()} BS</span>
          </div>
        </div>
      </div>

      {/* Date selector controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="text-slate-400 dark:text-slate-500" size={18} />
          <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha de Consulta:</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={handlePrevDay}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/80 active:scale-95 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          
          <input 
            type="date"
            value={formattedSelectedDateStr}
            onChange={handleDateChange}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 transition-all text-center"
          />

          <button 
            onClick={handleNextDay}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/80 active:scale-95 transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Totals Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Total Efectivo</p>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">${totalEfectivoUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Total en Bolívares (Bs.)</p>
            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{totalPagosBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.</p>
          </div>
          <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <Smartphone size={20} />
          </div>
        </div>

        <div className="bg-slate-900 dark:bg-blue-950/40 border border-slate-800 dark:border-blue-900/60 rounded-2xl p-4 flex items-center justify-between text-white">
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-blue-350 uppercase tracking-widest">Total Caja (Cálculo USD)</p>
            <p className="text-2xl font-black text-emerald-400 dark:text-emerald-350">${combinedTotalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="p-3 bg-slate-800 dark:bg-blue-900/50 text-emerald-400 dark:text-emerald-350 rounded-xl">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <RefreshCw className="animate-spin text-blue-500 mb-4" size={40} />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando desglose de operaciones...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* COLUMN 1: EFECTIVO */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex flex-col h-[550px] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between bg-slate-50/55 dark:bg-slate-950/20 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                  <DollarSign size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">Efectivo</h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-505">Dólares Estadounidenses</p>
                </div>
              </div>
              <span className="text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg">
                USD
              </span>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
              {efectivoPayments.map((p) => {
                const clientName = p.clientId ? (clientMap.get(p.clientId) || 'Cliente') : 'Venta General';
                return (
                  <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800/40 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">{clientName}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">
                          <Hash size={10} /> {p.saleId.slice(0, 8)}
                        </div>
                      </div>
                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                        ${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800/40">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1">
                        <Clock size={10} /> {formatTime(p.date)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {efectivoPayments.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center text-slate-300 dark:text-slate-700">
                  <DollarSign size={48} className="opacity-25 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">Sin pagos en efectivo</p>
                </div>
              )}
            </div>

            {/* Total Footer */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex-shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Acumulado</span>
                <span className="text-xl font-black text-slate-800 dark:text-white">
                  ${totalEfectivoUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* COLUMN 2: PUNTO DE VENTA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex flex-col h-[550px] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between bg-slate-50/55 dark:bg-slate-950/20 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                  <CreditCard size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">Punto de Venta</h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-505">Tarjetas de Débito/Crédito</p>
                </div>
              </div>
              <span className="text-[10px] font-black bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-lg">
                VES
              </span>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
              {puntoPayments.map((p) => {
                const clientName = p.clientId ? (clientMap.get(p.clientId) || 'Cliente') : 'Venta General';
                const calculatedBs = p.amountBs ?? (p.amount * (p.exchangeRate ?? rate));
                
                return (
                  <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800/40 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">{clientName}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">
                          <Hash size={10} /> {p.saleId.slice(0, 8)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                          {calculatedBs.toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs.
                        </span>
                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500">${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800/40">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1">
                        <Clock size={10} /> {formatTime(p.date)}
                      </span>
                      {p.exchangeRate && (
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium font-bold">Tasa: {p.exchangeRate}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {puntoPayments.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center text-slate-300 dark:text-slate-700">
                  <CreditCard size={48} className="opacity-25 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">Sin pagos por punto</p>
                </div>
              )}
            </div>

            {/* Total Footer */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex-shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Acumulado</span>
                <span className="text-xl font-black text-slate-800 dark:text-white truncate max-w-[180px]">
                  {totalPuntoBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.
                </span>
              </div>
            </div>
          </div>

          {/* COLUMN 3: PAGO MOVIL */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex flex-col h-[550px] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between bg-slate-50/55 dark:bg-slate-950/20 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                  <Smartphone size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">Pago Móvil</h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-520">Transferencias Interbancarias</p>
                </div>
              </div>
              <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg">
                VES
              </span>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
              {pagomovilPayments.map((p) => {
                const clientName = p.clientId ? (clientMap.get(p.clientId) || 'Cliente') : 'Venta General';
                const calculatedBs = p.amountBs ?? (p.amount * (p.exchangeRate ?? rate));
                
                return (
                  <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800/40 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">{clientName}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">
                          <Hash size={10} /> {p.saleId.slice(0, 8)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-405">
                          {calculatedBs.toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs.
                        </span>
                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-505">${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    {p.reference && (
                      <div className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-500 dark:text-slate-400 rounded-lg flex items-center justify-between">
                        <span>REF:</span>
                        <span className="font-mono tracking-wider font-extrabold">{p.reference}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800/40">
                      <span className="text-[9px] text-slate-400 dark:text-slate-505 font-bold flex items-center gap-1">
                        <Clock size={10} /> {formatTime(p.date)}
                      </span>
                      {p.exchangeRate && (
                        <span className="text-[9px] text-slate-400 dark:text-slate-505 font-medium font-bold">Tasa: {p.exchangeRate}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {pagomovilPayments.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center text-slate-300 dark:text-slate-700">
                  <Smartphone size={48} className="opacity-25 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">Sin pagos por pago móvil</p>
                </div>
              )}
            </div>

            {/* Total Footer */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex-shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Acumulado</span>
                <span className="text-xl font-black text-slate-800 dark:text-white truncate max-w-[180px]">
                  {totalPagomovilBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CierreCajaView;
