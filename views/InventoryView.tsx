
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { dbService } from '../services/dbService';
import { Product } from '../types';
import { Plus, Search, Edit2, Trash2, Camera, Package, RefreshCw, Loader2, Calculator, X, AlertTriangle, ChevronDown, ArrowRightLeft, MoreVertical } from 'lucide-react';

const InventoryView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReplenishOpen, setIsReplenishOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  const [categoryInput, setCategoryInput] = useState('');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  const [calcQty, setCalcQty] = useState<number>(0);
  const [calcUnitCost, setCalcUnitCost] = useState<number>(0);
  const [calcTotalCost, setCalcTotalCost] = useState<number>(0);

  useEffect(() => {
    dbService.getProducts().then(setProducts).catch(console.error);
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setShowCategorySuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      if (editingProduct) {
        setCalcQty(editingProduct.stock);
        setCalcUnitCost(editingProduct.cost);
        setCalcTotalCost(Number((editingProduct.stock * editingProduct.cost).toFixed(2)));
        setCategoryInput(editingProduct.category || '');
      } else {
        setCalcQty(0);
        setCalcUnitCost(0);
        setCalcTotalCost(0);
        setCategoryInput('');
      }
    }
  }, [isModalOpen, editingProduct]);

  useEffect(() => {
    if (isReplenishOpen && editingProduct) {
      setCalcUnitCost(editingProduct.cost);
      setCalcQty(0);
      setCalcTotalCost(0);
    }
  }, [isReplenishOpen, editingProduct]);

  const uniqueCategories = useMemo(() => {
    const cats = products.map(p => p.category).filter(Boolean);
    return Array.from(new Set(cats)).sort();
  }, [products]);

  const filteredCategories = useMemo(() => {
    if (!categoryInput) return uniqueCategories;
    return uniqueCategories.filter(c => 
      c.toLowerCase().includes(categoryInput.toLowerCase())
    );
  }, [uniqueCategories, categoryInput]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.barcode && p.barcode.includes(searchTerm))
    );
  }, [products, searchTerm]);

  const handleQtyChange = (qty: number) => {
    setCalcQty(qty);
    if (qty > 0 && calcUnitCost > 0) setCalcTotalCost(Number((calcUnitCost * qty).toFixed(2)));
  };

  const handleUnitCostChange = (unit: number) => {
    setCalcUnitCost(unit);
    if (calcQty > 0) setCalcTotalCost(Number((unit * calcQty).toFixed(2)));
  };

  const handleTotalCostChange = (total: number) => {
    setCalcTotalCost(total);
    if (calcQty > 0) setCalcUnitCost(Number((total / calcQty).toFixed(2)));
  };

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const isNew = !editingProduct;
    const productData: Partial<Product> = {
      id: editingProduct?.id || crypto.randomUUID(),
      name: formData.get('name') as string,
      barcode: (formData.get('barcode') as string) || '',
      category: categoryInput || 'General',
      price: Number(formData.get('price')),
      cost: calcUnitCost,
      stock: calcQty,
    };
    try {
      await dbService.saveProduct(productData, isNew);
      const updated = await dbService.getProducts();
      setProducts(updated);
      setIsModalOpen(false);
      setEditingProduct(null);
    } catch (err) {
      alert("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleReplenishStock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct || calcQty <= 0) return;
    setLoading(true);
    try {
      await dbService.updateStockAndRecordExpense(editingProduct.id, calcQty, calcUnitCost, editingProduct.name);
      const updated = await dbService.getProducts();
      setProducts(updated);
      setIsReplenishOpen(false);
      setEditingProduct(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setLoading(true);
    try {
      await dbService.deleteProduct(productToDelete.id);
      const updated = await dbService.getProducts();
      setProducts(updated);
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (err) {
      alert("Error al eliminar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-3xl font-black text-slate-800 tracking-tight">Inventario</h1>
          <p className="text-xs lg:text-base text-slate-500 font-medium tracking-tight">Administra tus existencias y costos base.</p>
        </div>
        <button 
          onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 lg:px-7 py-3 lg:py-4 rounded-2xl font-black text-xs lg:text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-100 transition-all active:scale-95"
        >
          <Plus size={18} /> <span className="hidden sm:inline">Nuevo Item</span><span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Nombre o Código de Barras..." 
          className="w-full pl-12 pr-4 py-3 lg:py-5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium shadow-sm outline-none text-sm lg:text-base"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Desktop View (Table) */}
      <div className="hidden lg:block bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-xl shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-6">Producto</th>
                <th className="px-8 py-6">Inversión / Venta</th>
                <th className="px-8 py-6 text-center">Existencia</th>
                <th className="px-8 py-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 text-base">{p.name}</span>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{p.category} • {p.barcode || 'S/C'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-400">Costo: ${p.cost.toLocaleString()}</span>
                      <span className="text-base font-black text-blue-600">PVP: ${p.price.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col items-center">
                      <div className={`px-4 py-1.5 rounded-full text-xs font-black ${p.stock <= 5 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {p.stock} UNIDADES
                      </div>
                      {p.stock <= 5 && <span className="text-[9px] font-black text-rose-400 mt-1 uppercase animate-pulse">Stock Crítico</span>}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditingProduct(p); setIsReplenishOpen(true); }} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all" title="Reponer"><RefreshCw size={18}/></button>
                      <button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all" title="Editar"><Edit2 size={18}/></button>
                      <button onClick={() => { setProductToDelete(p); setIsDeleteModalOpen(true); }} className="p-3 bg-rose-50 text-rose-300 hover:text-rose-600 rounded-xl transition-all" title="Eliminar"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile View (Cards) */}
      <div className="lg:hidden space-y-4">
        {filteredProducts.map((p) => (
          <div key={p.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">{p.category}</span>
                <h3 className="font-black text-slate-800 text-lg mt-1">{p.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-0.5">EAN: {p.barcode || 'N/A'}</p>
              </div>
              <div className={`text-right px-3 py-1 rounded-2xl font-black text-xs ${p.stock <= 5 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                {p.stock} uds
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-none">Costo Promedio</span>
                <span className="text-sm font-bold text-slate-700">${p.cost.toLocaleString()}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter leading-none">Precio Venta</span>
                <span className="text-lg font-black text-blue-600 leading-none">${p.price.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button 
                onClick={() => { setEditingProduct(p); setIsReplenishOpen(true); }} 
                className="flex-1 bg-emerald-50 text-emerald-600 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <RefreshCw size={14}/> Cargar Stock
              </button>
              <button 
                onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} 
                className="p-3 bg-blue-50 text-blue-600 rounded-2xl"
              >
                <Edit2 size={16}/>
              </button>
              <button 
                onClick={() => { setProductToDelete(p); setIsDeleteModalOpen(true); }} 
                className="p-3 bg-rose-50 text-rose-400 rounded-2xl"
              >
                <Trash2 size={16}/>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modals are full-screen or large on mobile */}
      {isReplenishOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsReplenishOpen(false)} />
          <div className="relative bg-white w-full max-w-md h-[85vh] sm:h-auto rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
             {/* Replenish Content (Same as previous but optimized for touch) */}
             <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Entrada de Mercancía</h3>
              <button onClick={() => setIsReplenishOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleReplenishStock} className="p-8 space-y-6">
              <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 mb-6">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Cargando a:</p>
                <p className="font-black text-blue-700 text-lg leading-tight">{editingProduct?.name}</p>
              </div>
              <div className="space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unidades</label>
                  <input type="number" required min="1" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl outline-none focus:ring-2 focus:ring-blue-500" value={calcQty || ''} onChange={(e) => handleQtyChange(Number(e.target.value))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Costo Unit ($)</label>
                    <input type="number" step="0.01" className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-lg outline-none" value={calcUnitCost || ''} onChange={(e) => handleUnitCostChange(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total ($)</label>
                    <input type="number" step="0.01" className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-lg outline-none" value={calcTotalCost || ''} onChange={(e) => handleTotalCostChange(Number(e.target.value))} />
                  </div>
                </div>
              </div>
              <button disabled={loading || calcQty <= 0} type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2 mt-4 active:scale-95 transition-all">
                {loading ? <Loader2 className="animate-spin" /> : 'Confirmar Ingreso'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Modal (Add/Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white w-full max-w-4xl h-[95vh] sm:h-auto rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{editingProduct ? 'Editar Producto' : 'Nuevo Ingreso'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={28} /></button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-6 lg:p-10 space-y-8 overflow-y-auto hide-scrollbar flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Comercial</label>
                    <input name="name" defaultValue={editingProduct?.name} required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-lg focus:ring-2 focus:ring-blue-500" placeholder="Ej: Coca Cola 2L" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código (EAN/UPC)</label>
                    <div className="relative">
                      <Camera className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                      <input name="barcode" defaultValue={editingProduct?.barcode} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" placeholder="Escanear o Escribir" />
                    </div>
                  </div>
                  <div className="space-y-1 relative" ref={categoryRef}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                    <div className="relative">
                      <input type="text" value={categoryInput} onChange={(e) => { setCategoryInput(e.target.value); setShowCategorySuggestions(true); }} onFocus={() => setShowCategorySuggestions(true)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" placeholder="Categoría" />
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    </div>
                    {showCategorySuggestions && filteredCategories.length > 0 && (
                      <div className="absolute z-[60] left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-48 overflow-y-auto">
                        {filteredCategories.map((cat, idx) => (
                          <button key={idx} type="button" onClick={() => { setCategoryInput(cat); setShowCategorySuggestions(false); }} className="w-full px-6 py-4 text-left hover:bg-blue-50 text-sm font-bold text-slate-700 transition-colors border-b border-slate-50 last:border-0">{cat}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1 font-black">Precio de Venta ($)</label>
                    <input name="price" type="number" step="0.01" defaultValue={editingProduct?.price} required className="w-full px-6 py-5 bg-blue-50 border border-blue-100 rounded-2xl outline-none font-black text-3xl text-blue-600 focus:ring-4 focus:ring-blue-100" />
                  </div>
                </div>

                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex flex-col justify-center gap-6">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Calculator size={16}/> Calculadora de Márgenes
                  </h4>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Stock Disponible</label>
                    <input type="number" required className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-black text-xl" value={calcQty || ''} onChange={(e) => handleQtyChange(Number(e.target.value))} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Costo Unit ($)</label>
                      <input type="number" step="0.01" className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-black text-blue-700" value={calcUnitCost || ''} onChange={(e) => handleUnitCostChange(Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Inversión Total ($)</label>
                      <input type="number" step="0.01" className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-black text-emerald-700" value={calcTotalCost || ''} onChange={(e) => handleTotalCostChange(Number(e.target.value))} />
                    </div>
                  </div>
                  {calcQty > 0 && calcUnitCost > 0 && (
                    <div className="mt-4 p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between">
                       <span className="text-[10px] font-black text-slate-400 uppercase">Rentabilidad Bruta</span>
                       <span className="font-black text-emerald-500">+{(((Number(editingProduct?.price || 0) - calcUnitCost) / calcUnitCost) * 100).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
              <button disabled={loading} type="submit" className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-4 uppercase tracking-widest">
                {loading ? <Loader2 className="animate-spin" /> : (editingProduct ? 'Guardar Cambios' : 'Registrar Producto')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-rose-50/50">
              <AlertTriangle size={48} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-3">¿Borrar Ítem?</h3>
            <p className="text-slate-500 font-medium mb-8 leading-tight">
              Eliminarás permanentemente <span className="font-black text-slate-800">"{productToDelete?.name}"</span> de tu inventario global.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDeleteProduct} disabled={loading} className="w-full bg-rose-600 hover:bg-rose-700 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">{loading ? <Loader2 className="animate-spin" /> : 'Sí, Eliminar'}</button>
              <button onClick={() => setIsDeleteModalOpen(false)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
