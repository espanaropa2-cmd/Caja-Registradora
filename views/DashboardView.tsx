
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
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} textAnchor={textAnchor} fill="#1e293b" style={{ fontSize: '10px', fontWeight: '900' }}>
        {typeof value === 'number' && value >= 100 ? `$${value.toLocaleString()}` : value}
      </text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} dy={12} textAnchor={textAnchor} fill="#94a3b8" style={{ fontSize: '8px', fontWeight: 'bold' }}>
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

const DashboardView: React.FC = () => {
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
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const incomeRows = filteredData.fSales.length > 0 ? filteredData.fSales.map(s => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">${new Date(s.date).toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">${clientMap[s.clientId || ''] || 'Venta Contado'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; text-align: center;">${s.items.reduce((a, it) => a + it.quantity, 0)} uds</td>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; text-align: right; font-weight: bold; color: #3b82f6;">$${s.total.toLocaleString()}</td>
      </tr>
    `).join('') : '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">Sin ingresos en este periodo</td></tr>';

    const expenseRows = filteredData.fExpenses.length > 0 ? filteredData.fExpenses.map(e => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">${new Date(e.date).toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">${e.description}</td>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; text-align: right; font-weight: bold; color: #ef4444;">$${e.amount.toLocaleString()}</td>
      </tr>
    `).join('') : '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">Sin egresos en este periodo</td></tr>';

    printWindow.document.write(`
      <html>
        <head>
          <title>Balance Operativo - ${businessName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; background: white; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 5px solid #3b82f6; padding-bottom: 25px; margin-bottom: 30px; }
            .business-info h1 { margin: 0; font-size: 32px; font-weight: 900; text-transform: uppercase; color: #1e293b; letter-spacing: -1px; }
            .business-info p { margin: 5px 0 0; color: #3b82f6; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; }
            .report-meta { text-align: right; }
            .report-meta h2 { margin: 0; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
            .report-meta p { margin: 5px 0 0; font-weight: 900; font-size: 18px; color: #1e293b; }
            
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 40px; }
            .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 20px; text-align: center; }
            .summary-card label { font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 4px; }
            .summary-card span { font-size: 20px; font-weight: 900; }

            .section-title { font-size: 14px; font-weight: 900; text-transform: uppercase; color: #1e293b; margin: 40px 0 15px; display: flex; align-items: center; border-left: 5px solid #3b82f6; padding-left: 12px; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { text-align: left; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; padding: 12px 10px; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; }
            
            .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 700; border-top: 1px solid #f1f5f9; padding-top: 30px; letter-spacing: 0.5px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="business-info">
              <h1>${businessName}</h1>
              <p>Analítica de Margen Real</p>
            </div>
            <div class="report-meta">
              <h2>Rango de Tiempo</h2>
              <p>${period.charAt(0).toUpperCase() + period.slice(1)}</p>
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-card"><label>Ventas Brutas</label><span style="color: #3b82f6;">$${stats.revenue.toLocaleString()}</span></div>
            <div class="summary-card"><label>Gastos Globales</label><span style="color: #ef4444;">$${stats.totalExpenses.toLocaleString()}</span></div>
            <div class="summary-card"><label>Ganancia Neta</label><span style="color: #10b981;">$${stats.profit.toLocaleString()}</span></div>
            <div class="summary-card"><label>CxC Pendientes</label><span style="color: #f59e0b;">$${stats.pending.toLocaleString()}</span></div>
          </div>

          <div class="section-title">Detalle Exhaustivo de Ingresos</div>
          <table>
            <thead><tr><th>Fecha / Hora</th><th>Cliente</th><th style="text-align: center;">Volumen</th><th style="text-align: right;">Monto Total</th></tr></thead>
            <tbody>${incomeRows}</tbody>
          </table>

          <div class="section-title">Detalle de Egresos</div>
          <table>
            <thead><tr><th>Fecha / Hora</th><th>Concepto</th><th style="text-align: right;">Monto</th></tr></thead>
            <tbody>${expenseRows}</tbody>
          </table>

          <div class="footer">REPORTE OFICIAL GENERADO POR CAJA PRO EL ${dateStr}</div>
          <script>window.onload = () => { setTimeout(() => { window.print(); }, 700); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const StatCard = ({ title, value, icon: Icon, iconColor, sub }: any) => (
    <div className="bg-white p-6 lg:p-8 rounded-[2rem] lg:rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group transition-all hover:border-blue-100 h-full">
      <div className="relative z-10">
        <p className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-xl lg:text-4xl font-black text-slate-800 tracking-tighter leading-none">${value.toLocaleString()}</h3>
        <p className="text-[8px] lg:text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tight">{sub}</p>
      </div>
      <div className={`absolute -right-4 lg:-right-6 -bottom-4 lg:-bottom-6 ${iconColor} opacity-[0.08] lg:opacity-[0.06] pointer-events-none transition-transform duration-700 group-hover:scale-125 group-hover:-rotate-12 print:hidden`}>
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
          <p className="text-xs lg:text-lg text-slate-500 font-medium">Margen real y flujo de caja.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={handleExportPDF}
            className="w-full sm:w-auto bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95"
          >
            <Printer size={16} /> Exportar Balance PDF
          </button>
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-full lg:w-auto">
            {(['hoy', 'semana', 'mes', 'año'] as DashboardPeriod[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`flex-1 lg:px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${period === p ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
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
        <div className="lg:col-span-2 bg-white p-6 lg:p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden">
          <h3 className="text-[10px] lg:text-xs font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
            <ArrowUpRight className="text-blue-600" size={16} /> Flujo de Ingreso Bruto
          </h3>
          <div className="h-64 lg:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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

        <div className="bg-white p-6 lg:p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-[10px] lg:text-xs font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
            <PieIcon className="text-blue-600" size={16} /> Rentabilidad por Categoría
          </h3>
          
          <div className="flex-1 space-y-8 overflow-y-auto hide-scrollbar px-2">
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Award size={14}/></div>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-tight">Top Márgenes Netos ($)</span>
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
                      {profitPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip cursor={{ fill: 'transparent' }} content={() => null} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 px-2">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Target size={14}/></div>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-tight">Volumen de Unidades</span>
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
                      {unitsPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
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
