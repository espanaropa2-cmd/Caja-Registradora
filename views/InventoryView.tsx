
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { dbService } from '../services/dbService';
import { Product } from '../types';
import { Plus, Search, Filter, Edit2, Trash2, Camera, Package, RefreshCw, Loader2, Calculator, X, AlertTriangle, ChevronDown } from 'lucide-react';

const InventoryView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReplenishOpen, setIsReplenishOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados para categorías
  const [categoryInput, setCategoryInput] = useState('');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  // Estados compartidos para calculadoras
  const [calcQty, setCalcQty] = useState<number>(0);
  const [calcUnitCost, setCalcUnitCost] = useState<number>(0);
  const [calcTotalCost, setCalcTotalCost] = useState<number>(0);

  useEffect(() => {
    dbService.getProducts().then(setProducts).catch(console.error);
    
    // Cerrar sugerencias al hacer clic fuera
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
    if (qty > 0) {
      if (calcUnitCost > 0) setCalcTotalCost(Number((calcUnitCost * qty).toFixed(2)));
      else if (calcTotalCost > 0) setCalcUnitCost(Number((calcTotalCost / qty).toFixed(2)));
    }
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
      alert("Error al guardar producto");
    } finally {
      setLoading(false);
    }
  };

  const handleReplenishStock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct || calcQty <= 0) return;
    setLoading(true);
    
    try {
      await dbService.updateStockAndRecordExpense(
        editingProduct.id, 
        calcQty, 
        calcUnitCost, 
        editingProduct.name
      );
      const updated = await dbService.getProducts();
      setProducts(updated);
      setIsReplenishOpen(false);
      setEditingProduct(null);
    } catch (err: any) {
      alert("Error al reponer stock: " + err.message);
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
      alert("Error al eliminar producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Inventario Global</h1>
          <p className="text-slate-500 font-medium">Control total de stock y costos base.</p>
        </div>
        <button 
          onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-blue-200 transition-all active:scale-95"
        >
          <Plus size={18} /> Nuevo Item
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o EAN-13..." 
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium shadow-sm outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-6">Producto & Código</th>
                <th className="px-8 py-6">Costo / P.Venta</th>
                <th className="px-8 py-6">Inventario</th>
                <th className="px-8 py-6">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="px-8 py-6">
                    <div>
                      <p className="font-black text-slate-800">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex items-center gap-1">
                        <Camera size={10} /> {p.barcode || 'SIN EAN'} • {p.category}
                      </p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-400">C: ${p.cost.toLocaleString()}</span>
                      <span className="text-sm font-black text-blue-600">V: ${p.price.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${p.stock <= 5 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                      <span className={`text-sm font-black ${p.stock <= 5 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {p.stock} uds
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => { setEditingProduct(p); setIsReplenishOpen(true); }}
                        className="p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all"
                        title="Reponer Stock"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button 
                        onClick={() => { setEditingProduct(p); setIsModalOpen(true); }}
                        className="p-2.5 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => { setProductToDelete(p); setIsDeleteModalOpen(true); }}
                        className="p-2.5 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Confirmación Borrado Estilizado */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-rose-50/50">
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">¿Eliminar Producto?</h3>
            <p className="text-slate-500 font-medium mb-8">
              Estás por borrar <span className="font-black text-slate-800">"{productToDelete?.name}"</span>. Esta acción no se puede deshacer y afectará el historial de inventario.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmDeleteProduct}
                disabled={loading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-rose-100 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Sí, Eliminar Permanentemente'}
              </button>
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setProductToDelete(null); }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{editingProduct ? 'Modificar Item' : 'Nuevo Producto'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-8 space-y-6 overflow-y-auto hide-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Comercial</label>
                    <input name="name" defaultValue={editingProduct?.name} required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código de Barras (EAN-13)</label>
                    <div className="relative">
                      <Camera className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input name="barcode" defaultValue={editingProduct?.barcode} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold shadow-sm" placeholder="Escanea o escribe..." />
                    </div>
                  </div>
                  
                  {/* Campo Categoría con Sugerencias */}
                  <div className="space-y-1 relative" ref={categoryRef}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                    <div className="relative">
                      <input 
                        type="text"
                        value={categoryInput}
                        onChange={(e) => {
                          setCategoryInput(e.target.value);
                          setShowCategorySuggestions(true);
                        }}
                        onFocus={() => setShowCategorySuggestions(true)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold pr-10"
                        placeholder="Ej: Víveres, Bebidas..."
                      />
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    </div>
                    
                    {/* Lista de Sugerencias */}
                    {showCategorySuggestions && filteredCategories.length > 0 && (
                      <div className="absolute z-[60] left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-48 overflow-y-auto overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        {filteredCategories.map((cat, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setCategoryInput(cat);
                              setShowCategorySuggestions(false);
                            }}
                            className="w-full px-5 py-3 text-left hover:bg-blue-50 text-sm font-bold text-slate-700 transition-colors flex items-center justify-between group"
                          >
                            <span>{cat}</span>
                            <span className="text-[10px] font-black uppercase text-blue-600 opacity-0 group-hover:opacity-100">Seleccionar</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Precio Venta ($)</label>
                    <input name="price" type="number" step="0.01" defaultValue={editingProduct?.price} required className="w-full px-5 py-4 bg-blue-50 border border-blue-100 rounded-2xl outline-none font-black text-xl text-blue-600" />
                  </div>
                </div>
                <div className="space-y-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Calculator size={14}/> Costos e Inversión</h4>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Stock Inicial</label>
                    <input type="number" required className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl outline-none font-black" value={calcQty || ''} onChange={(e) => handleQtyChange(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Costo Unitario ($)</label>
                    <input type="number" step="0.01" className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl outline-none font-black" value={calcUnitCost || ''} onChange={(e) => handleUnitCostChange(Number(e.target.value))} />
                  </div>
                  <div className="text-center text-[10px] font-black text-slate-300 uppercase">Ó</div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Costo Total Compra ($)</label>
                    <input type="number" step="0.01" className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl outline-none font-black" value={calcTotalCost || ''} onChange={(e) => handleTotalCostChange(Number(e.target.value))} />
                  </div>
                </div>
              </div>
              <button disabled={loading} type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                {loading ? <Loader2 className="animate-spin" /> : (editingProduct ? 'Guardar Cambios' : 'Registrar Producto')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
