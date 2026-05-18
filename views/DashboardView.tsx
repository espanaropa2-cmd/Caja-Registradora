
import React, { useMemo, useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend, Sector } from 'recharts';
import { dbService } from '../services/dbService';
import { DollarSign, TrendingDown, Package, Users, PieChart as PieIcon, Printer, Loader2, ArrowUpRight, Award, Target, X, ChevronRight, FileText } from 'lucide-react';
import { Sale, Expense, Product, Client } from '../types';

type DashboardPeriod = 'hoy' | 'semana' | 'mes' | 'año';
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 8) * cos;
  const sy = cy + (outerRadius + 8) * sin;
  const mx = cx + (outerRadius + 20) * cos;
  const my = cy + (outerRadius + 20) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 15;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} style={{ fontSize: '11px', fontVariantCaps: 'all-small-caps', fontWeight: '900' }}>
        {payload.name}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 8}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} textAnchor={textAnchor} fill="currentColor" className="text-slate-800 dark:text-slate-100" style={{ fontSize: '10px', fontWeight: '900' }}>
        {typeof value === 'number' && value >= 100 ? `$${value.toLocaleString()}` : value}
      </text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} dy={12} textAnchor={textAnchor} fill="currentColor" className="text-slate-400 dark:text-slate-500" style={{ fontSize: '8px', fontWeight: 'bold' }}>
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

interface DashboardViewProps {
  useParallelRate?: boolean;
  businessName?: string;
  isDarkMode?: boolean;
}

const DashboardView: React.FC<DashboardViewProps> = ({ useParallelRate = false, businessName = 'Mi Negocio', isDarkMode = false }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [period, setPeriod] = useState<DashboardPeriod>('semana');
  const [loading, setLoading] = useState(true);
  
  const [activeProfitIndex, setActiveProfitIndex] = useState(0);
  const [activeUnitsIndex, setActiveUnitsIndex] = useState(0);

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
    if (period === 'hoy') startDate.setHours(0, 0, 0, 0);
    else if (period === 'semana') startDate.setDate(now.getDate() - 7);
    else if (period === 'mes') startDate.setMonth(now.getMonth() - 1);
    else if (period === 'año') startDate.setFullYear(now.getFullYear() - 1);
    return { 
      fSales: sales.filter(s => new Date(s.date) >= startDate), 
      fExpenses: expenses.filter(e => new Date(e.date) >= startDate) 
    };
  }, [sales, expenses, period]);

  const stats = useMemo(() => {
    // Ingreso Bruto
    const revenue = filteredData.fSales.reduce((acc, s) => acc + (s.total || 0), 0);
    
    // Cálculo de Margen de Ventas
    const productMap = products.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as any);
    const grossProfitFromSales = filteredData.fSales.reduce((acc, s) => {
      const saleMargin = s.items.reduce((m, item) => {
        const prod = productMap[item.productId];
        const cost = prod?.cost || 0;
        return m + ((item.price - cost) * item.quantity);
      }, 0);
      return acc + saleMargin;
    }, 0);

    // Suma TOTAL de egresos (Operativos + Reabastecimiento)
    const totalExpenses = filteredData.fExpenses.reduce((acc, e) => acc + e.amount, 0);

    // Separados para utilidad (Solo 'Otros' resta al margen porque el costo de mercancía ya se resta arriba)
    const otherExpenses = filteredData.fExpenses
      .filter(e => e.category === 'Otros')
      .reduce((acc, e) => acc + e.amount, 0);

    return { 
      revenue, 
      totalExpenses, // Total global de egresos solicitado
      profit: grossProfitFromSales - otherExpenses, 
      pending: clients.reduce((acc, c) => acc + c.currentDebt, 0) 
    };
  }, [filteredData, products, clients]);

  const chartData = useMemo(() => {
    if (period === 'hoy') {
      const data = [];
      for (let i = 0; i <= 23; i++) {
        const d = new Date(); d.setHours(i, 0, 0, 0);
        const hourSales = sales.filter(s => {
          const sd = new Date(s.date);
          return sd.toDateString() === d.toDateString() && sd.getHours() === i;
        });
        const hourExpenses = expenses.filter(e => {
          const ed = new Date(e.date);
          return ed.toDateString() === d.toDateString() && ed.getHours() === i;
        });
        data.push({
          name: `${i}:00`,
          ingresos: hourSales.reduce((acc, s) => acc + (s.total || 0), 0),
          gastos: hourExpenses.reduce((acc, e) => acc + e.amount, 0)
        });
      }
      return data;
    }

    const days = period === 'semana' ? 7 : period === 'mes' ? 30 : 12;
    const data = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      if (period === 'año') d.setMonth(d.getMonth() - i); else d.setDate(d.getDate() - i);
      const daySales = sales.filter(s => new Date(s.date).toDateString() === d.toDateString());
      const dayExpenses = expenses.filter(e => new Date(e.date).toDateString() === d.toDateString());
      data.push({
        name: period === 'año' ? d.toLocaleString('es', { month: 'short' }) : d.getDate().toString(),
        ingresos: daySales.reduce((acc, s) => acc + (s.total || 0), 0),
        gastos: dayExpenses.reduce((acc, e) => acc + e.amount, 0)
      });
    }
    return data;
  }, [sales, expenses, period]);

  const categoryStats = useMemo(() => {
    const map: Record<string, any> = {};
    const fullProdMap = products.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as any);
    
    filteredData.fSales.forEach(s => s.items.forEach(it => {
      const prod = fullProdMap[it.productId];
      const cat = prod?.category || 'Varios';
      const cost = prod?.cost || 0;
      
      if (!map[cat]) map[cat] = { name: cat, profit: 0, units: 0, revenue: 0 };
      
      const itemRevenue = it.price * it.quantity;
      const itemProfit = (it.price - cost) * it.quantity;
      
      map[cat].revenue += itemRevenue;
      map[cat].profit += itemProfit;
      map[cat].units += it.quantity;
    }));
    
    return Object.values(map);
  }, [filteredData, products]);

  const profitPieData = useMemo(() => 
    [...categoryStats].sort((a, b) => b.profit - a.profit).slice(0, 5)
    .map(c => ({ name: c.name, value: Math.max(0, c.profit) })), 
  [categoryStats]);

  const unitsPieData = useMemo(() => 
    [...categoryStats].sort((a, b) => b.units - a.units).slice(0, 5)
    .map(c => ({ name: c.name, value: c.units })), 
  [categoryStats]);

  const handleExportPDF = () => {
    const profileData = JSON.parse(localStorage.getItem('cajapro_profile') || '{}');
    const businessName = profileData.businessName || 'Mi Negocio';
    const dateStr = new Date().toLocaleString();
    const clientMap = clients.reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {} as any);
    
    // 1. Mapear las filas de datos
    const incomeRows = filteredData.fSales.length > 0 ? filteredData.fSales.map(s => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">${new Date(s.date).toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">${clientMap[s.clientId || ''] || 'Venta Contado'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; text-align: center;">${s.items.reduce((a, it) => a + it.quantity, 0)} uds</td>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; text-align: right; font-weight: bold; color: #3b82f6;">$${(s.total || 0).toLocaleString()}</td>
      </tr>
    `).join('') : '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">Sin ingresos en este periodo</td></tr>';

    const expenseRows = filteredData.fExpenses.length > 0 ? filteredData.fExpenses.map(e => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">${new Date(e.date).toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">${e.description}</td>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; text-align: right; font-weight: bold; color: #ef4444;">$${e.amount.toLocaleString()}</td>
      </tr>
    `).join('') : '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">Sin egresos en este periodo</td></tr>';

    // 2. Estructurar el HTML del reporte
    const htmlPrint = `
      <div id="print-content-section" style="font-family: sans-serif; padding: 20px; color: #1e293b; background: white;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 5px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px;">
          <div>
            <h1 style="margin: 0; font-size: 26px; font-weight: 900; text-transform: uppercase;">${businessName}</h1>
            <p style="margin: 5px 0 0; color: #3b82f6; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Analítica de Margen Real</p>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Rango de Tiempo</h2>
            <p style="margin: 5px 0 0; font-weight: bold; font-size: 16px;">${period.charAt(0).toUpperCase() + period.slice(1)}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 30px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 12px; text-align: center;"><label style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">Ventas</label><br/><span style="font-size: 16px; font-weight: bold; color: #3b82f6;">$${stats.revenue.toLocaleString()}</span></div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 12px; text-align: center;"><label style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">Gastos</label><br/><span style="font-size: 16px; font-weight: bold; color: #ef4444;">$${stats.totalExpenses.toLocaleString()}</span></div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 12px; text-align: center;"><label style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">Neto</label><br/><span style="font-size: 16px; font-weight: bold; color: #10b981;">$${stats.profit.toLocaleString()}</span></div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 12px; text-align: center;"><label style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">Pendientes</label><br/><span style="font-size: 16px; font-weight: bold; color: #f59e0b;">$${stats.pending.toLocaleString()}</span></div>
        </div>

        <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 20px 0 10px; border-left: 4px solid #3b82f6; padding-left: 8px;">Detalle de Ingresos</div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead><tr><th style="text-align: left; font-size: 9px; background: #f1f5f9; padding: 8px;">Fecha</th><th style="text-align: left; font-size: 9px; background: #f1f5f9; padding: 8px;">Cliente</th><th style="text-align: center; font-size: 9px; background: #f1f5f9; padding: 8px;">Volumen</th><th style="text-align: right; font-size: 9px; background: #f1f5f9; padding: 8px;">Monto</th></tr></thead>
          <tbody>${incomeRows}</tbody>
        </table>

        <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 20px 0 10px; border-left: 4px solid #3b82f6; padding-left: 8px;">Detalle de Egresos</div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead><tr><th style="text-align: left; font-size: 9px; background: #f1f5f9; padding: 8px;">Fecha</th><th style="text-align: left; font-size: 9px; background: #f1f5f9; padding: 8px;">Concepto</th><th style="text-align: right; font-size: 9px; background: #f1f5f9; padding: 8px;">Monto</th></tr></thead>
          <tbody>${expenseRows}</tbody>
        </table>

        <div style="margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 15px;">REPORTE GENERADO EL ${dateStr}</div>
      </div>
    `;

    // TRUCO SUPREMO DE INTERCEPTACIÓN GLOBAL:
    // Guardamos el body original de la app de React
    const originalBody = document.body.innerHTML;

    // Reemplazamos la pantalla completa con el HTML limpio del balance
    document.body.innerHTML = htmlPrint;

    // Forzamos la orden de impresión nativa desde la ventana principal (Hará reaccionar a Android de golpe)
    setTimeout(() => {
      window.print();
      
      // Una vez que se abre el menú, restauramos la interfaz completa de React como si nada hubiera pasado
      // Recargamos la ubicación para devolverle los eventos vivos al DOM de Vite/React sin alterar la sesión
      window.location.reload();
    }, 250);
  };
  const StatCard = ({ title, value, icon: Icon, iconColor, sub }: any) => (
    <div className="bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-[2rem] lg:rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group transition-all hover:border-slate-300 dark:hover:border-slate-700 h-full">
      <div className="relative z-10">
        <p className="text-[9px] lg:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-xl lg:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tighter leading-none">${value.toLocaleString()}</h3>
        <p className="text-[8px] lg:text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-2 uppercase tracking-tight">{sub}</p>
      </div>
      <div className={`absolute -right-4 lg:-right-6 -bottom-4 lg:-bottom-6 ${iconColor} opacity-[0.08] dark:opacity-[0.1] pointer-events-none transition-transform duration-700 group-hover:scale-125 group-hover:-rotate-12 print:hidden`}>
        <Icon size={140} strokeWidth={1} />
      </div>
    </div>
  );

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-slate-400 dark:text-blue-500" size={40} /></div>;

  return (
    <div className="space-y-6 lg:space-y-10 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Analítica</h1>
          <p className="text-xs lg:text-lg text-slate-500 dark:text-slate-400 font-medium">Margen real y flujo de caja.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={handleExportPDF}
            className="w-full sm:w-auto bg-slate-900 dark:bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-sm active:scale-95 border border-slate-800 dark:border-blue-500/30"
          >
            <Printer size={16} /> Exportar Balance PDF
          </button>
          <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-full lg:w-auto overflow-hidden">
            {(['hoy', 'semana', 'mes', 'año'] as DashboardPeriod[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`flex-1 lg:px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${period === p ? 'bg-slate-900 dark:bg-blue-600/20 text-white dark:text-blue-400 border border-slate-800 dark:border-blue-500/30 shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8">
        <StatCard title="Ventas Brutas" value={stats.revenue} icon={DollarSign} iconColor="text-blue-600" sub="Ingreso en Caja" />
        <StatCard title="Egresos Totales" value={stats.totalExpenses} icon={TrendingDown} iconColor="text-rose-600" sub="Total Salidas de Caja" />
        <StatCard title="Utilidad Neta" value={stats.profit} icon={PieIcon} iconColor="text-emerald-600" sub="Ganancia Real Acumulada" />
        <StatCard title="Por Cobrar" value={stats.pending} icon={Users} iconColor="text-amber-600" sub="Deuda Clientes" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 lg:p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <h3 className="text-[10px] lg:text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-8 flex items-center gap-2">
            <ArrowUpRight className="text-blue-600" size={16} /> Flujo de Ingreso Bruto
          </h3>
          <div className="h-64 lg:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                   contentStyle={{ 
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', 
                    borderRadius: '24px', 
                    border: isDarkMode ? '1px solid #1e293b' : '1px solid #f1f5f9',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                    fontSize: '11px',
                    fontWeight: '800'
                  }} 
                />
                <Area type="monotone" dataKey="ingresos" stroke="#3b82f6" strokeWidth={4} fill="#3b82f6" fillOpacity={0.05} />
                <Area type="monotone" dataKey="gastos" stroke="#f43f5e" strokeWidth={4} fill="#f43f5e" fillOpacity={0.05} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 lg:p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <h3 className="text-[10px] lg:text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-8 flex items-center gap-2">
            <PieIcon className="text-blue-600" size={16} /> Rentabilidad por Categoría
          </h3>
          
          <div className="flex-1 space-y-8 overflow-y-auto hide-scrollbar px-2">
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg"><Award size={14}/></div>
                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-tight">Top Márgenes Netos ($)</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 40, left: 40, bottom: 0 }}>
                    <Pie 
                      activeIndex={activeProfitIndex}
                      activeShape={renderActiveShape}
                      data={profitPieData} 
                      innerRadius={40} 
                      outerRadius={55} 
                      paddingAngle={5} 
                      dataKey="value"
                      onMouseEnter={(_, index) => setActiveProfitIndex(index)}
                      onClick={(_, index) => setActiveProfitIndex(index)}
                    >
                      {profitPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke={isDarkMode ? '#0f172a' : '#ffffff'} />)}
                    </Pie>
                    <Tooltip cursor={{ fill: 'transparent' }} content={() => null} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 px-2">
                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg"><Target size={14}/></div>
                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-tight">Volumen de Unidades</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 40, left: 40, bottom: 0 }}>
                    <Pie 
                      activeIndex={activeUnitsIndex}
                      activeShape={renderActiveShape}
                      data={unitsPieData} 
                      innerRadius={40} 
                      outerRadius={55} 
                      paddingAngle={5} 
                      dataKey="value"
                      onMouseEnter={(_, index) => setActiveUnitsIndex(index)}
                      onClick={(_, index) => setActiveUnitsIndex(index)}
                    >
                      {unitsPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke={isDarkMode ? '#0f172a' : '#ffffff'} />)}
                    </Pie>
                    <Tooltip cursor={{ fill: 'transparent' }} content={() => null} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
