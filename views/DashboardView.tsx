
import React, { useMemo, useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend, Sector } from 'recharts';
import { dbService } from '../services/dbService';
import { DollarSign, TrendingDown, Package, Users, PieChart as PieIcon, Printer, Loader2, ArrowUpRight, Award, Target, X, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Sale, Expense, Product, Client, SaleStatus } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const [focalDate, setFocalDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [prevMonthClosureDone, setPrevMonthClosureDone] = useState<boolean>(true); // default to true so it doesn't flash before check
  const [prevMonthYearStr, setPrevMonthYearStr] = useState<string>('');
  const [prevMonthName, setPrevMonthName] = useState<string>('');
  
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

    // Comprobar cierre del mes anterior
    const checkClosure = async () => {
      try {
        const now = new Date();
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const year = prevDate.getFullYear();
        const monthNumber = prevDate.getMonth();
        const yearMonthStr = `${year}-${String(monthNumber + 1).padStart(2, '0')}`;
        setPrevMonthYearStr(yearMonthStr);
        
        const monthLabels = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        setPrevMonthName(monthLabels[monthNumber]);

        const alreadyDone = await dbService.checkMonthlyClosureSent(yearMonthStr);
        setPrevMonthClosureDone(alreadyDone);
      } catch (err) {
        console.error("Error al comprobar cierre mensual:", err);
      }
    };
    checkClosure();
  }, []);

  const { startDate, endDate } = useMemo(() => {
    let start = new Date(focalDate);
    let end = new Date(focalDate);

    if (period === 'hoy') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'semana') {
      // Monday to Sunday of the focalDate's week
      const day = focalDate.getDay();
      const distanceToMonday = day === 0 ? -6 : 1 - day;
      start.setDate(focalDate.getDate() + distanceToMonday);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'mes') {
      // 1st of the month to last of the month
      start = new Date(focalDate.getFullYear(), focalDate.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(focalDate.getFullYear(), focalDate.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'año') {
      // Jan 1st to Dec 31st of that year
      start = new Date(focalDate.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(focalDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    return { startDate: start, endDate: end };
  }, [period, focalDate]);

  const filteredData = useMemo(() => {
    return { 
      fSales: sales.filter(s => {
        const d = new Date(s.date);
        return d >= startDate && d <= endDate;
      }), 
      fExpenses: expenses.filter(e => {
        const d = new Date(e.date);
        return d >= startDate && d <= endDate;
      }) 
    };
  }, [sales, expenses, startDate, endDate]);

  const profileData = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('cajapro_profile') || '{}');
    } catch {
      return {};
    }
  }, []);

  const monthlyOperatingExpenses = profileData.monthlyOperatingExpenses || 0;
  const monthlySalaries = profileData.monthlySalaries || 0;
  const initialInvestmentAmount = profileData.initialInvestmentAmount || 0;
  const initialInvestmentLifeMonths = profileData.initialInvestmentLifeMonths || 0;

  const amortization = initialInvestmentLifeMonths > 0 ? (initialInvestmentAmount / initialInvestmentLifeMonths) : 0;
  const monthlyFixedCosts = monthlyOperatingExpenses + monthlySalaries + amortization;

  const factor = useMemo(() => {
    if (period === 'hoy') return 1 / 30;
    if (period === 'semana') return 7 / 30;
    if (period === 'mes') return 1;
    if (period === 'año') return 12;
    return 1;
  }, [period]);

  const proratedFixedCosts = monthlyFixedCosts * factor;

  const totalCashReceived = useMemo(() => {
    let total = 0;
    sales.forEach(s => {
      const saleDate = new Date(s.date);
      const saleInPeriod = saleDate >= startDate && saleDate <= endDate;

      const payments = s.payments || [];
      const paymentsInPeriod = payments.filter(p => {
        const pd = new Date(p.date);
        return pd >= startDate && pd <= endDate;
      });
      const sumPaymentsInPeriod = paymentsInPeriod.reduce((acc, p) => acc + p.amount, 0);

      if (sumPaymentsInPeriod > 0) {
        total += sumPaymentsInPeriod;
      } else if (saleInPeriod) {
        total += s.amountPaid || 0;
      }
    });
    return total;
  }, [sales, startDate, endDate]);

  const stats = useMemo(() => {
    // 1. Ventas Brutas (revenue) of the filtered period:
    // "las ventas brutas deben ser la sumatoria del precio de venta de cada producto vendido." (for filteredData.fSales)
    const revenue = filteredData.fSales.reduce((acc, s) => {
      const saleSum = s.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      return acc + saleSum;
    }, 0);

    // 2. Utilidad Neta (profit) of the filtered period:
    // "la utilidad neta en el dashboard debe ser únicamente la suma de ese margen de ganancia de cada producto vendido."
    const productMap = products.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as any);
    const profit = filteredData.fSales.reduce((acc, s) => {
      const saleMargin = s.items.reduce((m, item) => {
        const prod = productMap[item.productId];
        const cost = prod?.cost || 0;
        return m + ((item.price - cost) * item.quantity);
      }, 0);
      return acc + saleMargin;
    }, 0);

    // 3. Egresos Totales (totalExpenses) of the filtered period (for indicator card display):
    const traditionalExpenses = filteredData.fExpenses.reduce((acc, e) => acc + e.amount, 0);
    const totalExpenses = traditionalExpenses + proratedFixedCosts;

    // 4. Money Pending / Accounts Receivable ("dinero por cobrar") as of endDate:
    // "todos estos datos serán tomados hasta la culminación de la fecha colocada en la vista del dashboard...
    // (por lo que si estamos viendo fechas anteriores, no se contaran ninguna de las transacciones realizadas después de la fecha colocada)"
    
    // Helper to calculate a sale's debt as of a certain endDate
    const getSaleDebtAtDate = (s: Sale, limitDate: Date) => {
      if (!s.clientId) return 0;
      
      const salePayments = s.payments || [];
      
      if (salePayments.length === 0) {
        if (s.status === SaleStatus.CREDIT) {
          return Math.max(0, s.total - (s.amountPaid || 0));
        }
        return 0;
      }
      
      // Let's find the initial payment. This is the earliest payment, or any payment on the same day as the sale.
      const sortedPayments = [...salePayments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const firstPayment = sortedPayments[0];
      
      // If the first payment equaled the total, it was a cash sale from the beginning, so no debt.
      if (firstPayment.amount >= s.total && new Date(firstPayment.date).getTime() <= new Date(s.date).getTime() + 60000) {
        return 0; 
      }
      
      const paymentsBeforeEnd = salePayments.filter(p => new Date(p.date) <= limitDate);
      const amountPaidBeforeEnd = paymentsBeforeEnd.reduce((sum, p) => sum + p.amount, 0);
      
      return Math.max(0, s.total - amountPaidBeforeEnd);
    };

    const salesUpToDate = sales.filter(s => new Date(s.date) <= endDate);
    const pending = salesUpToDate.reduce((acc, s) => {
      return acc + getSaleDebtAtDate(s, endDate);
    }, 0);

    // 5. Cumulative Gross Sales up to endDate
    const cumulativeGrossSalesValue = salesUpToDate.reduce((acc, s) => {
      const saleTotalFromItems = s.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      return acc + saleTotalFromItems;
    }, 0);

    // 6. Cumulative traditional expenses registered up to endDate
    const cumulativeExpensesValue = expenses
      .filter(e => new Date(e.date) <= endDate)
      .reduce((acc, e) => acc + e.amount, 0);

    // 7. Efectivo Real (realCash) as of endDate:
    // "El efectivo real debe ser siempre... la resta de las ventas brutas - los egresos totales - el dinero por cobrar; todos estos datos serán tomados hasta la culminación de la fecha colocada..."
    const realCash = cumulativeGrossSalesValue - cumulativeExpensesValue - pending;

    return { 
      revenue, 
      totalExpenses, // Total global de egresos (tradicionales + costos fijos prorrateados) de periodo
      profit, 
      realCash,
      pending 
    };
  }, [filteredData, products, sales, expenses, endDate, proratedFixedCosts]);

  const chartData = useMemo(() => {
    if (period === 'hoy') {
      const data = [];
      for (let i = 0; i <= 23; i++) {
        const d = new Date(startDate);
        d.setHours(i, 0, 0, 0);
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

    if (period === 'semana') {
      const data = [];
      const weekdaysNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const daySales = sales.filter(s => new Date(s.date).toDateString() === d.toDateString());
        const dayExpenses = expenses.filter(e => new Date(e.date).toDateString() === d.toDateString());
        data.push({
          name: `${weekdaysNames[i]} ${d.getDate()}`,
          ingresos: daySales.reduce((acc, s) => acc + (s.total || 0), 0),
          gastos: dayExpenses.reduce((acc, e) => acc + e.amount, 0)
        });
      }
      return data;
    }

    if (period === 'mes') {
      const data = [];
      const lastDay = endDate.getDate();
      for (let i = 1; i <= lastDay; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth(), i);
        const daySales = sales.filter(s => new Date(s.date).toDateString() === d.toDateString());
        const dayExpenses = expenses.filter(e => new Date(e.date).toDateString() === d.toDateString());
        data.push({
          name: i.toString(),
          ingresos: daySales.reduce((acc, s) => acc + (s.total || 0), 0),
          gastos: dayExpenses.reduce((acc, e) => acc + e.amount, 0)
        });
      }
      return data;
    }

    // Año
    const data = [];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    for (let i = 0; i < 12; i++) {
      const monthSales = sales.filter(s => {
        const sd = new Date(s.date);
        return sd.getFullYear() === startDate.getFullYear() && sd.getMonth() === i;
      });
      const monthExpenses = expenses.filter(e => {
        const ed = new Date(e.date);
        return ed.getFullYear() === startDate.getFullYear() && ed.getMonth() === i;
      });
      data.push({
        name: monthNames[i],
        ingresos: monthSales.reduce((acc, s) => acc + (s.total || 0), 0),
        gastos: monthExpenses.reduce((acc, e) => acc + e.amount, 0)
      });
    }
    return data;
  }, [sales, expenses, period, startDate, endDate]);

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

  const handlePrevPeriod = () => {
    setFocalDate(prev => {
      const d = new Date(prev);
      if (period === 'hoy') d.setDate(d.getDate() - 1);
      else if (period === 'semana') d.setDate(d.getDate() - 7);
      else if (period === 'mes') d.setMonth(d.getMonth() - 1);
      else if (period === 'año') d.setFullYear(d.getFullYear() - 1);
      return d;
    });
  };

  const handleNextPeriod = () => {
    setFocalDate(prev => {
      const d = new Date(prev);
      if (period === 'hoy') d.setDate(d.getDate() + 1);
      else if (period === 'semana') d.setDate(d.getDate() + 7);
      else if (period === 'mes') d.setMonth(d.getMonth() + 1);
      else if (period === 'año') d.setFullYear(d.getFullYear() + 1);
      return d;
    });
  };

  const periodLabel = useMemo(() => {
    if (period === 'hoy') {
      return focalDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (period === 'semana') {
      const startStr = startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      const endStr = endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
    if (period === 'mes') {
      return focalDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
    return `Año ${focalDate.getFullYear()}`;
  }, [period, focalDate, startDate, endDate]);

  const clientMap = useMemo(() => {
    return clients.reduce((acc, c) => {
      acc[c.id] = c.name;
      return acc;
    }, {} as Record<string, string>);
  }, [clients]);

  const movements = useMemo(() => {
    const saleMovs = filteredData.fSales.map(s => {
      const clientName = clientMap[s.clientId || ''] || 'Venta al Contado';
      const itemsList = s.items?.map(it => `${it.name} (x${it.quantity})`).join(', ') || '';
      return {
        id: s.id,
        date: new Date(s.date),
        type: 'ingreso' as const,
        concept: `Venta - ${clientName}`,
        details: itemsList,
        amount: s.total
      };
    });

    const expenseMovs = filteredData.fExpenses.map(e => {
      return {
        id: e.id,
        date: new Date(e.date),
        type: 'egreso' as const,
        concept: `${e.category} - ${e.description}`,
        details: 'Gasto registrado en caja',
        amount: e.amount
      };
    });

    return [...saleMovs, ...expenseMovs].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filteredData, clientMap]);

  const formatDateTime = (date: Date) => {
    const d = new Date(date);
    const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dateStr} ${timeStr}`;
  };

  const handlePeriodChange = (p: DashboardPeriod) => {
    setPeriod(p);
    setFocalDate(new Date());
  };

  const handlePrintReport = async () => {
    setIsPrinting(true);
    
    // 1. Intentar activar diálogo de impresión del navegador
    try {
      window.print();
    } catch (err) {
      console.warn("window.print() no disponible en el contexto actual", err);
    }

    // 2. Descargar PDF directo usando jsPDF & html2canvas como fallback garantizado en iframes
    try {
      const reportElement = document.getElementById('printable-report-area');
      if (!reportElement) {
        throw new Error('Contenedor de reporte no encontrado');
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(reportElement, {
        scale: 2, // Calidad retina
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
        windowHeight: reportElement.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 15;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pdfHeight - 30);

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 15;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= (pdfHeight - 30);
      }

      const dateStr = new Date().toLocaleDateString().replace(/\//g, '-');
      pdf.save(`Balance_Comercial_${period}_${dateStr}.pdf`);
    } catch (error) {
      console.error("Error al exportar PDF de balance:", error);
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintPrevMonthClosure = async () => {
    try {
      setIsPrinting(true);
      
      // 1. Ajustar el periodo al mes anterior para cargar los datos correctos
      const now = new Date();
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setPeriod('mes');
      setFocalDate(prevDate);
      
      // 2. Dar tiempo para el renderizado del periodo antes de exportar
      setTimeout(async () => {
        try {
          window.print();
        } catch (err) {
          console.warn("window.print() no disponible", err);
        }

        try {
          const reportElement = document.getElementById('printable-report-area');
          if (reportElement) {
            const canvas = await html2canvas(reportElement, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff',
              windowWidth: 800,
              windowHeight: reportElement.scrollHeight
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const pdfHeight = 297;
            const imgWidth = 190;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 15;

            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= (pdfHeight - 30);

            while (heightLeft > 0) {
              position = heightLeft - imgHeight + 15;
              pdf.addPage();
              pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight, undefined, 'FAST');
              heightLeft -= (pdfHeight - 30);
            }

            pdf.save(`Balance_Mensual_Cierre_${prevMonthName}_${prevMonthYearStr}.pdf`);
          }
        } catch (err) {
          console.error("Error al generar PDF del mes anterior:", err);
        }

        // 3. Registrar cierre del mes como completado para ocultar el botón recordatorio
        if (prevMonthYearStr) {
          await dbService.markMonthlyClosureSent(prevMonthYearStr);
          setPrevMonthClosureDone(true);
        }
        setIsPrinting(false);
      }, 1000);
    } catch (err) {
      console.error("Error al iniciar cierre mensual:", err);
      setIsPrinting(false);
    }
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
    <div className="space-y-6 lg:space-y-10 pb-10 relative">
      
      {/* SECCIÓN INTERACTIVA INDISPENSABLE PARA PANTALLA (OCULTA EN IMPRESIÓN) */}
      <div className="print:hidden space-y-6 lg:space-y-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Analítica</h1>
            <p className="text-xs lg:text-lg text-slate-500 dark:text-slate-400 font-medium">Margen real y flujo de caja.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            {/* Botones de impresión */}
            <button 
              onClick={handlePrintReport}
              disabled={isPrinting}
              className="inline-flex items-center gap-2 bg-slate-900 dark:bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-sm active:scale-95 border border-slate-800 dark:border-blue-500/30 disabled:opacity-50"
            >
              {isPrinting ? <Loader2 className="animate-spin" size={16} /> : <Printer size={16} />} 
              Imprimir Balance
            </button>

            {!prevMonthClosureDone && (
              <button 
                onClick={handlePrintPrevMonthClosure}
                disabled={isPrinting}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(16,185,129,0.7)] hover:shadow-[0_0_25px_rgba(16,185,129,0.9)] animate-pulse active:scale-95 border border-emerald-500/30 disabled:opacity-50 font-sans"
              >
                {isPrinting ? <Loader2 className="animate-spin" size={16} /> : <Printer size={16} />}
                Imprimir balance de {prevMonthName}
              </button>
            )}

            <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-full lg:w-auto overflow-hidden">
              {(['hoy', 'semana', 'mes', 'año'] as DashboardPeriod[]).map(p => (
                <button key={p} onClick={() => handlePeriodChange(p)} className={`flex-1 lg:px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${period === p ? 'bg-slate-900 dark:bg-blue-600/20 text-white dark:text-blue-400 border border-slate-800 dark:border-blue-500/30 shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Navegación de Intervalos Temporales */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-6 py-4 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 shadow-sm max-w-xl mx-auto w-full">
          <button 
            onClick={handlePrevPeriod}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition-all active:scale-90"
            title="Periodo anterior"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Periodo Visualizado</p>
            <span className="text-xs lg:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {periodLabel}
            </span>
          </div>
          <button 
            onClick={handleNextPeriod}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition-all active:scale-90"
            title="Periodo siguiente"
          >
            <ChevronRight size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
          <StatCard title="Ventas Brutas" value={stats.revenue} icon={DollarSign} iconColor="text-blue-600" sub="Total Devengado" />
          <StatCard title="Egresos Totales" value={stats.totalExpenses} icon={TrendingDown} iconColor="text-rose-600" sub="Salidas + Costos Prorrateados" />
          <StatCard title="Efectivo Real" value={stats.realCash} icon={DollarSign} iconColor="text-indigo-600" sub="Caja de Dinero Físico" />
          <StatCard title="Utilidad Neta" value={stats.profit} icon={PieIcon} iconColor="text-emerald-600" sub="Rendimiento Contable" />
          <StatCard title="Por Cobrar" value={stats.pending} icon={Users} iconColor="text-amber-600" sub="Cuentas Pendientes" />
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

      {/* ÁREA DE IMPRESIÓN PROFESIONAL (SÓLO DESTELLO PARA PRINTPREVIEW & FALLBACK) */}
      <div 
        className="print-container-wrapper"
        style={{ 
          position: 'absolute', 
          width: '800px', 
          height: '0px', 
          overflow: 'hidden', 
          pointerEvents: 'none', 
          zIndex: -100,
          left: '0px',
          top: '0px'
        }}
      >
        <div 
          id="printable-report-area" 
          className="relative w-[800px] p-10 font-sans border-2 border-slate-950"
          style={{ backgroundColor: '#ffffff', color: '#000000' }}
        >
        {/* Cabecera Corporativa */}
        <div className="border-b-2 border-slate-950 pb-6 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-black" style={{ color: '#000000' }}>
              {businessName || profileData.businessName || 'Caja Registradora'}
            </h1>
            <p className="text-xs uppercase tracking-widest font-black text-black mt-1" style={{ color: '#000000' }}>
              Reporte de Balances y Movimientos
            </p>
            <p className="text-xs text-black mt-2 font-mono" style={{ color: '#000000' }}>
              ID Negocio: {profileData.id || 'Local/Offline'}
            </p>
          </div>
          
          <div className="text-right font-mono text-[10px] text-black space-y-1" style={{ color: '#000000' }}>
            <p><span className="font-extrabold uppercase text-[9px] tracking-wider text-black mr-1" style={{ color: '#000000' }}>Periodo:</span> {periodLabel}</p>
            <p><span className="font-extrabold uppercase text-[9px] tracking-wider text-black mr-1" style={{ color: '#000000' }}>Emisión:</span> {new Date().toLocaleDateString('es-ES')} {new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}</p>
            <p><span className="font-extrabold uppercase text-[9px] tracking-wider text-black mr-1" style={{ color: '#000000' }}>Usuario:</span> {profileData.email || 'Admin/Cajero'}</p>
          </div>
        </div>

        {/* Sección de Reconteo (Top Metrics Panels) */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          <div className="border-2 border-slate-950 p-4 rounded-xl bg-white" style={{ backgroundColor: '#ffffff', borderColor: '#000000' }}>
            <p className="text-[10px] font-black uppercase tracking-wider text-black mb-1" style={{ color: '#000000' }}>Ventas Brutas</p>
            <p className="text-xl font-black font-mono text-emerald-950" style={{ color: '#022c22' }}>${stats.revenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
            <p className="text-[8px] text-emerald-955 font-black mt-1 uppercase" style={{ color: '#012c22' }}>Ingreso Total (+)</p>
          </div>
          <div className="border-2 border-slate-950 p-4 rounded-xl bg-white" style={{ backgroundColor: '#ffffff', borderColor: '#000000' }}>
            <p className="text-[10px] font-black uppercase tracking-wider text-black mb-1" style={{ color: '#000000' }}>Egresos Totales</p>
            <p className="text-xl font-black font-mono text-red-950" style={{ color: '#450a0a' }}>${stats.totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
            <p className="text-[8px] text-red-955 font-black mt-1 uppercase" style={{ color: '#450a0a' }}>Egreso Total (-)</p>
          </div>
          <div className="border-2 border-slate-950 p-4 rounded-xl bg-white" style={{ backgroundColor: '#ffffff', borderColor: '#000000' }}>
            <p className="text-[10px] font-black uppercase tracking-wider text-black mb-1 font-bold" style={{ color: '#000000' }}>Utilidad Neta</p>
            <p className="text-xl font-black font-mono animate-none" style={{ color: stats.profit >= 0 ? '#022c22' : '#450a0a' }}>
              {stats.profit >= 0 ? '+' : ''}${stats.profit.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[8px] text-black font-black mt-1 uppercase" style={{ color: '#000000' }}>Utilidad Operativa</p>
          </div>
          <div className="border-2 border-slate-950 p-4 rounded-xl bg-white" style={{ backgroundColor: '#ffffff', borderColor: '#000000' }}>
            <p className="text-[10px] font-black uppercase tracking-wider text-black mb-1" style={{ color: '#000000' }}>Por Cobrar</p>
            <p className="text-xl font-black font-mono text-amber-950" style={{ color: '#451a03' }}>${stats.pending.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
            <p className="text-[8px] text-amber-955 font-black mt-1 uppercase" style={{ color: '#451a03' }}>Cuentas Deudoras</p>
          </div>
        </div>

        {/* Tabla de Movimientos Detalle */}
        <div className="mb-8">
          <h3 className="text-xs font-black uppercase tracking-widest text-black mb-3 border-b-2 border-slate-950 pb-1" style={{ color: '#000000' }}>
            Detalle Cronológico de Movimientos ({movements.length})
          </h3>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-950 text-black uppercase text-[9px] tracking-wider font-black" style={{ color: '#000000' }}>
                <th className="py-2.5 w-[160px]">Fecha y Hora</th>
                <th className="py-2.5 w-[90px]">Tipo</th>
                <th className="py-2.5">Concepto / Detalles</th>
                <th className="py-2.5 text-right w-[120px]">Monto ($)</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-black font-black italic" style={{ color: '#000000' }}>
                    No se registraron transacciones de ingresos ni egresos en este periodo.
                  </td>
                </tr>
              ) : (
                <>
                  {movements.map((mov, i) => (
                    <tr key={mov.id + '-' + i} className="border-b border-slate-300 hover:bg-slate-50 font-medium">
                      <td className="py-2.5 font-mono text-black font-bold whitespace-nowrap" style={{ color: '#000000' }}>
                        {formatDateTime(mov.date)}
                      </td>
                      <td className="py-2.5">
                        <span className="inline-block text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider" style={
                          mov.type === 'ingreso' 
                            ? { backgroundColor: '#e6fbf1', color: '#022c22', border: '1px solid #059669', fontWeight: 'bold' } 
                            : { backgroundColor: '#fdf2f2', color: '#450a0a', border: '1px solid #dc2626', fontWeight: 'bold' }
                        }>
                          {mov.type === 'ingreso' ? 'Ingreso' : 'Egreso'}
                        </span>
                      </td>
                      <td className="py-2.5 text-black" style={{ color: '#000000' }}>
                        <p className="font-extrabold text-black" style={{ color: '#000000' }}>{mov.concept}</p>
                        {mov.details && <p className="text-[10px] text-black font-bold truncate max-w-sm mt-0.5" style={{ color: '#000000' }}>{mov.details}</p>}
                      </td>
                      <td className="py-2.5 text-right font-bold font-mono" style={{
                        color: mov.type === 'ingreso' ? '#022c22' : '#450a0a'
                      }}>
                        {mov.type === 'ingreso' ? '+' : '-'}${mov.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Fila de Costos Fijos si existen */}
                  {proratedFixedCosts > 0 && (
                    <tr className="border-b border-slate-300 font-medium bg-slate-100">
                      <td className="py-2.5 font-mono text-black font-bold italic" style={{ color: '#000000' }}>Préstamo/Cierre</td>
                      <td className="py-2.5">
                        <span className="inline-block text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider" style={{ backgroundColor: '#cbd5e1', color: '#0f172a', border: '1px solid #475569' }}>
                          Costos Op.
                        </span>
                      </td>
                      <td className="py-2.5 text-black" style={{ color: '#000000' }}>
                        <p className="font-extrabold italic">Costos Operativos Prorrateados</p>
                        <p className="text-[10px] text-black font-bold" style={{ color: '#000000' }}>Gastos de alquiler, sueldos y amortizaciones prorrateados del periodo.</p>
                      </td>
                      <td className="py-2.5 text-right font-bold font-mono text-black" style={{ color: '#000000' }}>
                        -${proratedFixedCosts.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Resumen Final de Cuadres en Tabla */}
        <div className="border-t-2 border-slate-950 pt-4 flex justify-between items-start mb-12">
          <div>
            <h4 className="text-[10px] font-black uppercase text-black mb-1 tracking-wider" style={{ color: '#000000' }}>Flujo de Caja Real</h4>
            <p className="text-[11px] text-black max-w-sm leading-normal font-bold" style={{ color: '#000000' }}>
              Dinero físico neto capturado de transacciones menos gastos totales directos y costos fijos. Caja chica actual: <strong style={{ color: '#000000' }}>${stats.realCash.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong>.
            </p>
          </div>
          <div className="w-[300px] shrink-0 font-mono text-xs space-y-1.5 border-2 border-slate-950 p-4 rounded-xl bg-white" style={{ backgroundColor: '#ffffff', borderColor: '#000000' }}>
            <div className="flex justify-between text-black font-bold" style={{ color: '#000000' }}>
              <span className="font-sans font-black text-black text-[9px] uppercase" style={{ color: '#000000' }}>Ventas totales (+):</span>
              <span style={{ color: '#012c22', fontWeight: 'black' }}>${stats.revenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-black font-bold" style={{ color: '#000000' }}>
              <span className="font-sans font-black text-black text-[9px] uppercase" style={{ color: '#000000' }}>Egresos en caja (-):</span>
              <span style={{ color: '#450a0a', fontWeight: 'black' }}>-${(filteredData.fExpenses.reduce((acc, e) => acc + e.amount, 0)).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-black font-bold" style={{ color: '#000000' }}>
              <span className="font-sans font-black text-black text-[9px] uppercase" style={{ color: '#000000' }}>Cargos fijos fijos (-):</span>
              <span style={{ color: '#000000', fontWeight: 'black' }}>-${proratedFixedCosts.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-black border-t-2 border-slate-950 pt-1 font-bold" style={{ color: '#000000' }}>
              <span className="font-sans font-black text-[9px] uppercase" style={{ color: '#451a03' }}>Por Cobrar (Deudas):</span>
              <span className="font-bold font-mono" style={{ color: '#451a03' }}>${stats.pending.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="border-t-2 border-slate-950 pt-1.5 flex justify-between font-black text-black border-dashed" style={{ borderColor: '#000000' }}>
              <span className="font-sans font-black text-[9px] uppercase text-black" style={{ color: '#000000' }}>Utilidad Neta Total:</span>
              <span className="font-bold font-mono" style={{ color: stats.profit >= 0 ? '#022c22' : '#450a0a' }}>
                ${stats.profit.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Firmas y Cláusula */}
        <div className="grid grid-cols-2 gap-12 text-center pt-8 border-t-2 border-slate-950">
          <div className="space-y-4">
            <div className="border-b-2 border-slate-950 w-48 mx-auto h-12"></div>
            <div>
              <p className="font-black text-xs text-black" style={{ color: '#000000' }}>{profileData.email || 'Admin Principal'}</p>
              <p className="text-[9px] text-black uppercase tracking-widest font-black" style={{ color: '#000000' }}>Preparado por</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="border-b-2 border-slate-950 w-48 mx-auto h-12"></div>
            <div>
              <p className="font-black text-xs text-black" style={{ color: '#000000' }}>Caja Registradora</p>
              <p className="text-[9px] text-black uppercase tracking-widest font-black" style={{ color: '#000000' }}>Revisado y Aprobado</p>
            </div>
          </div>
        </div>
        
        <div className="mt-12 text-center text-[10px] text-black font-black font-mono leading-none border-t-2 border-slate-950 pt-4" style={{ color: '#000000' }}>
          CajaPro - Sistema de Gestión Comercial Intuitiva. Reporte autogenerado para {profileData.email || 'Usuario Principal'}.
        </div>
      </div>
    </div>
    </div>
  );
};

export default DashboardView;
