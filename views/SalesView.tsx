
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { dbService } from '../services/dbService';
import { Product, Client, SaleItem, SaleStatus, Sale } from '../types';
import { ShoppingCart, Search, User, Trash2, Plus, Minus, CreditCard, Wallet, AlertTriangle, ScanLine, UserPlus, Loader2 } from 'lucide-react';

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
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const lastProcessedRef = useRef<number>(0);

  useEffect(() => {
    dbService.getProducts().then(setProducts).catch(console.error);
    dbService.getClients().then(setClients).catch(console.error);
  }, []);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const addToCart = (product: Product) => {
    const now = Date.now();
    if (now - lastProcessedRef.current < 200) return;
    lastProcessedRef.current = now;

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
    });

    setSearchTerm('');
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.barcode && p.barcode.includes(searchTerm))
    );
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
      const newClient = await dbService.saveClient({
        name: clientSearch.trim(),
        phone: '',
        email: '',
        currentDebt: 0
      });
      // Recargar la lista de clientes completa
      const updatedClients = await dbService.getClients();
      setClients(updatedClients);
      // Seleccionar el nuevo cliente (saveClient ya devuelve el formato correcto ahora)
      setSelectedClient(newClient);
      setClientSearch('');
    } catch (err) {
      console.error(err);
      alert("Error al crear cliente rápido");
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = searchTerm.trim();
      if (!val) return;

      const exactMatch = products.find(p => p.barcode === val);
      if (exactMatch) {
        addToCart(exactMatch);
        return;
      }

      if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
      }
    }
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
      alert('¡Venta registrada con éxito!');
      setCart([]);
      setSelectedClient(null);
      setAmountPaid('');
      setSaleStatus(SaleStatus.COMPLETED);
      const updatedProds = await dbService.getProducts();
      setProducts(updatedProds);
      searchInputRef.current?.focus();
    } catch (err) {
      alert("Error al procesar la venta");
      console.error(err);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
      <div className="flex-1 flex flex-col space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest text-sm">
              <ScanLine size={20} className="text-blue-500" />
              Terminal de Ventas
            </h3>
            <span className="text-[10px] font-black uppercase bg-slate-900 text-white px-3 py-1 rounded-lg tracking-wider">Listo para Escanear</span>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Escribe o escanea producto..." 
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-medium transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            
            {filteredProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-20 max-h-80 overflow-y-auto divide-y divide-slate-100 overflow-hidden">
                {filteredProducts.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="w-full px-4 py-4 flex items-center justify-between hover:bg-blue-50 transition-colors"
                  >
                    <div className="text-left">
                      <p className="font-black text-slate-800">{p.name}</p>
                      <p className={`text-xs font-bold ${p.stock <= 5 ? 'text-rose-500' : 'text-slate-400'}`}>
                        Stock: {p.stock} unidades {p.stock <= 0 && '(AGOTADO)'}
                      </p>
                    </div>
                    <span className="font-black text-blue-600 text-lg">${p.price.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
            <User size={20} className="text-blue-500" />
            Cliente Asociado
          </h3>
          {!selectedClient ? (
            <div className="relative">
              <input 
                type="text" 
                placeholder="Buscar cliente por nombre..." 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              {(filteredClients.length > 0 || clientSearch.length > 1) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-slate-50">
                  {filteredClients.map(c => (
                    <button 
                      key={c.id}
                      onClick={() => { setSelectedClient(c); setClientSearch(''); }}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase">{c.phone || 'Sin teléfono'}</p>
                      </div>
                      <Plus size={16} className="text-blue-400" />
                    </button>
                  ))}
                  {clientSearch.length > 1 && (
                    <button 
                      onClick={handleQuickCreateClient}
                      disabled={isCreatingClient}
                      className="w-full px-4 py-4 text-left hover:bg-blue-600 hover:text-white bg-blue-50 transition-all flex items-center gap-3 text-blue-700"
                    >
                      {isCreatingClient ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                      <span className="font-black text-sm uppercase tracking-widest">Registrar "{clientSearch}" como nuevo</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-100/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-200 flex items-center justify-center text-emerald-700 font-black">
                  {selectedClient.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="font-black text-emerald-900 leading-tight">{selectedClient.name}</p>
                  <p className="text-[10px] text-emerald-600 font-black uppercase tracking-wider">
                    Deuda: ${(selectedClient.currentDebt || 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedClient(null)} className="text-[10px] font-black text-rose-600 bg-white px-3 py-1.5 rounded-lg border border-rose-100 shadow-sm hover:bg-rose-50 transition-colors uppercase tracking-widest">Cambiar</button>
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-[420px] flex flex-col h-full gap-6">
        <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 flex flex-col overflow-hidden shadow-2xl">
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest text-xs">
              <ShoppingCart size={18} className="text-blue-600" /> Detalle de Compra
            </h3>
            <span className="text-xs font-black bg-blue-600 text-white px-3 py-1 rounded-full">{cart.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {cart.map(item => {
              const productInfo = products.find(p => p.id === item.productId);
              const isOverstock = productInfo && item.quantity > productInfo.stock;
              
              return (
                <div key={item.productId} className="flex items-start justify-between group animate-in slide-in-from-right-4 duration-300">
                  <div className="flex-1 pr-2">
                    <p className="text-sm font-black text-slate-800 leading-tight mb-0.5">{item.name}</p>
                    <p className="text-xs text-slate-500 font-bold">${item.price.toLocaleString()} c/u</p>
                    {isOverstock && (
                      <p className="text-[10px] font-black text-amber-500 flex items-center gap-1 mt-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 animate-pulse">
                        <AlertTriangle size={10} /> ¡Cantidad excede el stock disponible!
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-1.5 border border-slate-200/50">
                    <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 hover:bg-white hover:text-rose-600 rounded-xl transition-all text-slate-500 shadow-sm"><Minus size={14}/></button>
                    <span className="text-sm font-black w-8 text-center text-slate-800">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 hover:bg-white hover:text-emerald-600 rounded-xl transition-all text-slate-500 shadow-sm"><Plus size={14}/></button>
                  </div>
                </div>
              );
            })}
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12">
                <ShoppingCart size={64} className="opacity-10 mb-4" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Esperando Productos...</p>
              </div>
            )}
          </div>

          <div className="p-8 border-t border-slate-100 bg-slate-50/50 space-y-6">
            <div className="flex items-center justify-between border-t border-slate-200 pt-6">
              <span className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Importe Total</span>
              <span className="font-black text-4xl text-blue-600 tracking-tighter">${total.toLocaleString()}</span>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Modalidad de Cobro</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setSaleStatus(SaleStatus.COMPLETED)}
                  className={`flex flex-col items-center justify-center py-5 rounded-[1.5rem] border-2 transition-all shadow-sm ${saleStatus === SaleStatus.COMPLETED ? 'border-blue-600 bg-blue-50 text-blue-700 ring-4 ring-blue-50' : 'border-slate-100 bg-white text-slate-400'}`}
                >
                  <Wallet size={24} className="mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-wider">De Contado</span>
                </button>
                <button 
                  onClick={() => setSaleStatus(SaleStatus.CREDIT)}
                  className={`flex flex-col items-center justify-center py-5 rounded-[1.5rem] border-2 transition-all shadow-sm ${saleStatus === SaleStatus.CREDIT ? 'border-amber-500 bg-amber-50 text-amber-700 ring-4 ring-amber-50' : 'border-slate-100 bg-white text-slate-400'}`}
                >
                  <CreditCard size={24} className="mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-wider">A Crédito</span>
                </button>
              </div>
            </div>

            {saleStatus === SaleStatus.CREDIT && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Abono Inicial</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    className="w-full pl-8 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-lg font-black shadow-inner focus:ring-2 focus:ring-amber-500 outline-none"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                  />
                </div>
              </div>
            )}

            <button 
              onClick={handleProcessSale}
              disabled={cart.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-6 rounded-2xl font-black text-xl transition-all shadow-2xl shadow-blue-200 active:scale-95 uppercase tracking-widest"
            >
              Registrar Transacción
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesView;
