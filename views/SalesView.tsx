
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { dbService } from '../services/dbService';
import { Product, Client, SaleItem, SaleStatus, Sale } from '../types';
import { ShoppingCart, Search, User, Trash2, Plus, Minus, CreditCard, Wallet, AlertTriangle, ScanLine, UserPlus, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';

const SalesView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [saleStatus, setSaleStatus] = useState<SaleStatus>(SaleStatus.COMPLETED);
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isCartVisible, setIsCartVisible] = useState(false); // Para mobile drawer
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastProcessedRef = useRef<number>(0);

  useEffect(() => {
    dbService.getProducts().then(setProducts).catch(console.error);
    dbService.getClients().then(setClients).catch(console.error);
  }, []);

  const addToCart = (product: Product) => {
    const now = Date.now();
    if (now - lastProcessedRef.current < 200) return;
    lastProcessedRef.current = now;
    if (product.stock <= 0) {
      alert("¡Sin Stock disponible!");
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
    setSearchTerm('');
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.barcode && p.barcode.includes(searchTerm)));
  }, [products, searchTerm]);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return [];
    return clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clients, clientSearch]);

  const total = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleQuickCreateClient = async () => {
    if (!clientSearch.trim()) return;
    setIsCreatingClient(true);
    try {
      const newClient = await dbService.saveClient({ name: clientSearch.trim(), phone: '', email: '', currentDebt: 0 });
      const updatedClients = await dbService.getClients();
      setClients(updatedClients);
      setSelectedClient(newClient);
      setClientSearch('');
    } catch (err) {
      alert("Error al crear cliente");
    } finally { setIsCreatingClient(false); }
  };

  const handleProcessSale = async () => {
    if (cart.length === 0) return;
    if (saleStatus === SaleStatus.CREDIT && !selectedClient) {
      alert('Debes seleccionar un cliente para ventas a crédito');
      return;
    }
    const sale: Partial<Sale> = {
      id: crypto.randomUUID(),
      clientId: selectedClient?.id,
      items: cart,
      total,
      date: new Date().toISOString(),
      status: saleStatus,
      amountPaid: saleStatus === SaleStatus.CREDIT ? Number(amountPaid) : total
    };
    try {
      await dbService.createSale(sale);
      alert('¡Venta Exitosa!');
      setCart([]);
      setSelectedClient(null);
      setAmountPaid('');
      setSaleStatus(SaleStatus.COMPLETED);
      setIsCartVisible(false);
      dbService.getProducts().then(setProducts);
    } catch (err) { alert("Error procesando venta"); }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* Terminal Area */}
      <div className="flex-1 flex flex-col space-y-4 lg:space-y-6">
        <div className="bg-white p-5 lg:p-7 rounded-[2rem] border border-slate-200 shadow-sm space-y-4 lg:space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs lg:text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-[0.2em]">
              <ScanLine size={20} className="text-blue-500" /> Terminal Táctil
            </h3>
            <span className="text-[9px] lg:text-[10px] font-black uppercase bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg border border-emerald-100">Activo</span>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Producto o EAN..." 
              className="w-full pl-14 pr-4 py-4 lg:py-6 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-blue-100 outline-none text-base lg:text-xl font-black transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            
            {filteredProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl z-[80] max-h-[60vh] overflow-y-auto divide-y divide-slate-50 overflow-hidden animate-in fade-in slide-in-from-top-4">
                {filteredProducts.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)} className="w-full p-5 lg:p-7 flex items-center justify-between hover:bg-blue-50 active:bg-blue-100 transition-all text-left">
                    <div>
                      <p className="font-black text-slate-800 text-base lg:text-xl">{p.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black uppercase text-blue-500 bg-blue-50 px-2 py-0.5 rounded">{p.category}</span>
                        <span className={`text-[10px] font-black uppercase ${p.stock <= 5 ? 'text-rose-500' : 'text-slate-400'}`}>Stock: {p.stock} uds</span>
                      </div>
                    </div>
                    <span className="font-black text-blue-600 text-xl lg:text-2xl">${p.price.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-5 lg:p-7 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-[10px] lg:text-xs font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
            <User size={18} className="text-blue-500" /> Vínculo de Cliente
          </h3>
          {!selectedClient ? (
            <div className="relative">
              <input 
                type="text" 
                placeholder="Nombre del cliente..." 
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm lg:text-base"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              {(filteredClients.length > 0 || clientSearch.length > 1) && (
                <div className="absolute bottom-full lg:top-full left-0 right-0 mb-2 lg:mt-2 bg-white border border-slate-200 rounded-3xl shadow-2xl z-[75] overflow-hidden">
                  {filteredClients.map(c => (
                    <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(''); }} className="w-full p-4 text-left hover:bg-blue-50 flex items-center justify-between border-b border-slate-50 last:border-0">
                      <div>
                        <p className="font-bold text-slate-800">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">${c.currentDebt.toLocaleString()} Deuda</p>
                      </div>
                      <Plus size={18} className="text-blue-400" />
                    </button>
                  ))}
                  {clientSearch.length > 1 && (
                    <button onClick={handleQuickCreateClient} disabled={isCreatingClient} className="w-full p-5 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                      {isCreatingClient ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                      Registrar "{clientSearch}"
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-3xl border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-200">{selectedClient.name.charAt(0)}</div>
                <div>
                  <p className="font-black text-blue-900 leading-none">{selectedClient.name}</p>
                  <p className="text-[10px] text-blue-500 font-black uppercase mt-1 tracking-widest">Deuda: ${selectedClient.currentDebt.toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => setSelectedClient(null)} className="p-2 bg-white text-rose-500 rounded-xl border border-rose-100 hover:bg-rose-50"><X size={18}/></button>
            </div>
          )}
        </div>
      </div>

      {/* Cart Summary (Mobile Floating Button) */}
      <div className="lg:hidden fixed bottom-20 left-4 right-4 z-[90]">
        <button 
          onClick={() => setIsCartVisible(true)}
          disabled={cart.length === 0}
          className={`w-full py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-between px-8 shadow-2xl transition-all ${cart.length > 0 ? 'bg-blue-600 text-white animate-bounce-short' : 'bg-slate-200 text-slate-400 opacity-50'}`}
        >
          <div className="flex items-center gap-3">
             <ShoppingCart size={20} />
             <span>Ver Carrito ({cart.length})</span>
          </div>
          <span className="text-lg">${total.toLocaleString()}</span>
        </button>
      </div>

      {/* Checkout Area (Desktop static, Mobile Drawer) */}
      <div className={`fixed lg:static inset-0 z-[100] lg:z-auto bg-slate-900/60 lg:bg-transparent backdrop-blur-sm lg:backdrop-blur-none transition-all duration-300 ${isCartVisible ? 'opacity-100 visible' : 'opacity-0 invisible lg:visible lg:opacity-100'}`}>
        <div className={`absolute lg:static bottom-0 left-0 right-0 w-full lg:w-[460px] max-h-[90vh] lg:max-h-none bg-white lg:bg-white rounded-t-[3rem] lg:rounded-[3rem] border-t lg:border border-slate-200 shadow-2xl flex flex-col transform transition-transform duration-300 ${isCartVisible ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}`}>
          <div className="p-6 lg:p-8 bg-slate-50 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <ShoppingCart size={22} className="text-blue-600" />
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs lg:text-sm">Resumen de Venta</h3>
            </div>
            <button onClick={() => setIsCartVisible(false)} className="lg:hidden p-2 text-slate-400"><ChevronDown size={28}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 lg:space-y-8 hide-scrollbar">
            {cart.map(item => (
              <div key={item.productId} className="flex items-start justify-between animate-in slide-in-from-right-4 duration-300">
                <div className="flex-1 pr-4">
                  <p className="text-sm lg:text-base font-black text-slate-800 leading-tight mb-0.5">{item.name}</p>
                  <p className="text-xs text-slate-400 font-black">${item.price.toLocaleString()} c/u</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-1.5 border border-slate-200/50">
                  <button onClick={() => updateQuantity(item.productId, -1)} className="p-1.5 bg-white text-slate-400 rounded-xl shadow-sm"><Minus size={14}/></button>
                  <span className="text-sm font-black w-8 text-center text-slate-800">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, 1)} className="p-1.5 bg-white text-slate-400 rounded-xl shadow-sm"><Plus size={14}/></button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center text-slate-300">
                <ShoppingCart size={48} className="opacity-20 mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest">Carrito Vacío</p>
              </div>
            )}
          </div>

          <div className="p-8 lg:p-10 border-t border-slate-100 bg-white space-y-8">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-400 uppercase tracking-widest text-[10px] lg:text-xs">Subtotal Neto</span>
              <span className="font-black text-3xl lg:text-5xl text-blue-600 tracking-tighter">${total.toLocaleString()}</span>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 leading-none">Tipo de Operación</p>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setSaleStatus(SaleStatus.COMPLETED)} className={`flex flex-col items-center justify-center py-5 rounded-3xl border-2 transition-all ${saleStatus === SaleStatus.COMPLETED ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-400 opacity-60'}`}>
                  <Wallet size={24} className="mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Efectivo</span>
                </button>
                <button onClick={() => setSaleStatus(SaleStatus.CREDIT)} className={`flex flex-col items-center justify-center py-5 rounded-3xl border-2 transition-all ${saleStatus === SaleStatus.CREDIT ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-100 bg-white text-slate-400 opacity-60'}`}>
                  <CreditCard size={24} className="mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Crédito</span>
                </button>
              </div>
            </div>

            {saleStatus === SaleStatus.CREDIT && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Monto de Abono</label>
                <input type="number" className="w-full px-6 py-5 bg-amber-50 border border-amber-100 rounded-3xl text-2xl font-black text-amber-700 outline-none" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00" />
              </div>
            )}

            <button onClick={handleProcessSale} disabled={cart.length === 0} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xl lg:text-2xl transition-all shadow-2xl active:scale-95 uppercase tracking-[0.2em] shadow-slate-300">
              Cerrar Venta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesView;
