
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { dbService } from '../services/dbService';
import { Product, Client, SaleItem, SaleStatus, Sale, PaymentMethod } from '../types';
import { fetchExchangeRate } from '../services/exchangeService';
import { ShoppingCart, Search, User, Trash2, Plus, Minus, CreditCard, Wallet, ScanLine, UserPlus, Loader2, X, ChevronDown, Camera, Check, Landmark, Smartphone, Banknote, Printer, CheckCircle2 } from 'lucide-react';
import { Html5Qrcode } from "html5-qrcode";
import { printThermalReceipt } from '../services/printService';

interface SalesViewProps {
  useParallelRate?: boolean;
  showTriplePrice?: boolean;
}

const SalesView: React.FC<SalesViewProps> = ({ useParallelRate = false, showTriplePrice = false }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [saleStatus, setSaleStatus] = useState<SaleStatus>(SaleStatus.COMPLETED);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.EFECTIVO);
  const [paymentRef, setPaymentRef] = useState('');
  const [amountPaidMode, setAmountPaidMode] = useState<'USD' | 'VES'>('USD');
  const [amountPaidStr, setAmountPaidStr] = useState<string>('');
  const isTypingAmountPaid = useRef(false);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [rate, setRate] = useState<number>(0);
  const [officialRate, setOfficialRate] = useState<number>(0);
  const [parallelRate, setParallelRate] = useState<number>(0);
  const [showBs, setShowBs] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [completedSaleClientName, setCompletedSaleClientName] = useState<string>('');
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastProcessedRef = useRef<number>(0);
  const rateLoadedRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [p, c] = await Promise.all([
          dbService.getProducts(), 
          dbService.getClients()
        ]);
        setProducts(p);
        setClients(c);
        
        if (!rateLoadedRef.current) {
          if (showTriplePrice) {
            const [o, par] = await Promise.all([
              fetchExchangeRate('oficial'),
              fetchExchangeRate('paralelo')
            ]);
            setOfficialRate(o);
            setParallelRate(par);
            setRate(useParallelRate ? par : o);
          } else {
            const r = await fetchExchangeRate(useParallelRate ? 'paralelo' : 'oficial');
            setRate(r);
          }
          rateLoadedRef.current = true;
        }
      } catch (err) {
        console.error("Error loading sales data:", err);
      }
    };
    loadData();
  }, [useParallelRate, showTriplePrice]);

  useEffect(() => {
    let isMounted = true;
    const initScanner = async () => {
      if (!isScannerOpen) return;
      setScannerLoading(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      const element = document.getElementById("scanner-region");
      if (!element) {
        setScannerLoading(false);
        return;
      }
      try {
        const scanner = new Html5Qrcode("scanner-region");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 180 } },
          (decodedText) => {
            const product = products.find(p => p.barcode === decodedText);
            if (product && isMounted) {
              addToCart(product);
              closeScanner();
            }
          },
          () => {}
        );
        if (isMounted) setScannerLoading(false);
      } catch (err) {
        if (isMounted) {
          alert("No se pudo iniciar la cámara.");
          setIsScannerOpen(false);
        }
      }
    };
    if (isScannerOpen) initScanner();
    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isScannerOpen, products]);

  const addToCart = (product: Product) => {
    const now = Date.now();
    if (now - lastProcessedRef.current < 500) return; 
    lastProcessedRef.current = now;
    if (product.stock <= 0) {
      alert(`¡Sin stock de ${product.name}!`);
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert("Límite de stock alcanzado");
          return prev;
        }
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
    setSearchTerm('');
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const product = products.find(p => p.id === productId);
        const newQty = Math.max(0, item.quantity + delta);
        if (product && newQty > product.stock) {
          alert("Stock máximo alcanzado");
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const openScanner = () => setIsScannerOpen(true);
  const closeScanner = () => setIsScannerOpen(false);

  const filteredProducts = useMemo(() => {
    if (!searchTerm || searchTerm.length < 1) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.barcode && p.barcode.includes(searchTerm))
    ).slice(0, 5);
  }, [products, searchTerm]);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return [];
    return clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 4);
  }, [clients, clientSearch]);

  const handleQuickCreateClient = async () => {
    if (!clientSearch.trim() || creatingClient) return;
    setCreatingClient(true);
    try {
      const newClient = await dbService.saveClient({
        name: clientSearch.trim(),
        currentDebt: 0
      });
      setClients(prev => [...prev, newClient]);
      setSelectedClient(newClient);
      setClientSearch('');
    } catch (err) {
      console.error(err);
      alert("Error al crear el cliente rápido.");
    } finally {
      setCreatingClient(false);
    }
  };

  const total = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);

  useEffect(() => {
    if (isTypingAmountPaid.current) return;
    const currentVal = Number(amountPaidStr || 0); // Not ideal because mountPaidStr is not the source of truth for the number
    // We actually need a number state or derive from total
  }, [amountPaidMode, rate]);

  // Use a derived number value
  const amountPaidInUSD = useMemo(() => {
    if (!amountPaidStr) return 0;
    const num = Number(amountPaidStr);
    return amountPaidMode === 'USD' ? num : num / rate;
  }, [amountPaidStr, amountPaidMode, rate]);

  const handleProcessSale = async () => {
    if (cart.length === 0 || processing) return;
    if (saleStatus === SaleStatus.CREDIT && !selectedClient) {
      alert('Seleccione un cliente para ventas a crédito.');
      return;
    }
    setProcessing(true);
    
    const finalAmountPaidInUSD = saleStatus === SaleStatus.COMPLETED ? total : amountPaidInUSD;

    const sale: Partial<Sale> = {
      id: crypto.randomUUID(),
      clientId: selectedClient?.id,
      items: cart,
      total,
      date: new Date().toISOString(),
      status: saleStatus,
      amountPaid: finalAmountPaidInUSD
    };
    
    const calculatedAmountBs = (paymentMethod === PaymentMethod.PAGOMOVIL || paymentMethod === PaymentMethod.PUNTO)
      ? (saleStatus === SaleStatus.COMPLETED 
          ? Number((total * rate).toFixed(2))
          : (amountPaidMode === 'BS' ? Number(amountPaidStr) : Number((finalAmountPaidInUSD * rate).toFixed(2))))
      : undefined;

    const initialPayment = {
      amount: sale.amountPaid || 0,
      method: paymentMethod,
      reference: paymentMethod === PaymentMethod.PAGOMOVIL ? paymentRef : undefined,
      exchangeRate: rate,
      amountBs: calculatedAmountBs
    };

    const clientName = selectedClient?.name || 'Venta de Contado';
    const fullSaleObj: Sale = {
      id: sale.id!,
      userId: '',
      clientId: sale.clientId,
      items: [...cart],
      total,
      date: sale.date!,
      status: saleStatus,
      amountPaid: finalAmountPaidInUSD,
      payments: [{
        id: crypto.randomUUID(),
        saleId: sale.id!,
        clientId: sale.clientId || '',
        amount: finalAmountPaidInUSD,
        method: paymentMethod,
        reference: paymentMethod === PaymentMethod.PAGOMOVIL ? paymentRef : undefined,
        date: sale.date!,
        exchangeRate: rate,
        amountBs: calculatedAmountBs
      }]
    };

    try {
      await dbService.createSale(sale, initialPayment);
      setCart([]);
      setSelectedClient(null);
      setAmountPaidStr('');
      setPaymentRef('');
      setClientSearch('');
      setIsCartVisible(false);
      const updatedProducts = await dbService.getProducts();
      setProducts(updatedProducts);
      setCompletedSale(fullSaleObj);
      setCompletedSaleClientName(clientName);
    } catch (err) {
      console.error(err);
      alert("Error al procesar venta.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-8 animate-in fade-in duration-700">
      <div className="flex-1 space-y-6 flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2">
          <div>
            <h1 className="text-2xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Terminal de Ventas</h1>
            <p className="text-xs lg:text-lg text-slate-500 dark:text-slate-400 font-medium">Realiza transacciones y créditos al instante.</p>
          </div>
          <div className="bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-end">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">
              {useParallelRate ? 'Tasa Paralelo' : 'Tasa BCV'}
            </span>
            <span className="text-sm font-black text-blue-600 dark:text-blue-400">1 USD = {rate.toLocaleString()} BS</span>
          </div>
        </div>
        {/* Buscador de Productos */}
        <div className="bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 transition-colors">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <ScanLine size={16} className="text-blue-500" /> Búsqueda de Productos
            </h3>
            <button 
              onClick={openScanner}
              className="lg:hidden p-4 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl shadow-sm flex items-center gap-3 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all border border-slate-800 dark:border-blue-500/30"
            >
              <Camera size={20} /> Escanear
            </button>
          </div>
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-blue-500 transition-colors" size={24} />
            <input 
              type="text" 
              placeholder="Escanea o escribe nombre del producto..." 
              className="w-full pl-16 pr-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl outline-none text-base font-bold dark:text-slate-100 transition-all focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-500/10 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-600"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {filteredProducts.length > 0 && searchTerm.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-2xl z-[80] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                {filteredProducts.map(p => (
                  <button key={p.id} onClick={() => { addToCart(p); setSearchTerm(''); }} className="w-full p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-left border-b border-slate-100 dark:border-slate-800 last:border-0 group">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{p.name}</span>
                      <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mt-0.5">Stock: {p.stock} uds • {p.category || 'General'}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900 dark:text-white text-lg">${p.price.toLocaleString()}</p>
                      {showTriplePrice && officialRate > 0 && parallelRate > 0 ? (
                        <div className="flex flex-col items-end">
                           <p className="text-[11px] font-black text-blue-500 uppercase tracking-tighter">Mix: ${((p.price * parallelRate) / officialRate).toFixed(2)}</p>
                           <p className="text-[11px] font-black text-emerald-500 uppercase tracking-tighter">Bs. {(p.price * rate).toLocaleString()}</p>
                        </div>
                      ) : (
                        rate > 0 && <p className="text-[10px] font-bold text-slate-400">≈ Bs. {(p.price * rate).toLocaleString()}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Buscador y Creador de Clientes */}
        <div className="bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 transition-colors">
           <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-2">Cliente / Receptor</h3>
           <div className="relative group">
             <User className={`absolute left-6 top-1/2 -translate-y-1/2 ${selectedClient ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} size={22} />
             <input 
               type="text" 
               placeholder="Venta rápida (Escribe para buscar o crear cliente)" 
               className={`w-full pl-16 pr-14 py-4 bg-slate-50 dark:bg-slate-800/50 border ${selectedClient ? 'border-emerald-200 dark:border-emerald-500/50' : 'border-slate-200 dark:border-slate-700'} rounded-2xl outline-none font-bold text-sm transition-all focus:bg-white dark:focus:bg-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600`}
               value={selectedClient ? selectedClient.name : clientSearch}
               onChange={(e) => {
                 setClientSearch(e.target.value);
                 if (selectedClient) setSelectedClient(null);
               }}
             />
             {selectedClient && (
               <button onClick={() => { setSelectedClient(null); setClientSearch(''); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"><X size={18}/></button>
             )}
             
             {/* Dropdown de Clientes */}
             {clientSearch.length > 0 && !selectedClient && (
               <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-[70] overflow-hidden animate-in slide-in-from-top-1 duration-200">
                 {/* Resultados de Búsqueda */}
                 {filteredClients.map(c => (
                   <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(''); }} className="w-full p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border-b border-slate-100 dark:border-slate-800 last:border-0 text-left">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{c.name}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mt-0.5">Cliente Frecuente</span>
                      </div>
                      <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Seleccionar</span>
                   </button>
                 ))}
                 
                 {/* Opción de Registro Rápido */}
                 <button 
                  onClick={handleQuickCreateClient}
                  disabled={creatingClient}
                  className="w-full p-6 flex items-center gap-5 bg-blue-50 dark:bg-blue-600/10 hover:bg-blue-100 dark:hover:bg-blue-600/20 transition-all text-left group"
                 >
                   <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm group-hover:scale-110 transition-transform">
                     {creatingClient ? <Loader2 className="animate-spin" size={24}/> : <UserPlus size={24} />}
                   </div>
                   <div className="flex flex-col">
                     <span className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest leading-none mb-1">Registrar como nuevo:</span>
                     <span className="font-bold text-slate-800 dark:text-slate-100 text-lg">"{clientSearch}"</span>
                   </div>
                 </button>
               </div>
             )}
           </div>
        </div>

        {cart.length > 0 && (
          <button 
            onClick={() => setIsCartVisible(true)}
            className="lg:hidden fixed bottom-24 right-6 w-16 h-16 bg-slate-900 dark:bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-[90] animate-bounce-short border-2 border-white dark:border-blue-400/30"
          >
            <div className="relative">
              <ShoppingCart size={24} />
              <span className="absolute -top-3 -right-3 bg-rose-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">{cart.length}</span>
            </div>
          </button>
        )}
      </div>

      {/* Panel de Carrito */}
      <div className={`fixed lg:static inset-0 z-[100] lg:z-0 lg:w-[380px] xl:w-[420px] transform transition-transform duration-500 flex flex-col ${isCartVisible ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}`}>
        <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 lg:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsCartVisible(false)} />
        <div className="relative bg-white dark:bg-[#0f172a] h-[95vh] lg:h-full mt-auto lg:mt-0 rounded-t-[2.5rem] lg:rounded-[2.5rem] shadow-2xl flex flex-col lg:p-6 p-5 overflow-hidden border-l border-slate-100 dark:border-slate-800 transition-colors">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/30">
                <ShoppingCart size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">Mi Carrito</h3>
                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-1">{cart.length} Items seleccionados</p>
              </div>
            </div>
            <button onClick={() => setIsCartVisible(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X size={24}/></button>
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar space-y-2 mb-6">
            {cart.map(item => (
              <div key={item.productId} className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 flex items-center justify-between group">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">{item.name}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">${item.price.toLocaleString()} c/u</p>
                  {showTriplePrice && officialRate > 0 && parallelRate > 0 && (
                    <div className="flex flex-col mt-1 bg-slate-100 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                       <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase leading-none">Mixto: ${((item.price * parallelRate) / officialRate).toFixed(2)}</span>
                       <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase leading-none mt-1.5">Bolívar: {(item.price * rate).toLocaleString()} Bs.</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <button onClick={() => updateQuantity(item.productId, -1)} className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-all shadow-sm border border-slate-100 dark:border-slate-700 active:scale-90"><Minus size={14}/></button>
                  <span className="font-black text-slate-900 dark:text-white w-5 text-center text-sm">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, 1)} className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-all shadow-sm border border-slate-100 dark:border-slate-700 active:scale-90"><Plus size={14}/></button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 py-10">
                <ShoppingCart size={48} strokeWidth={1} className="mb-2 opacity-30" />
                <p className="text-[10px] font-black uppercase tracking-widest">El carrito está vacío</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <button 
                onClick={() => setSaleStatus(SaleStatus.COMPLETED)}
                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${saleStatus === SaleStatus.COMPLETED ? 'bg-blue-600 text-white shadow-lg' : 'bg-transparent border border-slate-200 dark:border-white/10 text-slate-400'}`}
              >
                Contado
              </button>
              <button 
                onClick={() => setSaleStatus(SaleStatus.CREDIT)}
                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${saleStatus === SaleStatus.CREDIT ? 'bg-amber-500 text-white shadow-lg' : 'bg-transparent border border-slate-200 dark:border-white/10 text-slate-400'}`}
              >
                Crédito
              </button>
            </div>

            {/* Selección de Método de Pago */}
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-400 dark:text-white/40 uppercase tracking-widest ml-1">Método de Pago</label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => setPaymentMethod(PaymentMethod.EFECTIVO)}
                  className={`flex flex-col items-center justify-center py-2 rounded-xl border transition-all ${paymentMethod === PaymentMethod.EFECTIVO ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-400'}`}
                >
                  <Banknote size={16} />
                  <span className="text-[7px] font-black mt-1 uppercase">Efectivo</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod(PaymentMethod.PUNTO)}
                  className={`flex flex-col items-center justify-center py-2 rounded-xl border transition-all ${paymentMethod === PaymentMethod.PUNTO ? 'bg-blue-500 border-blue-400 text-white' : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-400'}`}
                >
                  <CreditCard size={16} />
                  <span className="text-[7px] font-black mt-1 uppercase">Punto</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod(PaymentMethod.PAGOMOVIL)}
                  className={`flex flex-col items-center justify-center py-2 rounded-xl border transition-all ${paymentMethod === PaymentMethod.PAGOMOVIL ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-400'}`}
                >
                  <Smartphone size={16} />
                  <span className="text-[7px] font-black mt-1 uppercase">Móvil</span>
                </button>
              </div>
            </div>

            {paymentMethod === PaymentMethod.PAGOMOVIL && (
               <div className="animate-in slide-in-from-top-2">
                 <input 
                  type="text" 
                  placeholder="Referencia PagoMóvil (Opcional)" 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none font-black text-xs text-slate-800 dark:text-white" 
                  value={paymentRef} 
                  onChange={(e) => setPaymentRef(e.target.value)} 
                />
               </div>
            )}

            {saleStatus === SaleStatus.CREDIT && (
              <div className="animate-in slide-in-from-top-2">
                <div className="flex justify-between items-center px-1 mb-1">
                  <label className="text-[8px] font-black text-slate-400 dark:text-white/40 uppercase tracking-widest">Abono Inicial</label>
                  {rate > 0 && (
                    <button 
                      type="button"
                      onClick={() => {
                         const currentUSD = amountPaidInUSD;
                         const newMode = amountPaidMode === 'USD' ? 'VES' : 'USD';
                         setAmountPaidMode(newMode);
                         if (newMode === 'VES') {
                           setAmountPaidStr(currentUSD === 0 ? '' : (currentUSD * rate).toFixed(2));
                         } else {
                           setAmountPaidStr(currentUSD === 0 ? '' : currentUSD.toFixed(2));
                         }
                      }}
                      className={`text-[8px] font-black uppercase flex items-center gap-1 transition-all ${amountPaidMode === 'USD' ? 'text-blue-400' : 'text-emerald-400'}`}
                    >
                       Modo: {amountPaidMode === 'USD' ? '$' : 'Bs.'}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none font-black text-sm transition-all ${amountPaidMode === 'USD' ? 'text-slate-800 dark:text-white' : 'text-emerald-400'}`} 
                    value={amountPaidStr} 
                    onFocus={() => isTypingAmountPaid.current = true}
                    onBlur={() => isTypingAmountPaid.current = false}
                    onChange={(e) => setAmountPaidStr(e.target.value)} 
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                     <p className={`text-[9px] font-black uppercase opacity-20 ${amountPaidMode === 'USD' ? 'text-blue-500' : 'text-emerald-500'}`}>
                       {amountPaidMode === 'USD' ? 'USD' : 'Bs.'}
                     </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-800 dark:text-white px-1">
              <span className="text-[9px] font-black uppercase tracking-widest opacity-50">Total</span>
              <div className="flex flex-col items-end">
                <span className="text-2xl font-black tracking-tighter">${total.toLocaleString()}</span>
                
                {showTriplePrice && officialRate > 0 && parallelRate > 0 && (
                  <div className="flex flex-col items-end mt-2 space-y-1 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 w-full mb-2">
                    <div className="flex justify-between w-full items-baseline">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mixto</span>
                      <p className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight">${((total * parallelRate) / officialRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="flex justify-between w-full items-baseline">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En Bolívares</span>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">Bs. {(total * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                )}

                {rate > 0 && !showTriplePrice && (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setShowBs(!showBs)}
                        className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1 hover:text-emerald-300 transition-colors"
                      >
                        <Landmark size={10} /> {showBs ? 'Cerrar Bs' : 'Ver Bs'}
                      </button>
                      <button 
                        onClick={async () => {
                          const r = await fetchExchangeRate();
                          setRate(r);
                        }}
                        className="text-[7px] font-black text-slate-500 uppercase tracking-tighter hover:text-slate-300"
                      >
                        Actualizar
                      </button>
                    </div>
                    {showBs && (
                      <span className="text-base font-black text-emerald-400 animate-in slide-in-from-right-2 mt-0.5">
                        Bs. {(total * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <button 
              onClick={handleProcessSale}
              disabled={cart.length === 0 || processing}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/80 disabled:text-slate-400 dark:disabled:text-slate-600 text-white py-4 rounded-2xl font-black text-base shadow-xl hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] uppercase tracking-widest transition-all duration-300 active:scale-95 hover:scale-[1.01] disabled:scale-100 disabled:shadow-none"
            >
              {processing ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Finalizar Venta'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Éxito y de Impresión de ticket térmico */}
      {completedSale && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setCompletedSale(null)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <button 
              onClick={() => setCompletedSale(null)}
              className="absolute right-6 top-6 text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 transition-colors"
            >
              <X size={24} />
            </button>
            
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-emerald-50/50 dark:ring-emerald-900/10">
              <CheckCircle2 size={40} />
            </div>
            
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">¡Venta Registrada!</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium">La operación se ha completado correctamente.</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 space-y-3 border border-slate-100 dark:border-slate-800 mb-8 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Factura ID:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">#{completedSale.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Cliente:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{completedSaleClientName}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-700/50 pt-2.5">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Monto USD:</span>
                <span className="font-black text-slate-900 dark:text-white">${completedSale.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Monto VES (Bs.):</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">Bs. {(completedSale.total * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* Desktop printer action */}
              <button 
                onClick={() => {
                  const storedProfile = localStorage.getItem('cajapro_profile');
                  const profileParsed = storedProfile ? JSON.parse(storedProfile) : null;
                  printThermalReceipt(completedSale, completedSaleClientName, profileParsed, {
                    rate,
                    useParallelRate,
                    showTriplePrice,
                    officialRate,
                    parallelRate
                  });
                }}
                className="hidden md:flex w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/10 items-center justify-center gap-2.5 transition-all active:scale-95"
              >
                <Printer size={18} /> Imprimir Factura (80mm / 58mm)
              </button>

              {/* Mobile notification */}
              <div className="md:hidden p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">⚠️ Impresión Habilitada Solo en PC</p>
                <p className="text-[9px] text-slate-500 mt-0.5">El formato miniatura de impresora fiscal/térmica requiere acceso de escritorio.</p>
              </div>

              <button 
                type="button"
                onClick={() => setCompletedSale(null)}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Nueva Venta / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Escáner */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-slate-900/95 animate-in fade-in duration-300">
           <div className="flex items-center justify-between p-8 text-white">
              <h4 className="font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3">Escáner Óptico</h4>
              <button onClick={closeScanner} className="p-4 bg-white/10 rounded-[2rem]"><X size={24}/></button>
           </div>
           <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="relative w-full max-w-sm aspect-[4/3] bg-black rounded-[3rem] border-4 border-white/10 overflow-hidden">
                 {scannerLoading && <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60"><Loader2 className="text-blue-500 animate-spin" size={48} /></div>}
                 <div id="scanner-region" className="w-full h-full"></div>
                 <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-32 border-2 border-blue-500/60 rounded-2xl relative">
                       <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1 rounded-tl-lg"></div>
                       <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1 rounded-br-lg"></div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SalesView;
