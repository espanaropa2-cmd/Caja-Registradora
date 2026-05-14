
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { dbService } from '../services/dbService';
import { Product } from '../types';
import { fetchExchangeRate } from '../services/exchangeService';
import { Plus, Search, Edit2, Trash2, Camera, Package, RefreshCw, Loader2, Calculator, X, AlertTriangle, ChevronDown, Barcode, Download, ArrowUpRight, DollarSign, Tag, Landmark } from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface InventoryViewProps {
  useParallelRate?: boolean;
}

const InventoryView: React.FC<InventoryViewProps> = ({ useParallelRate = false }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReplenishOpen, setIsReplenishOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForBarcode, setProductForBarcode] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [rate, setRate] = useState<number>(0);
  const [bsInput, setBsInput] = useState<string>('');
  const [isRateLoading, setIsRateLoading] = useState(false);
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formTotalCostMode, setFormTotalCostMode] = useState<'USD' | 'BS'>('USD');
  const [replenishTotalCostMode, setReplenishTotalCostMode] = useState<'USD' | 'BS'>('USD');
  
  // Local string states for inputs to allow smooth typing
  const [formTotalCostStr, setFormTotalCostStr] = useState<string>('');
  const [replenishTotalCostStr, setReplenishTotalCostStr] = useState<string>('');

  // Refs to track if the user is currently typing in the total cost field
  const isTypingFormTotal = useRef(false);
  const isTypingReplenishTotal = useRef(false);

  // Estados para la calculadora del Formulario Principal
  const [formStock, setFormStock] = useState<number>(0);
  const [formUnitCost, setFormUnitCost] = useState<number>(0);
  const [formTotalCost, setFormTotalCost] = useState<number>(0);
  const [formBarcode, setFormBarcode] = useState<string>('');

  // Estados para la calculadora del Modal de Reposición
  const [replenishQty, setReplenishQty] = useState<number>(0);
  const [replenishUnitCost, setReplenishUnitCost] = useState<number>(0);
  const [replenishTotalCost, setReplenishTotalCost] = useState<number>(0);

  const barcodeRef = useRef<SVGSVGElement>(null);

  const fetchProducts = async () => {
    try {
      const data = await dbService.getProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const getRate = async () => {
    setIsRateLoading(true);
    try {
      const r = await fetchExchangeRate(useParallelRate ? 'paralelo' : 'oficial');
      setRate(r);
    } catch (error) {
      console.error("Error fetching rate for inventory:", error);
    } finally {
      setIsRateLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    getRate();
  }, [useParallelRate]);

  // Sincronizar estados al abrir el modal de edición
  useEffect(() => {
    if (editingProduct) {
      setFormStock(editingProduct.stock);
      setFormUnitCost(editingProduct.cost);
      setFormTotalCost(editingProduct.stock * editingProduct.cost);
      setFormBarcode(editingProduct.barcode || '');
      setFormPrice(editingProduct.price);
      setFormTotalCostStr(String(editingProduct.stock * editingProduct.cost));
    } else {
      setFormStock(0);
      setFormUnitCost(0);
      setFormTotalCost(0);
      setFormTotalCostStr('');
      setFormBarcode('');
      setFormPrice(0);
    }
  }, [editingProduct, isModalOpen]);

  // Sync string state when switching modes or when USD total changes from other logic
  useEffect(() => {
    if (isTypingFormTotal.current) return;
    if (formTotalCostMode === 'USD') {
      setFormTotalCostStr(formTotalCost === 0 ? '' : formTotalCost.toString());
    } else if (rate > 0) {
      setFormTotalCostStr(formTotalCost === 0 ? '' : (formTotalCost * rate).toFixed(2));
    }
  }, [formTotalCostMode, formTotalCost, rate]);

  useEffect(() => {
    if (isTypingReplenishTotal.current) return;
    if (replenishTotalCostMode === 'USD') {
      setReplenishTotalCostStr(replenishTotalCost === 0 ? '' : replenishTotalCost.toString());
    } else if (rate > 0) {
      setReplenishTotalCostStr(replenishTotalCost === 0 ? '' : (replenishTotalCost * rate).toFixed(2));
    }
  }, [replenishTotalCostMode, replenishTotalCost, rate]);

  const generateSKU = () => {
    let newSKU = '';
    let isUnique = false;
    const existingBarcodes = new Set(products.map(p => p.barcode).filter(b => b));
    
    let attempts = 0;
    while (!isUnique && attempts < 100) {
      // Generar un número aleatorio de 10 dígitos
      newSKU = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      if (!existingBarcodes.has(newSKU)) {
        isUnique = true;
      }
      attempts++;
    }
    setFormBarcode(newSKU);
  };

  // Lógica de cálculo bidireccional para el Modal Principal
  const updateFormByUnitCost = (unit: number) => {
    setFormUnitCost(unit);
    setFormTotalCost(Number((unit * formStock).toFixed(2)));
  };

  const updateFormByStock = (stock: number) => {
    setFormStock(stock);
    setFormTotalCost(Number((formUnitCost * stock).toFixed(2)));
  };

  const updateFormByTotalCost = (total: number) => {
    setFormTotalCost(total);
    if (formStock > 0) {
      setFormUnitCost(Number((total / formStock).toFixed(2)));
    }
  };

  // Lógica de cálculo bidireccional para el Modal de Reposición
  const updateReplenishByUnitCost = (unit: number) => {
    setReplenishUnitCost(unit);
    setReplenishTotalCost(Number((unit * replenishQty).toFixed(2)));
  };

  const updateReplenishByQty = (qty: number) => {
    setReplenishQty(qty);
    setReplenishTotalCost(Number((replenishUnitCost * qty).toFixed(2)));
  };

  const updateReplenishByTotalCost = (total: number) => {
    setReplenishTotalCost(total);
    if (replenishQty > 0) {
      setReplenishUnitCost(Number((total / replenishQty).toFixed(2)));
    }
  };

  useEffect(() => {
    if (isBarcodeModalOpen && productForBarcode && barcodeRef.current) {
      JsBarcode(barcodeRef.current, productForBarcode.barcode || '000000000', {
        format: "CODE128",
        lineColor: "#000",
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
        textMargin: 4,
        marginTop: 35, // Espacio para el nombre del producto
      });

      // Agregar el nombre del producto al SVG manualmente
      const svg = barcodeRef.current;
      const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
      textElement.setAttribute("x", "50%");
      textElement.setAttribute("y", "20");
      textElement.setAttribute("text-anchor", "middle");
      textElement.style.fontFamily = "Inter, sans-serif";
      textElement.style.fontWeight = "900";
      textElement.style.fontSize = "12px";
      textElement.style.fill = "#000";
      textElement.textContent = productForBarcode.name.toUpperCase();
      svg.appendChild(textElement);
    }
  }, [isBarcodeModalOpen, productForBarcode]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.barcode && p.barcode.includes(searchTerm))
    );
  }, [products, searchTerm]);

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const isNew = !editingProduct;
    
    const productData: Partial<Product> = {
      id: editingProduct?.id || crypto.randomUUID(),
      name: formData.get('name') as string,
      barcode: (formData.get('barcode') as string) || '',
      category: (formData.get('category') as string) || 'General',
      price: Number(formData.get('price')),
      cost: formUnitCost,
      stock: formStock,
    };

    try {
      await dbService.saveProduct(productData, isNew);
      await fetchProducts();
      setIsModalOpen(false);
      setEditingProduct(null);
    } catch (err) { 
      alert("Error al guardar el producto"); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setLoading(true);
    try {
      await dbService.deleteProduct(productToDelete.id);
      await fetchProducts();
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
      setIsModalOpen(false); // Close edit modal if open
      setEditingProduct(null);
    } catch (err) {
      alert("No se pudo eliminar el producto. Verifique si tiene ventas asociadas.");
    } finally {
      setLoading(false);
    }
  };

  const openDeleteConfirmation = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const handleReplenish = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) return;
    setLoading(true);
    try {
      await dbService.updateStockAndRecordExpense(editingProduct.id, replenishQty, replenishUnitCost, editingProduct.name);
      await fetchProducts();
      setIsReplenishOpen(false);
      setEditingProduct(null);
    } catch (err) { alert("Error al reponer stock"); }
    finally { setLoading(false); }
  };

  const downloadBarcode = () => {
    if (!barcodeRef.current) return;
    const svg = barcodeRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `barcode-${productForBarcode?.name || 'product'}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Inventario</h1>
          <p className="text-xs lg:text-lg text-slate-500 dark:text-slate-400 font-medium">Gestión avanzada de costos y stock.</p>
        </div>
        <button 
          onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
          className="bg-slate-900 dark:bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-sm active:scale-95 border border-slate-800 dark:border-blue-500/30"
        >
          <Plus size={18} /> Registrar Producto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o código..." 
            className="w-full pl-14 pr-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] outline-none font-bold text-slate-700 dark:text-slate-200 focus:border-slate-300 dark:focus:border-slate-700 transition-all shadow-sm text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="bg-slate-900 dark:bg-slate-900/50 p-4 rounded-[1.5rem] border border-slate-800 dark:border-slate-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <RefreshCw size={16} className={isRateLoading ? 'animate-spin' : ''} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Tasa {useParallelRate ? 'Paralela' : 'BCV'}</p>
              <p className="text-sm font-black text-white dark:text-slate-100 mt-1">1 USD = {rate.toLocaleString()} BS</p>
            </div>
          </div>
          <button onClick={getRate} className="p-2 text-slate-400 hover:text-white transition-colors">
            <RefreshCw size={14} className={isRateLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-200 dark:border-slate-800">
                <th className="px-8 py-6">Producto</th>
                <th className="px-8 py-6">Precio Venta</th>
                <th className="px-8 py-6 text-center">Stock</th>
                <th className="px-8 py-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-base">{p.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{p.barcode || 'Manual'}</span>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-tight px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded-full">{p.category || 'General'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-base font-black text-slate-900 dark:text-slate-100">${p.price.toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-slate-400">≈ BS {(p.price * rate).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className={`inline-block px-4 py-1 rounded-full text-[10px] font-black tracking-tight ${p.stock <= 5 ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
                      {p.stock} UNIDADES
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-end gap-2 lg:opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => { setProductForBarcode(p); setIsBarcodeModalOpen(true); }} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="Código Barras"><Barcode size={18}/></button>
                      <button onClick={() => { setEditingProduct(p); setReplenishQty(0); setReplenishUnitCost(p.cost); setReplenishTotalCost(0); setIsReplenishOpen(true); }} className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors" title="Reponer Stock"><RefreshCw size={18}/></button>
                      <button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors" title="Editar"><Edit2 size={18}/></button>
                      <button onClick={() => openDeleteConfirmation(p)} className="p-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors" title="Eliminar"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="py-20 flex flex-col items-center text-slate-400 dark:text-slate-600">
              <Package size={64} className="mb-4 opacity-20" />
              <p className="font-bold uppercase tracking-widest text-[10px]">No se encontraron productos</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Principal Crear/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-[2px]" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-[#0f172a] w-full max-w-4xl h-[95vh] sm:h-auto rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom sm:zoom-in-95 transition-colors">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-[#0f172a] z-10">
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <div className="flex items-center gap-2">
                {editingProduct && (
                  <button 
                    type="button" 
                    onClick={() => openDeleteConfirmation(editingProduct)}
                    className="p-3 text-rose-500 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 rounded-2xl transition-all"
                    title="Eliminar Producto"
                  >
                    <Trash2 size={24} />
                  </button>
                )}
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X size={28} /></button>
              </div>
            </div>
            <form onSubmit={handleSaveProduct} className="p-8 lg:p-10 space-y-8 overflow-y-auto hide-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Información Básica */}
                <div className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nombre del Producto</label>
                    <input name="name" defaultValue={editingProduct?.name} required className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 outline-none font-black text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 transition-all rounded-2xl" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Categoría</label>
                    <div className="relative">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={18} />
                      <input name="category" defaultValue={editingProduct?.category} placeholder="Ej: Bebidas, Alimentos, Limpieza..." className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 outline-none font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 transition-all rounded-2xl" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Código Barra / SKU</label>
                    <div className="flex gap-2">
                      <input 
                        name="barcode" 
                        value={formBarcode} 
                        onChange={(e) => setFormBarcode(e.target.value)}
                        placeholder="Escanee o ingrese código..."
                        className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 outline-none font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 transition-all rounded-2xl" 
                      />
                      <button 
                        type="button"
                        onClick={generateSKU}
                        className="px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center group border border-slate-200 dark:border-slate-700"
                        title="Generar SKU Aleatorio"
                      >
                        <RefreshCw size={20} className="group-active:rotate-180 transition-transform duration-500" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1">Precio Venta al Público ($)</label>
                    <div className="flex flex-col">
                       <div className="relative">
                         <input 
                           name="price" 
                           id="price-input" 
                           type="number" 
                           step="0.01" 
                           value={formPrice || ''} 
                           onChange={(e) => setFormPrice(Number(e.target.value))}
                           required 
                           className="w-full px-6 py-4 bg-blue-50 dark:bg-blue-600/10 border border-blue-100 dark:border-blue-500/30 rounded-2xl outline-none font-black text-2xl text-blue-600 dark:text-blue-400" 
                         />
                         <div className="absolute right-6 top-1/2 -translate-y-1/2 text-blue-300 dark:text-blue-600 font-black">$</div>
                       </div>
                       {rate > 0 && formPrice > 0 && (
                         <div className="ml-1 mt-1 flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                           <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight">Equivale a: <span className="text-emerald-600 dark:text-emerald-400">Bs. {(formPrice * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                         </div>
                       )}
                    </div>
                    {rate > 0 && <div className="flex justify-between items-center mt-1">
                      <button 
                        type="button" 
                        onClick={getRate}
                        className="text-[8px] font-black text-blue-400 uppercase tracking-tighter hover:text-blue-600 flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw size={10} className={isRateLoading ? 'animate-spin' : ''} /> Actualizar Tasa
                      </button>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Tasa BCV: {rate.toLocaleString()} Bs/$</p>
                    </div>}
                  </div>
                </div>

                {/* Calculadora Inteligente de Costos */}
                <div className="space-y-6 bg-slate-50 p-6 lg:p-8 rounded-[2.5rem] border border-slate-100 relative">
                  <div className="absolute top-4 right-6 text-slate-200 pointer-events-none">
                    <Calculator size={48} strokeWidth={1} />
                  </div>
                  <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] mb-4">Calculadora de Inversión</h4>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Existencia Actual (Stock)</label>
                      <input 
                        type="number" 
                        value={formStock} 
                        onChange={(e) => updateFormByStock(Number(e.target.value))} 
                        required 
                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-black text-slate-800" 
                      />
                    </div>
                      <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo Unitario ($)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={formUnitCost || ''} 
                        onChange={(e) => updateFormByUnitCost(Number(e.target.value))} 
                        required 
                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-black text-slate-800" 
                      />
                    </div>

                    <div className="pt-2">
                       <div className="bg-slate-900 rounded-2xl p-5 text-white relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform">
                            <ArrowUpRight size={40} />
                         </div>
                         <div className="flex justify-between items-center mb-1 relative z-10">
                           <label className="text-[9px] font-black text-white/50 uppercase tracking-widest block">Inversión Total en Stock</label>
                           <button 
                             type="button" 
                             onClick={() => setFormTotalCostMode(prev => prev === 'USD' ? 'BS' : 'USD')}
                             className="text-[8px] font-black bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-lg uppercase tracking-widest transition-colors flex items-center gap-1 active:scale-95"
                           >
                             <Landmark size={10} /> {formTotalCostMode === 'USD' ? 'Cambiar a Bs.' : 'Cambiar a $'}
                           </button>
                         </div>
                         <div className="relative z-10 flex items-center">
                           <input 
                            type="number" 
                            step="0.01" 
                            value={formTotalCostStr} 
                            onFocus={() => isTypingFormTotal.current = true}
                            onBlur={() => {
                              isTypingFormTotal.current = false;
                              // Force a sync on blur to clean up formatting
                              if (formTotalCostMode === 'USD') {
                                setFormTotalCostStr(formTotalCost === 0 ? '' : formTotalCost.toString());
                              } else if (rate > 0) {
                                setFormTotalCostStr(formTotalCost === 0 ? '' : (formTotalCost * rate).toFixed(2));
                              }
                            }}
                            onChange={(e) => {
                              const strVal = e.target.value;
                              setFormTotalCostStr(strVal);
                              const numVal = Number(strVal);
                              if (formTotalCostMode === 'BS') {
                                updateFormByTotalCost(rate > 0 ? Number((numVal / rate).toFixed(2)) : 0);
                              } else {
                                updateFormByTotalCost(numVal);
                              }
                            }} 
                            className="bg-transparent border-none outline-none font-black text-4xl w-full text-emerald-400 placeholder:text-emerald-900/30" 
                            placeholder="0.00"
                          />
                           <span className={`text-2xl font-black absolute right-0 pointer-events-none transition-all duration-300 ${formTotalCostMode === 'USD' ? 'text-blue-500/20' : 'text-emerald-500/20'}`}>
                             {formTotalCostMode === 'USD' ? 'USD' : 'Bs.'}
                           </span>
                         </div>
                         <p className="text-[8px] font-bold text-white/30 uppercase mt-2 relative z-10">Este valor recalcula el costo unitario basado en el stock</p>
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              <button disabled={loading} type="submit" className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-lg shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3">
                {loading ? <Loader2 className="animate-spin" /> : 'Confirmar y Guardar Registro'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Borrado de Producto */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <AlertTriangle size={40} />
            </div>
            
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">¿Eliminar Producto?</h3>
            <p className="text-slate-500 font-medium mb-6">
              Estás a punto de eliminar <span className="font-black text-slate-800 underline decoration-rose-300">"{productToDelete?.name}"</span>. <br/>
              Esta acción no se puede deshacer y fallará si el producto tiene historial de ventas.
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDeleteProduct}
                disabled={loading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-rose-100 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Sí, Eliminar Producto'}
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

      {/* Modal Reponer Stock con Calculadora Similar */}
      {isReplenishOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsReplenishOpen(false)} />
          <form onSubmit={handleReplenish} className="relative bg-white w-full max-md rounded-[3rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Entrada de Mercancía</h3>
              <Calculator size={20} className="text-blue-500" />
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad a Añadir</label>
                <input 
                  type="number" 
                  required 
                  value={replenishQty || ''} 
                  onChange={(e) => updateReplenishByQty(Number(e.target.value))} 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-xl" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo Unitario de Compra ($)</label>
                <div className="flex flex-col">
                  <div className="relative flex-1">
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      value={replenishUnitCost || ''} 
                      onChange={(e) => updateReplenishByUnitCost(Number(e.target.value))} 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-xl" 
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">$</div>
                  </div>
                  {rate > 0 && replenishUnitCost > 0 && (
                    <div className="ml-1 mt-1 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Equivale a: <span className="text-blue-600">Bs. {(replenishUnitCost * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                    </div>
                  )}
                </div>
                {rate > 0 && <div className="flex justify-between items-center mt-1">
                  <button 
                    type="button" 
                    onClick={getRate}
                    className="text-[8px] font-black text-blue-400 uppercase tracking-tighter hover:text-blue-600 flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw size={10} className={isRateLoading ? 'animate-spin' : ''} /> Actualizar Tasa
                  </button>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Tasa BCV: {rate.toLocaleString()} Bs/$</p>
                </div>}
              </div>
              <div className="bg-slate-900 rounded-2xl p-5 text-white">
                 <div className="flex justify-between items-center mb-1">
                   <p className="text-[8px] font-black uppercase opacity-50 tracking-widest">Monto de Inversión (Total)</p>
                   <button 
                     type="button" 
                     onClick={() => setReplenishTotalCostMode(prev => prev === 'USD' ? 'BS' : 'USD')}
                     className="text-[7px] font-black bg-white/10 hover:bg-white/20 text-white/70 px-2 py-1 rounded-md uppercase tracking-widest transition-colors flex items-center gap-1"
                   >
                     <Landmark size={8} /> {replenishTotalCostMode === 'USD' ? 'Cambiar a Bs.' : 'Cambiar a $'}
                   </button>
                 </div>
                 <div className="flex items-center relative">
                   <input 
                    type="number" 
                    step="0.01" 
                    value={replenishTotalCostStr} 
                    onFocus={() => isTypingReplenishTotal.current = true}
                    onBlur={() => {
                      isTypingReplenishTotal.current = false;
                      // Force a sync on blur to clean up formatting
                      if (replenishTotalCostMode === 'USD') {
                        setReplenishTotalCostStr(replenishTotalCost === 0 ? '' : replenishTotalCost.toString());
                      } else if (rate > 0) {
                        setReplenishTotalCostStr(replenishTotalCost === 0 ? '' : (replenishTotalCost * rate).toFixed(2));
                      }
                    }}
                    onChange={(e) => {
                      const strVal = e.target.value;
                      setReplenishTotalCostStr(strVal);
                      const numVal = Number(strVal);
                      if (replenishTotalCostMode === 'BS') {
                        updateReplenishByTotalCost(rate > 0 ? Number((numVal / rate).toFixed(2)) : 0);
                      } else {
                        updateReplenishByTotalCost(numVal);
                      }
                    }} 
                    className="bg-transparent border-none outline-none text-3xl font-black text-emerald-400 w-full placeholder:text-emerald-900/30" 
                    placeholder="0.00"
                  />
                  <span className={`text-xl font-black absolute right-0 pointer-events-none transition-all duration-300 ${replenishTotalCostMode === 'USD' ? 'text-blue-500/20' : 'text-emerald-500/20'}`}>
                    {replenishTotalCostMode === 'USD' ? 'USD' : 'Bs.'}
                  </span>
                 </div>
              </div>
            </div>
            <button disabled={loading || replenishQty <= 0} type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin" /> : 'Confirmar Entrada'}
            </button>
          </form>
        </div>
      )}

      {/* Modal de Etiquetas */}
      {isBarcodeModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsBarcodeModalOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Etiqueta de Barra</h3>
            <p className="text-xs text-slate-400 font-bold mb-6 truncate">{productForBarcode?.name}</p>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 mb-8 flex justify-center">
               <svg ref={barcodeRef}></svg>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={downloadBarcode} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all">
                <Download size={18} /> Descargar Imagen
              </button>
              <button onClick={() => setIsBarcodeModalOpen(false)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
