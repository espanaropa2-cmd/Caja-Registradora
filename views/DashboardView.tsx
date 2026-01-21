
import React, { useMemo, useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell } from 'recharts';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [s, e, p, c] = await Promise.all([dbService.getSales(), dbService.getExpenses(), dbService.getProducts(), dbService.getClients()]);
        setSales(s); setExpenses(e); setProducts(p); setClients(c);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    const now = new Date(); let startDate = new Date();
    if (period === 'semana') startDate.setDate(now.getDate() - 7);
    else if (period === 'mes') startDate.setMonth(now.getMonth() - 1);
    else if (period === 'año') startDate.setFullYear(now.getFullYear() - 1);
    return { fSales: sales.filter(s => new Date(s.date) >= startDate), fExpenses: expenses.filter(e => new Date(e.date) >= startDate) };
  }, [sales, expenses, period]);

  const stats = useMemo(() => {
    const revenue = filteredData.fSales.reduce((acc, s) => acc + (s.amountPaid || 0), 0);
    const cost = filteredData.fExpenses.reduce((acc, e) => acc + e.amount, 0);
    return { revenue, expenses: cost, profit: revenue - cost, pending: clients.reduce((acc, c) => acc + c.currentDebt, 0) };
  }, [filteredData, clients]);

  const chartData = useMemo(() => {
    const days = period === 'semana' ? 7 : period === 'mes' ? 30 : 12;
    const data = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      if (period === 'año') d.setMonth(d.getMonth() - i); else d.setDate(d.getDate() - i);
      const daySales = sales.filter(s => new Date(s.date).toDateString() === d.toDateString());
      const dayExpenses = expenses.filter(e => new Date(e.date).toDateString() === d.toDateString());
      data.push({
        name: period === 'año' ? d.toLocaleString('es', { month: 'short' }) : d.getDate().toString(),
        ingresos: daySales.reduce((acc, s) => acc + (s.amountPaid || 0), 0),
        gastos: dayExpenses.reduce((acc, e) => acc + e.amount, 0)
      });
    }
    return data;
  }, [sales, expenses, period]);

  const categoryStats = useMemo(() => {
    const map: Record<string, any> = {};
    const prodMap = products.reduce((acc, p) => { acc[p.id] = p.category || 'Varios'; return acc; }, {} as any);
    filteredData.fSales.forEach(s => s.items.forEach(it => {
      const cat = prodMap[it.productId] || 'Varios';
      if (!map[cat]) map[cat] = { category: cat, money: 0, units: 0 };
      map[cat].money += it.price * it.quantity; map[cat].units += it.quantity;
    }));
    return Object.values(map).sort((a, b) => b.money - a.money).slice(0, 5);
  }, [filteredData, products]);

  const StatCard = ({ title, value, icon: Icon, iconColor, sub }: any) => (
    <div className="bg-white p-6 lg:p-8 rounded-[2rem] lg:rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group transition-all hover:border-blue-100 h-full">
      <div className="relative z-10">
        <p className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-xl lg:text-4xl font-black text-slate-800 tracking-tighter leading-none">${value.toLocaleString()}</h3>
        <p className="text-[8px] lg:text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tight">{sub}</p>
      </div>
      {/* Watermark Icon - Background Effect */}
      <div className={`absolute -right-4 lg:-right-6 -bottom-4 lg:-bottom-6 ${iconColor} opacity-[0.08] lg:opacity-[0.06] pointer-events-none transition-transform duration-700 group-hover:scale-125 group-hover:-rotate-12`}>
        <Icon size={140} strokeWidth={1} />
      </div>
    </div>
  );

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="space-y-6 lg:space-y-10 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-800 tracking-tighter">Analítica</h1>
          <p className="text-xs lg:text-lg text-slate-500 font-medium">Pulso operativo de tu comercio.</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-full lg:w-auto">
          {(['semana', 'mes', 'año'] as DashboardPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`flex-1 lg:px-7 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${period === p ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8">
        <StatCard title="Ingreso Neto" value={stats.revenue} icon={DollarSign} iconColor="text-blue-600" sub="Ventas Cobradas" />
        <StatCard title="Gasto Operativo" value={stats.expenses} icon={TrendingDown} iconColor="text-rose-600" sub="Salidas y Compras" />
        <StatCard title="Margen Real" value={stats.profit} icon={PieChart} iconColor="text-emerald-600" sub="Flujo Neto" />
        <StatCard title="Por Cobrar" value={stats.pending} icon={Users} iconColor="text-amber-600" sub="Deuda Clientes" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
        <div className="lg:col-span-2 bg-white p-6 lg:p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden">
          <h3 className="text-[10px] lg:text-xs font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
            <ArrowUpRight className="text-blue-600" size={16} /> Tendencia de Flujo
          </h3>
          <div className="h-64 lg:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="ingresos" stroke="#3b82f6" strokeWidth={4} fill="#3b82f6" fillOpacity={0.05} />
                <Area type="monotone" dataKey="gastos" stroke="#f43f5e" strokeWidth={4} fill="#f43f5e" fillOpacity={0.05} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 lg:p-10 rounded-[3rem] border border-slate-200 shadow-sm">
          <h3 className="text-[10px] lg:text-xs font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
            <BarChart3 className="text-blue-600" size={16} /> Top Categorías ($)
          </h3>
          <div className="h-64 lg:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryStats} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="category" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 800}} width={80} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="money" radius={[0, 10, 10, 0]} barSize={20}>
                  {categoryStats.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
