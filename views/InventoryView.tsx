
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { dbService } from '../services/dbService';
import { Product, WholesaleTier, ServiceUsedProduct, ServiceExtraExpense } from '../types';
import { fetchExchangeRate } from '../services/exchangeService';
import { Plus, Search, Edit2, Trash2, Camera, Package, RefreshCw, Loader2, Calculator, X, AlertTriangle, ChevronDown, Barcode, Download, ArrowUpRight, DollarSign, Tag, Landmark, FileUp, FileText, Percent, Layers, PlusCircle, Trash, Settings } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import Papa from 'papaparse';

interface InventoryViewProps {
  useParallelRate?: boolean;
}

const InventoryView: React.FC<InventoryViewProps> = ({ useParallelRate = false }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'products' | 'services'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReplenishOpen, setIsReplenishOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForBarcode, setProductForBarcode] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Estados para Servicios
  const [isService, setIsService] = useState<boolean>(false);
  const [serviceBasePrice, setServiceBasePrice] = useState<number>(0);
  const [usedProducts, setUsedProducts] = useState<ServiceUsedProduct[]>([]);
  const [extraExpenses, setExtraExpenses] = useState<ServiceExtraExpense[]>([]);

  // Estados auxiliares temporales para el modal de carga de servicios
  const [tempSelectedProductId, setTempSelectedProductId] = useState<string>('');
  const [tempProductQty, setTempProductQty] = useState<number>(1);
  const [tempExpenseName, setTempExpenseName] = useState<string>('');
  const [tempExpenseAmount, setTempExpenseAmount] = useState<number>(0);

  // Estados para la advertencia de doble confirmación de precio menor al costo
  const [showPriceWarningModal, setShowPriceWarningModal] = useState(false);
  const [pendingProductData, setPendingProductData] = useState<Partial<Product> | null>(null);
  const [isNewPending, setIsNewPending] = useState(false);
  const [warnCheck1, setWarnCheck1] = useState(false);
  const [warnCheck2, setWarnCheck2] = useState(false);

  // Estados para Descuentos Especiales
  const [seasonalDiscountEnabled, setSeasonalDiscountEnabled] = useState<boolean>(false);
  const [seasonalDiscountPrice, setSeasonalDiscountPrice] = useState<number>(0);
  const [cashDiscountEnabled, setCashDiscountEnabled] = useState<boolean>(false);
  const [cashDiscountPrice, setCashDiscountPrice] = useState<number>(0);
  const [wholesaleDiscountEnabled, setWholesaleDiscountEnabled] = useState<boolean>(false);
  const [wholesaleTiers, setWholesaleTiers] = useState<WholesaleTier[]>([]);

  // Funciones auxiliares para escalas al mayor
  const addWholesaleTier = () => {
    setWholesaleTiers([...wholesaleTiers, { qty: 2, price: 0 }]);
  };

  const updateWholesaleTier = (index: number, field: 'qty' | 'price', value: number) => {
    const updated = [...wholesaleTiers];
    updated[index] = { ...updated[index], [field]: value };
    setWholesaleTiers(updated);
  };

  const removeWholesaleTier = (index: number) => {
    setWholesaleTiers(wholesaleTiers.filter((_, i) => i !== index));
  };

  const downloadInventoryTemplate = () => {
    const csvContent = "Nombre,Precio,Costo,Stock,Categoria,CodigoBarra\nEjemplo Producto,10.50,7.00,100,Bebidas,123456789";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_inventario.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleInventoryCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const mappedProducts = results.data.map((row: any) => ({
            name: row.Nombre || row.name,
            price: parseFloat(row.Precio || row.price || '0'),
            cost: parseFloat(row.Costo || row.cost || '0'),
            stock: parseFloat(row.Stock || row.stock || '0'),
            category: row.Categoria || row.category || 'General',
            barcode: row.CodigoBarra || row.barcode || ''
          })).filter(p => p.name);

          if (mappedProducts.length === 0) {
            alert("No se encontraron productos válidos en el CSV. Verifique el formato.");
            setImporting(false);
            return;
          }

          await dbService.saveProductsBatch(mappedProducts);
          await fetchProducts();
          setIsMigrationModalOpen(false);
          alert(`¡Éxito! Se importaron ${mappedProducts.length} productos.`);
        } catch (err) {
          console.error(err);
          alert("Error al procesar el archivo CSV. Asegúrese de que el formato sea correcto.");
        } finally {
          setImporting(false);
          if (e.target) e.target.value = '';
        }
      }
    });
  };

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
      
      setSeasonalDiscountEnabled(editingProduct.seasonalDiscountEnabled || false);
      setSeasonalDiscountPrice(editingProduct.seasonalDiscountPrice || 0);
      setCashDiscountEnabled(editingProduct.cashDiscountEnabled || false);
      setCashDiscountPrice(editingProduct.cashDiscountPrice || 0);
      setWholesaleDiscountEnabled(editingProduct.wholesaleDiscountEnabled || false);
      setWholesaleTiers(editingProduct.wholesaleTiers || []);

      setIsService(editingProduct.isService || false);
      setServiceBasePrice(editingProduct.serviceBasePrice || 0);
      setUsedProducts(editingProduct.usedProducts || []);
      setExtraExpenses(editingProduct.extraExpenses || []);
    } else {
      setFormStock(0);
      setFormUnitCost(0);
      setFormTotalCost(0);
      setFormTotalCostStr('');
      setFormBarcode('');
      setFormPrice(0);
      
      setSeasonalDiscountEnabled(false);
      setSeasonalDiscountPrice(0);
      setCashDiscountEnabled(false);
      setCashDiscountPrice(0);
      setWholesaleDiscountEnabled(false);
      setWholesaleTiers([]);

      setIsService(false);
      setServiceBasePrice(0);
      setUsedProducts([]);
      setExtraExpenses([]);
    }
  }, [editingProduct, isModalOpen]);

  // Recalcular el precio del servicio en tiempo real
  useEffect(() => {
    if (isService) {
      const consumedSum = usedProducts.reduce((sum, item) => {
        const prod = products.find(p => p.id === item.productId);
        const itemPrice = prod ? prod.price : item.unitCost;
        return sum + (item.qty * itemPrice);
      }, 0);
      const extraSum = extraExpenses.reduce((sum, e) => sum + e.amount, 0);
      const computedPrice = serviceBasePrice + consumedSum + extraSum;
      setFormPrice(Number(computedPrice.toFixed(2)));
    }
  }, [isService, serviceBasePrice, usedProducts, extraExpenses, products]);

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
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.barcode && p.barcode.includes(searchTerm));
      if (!matchesSearch) return false;

      if (activeTab === 'products') return !p.isService;
      if (activeTab === 'services') return !!p.isService;
      return true;
    });
  }, [products, searchTerm, activeTab]);

  const saveProductDirect = async (productData: Partial<Product>, isNew: boolean) => {
    setLoading(true);
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

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const isNew = !editingProduct;
    
    const price = Number(formData.get('price')) || formPrice;
    
    // Calcular costo real del servicio en base a insumos y gastos extras
    const cost = isService 
      ? usedProducts.reduce((sum, item) => {
          const originalProd = products.find(p => p.id === item.productId);
          return sum + (item.qty * (originalProd?.cost || item.unitCost));
        }, 0) + extraExpenses.reduce((sum, ext) => sum + ext.amount, 0)
      : formUnitCost;

    const productData: Partial<Product> = {
      id: editingProduct?.id || crypto.randomUUID(),
      name: formData.get('name') as string,
      barcode: (formData.get('barcode') as string) || '',
      category: (formData.get('category') as string) || 'General',
      price: price,
      cost: cost,
      stock: isService ? 999999 : formStock, // Stock ilimitado para servicios
      seasonalDiscountEnabled: seasonalDiscountEnabled,
      seasonalDiscountPrice: Number(seasonalDiscountPrice) || 0,
      cashDiscountEnabled: cashDiscountEnabled,
      cashDiscountPrice: Number(cashDiscountPrice) || 0,
      wholesaleDiscountEnabled: wholesaleDiscountEnabled,
      wholesaleTiers: wholesaleTiers,
      isService: isService,
      serviceBasePrice: isService ? Number(serviceBasePrice) : 0,
      usedProducts: isService ? usedProducts : [],
      extraExpenses: isService ? extraExpenses : []
    };

    // Para servicios, omitimos la advertencia si el margen ya fue calculado positivamente
    if (!isService && price < cost) {
      setPendingProductData(productData);
      setIsNewPending(isNew);
      setWarnCheck1(false);
      setWarnCheck2(false);
      setShowPriceWarningModal(true);
      return;
    }

    await saveProductDirect(productData, isNew);
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
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setIsMigrationModalOpen(true)}
            className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm border border-slate-200 dark:border-slate-800"
          >
            <FileUp size={18} /> Migrar CSV
          </button>
          <button 
            onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
            className="bg-slate-900 dark:bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-sm active:scale-95 border border-slate-800 dark:border-blue-500/30"
          >
            <Plus size={18} /> Registrar Producto
          </button>
        </div>
      </div>

      {/* Selector de tipo para filtrar */}
      <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-700/85">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'products' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
        >
          Productos
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'services' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
        >
          Servicios
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
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Tasa {useParallelRate ? 'Paralelo' : 'BCV'}</p>
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
                <th className="px-8 py-6 text-center">Stock / Tipo</th>
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
                        {p.isService && (
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-black uppercase tracking-tight px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 rounded-full">Servicio</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-base font-black text-slate-900 dark:text-slate-100">${p.price.toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-slate-400">≈ BS {(p.price * rate).toLocaleString()}</span>
                      <div className="flex flex-wrap gap-1 mt-1.5 max-w-[150px]">
                        {p.seasonalDiscountEnabled && (
                          <span className="text-[8px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-black uppercase tracking-tight" title={`Precio de temporada: $${p.seasonalDiscountPrice}`}>
                            Temp: ${p.seasonalDiscountPrice}
                          </span>
                        )}
                        {p.cashDiscountEnabled && (
                          <span className="text-[8px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase tracking-tight" title={`Precio en efectivo: $${p.cashDiscountPrice}`}>
                            Efect: ${p.cashDiscountPrice}
                          </span>
                        )}
                        {p.wholesaleDiscountEnabled && p.wholesaleTiers && p.wholesaleTiers.length > 0 && (
                          <span className="text-[8px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-black uppercase tracking-tight" title={`Escalas al mayor: ${p.wholesaleTiers.length}`}>
                            Mayor ({p.wholesaleTiers.length})
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    {p.isService ? (
                      <div className="inline-block px-4 py-1 rounded-full text-[10px] font-black tracking-tight bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                        SERVICIO ILIMITADO
                      </div>
                    ) : (
                      <div className={`inline-block px-4 py-1 rounded-full text-[10px] font-black tracking-tight ${p.stock <= 5 ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
                        {p.stock} UNIDADES
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-end gap-2 lg:opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => { setProductForBarcode(p); setIsBarcodeModalOpen(true); }} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="Código Barras"><Barcode size={18}/></button>
                      {!p.isService && (
                        <button onClick={() => { setEditingProduct(p); setReplenishQty(0); setReplenishUnitCost(p.cost); setReplenishTotalCost(0); setIsReplenishOpen(true); }} className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors" title="Reponer Stock"><RefreshCw size={18}/></button>
                      )}
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
          <div className="relative bg-white dark:bg-[#0f172a] w-full max-w-4xl h-[95vh] sm:max-h-[90vh] rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom sm:zoom-in-95 transition-colors">
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
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 transition-colors"><X size={28} /></button>
              </div>
            </div>
            <form onSubmit={handleSaveProduct} className="p-8 lg:p-10 space-y-8 overflow-y-auto flex-1 scrollbar-thin">
              {/* Selector de Tipo de Registro */}
              <div className="flex bg-slate-150 dark:bg-slate-800 p-1 rounded-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setIsService(false)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 ${!isService ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  <Package size={14} /> Producto Físico
                </button>
                <button
                  type="button"
                  onClick={() => setIsService(true)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 ${isService ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  <RefreshCw size={14} /> Servicio
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Información Básica */}
                <div className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                      {isService ? 'Nombre del Servicio' : 'Nombre del Producto'}
                    </label>
                    <input name="name" defaultValue={editingProduct?.name} required className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 outline-none font-black text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 transition-all rounded-2xl" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Categoría</label>
                    <div className="relative">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={18} />
                      <input name="category" defaultValue={editingProduct?.category} placeholder={isService ? "Ej: Reparación, Delivery, Soporte..." : "Ej: Bebidas, Alimentos, Limpieza..."} className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 outline-none font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 transition-all rounded-2xl" />
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

                  {isService && (
                    <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                      <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1">Mano de Obra / Base Trabajo ($)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={serviceBasePrice || ''} 
                        onChange={(e) => setServiceBasePrice(Number(e.target.value))}
                        className="w-full px-6 py-4 bg-purple-50/20 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 outline-none font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-850 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-500/20 transition-all rounded-2xl"
                        placeholder="Precio base por el servicio..." 
                      />
                    </div>
                  )}

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
                           readOnly={isService}
                           className={`w-full px-6 py-4 border rounded-2xl outline-none font-black text-2xl transition-all ${isService ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed' : 'bg-blue-50 dark:bg-blue-600/10 border-blue-100 dark:border-blue-500/30 text-blue-600 dark:text-blue-400'}`} 
                         />
                         <div className="absolute right-6 top-1/2 -translate-y-1/2 text-blue-300 dark:text-blue-600 font-black">$</div>
                       </div>
                       {isService && (
                         <p className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest leading-none mt-1.5 ml-1">
                           ★ Auto-calculado: Base Trabajo + Insumos + Gastos Extras
                         </p>
                       )}
                       {rate > 0 && formPrice > 0 && (
                         <div className="ml-1 mt-1 flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                           <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight">Equivale a: <span className="text-emerald-600 dark:text-emerald-400">Bs. {(formPrice * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                         </div>
                       )}
                    </div>
                    {rate > 0 && !isService && <div className="flex justify-between items-center mt-1">
                      <button 
                        type="button" 
                        onClick={getRate}
                        className="text-[8px] font-black text-blue-400 uppercase tracking-tighter hover:text-blue-600 flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw size={10} className={isRateLoading ? 'animate-spin' : ''} /> Actualizar Tasa
                      </button>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{useParallelRate ? 'Tasa Paralelo' : 'Tasa BCV'}: {rate.toLocaleString()} Bs/$</p>
                    </div>}
                  </div>
                </div>

                {/* Calculadora Inteligente de Costos para Productos FÍSICOS */}
                {!isService && (
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
                )}

                {/* Composición Estructurada para SERVICIOS */}
                {isService && (
                  <div className="space-y-6 bg-purple-50/30 dark:bg-purple-950/20 p-6 lg:p-8 rounded-[2.5rem] border border-purple-200/50 dark:border-purple-800/30 max-h-[80vh] overflow-y-auto">
                    <h4 className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-1.5">
                      <Settings size={14} /> Estructura del Servicio
                    </h4>

                    {/* 1. PRODUCTOS/INSUMOS CONSUMIDOS */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block text-xs">Productos/Insumos que Consume</label>
                      
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={tempSelectedProductId}
                          onChange={(e) => setTempSelectedProductId(e.target.value)}
                          className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-slate-100 font-bold text-sm"
                        >
                          <option value="">-- Seleccionar Insumo --</option>
                          {products.filter(p => !p.isService).map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stock: {p.stock}, ${p.price})
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2 shrink-0">
                          <input
                            type="number"
                            min="1"
                            value={tempProductQty}
                            onChange={(e) => setTempProductQty(Math.max(1, Number(e.target.value)))}
                            className="w-20 px-3 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-black text-center text-slate-900 dark:text-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!tempSelectedProductId) return;
                              const product = products.find(p => p.id === tempSelectedProductId);
                              if (!product) return;
                              
                              const existingIndex = usedProducts.findIndex(u => u.productId === product.id);
                              if (existingIndex > -1) {
                                const updated = [...usedProducts];
                                updated[existingIndex].qty += tempProductQty;
                                setUsedProducts(updated);
                              } else {
                                setUsedProducts([...usedProducts, {
                                  productId: product.id,
                                  name: product.name,
                                  qty: tempProductQty,
                                  unitCost: product.cost,
                                  sellingPrice: product.price
                                }]);
                              }
                              setTempSelectedProductId('');
                              setTempProductQty(1);
                            }}
                            className="px-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition"
                          >
                            Agregar
                          </button>
                        </div>
                      </div>

                      {usedProducts.length > 0 ? (
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1 border border-slate-150 dark:border-slate-800 rounded-xl p-2 bg-white dark:bg-slate-900/50">
                          {usedProducts.map((u, index) => {
                            const original = products.find(p => p.id === u.productId);
                            const displayPrice = original ? original.price : u.sellingPrice;
                            return (
                              <div key={index} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-b-0">
                                <div>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{u.name}</span>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-2">Cant: {u.qty} x ${displayPrice}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-705 dark:text-slate-300">${(u.qty * displayPrice).toFixed(2)}</span>
                                  <button
                                    type="button"
                                    onClick={() => setUsedProducts(usedProducts.filter((_, i) => i !== index))}
                                    className="text-rose-500 hover:text-rose-700 p-1"
                                  >
                                    <Trash size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">No consume productos cargados en almacén.</p>
                      )}
                    </div>

                    {/* 2. GASTOS EXTRAS */}
                    <div className="space-y-3 pt-3 border-t border-purple-200/40">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block text-xs">Gastos Adicionales (Delivery, Repuestos Extra)</label>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Repuesto extra, traslado, etc..."
                          value={tempExpenseName}
                          onChange={(e) => setTempExpenseName(e.target.value)}
                          className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-slate-100 font-bold text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00 $"
                          value={tempExpenseAmount || ''}
                          onChange={(e) => setTempExpenseAmount(Number(e.target.value))}
                          className="w-24 px-3 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-black text-center text-slate-900 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!tempExpenseName || tempExpenseAmount <= 0) return;
                            setExtraExpenses([...extraExpenses, {
                              name: tempExpenseName,
                              amount: tempExpenseAmount
                            }]);
                            setTempExpenseName('');
                            setTempExpenseAmount(0);
                          }}
                          className="px-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition"
                        >
                          +
                        </button>
                      </div>

                      {extraExpenses.length > 0 ? (
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1 border border-slate-150 dark:border-slate-800 rounded-xl p-2 bg-white dark:bg-slate-900/50">
                          {extraExpenses.map((e, index) => (
                            <div key={index} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-b-0">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{e.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-705 dark:text-slate-300">${e.amount.toFixed(2)}</span>
                                <button
                                  type="button"
                                  onClick={() => setExtraExpenses(extraExpenses.filter((_, i) => i !== index))}
                                  className="text-rose-500 hover:text-rose-700 p-1"
                                >
                                  <Trash size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">No hay gastos adicionales especificados.</p>
                      )}
                    </div>

                    {/* RESUMEN DE COMPOSICIÓN EN TIEMPO REAL */}
                    <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Resumen en Tiempo Real</p>
                      <div className="flex justify-between text-xs">
                        <span>Precio Base de Trabajo:</span>
                        <span className="font-bold">${serviceBasePrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Insumos Usados ({usedProducts.length}):</span>
                        <span className="font-bold">
                          ${usedProducts.reduce((sum, item) => sum + (item.qty * (products.find(p => p.id === item.productId)?.price || item.sellingPrice)), 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs pb-2 border-b border-white/10">
                        <span>Gastos Extras:</span>
                        <span className="font-bold">${extraExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black text-emerald-300">
                        <span>Precio Final Calculado:</span>
                        <span className="text-lg font-black text-white">$ {formPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CONFIGURACIÓN DE DESCUENTOS ESPECIALES */}
              <div className="bg-slate-50 dark:bg-slate-900/40 p-6 lg:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md">
                    <Percent size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Descuentos Especiales</h4>
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-1">Configuración Flexible de Precios</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Descuento por Temporada */}
                  <div className="bg-white dark:bg-[#0b0f19] p-5 rounded-2xl border border-slate-100 dark:border-slate-800/40 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Temporada</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setSeasonalDiscountEnabled(!seasonalDiscountEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${seasonalDiscountEnabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${seasonalDiscountEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    {seasonalDiscountEnabled && (
                      <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Precio en Temporada ($)</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            step="0.01" 
                            value={seasonalDiscountPrice || ''} 
                            onChange={(e) => setSeasonalDiscountPrice(Number(e.target.value))} 
                            placeholder="0.00" 
                            required 
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/55 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-extrabold text-sm text-slate-800 dark:text-slate-100" 
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-550 font-bold">$</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Descuento Pago Efectivo */}
                  <div className="bg-white dark:bg-[#0b0f19] p-5 rounded-2xl border border-slate-100 dark:border-slate-800/40 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Pago en Efectivo</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setCashDiscountEnabled(!cashDiscountEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${cashDiscountEnabled ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${cashDiscountEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    {cashDiscountEnabled && (
                      <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Precio en Efectivo ($)</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            step="0.01" 
                            value={cashDiscountPrice || ''} 
                            onChange={(e) => setCashDiscountPrice(Number(e.target.value))} 
                            placeholder="0.00" 
                            required 
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/55 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-extrabold text-sm text-slate-800 dark:text-slate-100" 
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-550 font-bold">$</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Descuento al Mayor */}
                  <div className="bg-white dark:bg-[#0b0f19] p-5 rounded-2xl border border-slate-100 dark:border-slate-800/40 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Ventas al Mayor</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setWholesaleDiscountEnabled(!wholesaleDiscountEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${wholesaleDiscountEnabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${wholesaleDiscountEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    {wholesaleDiscountEnabled && (
                      <div className="space-y-2 animate-in slide-in-from-top-2 duration-200 text-left">
                        <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-snug">Escalas creadas: {wholesaleTiers.length}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* EDITAR ESCALAS AL MAYOR EN DETALLE */}
                {wholesaleDiscountEnabled && (
                  <div className="bg-white dark:bg-[#0b0f19] p-6 rounded-2xl border border-slate-200 dark:border-slate-800/60 space-y-4 shadow-sm animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h5 className="text-[10px] font-black text-slate-850 dark:text-slate-200 uppercase tracking-widest">Escalas de Descuento por Mayor</h5>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Establece precios preferenciales por volumen</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={addWholesaleTier}
                        className="text-[10px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all active:scale-95"
                      >
                        <PlusCircle size={14} /> Agregar Escala
                      </button>
                    </div>

                    {wholesaleTiers.length === 0 ? (
                      <div className="py-6 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-450 dark:text-slate-550">
                        <Layers size={24} className="mx-auto mb-1.5 opacity-30 animate-pulse" />
                        <p className="text-[10px] font-black uppercase tracking-wider">No se han definido escalas al mayor</p>
                        <button type="button" onClick={addWholesaleTier} className="text-[9px] text-indigo-600 dark:text-indigo-400 font-black hover:underline mt-1">CREAR PRIMERA ESCALA AHORA</button>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
                        {wholesaleTiers.map((tier, index) => (
                          <div key={index} className="flex items-center gap-3.5 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800/75 animate-in slide-in-from-right-3">
                            <span className="text-[10px] font-black text-slate-450 dark:text-slate-550 uppercase">{index + 1}° Escala</span>
                            
                            <div className="flex-1 grid grid-cols-2 gap-3">
                              <div className="space-y-0.5 col-span-1">
                                <span className="text-[9px] font-black text-slate-450 dark:text-slate-550 uppercase tracking-tight">Cantidad Mínima</span>
                                <input 
                                  type="number" 
                                  min="2"
                                  value={tier.qty || ''} 
                                  onChange={(e) => updateWholesaleTier(index, 'qty', Number(e.target.value))} 
                                  placeholder="Ej: 6" 
                                  required 
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none font-extrabold text-xs text-slate-800 dark:text-slate-100"
                                />
                              </div>

                              <div className="space-y-0.5 col-span-1">
                                <span className="text-[9px] font-black text-slate-450 dark:text-slate-550 uppercase tracking-tight">Precio de Unidad ($)</span>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    step="0.01" 
                                    value={tier.price || ''} 
                                    onChange={(e) => updateWholesaleTier(index, 'price', Number(e.target.value))} 
                                    placeholder="0.00" 
                                    required 
                                    className="w-full pl-3 pr-6 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none font-extrabold text-xs text-slate-800 dark:text-slate-100"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                                </div>
                              </div>
                            </div>

                            <button 
                              type="button" 
                              onClick={() => removeWholesaleTier(index)}
                              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors mt-2.5"
                              title="Remover Escala"
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-md" onClick={() => setIsReplenishOpen(false)} />
          <form onSubmit={handleReplenish} className="relative bg-white dark:bg-[#0f172a] w-full max-w-md rounded-[3rem] p-8 shadow-2xl space-y-6 border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Entrada de Mercancía</h3>
              <Calculator size={20} className="text-blue-500" />
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Cantidad a Añadir</label>
                <input 
                  type="number" 
                  required 
                  value={replenishQty || ''} 
                  onChange={(e) => updateReplenishByQty(Number(e.target.value))} 
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 outline-none font-black text-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 transition-all rounded-2xl" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Costo Unitario de Compra ($)</label>
                <div className="flex flex-col">
                  <div className="relative flex-1">
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      value={replenishUnitCost || ''} 
                      onChange={(e) => updateReplenishByUnitCost(Number(e.target.value))} 
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 outline-none font-black text-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 transition-all rounded-2xl" 
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300 dark:text-slate-600">$</div>
                  </div>
                  {rate > 0 && replenishUnitCost > 0 && (
                    <div className="ml-1 mt-1.5 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">Equivale a: <span className="text-blue-600 dark:text-blue-400">Bs. {(replenishUnitCost * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                    </div>
                  )}
                </div>
                {rate > 0 && <div className="flex justify-between items-center mt-1.5 px-1">
                  <button 
                    type="button" 
                    onClick={getRate}
                    className="text-[8px] font-black text-blue-400 uppercase tracking-tighter hover:text-blue-600 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw size={10} className={isRateLoading ? 'animate-spin' : ''} /> Actualizar Tasa
                  </button>
                  <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{useParallelRate ? 'Tasa Paralelo' : 'Tasa BCV'}: {rate.toLocaleString()} Bs/$</p>
                </div>}
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-5 text-white border border-transparent dark:border-slate-800">
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
                    className="bg-transparent border-none outline-none text-3xl font-black text-emerald-400 w-full placeholder:text-emerald-950/30" 
                    placeholder="0.00"
                  />
                  <span className={`text-xl font-black absolute right-0 pointer-events-none transition-all duration-300 ${replenishTotalCostMode === 'USD' ? 'text-blue-500/20' : 'text-emerald-500/20'}`}>
                    {replenishTotalCostMode === 'USD' ? 'USD' : 'Bs.'}
                  </span>
                 </div>
              </div>
            </div>
            <button disabled={loading || replenishQty <= 0} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-5 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin" /> : 'Confirmar Entrada'}
            </button>
          </form>
        </div>
      )}

      {/* Modal de Migración CSV */}
      {isMigrationModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsMigrationModalOpen(false)} />
          <div className="relative bg-white dark:bg-[#0f172a] w-full max-w-md rounded-[3rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <FileUp size={40} />
            </div>
            
            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-2 uppercase">Migrar Inventario</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 text-sm">
              Sube un archivo CSV con tus productos. Asegúrate de seguir el formato de la plantilla.
            </p>

            <div className="flex flex-col gap-4">
              <button 
                onClick={downloadInventoryTemplate}
                className="w-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-slate-200 dark:border-slate-700"
              >
                <FileText size={18} /> Descargar Plantilla
              </button>
              
              <label className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 cursor-pointer shadow-xl shadow-blue-500/20 transition-all active:scale-95">
                {importing ? <Loader2 className="animate-spin" size={20} /> : <FileUp size={20} />}
                {importing ? 'Procesando...' : 'Seleccionar Archivo .CSV'}
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleInventoryCSV} 
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

      {/* Modal de Advertencia de Precio Menor que Costo con Doble Confirmación */}
      {showPriceWarningModal && pendingProductData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md" onClick={() => setShowPriceWarningModal(false)} />
          <div className="relative bg-white dark:bg-[#0f172a] w-full max-w-md rounded-[3rem] p-8 shadow-2xl border border-rose-100 dark:border-rose-950/30 animate-in zoom-in-95 duration-200 text-center space-y-6">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-3xl flex items-center justify-center mx-auto mb-2 shadow-inner">
              <AlertTriangle size={36} className="animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-rose-600 dark:text-rose-400 uppercase tracking-tight">⚠️ Alerta de Margen Negativo</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">Pérdida Financiera Detectada</p>
            </div>

            <div className="p-5 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/10 rounded-2xl text-left space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                El precio de venta es menor que el de costo unitario:
              </p>
              <div className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-2.5 rounded-lg border border-rose-100/50 dark:border-rose-950/20">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Precio de Costo</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">${pendingProductData.cost?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block">Precio de Venta</span>
                  <span className="font-extrabold text-rose-600 dark:text-rose-400">${pendingProductData.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
                Cada unidad vendida de <span className="font-black">"{pendingProductData.name}"</span> generará una pérdida directa de <span className="font-bold text-rose-600 dark:text-rose-400">${((pendingProductData.cost || 0) - (pendingProductData.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>.
              </p>
            </div>

            {/* SECCIÓN DE CONFIRMACIÓN DOBLE */}
            <div className="space-y-3.5 text-left bg-slate-50 dark:bg-slate-900/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={warnCheck1} 
                  onChange={(e) => setWarnCheck1(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 group-hover:dark:text-slate-150 transition-colors select-none">
                  Confirmo que el precio de venta registrado de <span className="font-black text-rose-600 dark:text-rose-400">${pendingProductData.price}</span> sí es el correcto.
                </span>
              </label>

              <div className="h-px bg-slate-200/50 dark:bg-slate-800" />

              <label className="flex items-start gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={warnCheck2} 
                  onChange={(e) => setWarnCheck2(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 group-hover:dark:text-slate-150 transition-colors select-none">
                  Acepto asumir el riesgo de registrar y vender este producto con pérdida económica.
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={async () => {
                  if (warnCheck1 && warnCheck2) {
                    setShowPriceWarningModal(false);
                    await saveProductDirect(pendingProductData, isNewPending);
                  }
                }}
                disabled={!warnCheck1 || !warnCheck2 || loading}
                className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-650 text-white py-4.5 rounded-2xl font-black text-base shadow-xl disabled:shadow-none flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Confirmar y Guardar con Pérdida'}
              </button>
              
              <button 
                onClick={() => {
                  setShowPriceWarningModal(false);
                  setPendingProductData(null);
                }}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Volver a corregir precio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
