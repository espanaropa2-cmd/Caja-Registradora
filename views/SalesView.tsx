
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { dbService } from '../services/dbService';
import { Product, Client, SaleItem, SaleStatus, Sale } from '../types';
import { ShoppingCart, Search, User, Trash2, Plus, Minus, CreditCard, Wallet, ScanLine, UserPlus, Loader2, X, ChevronDown, Camera, Check } from 'lucide-react';
import { Html5Qrcode } from "html5-qrcode";

const SalesView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [saleStatus, setSaleStatus] = useState<SaleStatus>(SaleStatus.COMPLETED);
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastProcessedRef = useRef<number>(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [p, c] = await Promise.all([dbService.getProducts(), dbService.getClients()]);
        setProducts(p);
        setClients(c);
      } catch (err) {
        console.error("Error loading sales data:", err);
      }
    };
    loadData();
  }, []);

  // Effect to handle scanner initialization once the DOM element is available
  useEffect(() => {
    let isMounted = true;

    const initScanner = async () => {
      if (!isScannerOpen) return;
      
      // Give React a moment to render the scanner-region div
      setScannerLoading(true);
      await new Promise(resolve => setTimeout(resolve, 100));

      const element = document.getElementById("scanner-region");
      if (!element) {
        console.error("Scanner region not found in DOM");
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
        console.error("Scanner start error:", err);
        if (isMounted) {
          alert("No se pudo iniciar la cámara. Verifique los permisos.");
          setIsScannerOpen(false);
        }
      }
    };

    if (isScannerOpen) {
      initScanner();
    }

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

  const total = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);

  const handleProcessSale = async () => {
    if (cart.length === 0 || processing) return;
    if (saleStatus === SaleStatus.CREDIT && !selectedClient) {
      alert('Por favor, seleccione un cliente para ventas a crédito.');
      return;
    }

    setProcessing(true);
    const sale: Partial<Sale> = {
      id: crypto.randomUUID(),
      clientId: selectedClient?.id,
      items: cart,
      total,
      date: new Date().toISOString(),
      status: saleStatus,
      amountPaid: saleStatus === SaleStatus.CREDIT ? Number(amountPaid || 0) : total
    };

    try {
      await dbService.createSale(sale);
      setCart([]);
      setSelectedClient(null);
      setAmountPaid('');
      setClientSearch('');
      setIsCartVisible(false);
      const updatedProducts = await dbService.getProducts();
      setProducts(updatedProducts);
      alert('¡Venta realizada con éxito!');
    } catch (err) {
      console.error(err);
      alert("Error al procesar la venta.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 animate-in fade-in pb-20 lg:pb-0">
      <div className="flex-1 flex flex-col space-y-4 lg:space-y-6">
        
        {/* Terminal de Búsqueda */}
        <div className="bg-white p-5 lg:p-7 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <ScanLine size={16} className="text-blue-500" /> Terminal de Ventas
            </h3>
            <button 
              onClick={openScanner}
              className="lg:hidden p-3 bg-blue-600 text-white rounded-2xl shadow-lg flex items-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
            >
              <Camera size={18} /> Escanear
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
            <input 
              type="text" 
              placeholder="Escribe nombre o código del producto..." 
              className="w-full pl-16 pr-4 py-5 lg:py-6 bg-slate-50 border border-slate-200 rounded-3xl outline-none text-base lg:text-xl font-black transition-all focus:bg-white focus:ring-4 focus:ring-blue-50 shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {filteredProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-[80] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                {filteredProducts.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)} className="w-full p-5 flex items-center justify-between hover:bg-blue-50 transition-all text-left border-b border-slate-50 last:border-0 group">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 group-hover:text-blue-600">{p.name}</span>
                      <span className="text-[10px] font-black uppercase text-slate-400">Existencia: {p.stock} uds</span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-blue-600 text-lg">${p.price.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-emerald-500 uppercase">Añadir +</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selector de Cliente */}
        <div className="bg-white p-5 lg:p-7 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Cliente / Receptor</h3>
           <div className="relative">
             <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
             <input 
               type="text" 
               placeholder="Venta de contado (Escriba para buscar cliente)" 
               className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700"
               value={selectedClient ? selectedClient.name : clientSearch}
               onChange={(e) => {
                 setClientSearch(e.target.value);
                 if (selectedClient) setSelectedClient(null);
               }}
             />
             {selectedClient && (
               <button onClick={() => { setSelectedClient(null); setClientSearch(''); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-rose-500"><X size={18}/></button>
             )}
             {filteredClients.length > 0 && !selectedClient && (
               <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-[70] overflow-hidden">
                 {filteredClients.map(c => (
                   <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(''); }} className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-all border-b last:border-0">
                      <span className="font-bold text-slate-800">{c.name}</span>
                      <span className="text-[10px] font-black text-blue-600 uppercase">Seleccionar</span>
                   </button>
                 ))}
               </div>
             )}
           </div>
        </div>

        {/* Carrito en Móvil (Visible solo si hay items) */}
        {cart.length > 0 && (
          <button 
            onClick={() => setIsCartVisible(true)}
            className="lg:hidden fixed bottom-20 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-[90] animate-bounce-short"
          >
            <div className="relative">
              <ShoppingCart size={24} />
              <span className="absolute -top-3 -right-3 bg-rose-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">{cart.length}</span>
            </div>
          </button>
        )}
      </div>

      {/* Panel de Resumen (Derecha / Modal en móvil) */}
      <div className={`fixed lg:static inset-0 z-[100] lg:z-0 lg:w-96 transform transition-transform duration-300 flex flex-col ${isCartVisible ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}`}>
        <div className="absolute inset-0 bg-slate-900/40 lg:hidden" onClick={() => setIsCartVisible(false)} />
        <div className="relative bg-white lg:bg-slate-900 h-[90vh] lg:h-full mt-auto lg:mt-0 rounded-t-[3rem] lg:rounded-[3rem] shadow-2xl flex flex-col lg:p-8 p-6 overflow-hidden">
          
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-800 lg:text-white uppercase tracking-tighter flex items-center gap-2">
               <ShoppingCart size={24} className="text-blue-500" /> Tu Carrito
            </h3>
            <button onClick={() => setIsCartVisible(false)} className="lg:hidden p-2 text-slate-400"><X size={28}/></button>
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar space-y-4 mb-6">
            {cart.map(item => (
              <div key={item.productId} className="bg-slate-50 lg:bg-white/5 p-4 rounded-3xl border border-slate-100 lg:border-white/10 flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="font-black text-slate-800 lg:text-white truncate text-sm">{item.name}</p>
                  <p className="text-xs font-bold text-slate-400">${item.price.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateQuantity(item.productId, -1)} className="w-8 h-8 rounded-xl bg-white lg:bg-white/10 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors shadow-sm"><Minus size={14}/></button>
                  <span className="font-black text-slate-800 lg:text-white w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, 1)} className="w-8 h-8 rounded-xl bg-white lg:bg-white/10 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors shadow-sm"><Plus size={14}/></button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 space-y-4 py-20">
                <ShoppingCart size={64} strokeWidth={1} />
                <p className="text-[10px] font-black uppercase tracking-widest text-center">El carrito está vacío</p>
              </div>
            )}
          </div>

          <div className="space-y-4 pt-6 border-t border-slate-100 lg:border-white/10">
            {/* Método de Pago */}
            <div className="flex gap-2">
              <button 
                onClick={() => setSaleStatus(SaleStatus.COMPLETED)}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 ${saleStatus === SaleStatus.COMPLETED ? 'bg-blue-600 border-blue-600 text-white' : 'bg-transparent border-slate-200 lg:border-white/10 text-slate-400'}`}
              >
                <Wallet size={16}/> Contado
              </button>
              <button 
                onClick={() => setSaleStatus(SaleStatus.CREDIT)}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 ${saleStatus === SaleStatus.CREDIT ? 'bg-amber-500 border-amber-500 text-white' : 'bg-transparent border-slate-200 lg:border-white/10 text-slate-400'}`}
              >
                <CreditCard size={16}/> Crédito
              </button>
            </div>

            {saleStatus === SaleStatus.CREDIT && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <input 
                  type="number" 
                  placeholder="Monto abonado hoy..." 
                  className="w-full px-5 py-4 bg-slate-50 lg:bg-white/5 border border-slate-200 lg:border-white/10 rounded-2xl outline-none font-black text-slate-800 lg:text-white"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>
            )}

            <div className="flex items-center justify-between text-slate-800 lg:text-white px-2">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Total a Pagar</span>
              <span className="text-3xl font-black tracking-tighter">${total.toLocaleString()}</span>
            </div>

            <button 
              onClick={handleProcessSale}
              disabled={cart.length === 0 || processing}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 lg:disabled:bg-white/10 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-blue-100 lg:shadow-none flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-widest"
            >
              {processing ? <Loader2 className="animate-spin" size={24} /> : (
                <><Check size={24} /> Finalizar Venta</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Escáner */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-slate-900/95 animate-in fade-in duration-300">
           <div className="flex items-center justify-between p-8 text-white">
              <h4 className="font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3">
                <Camera className="text-blue-500" /> Escáner Óptico
              </h4>
              <button onClick={closeScanner} className="p-4 bg-white/10 rounded-[2rem] hover:bg-white/20 transition-all"><X size={24}/></button>
           </div>
           <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="relative w-full max-w-sm aspect-[4/3] bg-black rounded-[3rem] border-4 border-white/10 overflow-hidden shadow-2xl">
                 {scannerLoading && (
                   <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60 backdrop-blur-sm">
                     <Loader2 className="text-blue-500 animate-spin" size={48} />
                   </div>
                 )}
                 {/* The scanner library expects this ID in the DOM */}
                 <div id="scanner-region" className="w-full h-full"></div>
                 {/* Guía Visual */}
                 <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-32 border-2 border-blue-500/60 rounded-2xl relative">
                       <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1 rounded-tl-lg"></div>
                       <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1 rounded-tr-lg"></div>
                       <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1 rounded-bl-lg"></div>
                       <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1 rounded-br-lg"></div>
                    </div>
                 </div>
              </div>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mt-12 text-center px-12 leading-relaxed">
                Alinee el código de barras dentro del marco para detección instantánea.
              </p>
           </div>
        </div>
      )}
    </div>
  );
};

export default SalesView;
