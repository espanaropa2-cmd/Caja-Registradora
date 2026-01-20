
import React, { useMemo, useState, useEffect } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { dbService } from '../services/dbService';
import { DollarSign, TrendingDown, Package, Users, FileText, PieChart, Printer, Loader2, ArrowUpRight, BarChart3, Layers } from 'lucide-react';
import { Sale, Expense, Product, Client } from '../types';

type DashboardPeriod = 'semana' | 'mes' | 'año';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const DashboardView: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [period, setPeriod] = useState<DashboardPeriod>('semana');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [s, e, p, c] = await Promise.all([
          dbService.getSales(),
          dbService.getExpenses(),
          dbService.getProducts(),
          dbService.getClients()
        ]);
        setSales(s);
        setExpenses(e);
        setProducts(p);
        setClients(c);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      }
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    
    if (period === 'semana') startDate.setDate(now.getDate() - 7);
    else if (period === 'mes') startDate.setMonth(now.getMonth() - 1);
    else if (period === 'año') startDate.setFullYear(now.getFullYear() - 1);

    const fSales = sales.filter(s => new Date(s.date) >= startDate);
    const fExpenses = expenses.filter(e => new Date(e.date) >= startDate);

    return { fSales, fExpenses };
  }, [sales, expenses, period]);

  const stats = useMemo(() => {
    const totalRevenue = filteredData.fSales.reduce((acc, s) => acc + (s.amountPaid || 0), 0);
    const totalExpenses = filteredData.fExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netIncome = totalRevenue - totalExpenses;
    const pendingCredits = clients.reduce((acc, c) => acc + c.currentDebt, 0);

    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit: netIncome,
      pendingCredits
    };
  }, [filteredData, clients]);

  // Cálculo de analítica por categorías
  const categoryStats = useMemo(() => {
    const statsMap: Record<string, { category: string, money: number, units: number }> = {};
    
    // Mapeo rápido de productos para obtener categorías
    const productMap = products.reduce((acc, p) => {
      acc[p.id] = p.category || 'Sin Categoría';
      return acc;
    }, {} as Record<string, string>);

    filteredData.fSales.forEach(sale => {
      sale.items.forEach(item => {
        const category = productMap[item.productId] || 'General';
        if (!statsMap[category]) {
          statsMap[category] = { category, money: 0, units: 0 };
        }
        statsMap[category].money += item.price * item.quantity;
        statsMap[category].units += item.quantity;
      });
    });

    return Object.values(statsMap).sort((a, b) => b.money - a.money);
  }, [filteredData.fSales, products]);

  const handlePrintReport = () => {
    const businessName = localStorage.getItem('cajapro_profile') 
      ? JSON.parse(localStorage.getItem('cajapro_profile')!).businessName 
      : 'Mi Negocio';

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte de Balance Real - ${businessName}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { size: A4; margin: 1.5cm; }
          body { font-family: 'Inter', sans-serif; color: #1e293b; background: white; }
          .report-header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .stat-card { border: 1px solid #f1f5f9; padding: 15px; border-radius: 12px; background: #f8fafc; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { text-align: left; padding: 10px; font-size: 9px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
          td { padding: 10px; border-bottom: 1px solid #f8fafc; font-size: 11px; }
          .font-black { font-weight: 900; }
        </style>
      </head>
      <body class="p-8">
        <div class="report-header flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-black text-slate-900">${businessName.toUpperCase()}</h1>
            <p class="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Balance de Caja e Ingresos Reales</p>
          </div>
          <div class="text-right">
            <p class="text-[9px] font-black text-slate-400 uppercase">Periodo Analizado: ${period.toUpperCase()}</p>
            <p class="text-xs font-bold">${new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4 mb-8">
          <div class="stat-card">
            <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Efectivo Ingresado</p>
            <p class="text-xl font-black text-blue-600">$${stats.revenue.toLocaleString()}</p>
          </div>
          <div class="stat-card">
            <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Gastos Operativos</p>
            <p class="text-xl font-black text-rose-600">$${stats.expenses.toLocaleString()}</p>
          </div>
          <div class="stat-card bg-slate-900 text-white">
            <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Utilidad Real</p>
            <p class="text-xl font-black text-emerald-400">$${stats.profit.toLocaleString()}</p>
          </div>
        </div>

        <div class="mb-8">
          <h2 class="text-xs font-black uppercase tracking-widest border-b border-slate-900 pb-2 mb-4">Rendimiento por Categoría</h2>
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th class="text-right">Unidades Vendidas</th>
                <th class="text-right">Dinero Generado ($)</th>
              </tr>
            </thead>
            <tbody>
              ${categoryStats.map(c => `
                <tr>
                  <td class="font-bold">${c.category}</td>
                  <td class="text-right">${c.units} uds</td>
                  <td class="text-right font-black text-blue-600">$${c.money.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="mt-20 flex justify-between items-center text-[8px] font-bold text-slate-300 uppercase tracking-[0.3em]">
          <p>Caja Pro v1.0 - Gestión Integral</p>
          <p>Documento de Auditoría Interna</p>
        </div>

        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const StatCard = ({ title, value, icon: Icon, color, isProfit, subtext }: any) => (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-start justify-between">
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className={`text-2xl font-black ${isProfit && value < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
          ${value.toLocaleString()}
        </h3>
        {subtext && <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-2xl ${color} shadow-lg shadow-current/10`}>
        <Icon size={24} />
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Análisis Estratégico</h1>
          <p className="text-slate-500 font-medium">Contabilizando ingresos reales y rendimiento de inventario.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrintReport}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95"
          >
            <Printer size={16} /> Reporte PDF Detallado
          </button>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {(['semana', 'mes', 'año'] as DashboardPeriod[]).map(p => (
              <button 
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${period === p ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Ingresos Reales" value={stats.revenue} icon={DollarSign} color="bg-blue-50 text-blue-600" subtext="Cobro Efectivo" />
        <StatCard title="Gastos Operativos" value={stats.expenses} icon={TrendingDown} color="bg-rose-50 text-rose-600" subtext="Compras y Salidas" />
        <StatCard title="Utilidad Liquida" value={stats.profit} icon={PieChart} color="bg-emerald-50 text-emerald-600" isProfit={true} subtext="Cash Flow Neto" />
        <StatCard title="Cartera Clientes" value={stats.pendingCredits} icon={Users} color="bg-amber-50 text-amber-600" subtext="Cuentas por Cobrar" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8">
             <ArrowUpRight className="text-slate-100" size={120} />
          </div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2 relative z-10">
             <TrendingDown className="text-blue-600" size={18} /> Tendencia de Cobro Real
          </h3>
          <div className="h-80 w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={useMemo(() => {
                const days = period === 'semana' ? 7 : period === 'mes' ? 30 : 12;
                const data = [];
                for (let i = days; i >= 0; i--) {
                  const d = new Date();
                  if (period === 'año') d.setMonth(d.getMonth() - i);
                  else d.setDate(d.getDate() - i);
                  
                  const daySales = sales.filter(s => new Date(s.date).toDateString() === d.toDateString());
                  const dayExpenses = expenses.filter(e => new Date(e.date).toDateString() === d.toDateString());
                  
                  data.push({
                    name: period === 'año' ? d.toLocaleString('es-VE', { month: 'short' }) : d.toISOString().split('T')[0].slice(5),
                    ingresos: daySales.reduce((acc, s) => acc + (s.amountPaid || 0), 0),
                    gastos: dayExpenses.reduce((acc, e) => acc + e.amount, 0)
                  });
                }
                return data;
              }, [sales, expenses, period])}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '15px'}} />
                <Area type="monotone" dataKey="ingresos" stroke="#3b82f6" strokeWidth={4} fill="#3b82f6" fillOpacity={0.05} />
                <Area type="monotone" dataKey="gastos" stroke="#f43f5e" strokeWidth={4} fill="#f43f5e" fillOpacity={0.05} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <FileText className="text-blue-500" size={16} /> Resumen de Liquidez
          </h3>
          <div className="flex-1 space-y-6">
            <div className="p-5 bg-blue-50 rounded-3xl border border-blue-100">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider mb-1">Recaudado vs Facturado</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-black text-blue-700">
                  {filteredData.fSales.length > 0 
                    ? ((stats.revenue / filteredData.fSales.reduce((acc, s) => acc + s.total, 0)) * 100).toFixed(1) 
                    : 0}%
                </p>
                <span className="text-[10px] font-bold text-blue-400 mb-1">Eficiencia de Cobro</span>
              </div>
            </div>
            
            <div className="p-5 bg-amber-50 rounded-3xl border border-amber-100">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider mb-1">Capital en la Calle</p>
              <p className="text-2xl font-black text-amber-700">${stats.pendingCredits.toLocaleString()}</p>
              <p className="text-[9px] text-amber-600/60 font-bold mt-2 leading-tight uppercase">Monto total que clientes tienen pendiente por pagar.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Nuevos Gráficos por Categoría */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
            <BarChart3 className="text-blue-600" size={18} /> Ingresos por Categoría ($)
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="money" radius={[8, 8, 0, 0]}>
                  {categoryStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
            <Layers className="text-emerald-600" size={18} /> Unidades por Categoría (Ventas)
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="units" radius={[8, 8, 0, 0]}>
                  {categoryStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
