
import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { Expense, ExpenseCategory, UserProfile, OperatingExpenseItem, SalaryItem } from '../types';
import { TrendingDown, Plus, DollarSign, Tag, Edit2, Trash2, Loader2, X, AlertTriangle, Layers, FileUp, FileText, Banknote, Save, Info, Lock, Unlock, Check } from 'lucide-react';
import Papa from 'papaparse';

interface ExpensesViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => Promise<void>;
}

const ExpensesView: React.FC<ExpensesViewProps> = ({ user, onUpdateUser }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [savingCosts, setSavingCosts] = useState(false);
  const [registeringItem, setRegisteringItem] = useState<string | null>(null);

  const [isLocked, setIsLocked] = useState(true);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const currentMonthStr = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
  const [isGlowDismissed, setIsGlowDismissed] = useState(() => {
    return localStorage.getItem(`glow_dismissed_${user.id}_${currentMonthStr}`) === 'true';
  });

  const [formData, setFormData] = useState({
    monthlyOperatingExpenses: user.monthlyOperatingExpenses || 0,
    monthlySalaries: user.monthlySalaries || 0,
    initialInvestmentAmount: user.initialInvestmentAmount || 0,
    initialInvestmentLifeMonths: user.initialInvestmentLifeMonths || 0
  });

  const [operatingExpenses, setOperatingExpenses] = useState<OperatingExpenseItem[]>(() => {
    if (user.operatingExpensesList && user.operatingExpensesList.length > 0) {
      return [...user.operatingExpensesList];
    }
    if (user.monthlyOperatingExpenses && user.monthlyOperatingExpenses > 0) {
      return [{ id: '1', name: 'Gastos Operativos Generales', amount: user.monthlyOperatingExpenses }];
    }
    return [{ id: crypto.randomUUID(), name: '', amount: 0 }];
  });

  const [salaries, setSalaries] = useState<SalaryItem[]>(() => {
    if (user.salariesList && user.salariesList.length > 0) {
      return [...user.salariesList];
    }
    if (user.monthlySalaries && user.monthlySalaries > 0) {
      return [{ id: '1', employeeName: 'Nómina General', salary: user.monthlySalaries }];
    }
    return [{ id: crypto.randomUUID(), employeeName: '', salary: 0 }];
  });

  useEffect(() => {
    setFormData({
      monthlyOperatingExpenses: user.monthlyOperatingExpenses || 0,
      monthlySalaries: user.monthlySalaries || 0,
      initialInvestmentAmount: user.initialInvestmentAmount || 0,
      initialInvestmentLifeMonths: user.initialInvestmentLifeMonths || 0
    });

    if (user.operatingExpensesList && user.operatingExpensesList.length > 0) {
      setOperatingExpenses([...user.operatingExpensesList]);
    } else if (user.monthlyOperatingExpenses && user.monthlyOperatingExpenses > 0) {
      setOperatingExpenses([{ id: 'default', name: 'Gastos Operativos Generales', amount: user.monthlyOperatingExpenses }]);
    } else {
      setOperatingExpenses([{ id: crypto.randomUUID(), name: '', amount: 0 }]);
    }

    if (user.salariesList && user.salariesList.length > 0) {
      setSalaries([...user.salariesList]);
    } else if (user.monthlySalaries && user.monthlySalaries > 0) {
      setSalaries([{ id: 'default', employeeName: 'Nómina General', salary: user.monthlySalaries }]);
    } else {
      setSalaries([{ id: crypto.randomUUID(), employeeName: '', salary: 0 }]);
    }
  }, [user]);

  const addOperatingExpense = () => {
    setOperatingExpenses([
      ...operatingExpenses,
      { id: crypto.randomUUID(), name: '', amount: 0 }
    ]);
  };

  const removeOperatingExpense = (id: string) => {
    const updated = operatingExpenses.filter(item => item.id !== id);
    if (updated.length === 0) {
      setOperatingExpenses([{ id: crypto.randomUUID(), name: '', amount: 0 }]);
    } else {
      setOperatingExpenses(updated);
    }
  };

  const updateOperatingExpense = (id: string, field: 'name' | 'amount', value: any) => {
    setOperatingExpenses(operatingExpenses.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const addSalary = () => {
    setSalaries([
      ...salaries,
      { id: crypto.randomUUID(), employeeName: '', salary: 0 }
    ]);
  };

  const removeSalary = (id: string) => {
    const updated = salaries.filter(item => item.id !== id);
    if (updated.length === 0) {
      setSalaries([{ id: crypto.randomUUID(), employeeName: '', salary: 0 }]);
    } else {
      setSalaries(updated);
    }
  };

  const updateSalary = (id: string, field: 'employeeName' | 'salary', value: any) => {
    setSalaries(salaries.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const totalOperatingExpenses = operatingExpenses.reduce((acc, item) => acc + (item.amount || 0), 0);
  const totalSalaries = salaries.reduce((acc, item) => acc + (item.salary || 0), 0);

  const isFixedCostPaidThisMonth = (name: string | undefined, type: 'operating' | 'salary') => {
    if (!name || name.trim() === '') return false;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return expenses.some(exp => {
      if (!exp.date) return false;
      const expDate = new Date(exp.date);
      if (isNaN(expDate.getTime())) return false;
      
      const isSameMonth = expDate.getFullYear() === currentYear && expDate.getMonth() === currentMonth;
      if (!isSameMonth) return false;

      const expectedDesc = type === 'operating' ? `${name.trim()} (Gasto Operativo)` : `Nómina - ${name.trim()}`;
      return exp.description === expectedDesc;
    });
  };

  const hasUnpaidFixedCosts = React.useMemo(() => {
    const pendingOp = operatingExpenses.some(oe => 
      oe.name && oe.name.trim() !== '' && oe.amount > 0 && !isFixedCostPaidThisMonth(oe.name, 'operating')
    );
    const pendingSal = salaries.some(sal => 
      sal.employeeName && sal.employeeName.trim() !== '' && sal.salary > 0 && !isFixedCostPaidThisMonth(sal.employeeName, 'salary')
    );
    return pendingOp || pendingSal;
  }, [operatingExpenses, salaries, expenses]);

  const shouldPulseRed = hasUnpaidFixedCosts && !isGlowDismissed;

  const handlePinKeyPress = (num: string) => {
    setPinError('');
    if (pinInput.length < 4) {
      const nextPin = pinInput + num;
      setPinInput(nextPin);
      if (nextPin.length === 4) {
        verifySecurityPin(nextPin);
      }
    }
  };

  const handlePinDelete = () => {
    setPinError('');
    setPinInput(pinInput.slice(0, -1));
  };

  const handlePinClear = () => {
    setPinInput('');
    setPinError('');
  };

  const verifySecurityPin = (enteredPin: string) => {
    const currentPin = user.dashboardPin || localStorage.getItem(`cajapro_pin_${user.id}`) || '';
    if (enteredPin === currentPin) {
      setIsLocked(false);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      
      localStorage.setItem(`glow_dismissed_${user.id}_${currentMonthStr}`, 'true');
      setIsGlowDismissed(true);
    } else {
      setPinError('PIN incorrecto. Intente nuevamente.');
      setPinInput('');
    }
  };

  const handleToggleFixedCostPaid = async (item: any, type: 'operating' | 'salary') => {
    const name = type === 'operating' ? item.name : item.employeeName;
    const amount = type === 'operating' ? item.amount : item.salary;

    if (!name || !name.trim() || !amount || amount <= 0) {
      alert('Por favor configure un nombre y monto válidos para este ítem antes de registrarlo.');
      return;
    }

    if (isFixedCostPaidThisMonth(name, type)) {
      alert('Este costo ya ha sido registrado en el historial para este mes.');
      return;
    }

    const desc = type === 'operating' ? `${name.trim()} (Gasto Operativo)` : `Nómina - ${name.trim()}`;
    const itemIdKey = `${item.id}_${type}`;

    try {
      setRegisteringItem(itemIdKey);
      await dbService.saveExpense({
        description: desc,
        amount: amount,
        category: 'Otros',
        date: new Date().toISOString()
      });

      // Refresh expenses list
      await loadExpenses();
    } catch (err: any) {
      console.error(err);
      alert('Error al registrar el gasto: ' + (err.message || String(err)));
    } finally {
      setRegisteringItem(null);
    }
  };

  useEffect(() => {
    if (!showPinModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePinKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handlePinDelete();
      } else if (e.key === 'Escape') {
        setShowPinModal(false);
        handlePinClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPinModal, pinInput]);

  const isOperatingItem = (expenseDesc: string) => {
    if (!expenseDesc) return false;
    const desc = expenseDesc.toLowerCase();
    
    // Si es un gasto transaccional de servicio (ej: "Servicio: Corte - Gasto: Loción"), no lo agrupamos en fijos
    if (desc.includes('servicio:')) {
      return false;
    }

    if (operatingExpenses.some(oe => 
      oe.name && oe.name.trim() !== '' && 
      (desc.includes(oe.name.toLowerCase().trim()) || oe.name.toLowerCase().trim().includes(desc))
    )) {
      return true;
    }
    if (desc.includes('operativo') || desc.includes('alquiler') || desc.includes('servicio') || desc.includes('luz') || desc.includes('agua') || desc.includes('internet')) {
      return true;
    }
    return false;
  };

  const isSalaryItem = (expenseDesc: string) => {
    if (!expenseDesc) return false;
    const desc = expenseDesc.toLowerCase();

    // Si es un gasto transaccional de servicio, no lo agrupamos en nóminas
    if (desc.includes('servicio:')) {
      return false;
    }

    if (salaries.some(sal => 
      sal.employeeName && sal.employeeName.trim() !== '' && 
      (desc.includes(sal.employeeName.toLowerCase().trim()) || sal.employeeName.toLowerCase().trim().includes(desc))
    )) {
      return true;
    }
    if (desc.includes('nomina') || desc.includes('nómina') || desc.includes('sueldo') || desc.includes('salario') || desc.includes('empleado')) {
      return true;
    }
    return false;
  };

  const displayedExpenses = React.useMemo(() => {
    if (!isLocked) {
      return expenses;
    }

    const unmapped: Expense[] = [];
    const groupedOpItems: Expense[] = [];
    const groupedSalaryItems: Expense[] = [];

    expenses.forEach(exp => {
      if (isOperatingItem(exp.description)) {
        groupedOpItems.push(exp);
      } else if (isSalaryItem(exp.description)) {
        groupedSalaryItems.push(exp);
      } else {
        unmapped.push(exp);
      }
    });

    const result = [...unmapped];

    if (groupedOpItems.length > 0) {
      const totalOp = groupedOpItems.reduce((acc, current) => acc + current.amount, 0);
      const latestDate = groupedOpItems.reduce((latest, current) => 
        new Date(current.date) > new Date(latest) ? current.date : latest
      , groupedOpItems[0].date);

      result.push({
        id: 'grouped_ops',
        description: 'Gastos Operativos (Agrupados bajo protección)',
        category: 'Otros',
        amount: totalOp,
        date: latestDate,
        userId: user.id,
        isGrouped: true
      });
    }

    if (groupedSalaryItems.length > 0) {
      const totalSal = groupedSalaryItems.reduce((acc, current) => acc + current.amount, 0);
      const latestDate = groupedSalaryItems.reduce((latest, current) => 
        new Date(current.date) > new Date(latest) ? current.date : latest
      , groupedSalaryItems[0].date);

      result.push({
        id: 'grouped_salaries',
        description: 'Nóminas y Salarios (Agrupados bajo protección)',
        category: 'Otros',
        amount: totalSal,
        date: latestDate,
        userId: user.id,
        isGrouped: true
      });
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, isLocked, operatingExpenses, salaries, user.id]);

  const handleSaveFixedCosts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingCosts) return;
    setSavingCosts(true);
    try {
      await onUpdateUser({
        ...user,
        monthlyOperatingExpenses: totalOperatingExpenses,
        monthlySalaries: totalSalaries,
        initialInvestmentAmount: formData.initialInvestmentAmount,
        initialInvestmentLifeMonths: formData.initialInvestmentLifeMonths,
        operatingExpensesList: operatingExpenses.filter(item => item.name.trim() !== '' || item.amount > 0),
        salariesList: salaries.filter(item => item.employeeName.trim() !== '' || item.salary > 0)
      });
      alert('¡Éxito! Estructura de costos fijos e inversión guardada.');
    } catch (err: any) {
      console.error(err);
      alert('Error al guardar costos fijos: ' + (err.message || String(err)));
    } finally {
      setSavingCosts(false);
    }
  };

  const downloadExpensesTemplate = () => {
    const csvContent = "Descripcion,Monto,Categoria,Fecha\nPago de Alquiler,500.00,Otros,2024-05-15\nCompra de Mercancia,1200.50,Reabastecimiento,2024-05-14";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_egresos.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExpensesCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const mappedExpenses = results.data.map((row: any) => ({
            description: row.Descripcion || row.description,
            amount: parseFloat(row.Monto || row.amount || '0'),
            category: (row.Categoria || row.category || 'Otros') as ExpenseCategory,
            date: row.Fecha || row.date || new Date().toISOString()
          })).filter(e => e.description && e.amount > 0);

          if (mappedExpenses.length === 0) {
            alert("No se encontraron egresos válidos en el CSV.");
            setImporting(false);
            return;
          }

          await dbService.saveExpensesBatch(mappedExpenses);
          await loadExpenses();
          setIsMigrationModalOpen(false);
          alert(`¡Éxito! Se importaron ${mappedExpenses.length} registros de egresos.`);
        } catch (err) {
          console.error(err);
          alert("Error al procesar el archivo CSV.");
        } finally {
          setImporting(false);
          if (e.target) e.target.value = '';
        }
      }
    });
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const data = await dbService.getExpenses();
      setExpenses(data);
    } catch (err) {
      console.error("Error cargando egresos:", err);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const amountStr = formData.get('amount') as string;
    const amount = Number(amountStr);

    if (isNaN(amount) || amount <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0.");
      setLoading(false);
      return;
    }

    const expenseData: Partial<Expense> = {
      id: editingExpense?.id, // Si existe, actualiza; si no, saveExpense crea UUID
      amount: amount,
      description: (formData.get('description') as string).trim() || 'Gasto General',
      category: formData.get('category') as ExpenseCategory,
      date: editingExpense ? editingExpense.date : new Date().toISOString()
    };
    
    try {
      console.log("Enviando gasto a dbService:", expenseData);
      await dbService.saveExpense(expenseData);
      
      // Limpiar y cerrar antes de recargar para evitar doble envío
      setIsModalOpen(false);
      setEditingExpense(null);
      
      // Refrescar lista
      await loadExpenses();
    } catch (err: any) {
      console.error("Error capturado en vista:", err);
      alert(`Error crítico al registrar: ${err.message || 'Sin respuesta del servidor'}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setLoading(true);
    try {
      await dbService.deleteExpense(expenseToDelete.id);
      setIsDeleteModalOpen(false);
      setExpenseToDelete(null);
      await loadExpenses();
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Egresos & Gastos</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Control operativo de salidas de capital.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setIsMigrationModalOpen(true)}
            className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm border border-slate-200 dark:border-slate-800"
          >
            <FileUp size={18} /> Migrar CSV
          </button>
          <button 
            onClick={() => { setEditingExpense(null); setIsModalOpen(true); }}
            className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-rose-100 dark:shadow-none transition-all active:scale-95"
          >
            <Plus size={20} /> Registrar Gasto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                  <th className="px-8 py-5">Descripción del Gasto</th>
                  <th className="px-8 py-5">Categoría</th>
                  <th className="px-8 py-5">Fecha</th>
                  <th className="px-8 py-5 text-right">Monto</th>
                  <th className="px-8 py-5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedExpenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-8 py-5 font-bold text-slate-800 dark:text-slate-200">{expense.description}</td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${expense.category === 'Reabastecimiento' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-slate-400 dark:text-slate-500 text-xs font-bold uppercase">
                      {new Date(expense.date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-8 py-5 text-right font-black text-rose-600 dark:text-rose-400 text-lg">
                      ${expense.amount.toLocaleString()}
                    </td>
                    <td className="px-8 py-5">
                      {!expense.isGrouped ? (
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openEditModal(expense)}
                            className="p-2 text-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-xl transition-all"
                            title="Editar registro"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => { setExpenseToDelete(expense); setIsDeleteModalOpen(true); }}
                            className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900 rounded-xl transition-all"
                            title="Eliminar registro"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-center text-slate-300 dark:text-slate-600">
                          <Lock size={14} className="hover:text-rose-500 transition-colors" title="Desbloquee sección de costos fijos para editar" />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {displayedExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-24 text-center">
                      <TrendingDown size={64} className="mx-auto text-slate-100 dark:text-slate-800 mb-4" />
                      <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">No hay registros contables</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-rose-600 p-8 rounded-[2rem] shadow-2xl shadow-rose-200 dark:shadow-none relative overflow-hidden text-white">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <h3 className="font-black text-white/60 uppercase text-[10px] tracking-[0.2em] mb-4 flex items-center gap-2">
              <DollarSign size={16}/> Total Salidas de Caja
            </h3>
            <p className="text-5xl font-black tracking-tighter">
              ${expenses.reduce((acc, e) => acc + e.amount, 0).toLocaleString()}
            </p>
            <p className="text-xs text-rose-100 mt-6 font-medium leading-relaxed">
              Recuerda: Los gastos operativos de tu negocio afectan tu utilidad neta en el Dashboard.
            </p>
          </div>

          {/* Costos Fijos e Inversión */}
          <div className={`relative rounded-[2rem] transition-all duration-1000 ${shouldPulseRed ? 'ring-4 ring-rose-500/25 border border-rose-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-pulse' : ''}`}>
            <form onSubmit={handleSaveFixedCosts} className={`bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors space-y-6 ${isLocked ? 'pointer-events-none select-none filter blur-[6px]' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-600 rounded-xl text-white shadow-lg shadow-rose-500/20">
                    <Banknote size={20} />
                  </div>
                  <div>
                    <h3 className="text-md font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Costos Fijos</h3>
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-0.5">Estructura e Inversión</p>
                  </div>
                </div>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => setIsLocked(true)}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                    title="Bloquear estructura"
                  >
                    <Lock size={16} />
                  </button>
                )}
              </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium px-1 leading-relaxed">
              Configura tus egresos recurrentes y la inversión inicial para prorratear los egresos en tus balances.
            </p>

            <div className="space-y-6">
              {/* Componente 1: Gastos Operativos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Gastos Operativos</label>
                  <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">Total: ${totalOperatingExpenses.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                </div>
                
                 <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {operatingExpenses.map((expense) => {
                    const isPaid = isFixedCostPaidThisMonth(expense.name, 'operating');
                    const isCurrentlyRegistering = registeringItem === `${expense.id}_operating`;
                    return (
                      <div key={expense.id} className="flex gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => handleToggleFixedCostPaid(expense, 'operating')}
                          disabled={!expense.name?.trim() || !expense.amount || expense.amount <= 0 || isCurrentlyRegistering}
                          className={`p-1.5 rounded-xl border transition-all pointer-events-auto ${
                            isPaid
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-400'
                              : 'bg-slate-50 border-slate-200 text-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-600 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50/20'
                          }`}
                          title={isPaid ? "Gasto registrado este mes (Visto Bueno)" : "Registrar pago de este gasto"}
                        >
                          {isCurrentlyRegistering ? (
                            <Loader2 size={13} className="animate-spin text-emerald-500" />
                          ) : (
                            <Check size={13} className={`transition-all ${isPaid ? 'stroke-[3px]' : 'opacity-40 hover:opacity-100'}`} />
                          )}
                        </button>
                        <input 
                          type="text" 
                          placeholder="Nombre del gasto"
                          className="flex-1 min-w-[100px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 transition-all text-xs"
                          value={expense.name}
                          onChange={e => updateOperatingExpense(expense.id, 'name', e.target.value)}
                        />
                        <div className="relative w-24">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">$</span>
                          <input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00"
                            className="w-full pl-6 pr-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 transition-all text-xs font-mono"
                            value={expense.amount || ''}
                            onChange={e => updateOperatingExpense(expense.id, 'amount', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeOperatingExpense(expense.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                          title="Eliminar gasto"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                <button 
                  type="button"
                  onClick={addOperatingExpense}
                  className="w-full py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                >
                  <Plus size={14} /> Añadir Gasto Operativo
                </button>
              </div>

              {/* Componente 2: Nomina y Salarios */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nómina y Salarios</label>
                  <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">Total: ${totalSalaries.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                </div>
                
                 <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {salaries.map((salary) => {
                    const isPaid = isFixedCostPaidThisMonth(salary.employeeName, 'salary');
                    const isCurrentlyRegistering = registeringItem === `${salary.id}_salary`;
                    return (
                      <div key={salary.id} className="flex gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => handleToggleFixedCostPaid(salary, 'salary')}
                          disabled={!salary.employeeName?.trim() || !salary.salary || salary.salary <= 0 || isCurrentlyRegistering}
                          className={`p-1.5 rounded-xl border transition-all pointer-events-auto ${
                            isPaid
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-400'
                              : 'bg-slate-50 border-slate-200 text-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-600 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50/20'
                          }`}
                          title={isPaid ? "Nómina registrada este mes (Visto Bueno)" : "Registrar pago de esta nómina"}
                        >
                          {isCurrentlyRegistering ? (
                            <Loader2 size={13} className="animate-spin text-emerald-500" />
                          ) : (
                            <Check size={13} className={`transition-all ${isPaid ? 'stroke-[3px]' : 'opacity-40 hover:opacity-100'}`} />
                          )}
                        </button>
                        <input 
                          type="text" 
                          placeholder="Nombre y Apellido"
                          className="flex-1 min-w-[100px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 transition-all text-xs"
                          value={salary.employeeName}
                          onChange={e => updateSalary(salary.id, 'employeeName', e.target.value)}
                        />
                        <div className="relative w-24">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">$</span>
                          <input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00"
                            className="w-full pl-6 pr-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 transition-all text-xs font-mono"
                            value={salary.salary || ''}
                            onChange={e => updateSalary(salary.id, 'salary', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeSalary(salary.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                          title="Eliminar nómina"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                <button 
                  type="button"
                  onClick={addSalary}
                  className="w-full py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                >
                  <Plus size={14} /> Añadir Empleado / Nómina
                </button>
              </div>

              {/* Componente 3: Coste de Apertura del Negocio */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Apertura del Negocio</label>
                  <div className="relative group">
                    <Info size={14} className="text-blue-500 hover:text-blue-600 cursor-pointer transition-colors" />
                    <div className="absolute left-6 bottom-full mb-2 w-64 p-3 bg-slate-800 dark:bg-slate-950 text-white text-[10px] font-bold rounded-xl shadow-2xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-50 leading-normal">
                      Aquí debe colocar el monto total del coste de apertura tomando en cuenta muebles, sistema de cámaras, vitrinas, etc., para que se distribuya a lo largo de los meses seleccionados.
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Monto Total ($)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="Monto total"
                        className="w-full pl-6 pr-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 transition-all text-xs font-mono"
                        value={formData.initialInvestmentAmount || ''}
                        onChange={e => setFormData({...formData, initialInvestmentAmount: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Meses Estimados</label>
                    <input 
                      type="number" 
                      placeholder="Ej: 36, 48"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 transition-all text-xs font-mono"
                      value={formData.initialInvestmentLifeMonths || ''}
                      onChange={e => setFormData({...formData, initialInvestmentLifeMonths: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Resumen prorrateo rápido */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-[1.5rem] p-4 border border-slate-100 dark:border-slate-800 space-y-3">
              <h4 className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-1.5 font-mono">
                <div className="w-1 h-1 bg-rose-500 rounded-full"></div> Prorrateo Estimado
              </h4>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Fijos/Mes</span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono">
                    ${(totalOperatingExpenses + totalSalaries + (formData.initialInvestmentLifeMonths > 0 ? (formData.initialInvestmentAmount / formData.initialInvestmentLifeMonths) : 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Deducción Diaria</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    ${((totalOperatingExpenses + totalSalaries + (formData.initialInvestmentLifeMonths > 0 ? (formData.initialInvestmentAmount / formData.initialInvestmentLifeMonths) : 0)) / 30).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <button type="submit" disabled={savingCosts} className="w-full bg-slate-900 dark:bg-rose-600 hover:bg-slate-850 dark:hover:bg-rose-700 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg">
              {savingCosts ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              Guardar Estructura
            </button>
          </form>
          {isLocked && (
            <div 
              onClick={() => setShowPinModal(true)}
              className="absolute inset-0 bg-slate-100/30 dark:bg-slate-900/40 backdrop-blur-[4px] rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-200/20 dark:hover:bg-slate-800/20 transition-all group z-30 pointer-events-auto"
            >
              <div className="p-6 bg-white dark:bg-slate-850 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3 max-w-[260px] transform group-hover:scale-105 transition-all">
                <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center mx-auto shadow-inner text-rose-500">
                  <Lock size={22} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Estructura Protegida</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed mt-1">Hacer clic para ingresar PIN de su Dashboard y desbloquear.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Modal Crear/Editar Gasto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !loading && setIsModalOpen(false)} />
          <form onSubmit={handleSaveExpense} className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  {editingExpense ? 'Editar Registro' : 'Nuevo Egreso'}
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Gestión de flujo de caja</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} disabled={loading} className="text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Categoría Contable</label>
                <div className="relative">
                  <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={18} />
                  <select 
                    name="category" 
                    key={editingExpense?.id || 'new'}
                    defaultValue={editingExpense?.category || 'Otros'}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none font-bold appearance-none text-slate-900 dark:text-slate-100 transition-colors"
                    disabled={loading}
                  >
                    <option value="Otros">Otros (Sueldos, Servicios, Alquiler)</option>
                    <option value="Reabastecimiento">Reabastecimiento (Compra Stock)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Concepto / Descripción</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={18} />
                  <input 
                    name="description" 
                    defaultValue={editingExpense?.description} 
                    placeholder="Ej: Pago de luz, Alquiler, Proveedor..." 
                    required 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none font-bold text-slate-900 dark:text-slate-100 transition-colors" 
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Monto de la Salida ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={18} />
                  <input 
                    name="amount" 
                    type="number" 
                    step="0.01" 
                    required 
                    defaultValue={editingExpense?.amount}
                    placeholder="0.00" 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none font-black text-xl text-slate-900 dark:text-slate-100 transition-colors" 
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <button disabled={loading} type="submit" className="w-full bg-slate-800 dark:bg-rose-600 hover:bg-slate-900 dark:hover:bg-rose-700 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" /> : (editingExpense ? 'Actualizar Registro' : 'Registrar Egreso')}
            </button>
          </form>
        </div>
      )}

      {/* Modal de Migración CSV */}
      {isMigrationModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsMigrationModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <FileUp size={40} />
            </div>
            
            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-2 uppercase">Migrar Egresos</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 text-sm">
              Sube un archivo CSV con tus egresos históricos.
            </p>

            <div className="flex flex-col gap-4">
              <button 
                onClick={downloadExpensesTemplate}
                className="w-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-slate-200 dark:border-slate-700"
              >
                <FileText size={18} /> Descargar Plantilla
              </button>
              
              <label className="w-full bg-rose-600 hover:bg-rose-700 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 cursor-pointer shadow-xl shadow-rose-500/20 transition-all active:scale-95">
                {importing ? <Loader2 className="animate-spin" size={20} /> : <FileUp size={20} />}
                {importing ? 'Procesando...' : 'Seleccionar Archivo .CSV'}
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleExpensesCSV} 
                  disabled={importing}
                />
              </label>

              <button 
                onClick={() => setIsMigrationModalOpen(false)}
                className="text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-widest mt-2 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Borrado */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !loading && setIsDeleteModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-sm:w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-rose-50/50 dark:ring-rose-900/10">
              <AlertTriangle size={40} />
            </div>
            
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">¿Confirmar Borrado?</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">
              Estás a punto de eliminar el registro: <br/>
              <span className="font-black text-slate-800 dark:text-slate-100">"{expenseToDelete?.description}"</span>
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmDeleteExpense}
                disabled={loading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-rose-100 dark:shadow-none flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Sí, Eliminar Registro'}
              </button>
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setExpenseToDelete(null); }}
                disabled={loading}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal De PIN de Seguridad */}
      {showPinModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-md" onClick={() => { setShowPinModal(false); handlePinClear(); }} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-500 mb-4 shadow-inner">
                <Lock size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Desbloquear Estructura</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-1.5 px-2">Ingrese el PIN del Dashboard</p>
            </div>

            {pinError && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/35 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-2xl text-center">
                {pinError}
              </div>
            )}

            {/* Dot indicators */}
            <div className="flex justify-center items-center gap-4 py-2">
              {[...Array(4)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-150 border-2 ${
                    i < pinInput.length 
                      ? 'bg-rose-500 border-rose-500 scale-110 shadow-lg shadow-rose-500/30' 
                      : 'bg-transparent border-slate-300 dark:border-slate-700'
                  }`}
                />
              ))}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button 
                  key={num}
                  type="button"
                  onClick={() => handlePinKeyPress(num)}
                  className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-100 dark:border-slate-850 flex items-center justify-center font-black text-lg text-slate-700 dark:text-slate-200 active:scale-95 transition-all shadow-sm"
                >
                  {num}
                </button>
              ))}
              <button 
                type="button"
                onClick={handlePinClear}
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-[10px] font-black text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 active:scale-95 transition-all uppercase tracking-wider"
              >
                Limpiar
              </button>
              <button 
                type="button"
                onClick={() => handlePinKeyPress('0')}
                className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-100 dark:border-slate-850 flex items-center justify-center font-black text-lg text-slate-700 dark:text-slate-200 active:scale-95 transition-all shadow-sm"
              >
                0
              </button>
              <button 
                type="button"
                onClick={handlePinDelete}
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-[10px] font-black text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 active:scale-95 transition-all uppercase tracking-wider"
              >
                Borrar
              </button>
            </div>

            {!(user.dashboardPin || localStorage.getItem(`cajapro_pin_${user.id}`)) && (
              <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { 
                    setIsLocked(false); 
                    setShowPinModal(false); 
                    localStorage.setItem(`glow_dismissed_${user.id}_${currentMonthStr}`, 'true');
                    setIsGlowDismissed(true);
                  }}
                  className="text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline hover:scale-105 transition-all"
                >
                  No hay PIN configurado. Desbloquear directo.
                </button>
              </div>
            )}

            <button 
              type="button"
              onClick={() => { setShowPinModal(false); handlePinClear(); }}
              className="w-full text-center text-[10px] font-black text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 uppercase tracking-widest mt-2"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesView;
