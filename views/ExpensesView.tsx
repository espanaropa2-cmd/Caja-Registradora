
import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { Expense, ExpenseCategory } from '../types';
import { TrendingDown, Plus, DollarSign, Tag, Edit2, Trash2, Loader2, X, AlertTriangle, Layers } from 'lucide-react';

const ExpensesView: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(false);

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
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Egresos & Gastos</h1>
          <p className="text-slate-500 font-medium">Control operativo de salidas de capital.</p>
        </div>
        <button 
          onClick={() => { setEditingExpense(null); setIsModalOpen(true); }}
          className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-rose-100 transition-all active:scale-95"
        >
          <Plus size={20} /> Registrar Gasto
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                  <th className="px-8 py-5">Descripción del Gasto</th>
                  <th className="px-8 py-5">Categoría</th>
                  <th className="px-8 py-5">Fecha</th>
                  <th className="px-8 py-5 text-right">Monto</th>
                  <th className="px-8 py-5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5 font-bold text-slate-800">{expense.description}</td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${expense.category === 'Reabastecimiento' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-slate-400 text-xs font-bold uppercase">
                      {new Date(expense.date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-8 py-5 text-right font-black text-rose-600 text-lg">
                      ${expense.amount.toLocaleString()}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditModal(expense)}
                          className="p-2 text-blue-500 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all"
                          title="Editar registro"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => { setExpenseToDelete(expense); setIsDeleteModalOpen(true); }}
                          className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Eliminar registro"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-24 text-center">
                      <TrendingDown size={64} className="mx-auto text-slate-100 mb-4" />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No hay registros contables</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-rose-600 p-8 rounded-[2rem] shadow-2xl shadow-rose-200 relative overflow-hidden text-white">
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
        </div>
      </div>

      {/* Modal Crear/Editar Gasto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !loading && setIsModalOpen(false)} />
          <form onSubmit={handleSaveExpense} className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                  {editingExpense ? 'Editar Registro' : 'Nuevo Egreso'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestión de flujo de caja</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} disabled={loading} className="text-slate-300 hover:text-slate-600 transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría Contable</label>
                <div className="relative">
                  <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <select 
                    name="category" 
                    key={editingExpense?.id || 'new'}
                    defaultValue={editingExpense?.category || 'Otros'}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none font-bold appearance-none"
                    disabled={loading}
                  >
                    <option value="Otros">Otros (Sueldos, Servicios, Alquiler)</option>
                    <option value="Reabastecimiento">Reabastecimiento (Compra Stock)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Concepto / Descripción</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    name="description" 
                    defaultValue={editingExpense?.description} 
                    placeholder="Ej: Pago de luz, Alquiler, Proveedor..." 
                    required 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none font-bold" 
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Monto de la Salida ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    name="amount" 
                    type="number" 
                    step="0.01" 
                    required 
                    defaultValue={editingExpense?.amount}
                    placeholder="0.00" 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none font-black text-xl" 
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <button disabled={loading} type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" /> : (editingExpense ? 'Actualizar Registro' : 'Registrar Egreso')}
            </button>
          </form>
        </div>
      )}

      {/* Modal de Confirmación de Borrado */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !loading && setIsDeleteModalOpen(false)} />
          <div className="relative bg-white w-full max-sm rounded-[2.5rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <AlertTriangle size={40} />
            </div>
            
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">¿Confirmar Borrado?</h3>
            <p className="text-slate-500 font-medium mb-6">
              Estás a punto de eliminar el registro: <br/>
              <span className="font-black text-slate-800">"{expenseToDelete?.description}"</span>
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmDeleteExpense}
                disabled={loading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-rose-100 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Sí, Eliminar Registro'}
              </button>
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setExpenseToDelete(null); }}
                disabled={loading}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesView;
