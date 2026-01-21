
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { dbService } from '../services/dbService';
import { Product } from '../types';
import { Plus, Search, Edit2, Trash2, Camera, Package, RefreshCw, Loader2, Calculator, X, AlertTriangle, ChevronDown, Barcode, Download, ArrowUpRight, DollarSign } from 'lucide-react';
import JsBarcode from 'jsbarcode';

const InventoryView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReplenishOpen, setIsReplenishOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForBarcode, setProductForBarcode] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados para la calculadora del Formulario Principal
  const [formStock, setFormStock] = useState<number>(0);
  const [formUnitCost, setFormUnitCost] = useState<number>(0);
  const [formTotalCost, setFormTotalCost] = useState<number>(0);

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

  useEffect(() => {
    fetchProducts();
  }, []);

  // Sincronizar estados al abrir el modal de edición
  useEffect(() => {
    if (editingProduct) {
      setFormStock(editingProduct.stock);
      setFormUnitCost(editingProduct.cost);
      setFormTotalCost(editingProduct.stock * editingProduct.cost);
    } else {
      setFormStock(0);
      setFormUnitCost(0);
      setFormTotalCost(0);
    }
  }, [editingProduct, isModalOpen]);

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
        height: 100,
        displayValue: true,
        fontSize: 18,
        textMargin: 10
      });
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
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-3xl font-black text-slate-800 tracking-tight">Inventario</h1>
          <p className="text-xs lg:text-base text-slate-500 font-medium">Gestión avanzada de costos y stock.</p>
        </div>
        <button 
          onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
        >
          <Plus size={18} /> Nuevo Item
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por nombre o código..." 
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-50 transition-all font-medium shadow-sm outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-6">Producto</th>
                <th className="px-8 py-6">Precio Venta</th>
                <th className="px-8 py-6 text-center">Stock</th>
                <th className="px-8 py-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 text-base">{p.name}</span>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{p.barcode || 'Manual'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-base font-black text-blue-600">${p.price.toLocaleString()}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className={`inline-block px-4 py-1 rounded-full text-[10px] font-black ${p.stock <= 5 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {p.stock} UNIDADES
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setProductForBarcode(p); setIsBarcodeModalOpen(true); }} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200" title="Código Barras"><Barcode size={18}/></button>
                      <button onClick={() => { setEditingProduct(p); setReplenishQty(0); setReplenishUnitCost(p.cost); setReplenishTotalCost(0); setIsReplenishOpen(true); }} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100" title="Reponer Stock"><RefreshCw size={18}/></button>
                      <button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100" title="Editar"><Edit2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Principal Crear/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white w-full max-w-4xl h-[95vh] sm:h-auto rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Ficha Técnica Item</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400"><X size={28} /></button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-8 lg:p-10 space-y-8 overflow-y-auto hide-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Información Básica */}
                <div className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Producto</label>
                    <input name="name" defaultValue={editingProduct?.name} required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código Barra / SKU</label>
                    <input name="barcode" defaultValue={editingProduct?.barcode} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Precio Venta al Público ($)</label>
                    <input name="price" type="number" step="0.01" defaultValue={editingProduct?.price} required className="w-full px-6 py-4 bg-blue-50 border border-blue-100 rounded-2xl outline-none font-black text-2xl text-blue-600" />
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
                        value={formUnitCost} 
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
                         <label className="text-[9px] font-black text-white/50 uppercase tracking-widest block mb-1">Inversión Total en Stock ($)</label>
                         <input 
                          type="number" 
                          step="0.01" 
                          value={formTotalCost} 
                          onChange={(e) => updateFormByTotalCost(Number(e.target.value))} 
                          className="bg-transparent border-none outline-none font-black text-3xl w-full text-emerald-400" 
                        />
                         <p className="text-[8px] font-bold text-white/30 uppercase mt-2">Este valor recalcula el costo unitario basado en el stock</p>
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

      {/* Modal Reponer Stock con Calculadora Similar */}
      {isReplenishOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsReplenishOpen(false)} />
          <form onSubmit={handleReplenish} className="relative bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
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
                <input 
                  type="number" 
                  step="0.01" 
                  required 
                  value={replenishUnitCost || ''} 
                  onChange={(e) => updateReplenishByUnitCost(Number(e.target.value))} 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-xl" 
                />
              </div>
              <div className="bg-slate-900 rounded-2xl p-5 text-white">
                 <p className="text-[8px] font-black uppercase opacity-50 tracking-widest mb-1">Monto de Inversión (Total)</p>
                 <div className="flex items-center">
                   <span className="text-2xl font-black text-white mr-1">$</span>
                   <input 
                    type="number" 
                    step="0.01" 
                    value={replenishTotalCost || ''} 
                    onChange={(e) => updateReplenishByTotalCost(Number(e.target.value))} 
                    className="bg-transparent border-none outline-none text-2xl font-black text-emerald-400 w-full" 
                  />
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
