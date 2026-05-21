
import { supabase } from '../supabaseClient';
import { Product, Client, Sale, SalePayment, Expense, SaleStatus, ExpenseCategory, CreditPayment, AppConfig, UserProfile, SubscriptionRequest, SubscriptionStatus } from '../types';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Prefijos para emular categorías si la columna no existe en la DB
const REAB_PREFIX = "📦 [REAB] ";
const OTRO_PREFIX = "💸 [OTRO] ";
const ABONO_PREFIX = "💰 [ABONO] ";

export const dbService = {
  // Productos
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      userId: p.user_id,
      name: p.name,
      price: p.price,
      cost: p.cost,
      stock: p.stock,
      barcode: p.barcode,
      category: p.category
    }));
  },

  async saveProduct(product: Partial<Product>, isNew: boolean = false) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión expirada");

    const productId = product.id || generateUUID();
    const currentStock = Number(product.stock) || 0;
    const currentCost = Number(product.cost) || 0;

    // 1. Detección de reabastecimiento en edición
    if (!isNew && product.id) {
      const { data: existing } = await supabase
        .from('products')
        .select('stock')
        .eq('id', product.id)
        .single();
      
      if (existing && currentStock > existing.stock && currentCost > 0) {
        const diff = currentStock - existing.stock;
        await this.saveExpense({
          description: `Ajuste Inventario: ${product.name} (+${diff} uds)`,
          amount: diff * currentCost,
          category: 'Reabastecimiento',
          date: new Date().toISOString()
        });
      }
    }

    const productData = { 
      id: productId,
      name: product.name,
      price: Number(product.price),
      cost: currentCost,
      stock: currentStock,
      barcode: product.barcode || '',
      category: product.category || 'General',
      user_id: user.id 
    };

    const { error: productError } = await supabase.from('products').upsert(productData);
    if (productError) throw productError;

    // 2. Inversión inicial si es nuevo
    if (isNew && currentStock > 0 && currentCost > 0) {
      await this.saveExpense({
        description: `Inversión Inicial: ${product.name} (${currentStock} uds)`,
        amount: currentStock * currentCost,
        category: 'Reabastecimiento',
        date: new Date().toISOString()
      });
    }
  },

  async updateStockAndRecordExpense(productId: string, quantityToAdd: number, cost: number, productName: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    
    const { data: prod } = await supabase.from('products').select('stock').eq('id', productId).single();
    if (!prod) throw new Error("Producto no encontrado");

    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: prod.stock + quantityToAdd, cost: cost })
      .eq('id', productId);

    if (updateError) throw updateError;

    await this.saveExpense({
      description: `Reposición Stock: ${productName} (+${quantityToAdd} uds)`,
      amount: quantityToAdd * cost,
      category: 'Reabastecimiento',
      date: new Date().toISOString()
    });
  },

  async deleteProduct(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  },

  async saveProductsBatch(products: Partial<Product>[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión expirada");

    const productsData = products.map(p => ({
      id: p.id || generateUUID(),
      name: p.name,
      price: Number(p.price) || 0,
      cost: Number(p.cost) || 0,
      stock: Number(p.stock) || 0,
      barcode: p.barcode || '',
      category: p.category || 'General',
      user_id: user.id
    }));

    const { error } = await supabase.from('products').upsert(productsData);
    if (error) throw error;
  },

  // Egresos (Refactorizado para evitar error de columna 'category')
  async getExpenses(): Promise<Expense[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    return (data || [])
      .filter(e => {
        const desc = e.description || '';
        return !desc.startsWith(ABONO_PREFIX) && !desc.startsWith('⚙️ [CONFIG]') && !desc.startsWith('⚙️ [CORTE_ENVIADO]');
      })
      .map(e => {
        let category: ExpenseCategory = 'Otros';
        let cleanDescription = e.description || '';

        if (cleanDescription.startsWith(REAB_PREFIX)) {
          category = 'Reabastecimiento';
          cleanDescription = cleanDescription.replace(REAB_PREFIX, '');
        } else if (cleanDescription.startsWith(OTRO_PREFIX)) {
          category = 'Otros';
          cleanDescription = cleanDescription.replace(OTRO_PREFIX, '');
        }

        return {
          id: e.id,
          userId: e.user_id,
          amount: e.amount,
          description: cleanDescription,
          date: e.date,
          category: category
        };
      });
  },

  async saveExpense(expense: Partial<Expense>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const expenseId = expense.id || generateUUID();
    const category = expense.category || 'Otros';
    
    // Almacenamos la categoría como prefijo en la descripción para no depender de la columna en DB
    const prefix = category === 'Reabastecimiento' ? REAB_PREFIX : OTRO_PREFIX;
    const finalDescription = prefix + (expense.description || 'Gasto');

    const expenseData: any = {
      id: expenseId,
      description: finalDescription,
      amount: Number(expense.amount) || 0,
      user_id: user.id,
      date: expense.date || new Date().toISOString()
    };

    const { error } = await supabase
      .from('expenses')
      .upsert(expenseData);

    if (error) {
      console.error("Error al guardar gasto:", error);
      throw new Error(`Error en DB: ${error.message}`);
    }
  },

  async deleteExpense(id: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
  },

  async saveExpensesBatch(expenses: Partial<Expense>[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión expirada");

    const expensesData = expenses.map(e => {
      const category = e.category || 'Otros';
      const prefix = category === 'Reabastecimiento' ? REAB_PREFIX : OTRO_PREFIX;
      return {
        id: e.id || generateUUID(),
        description: prefix + (e.description || 'Gasto Migrado'),
        amount: Number(e.amount) || 0,
        user_id: user.id,
        date: e.date || new Date().toISOString()
      };
    });

    const { error } = await supabase.from('expenses').upsert(expensesData);
    if (error) throw error;
  },

  // Clientes y Ventas
  async getClients(): Promise<Client[]> {
    const { data, error } = await supabase.from('clients').select('*');
    if (error) throw error;
    return (data || []).map(c => ({
      id: c.id, userId: c.user_id, name: c.name, phone: c.phone || '', email: c.email || '', currentDebt: c.current_debt || 0
    }));
  },

  async saveClient(client: Partial<Client>): Promise<Client> {
    const { data: { user } } = await supabase.auth.getUser();
    const { error, data } = await supabase
      .from('clients')
      .upsert({ 
        id: client.id || generateUUID(),
        name: client.name,
        phone: client.phone || '',
        email: client.email || '',
        current_debt: client.currentDebt || 0,
        user_id: user?.id 
      })
      .select().single();
    if (error) throw error;
    return { id: data.id, userId: data.user_id, name: data.name, phone: data.phone || '', email: data.email || '', currentDebt: data.current_debt || 0 };
  },

  // Fix: Added deleteClient method
  async deleteClient(id: string) {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
  },

  async getSales(): Promise<Sale[]> {
    const { data: sales, error } = await supabase.from('sales').select('*').order('date', { ascending: false });
    if (error) throw error;
    
    const { data: payments } = await supabase.from('sale_payments').select('*');
    
    return (sales || []).map(s => ({
      id: s.id, 
      userId: s.user_id, 
      clientId: s.client_id, 
      items: s.items || [], 
      total: s.total, 
      date: s.date, 
      status: s.status, 
      amountPaid: s.amount_paid,
      payments: (payments || [])
        .filter(p => p.sale_id === s.id)
        .map(p => ({
          id: p.id,
          saleId: p.sale_id,
          clientId: p.client_id,
          amount: p.amount,
          method: p.method,
          reference: p.reference,
          date: p.date,
          exchangeRate: p.exchange_rate,
          amountBs: p.amount_bs
        }))
    }));
  },

  async createSale(sale: Partial<Sale>, initialPayment?: { amount: number, method: string, reference?: string, exchangeRate?: number, amountBs?: number }) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: newSale, error: saleError } = await supabase
      .from('sales')
      .insert({
        id: sale.id || generateUUID(),
        user_id: user?.id,
        client_id: sale.clientId,
        total: sale.total,
        amount_paid: sale.amountPaid,
        status: sale.status,
        items: sale.items
      })
      .select().single();

    if (saleError) throw saleError;
    
    // Registrar el pago inicial si existe
    if (initialPayment && initialPayment.amount > 0) {
      const paymentData: any = {
        sale_id: newSale.id,
        client_id: sale.clientId,
        amount: initialPayment.amount,
        method: initialPayment.method,
        reference: initialPayment.reference,
        user_id: user?.id,
        date: new Date().toISOString()
      };
      if (initialPayment.exchangeRate !== undefined) paymentData.exchange_rate = initialPayment.exchangeRate;
      if (initialPayment.amountBs !== undefined) paymentData.amount_bs = initialPayment.amountBs;

      await supabase.from('sale_payments').insert(paymentData);
    }

    for (const item of sale.items || []) {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.productId).single();
      if (prod) await supabase.from('products').update({ stock: prod.stock - item.quantity }).eq('id', item.productId);
    }
    if (sale.status === SaleStatus.CREDIT && sale.clientId) {
      const pending = (sale.total || 0) - (sale.amountPaid || 0);
      const { data: client } = await supabase.from('clients').select('current_debt').eq('id', sale.clientId).single();
      if (client) await supabase.from('clients').update({ current_debt: client.current_debt + pending }).eq('id', sale.clientId);
    }
    return newSale;
  },

  async importSalesBatch(sales: (Partial<Sale> & { clientName?: string })[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión expirada");

    // 1. Get or create clients
    const clientNames = [...new Set(sales.map(s => s.clientName).filter(Boolean))];
    const existingClients = await this.getClients();
    const clientMap: Record<string, string> = {};
    
    for (const name of clientNames) {
      const existing = existingClients.find(c => c.name.toLowerCase() === name?.toLowerCase());
      if (existing) {
        clientMap[name!] = existing.id;
      } else {
        const newClient = await this.saveClient({ name: name! });
        clientMap[name!] = newClient.id;
      }
    }

    // 2. Prepare sales data
    const salesData = sales.map(s => ({
      id: s.id || generateUUID(),
      user_id: user.id,
      client_id: s.clientName ? clientMap[s.clientName] : s.clientId,
      total: Number(s.total) || 0,
      amount_paid: Number(s.amountPaid) || 0,
      status: s.status || SaleStatus.COMPLETED,
      items: s.items || [],
      date: s.date || new Date().toISOString()
    }));

    const { error } = await supabase.from('sales').upsert(salesData);
    if (error) throw error;
  },

  // Fix: Added deleteSale method with reverse inventory and debt logic
  async deleteSale(id: string) {
    const { data: sale, error: fetchError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !sale) throw new Error("Venta no encontrada");

    // 1. Restaurar stock de los productos vendidos
    for (const item of (sale.items || [])) {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.productId).single();
      if (prod) {
        await supabase.from('products').update({ stock: prod.stock + item.quantity }).eq('id', item.productId);
      }
    }

    // 2. Si era venta a crédito, descontar del saldo pendiente del cliente
    if (sale.status === SaleStatus.CREDIT && sale.client_id) {
      const pending = sale.total - sale.amount_paid;
      const { data: client } = await supabase.from('clients').select('current_debt').eq('id', sale.client_id).single();
      if (client) {
        await supabase.from('clients').update({ current_debt: Math.max(0, client.current_debt - pending) }).eq('id', sale.client_id);
      }
    }

    // 3. Eliminar físicamente el registro de venta
    const { error: deleteError } = await supabase.from('sales').delete().eq('id', id);
    if (deleteError) throw deleteError;
  },

  async processDistributedAbono(clientId: string, totalAmount: number, saleIds: string[], paymentDetails: { method: string, reference?: string, exchangeRate?: number, amountBs?: number }) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: sales } = await supabase.from('sales').select('*').in('id', saleIds).order('date', { ascending: true });
    let remaining = totalAmount;
    for (const sale of sales || []) {
      if (remaining <= 0) break;
      const pending = sale.total - sale.amount_paid;
      const applied = Math.min(remaining, pending);
      
      // Actualizar venta
      await supabase.from('sales').update({ 
        amount_paid: sale.amount_paid + applied, 
        status: (sale.amount_paid + applied >= sale.total ? SaleStatus.COMPLETED : SaleStatus.CREDIT) 
      }).eq('id', sale.id);

      // Guardar pago detallado
      const paymentInsert: any = {
        sale_id: sale.id,
        client_id: clientId,
        amount: applied,
        method: paymentDetails.method,
        reference: paymentDetails.reference,
        user_id: user?.id,
        date: new Date().toISOString()
      };
      if (paymentDetails.exchangeRate !== undefined) {
        paymentInsert.exchange_rate = paymentDetails.exchangeRate;
      }
      if (paymentDetails.amountBs !== undefined) {
        paymentInsert.amount_bs = Number((paymentDetails.amountBs * (applied / totalAmount)).toFixed(2));
      }

      await supabase.from('sale_payments').insert(paymentInsert);

      remaining -= applied;
    }
    const { data: client } = await supabase.from('clients').select('current_debt').eq('id', clientId).single();
    if (client) await supabase.from('clients').update({ current_debt: Math.max(0, client.current_debt - totalAmount) }).eq('id', clientId);
  },

  async getSalePaymentsByClient(clientId: string): Promise<CreditPayment[]> {
    const { data, error } = await supabase
      .from('sale_payments')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      saleId: p.sale_id,
      clientId: p.client_id,
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      date: p.date,
      exchangeRate: p.exchange_rate,
      amountBs: p.amount_bs
    }));
  },

  async getCreditPayments(clientId?: string): Promise<CreditPayment[]> {
    let query = supabase.from('sale_payments').select('*').order('date', { ascending: false });
    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    const { data, error } = await query;
    if (error) {
       // Fallback logic from previous implementation if needed, but we prefer the new table
       console.warn("Could not fetch sale_payments table, trying fallback info");
       return [];
    }

    return (data || []).map(p => ({
      id: p.id,
      saleId: p.sale_id,
      clientId: p.client_id,
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      date: p.date,
      exchangeRate: p.exchange_rate,
      amountBs: p.amount_bs
    }));
  },

  async getAllSalePayments(): Promise<SalePayment[]> {
    const { data, error } = await supabase
      .from('sale_payments')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      saleId: p.sale_id,
      clientId: p.client_id,
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      date: p.date,
      exchangeRate: p.exchange_rate,
      amountBs: p.amount_bs
    }));
  },

  async addCreditPayment(payment: { clientId: string, amount: number, date: string }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    // Store as expense with prefix for backward compatibility and guaranteed table presence
    // Format: "💰 [ABONO] |CLIENT_ID|SALE_ID"
    const description = `${ABONO_PREFIX}|${payment.clientId}|`;

    const { error } = await supabase.from('expenses').insert({
      id: generateUUID(),
      description: description,
      amount: payment.amount,
      date: payment.date,
      user_id: user.id
    });

    if (error) {
      console.error("Error adding credit payment to expenses:", error);
      throw error;
    }
  },

  // Admin Methods
  async getAllProfiles(): Promise<UserProfile[]> {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      businessName: p.business_name || 'Sin Nombre',
      email: p.email,
      sheetsUrl: p.sheets_url,
      subscriptionExpires: p.subscription_expires,
      isBanned: p.is_banned,
      alias: p.alias,
      contactPhone: p.contact_phone,
      lastPaymentRef: p.last_payment_ref,
      archived: p.archived,
      role: p.role || 'user',
      useParallelRate: p.use_parallel_rate || false,
      showTriplePrice: p.show_triple_price || false,
      isDarkMode: p.is_dark_mode || false
    }));
  },

  async toggleArchiveUserProfile(userId: string, archived: boolean) {
    const { error } = await supabase.from('profiles').update({ archived }).eq('id', userId);
    if (error) throw error;
  },

  async updateProfileByAdmin(profileId: string, updates: Partial<UserProfile>) {
    const dbUpdates: any = {};
    if (updates.businessName !== undefined) dbUpdates.business_name = updates.businessName;
    if (updates.sheetsUrl !== undefined) dbUpdates.sheets_url = updates.sheetsUrl;
    if (updates.subscriptionExpires !== undefined) dbUpdates.subscription_expires = updates.subscriptionExpires;
    if (updates.isBanned !== undefined) dbUpdates.is_banned = updates.isBanned;
    if (updates.alias !== undefined) dbUpdates.alias = updates.alias;
    if (updates.contactPhone !== undefined) dbUpdates.contact_phone = updates.contactPhone;
    if (updates.lastPaymentRef !== undefined) dbUpdates.last_payment_ref = updates.lastPaymentRef;
    if (updates.archived !== undefined) dbUpdates.archived = updates.archived;
    if (updates.useParallelRate !== undefined) dbUpdates.use_parallel_rate = updates.useParallelRate;
    if (updates.showTriplePrice !== undefined) dbUpdates.show_triple_price = updates.showTriplePrice;
    if (updates.isDarkMode !== undefined) dbUpdates.is_dark_mode = updates.isDarkMode;

    const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', profileId);
    if (error) throw error;
  },

  // App Config with fallback to expenses table
  async getAppConfig(): Promise<AppConfig> {
    try {
      const { data, error } = await supabase.from('app_config').select('*').eq('id', 'global').single();
      if (!error && data) {
        return {
          id: 'global',
          bankName: data.bank_name || '',
          accountNumber: data.account_number || '',
          phone: data.phone || '',
          idNumber: data.id_number || '',
          binanceUser: data.binance_user || ''
        };
      }
    } catch (e) {
      console.warn("app_config table missing or mapping error, trying expenses fallback");
    }

    // Fallback: search in expenses
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .filter('description', 'ilike', '⚙️ [CONFIG]%')
      .order('date', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const parts = data[0].description.replace('⚙️ [CONFIG] ', '').split('|');
      return {
        id: 'global',
        bankName: parts[0] || '',
        accountNumber: parts[1] || '',
        phone: parts[2] || '',
        idNumber: parts[3] || '',
        binanceUser: parts[4] || ''
      };
    }

    return {
      id: 'global',
      bankName: '',
      accountNumber: '',
      phone: '',
      idNumber: '',
      binanceUser: ''
    };
  },

  async saveAppConfig(config: AppConfig) {
    // Try app_config first
    try {
      const dbConfig = {
        id: 'global',
        bank_name: config.bankName,
        account_number: config.accountNumber,
        phone: config.phone,
        id_number: config.idNumber,
        binance_user: config.binanceUser
      };
      const { error } = await supabase.from('app_config').upsert(dbConfig);
      if (!error) return;
    } catch (e) {
      // ignore table missing
    }

    // Fallback: save as a special expense
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const description = `⚙️ [CONFIG] ${config.bankName}|${config.accountNumber}|${config.phone}|${config.idNumber}|${config.binanceUser}`;
    
    const { error } = await supabase.from('expenses').insert({
      id: generateUUID(),
      description: description,
      amount: 0,
      date: new Date().toISOString(),
      user_id: user.id
    });

    if (error) throw error;
  },

  async createSubscriptionRequest(request: Partial<SubscriptionRequest>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { error } = await supabase.from('subscription_requests').insert({
      id: generateUUID(),
      user_id: user.id,
      business_name: request.businessName,
      months: request.months,
      amount_usd: request.amountUsd,
      method: request.method,
      reference: request.reference,
      status: SubscriptionStatus.PENDING,
      date: new Date().toISOString()
    });
    if (error) throw error;
  },

  async getSubscriptionRequests(): Promise<SubscriptionRequest[]> {
    const { data, error } = await supabase
      .from('subscription_requests')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      businessName: r.business_name,
      months: r.months,
      amountUsd: r.amount_usd,
      method: r.method,
      reference: r.reference,
      status: r.status,
      date: r.date
    }));
  },

  async updateSubscriptionRequestStatus(requestId: string, status: SubscriptionStatus) {
    const { data: req, error: fetchErr } = await supabase.from('subscription_requests').select('*').eq('id', requestId).single();
    if (fetchErr) throw fetchErr;

    if (status === SubscriptionStatus.CONFIRMED && req.status !== SubscriptionStatus.CONFIRMED) {
      // 1. Obtener perfil
      const { data: profile, error: profileErr } = await supabase.from('profiles').select('*').eq('id', req.user_id).single();
      if (profileErr) throw new Error("No se pudo encontrar el perfil del usuario: " + profileErr.message);
      
      // 2. Calcular nueva fecha
      const now = new Date();
      const currentExpiry = profile.subscription_expires ? new Date(profile.subscription_expires) : null;
      
      // Si ya tiene una fecha y no ha vencido, sumamos a esa. Si no, sumamos desde hoy.
      const baseDate = (currentExpiry && currentExpiry > now) ? currentExpiry : now;
      
      const monthsToAdd = Number(req.months) || 0;
      const newDate = new Date(baseDate);
      newDate.setMonth(newDate.getMonth() + monthsToAdd);
      newDate.setHours(23, 59, 59, 999);

      // 3. Actualizar perfil
      const { error: updateProfileErr } = await supabase.from('profiles').update({
        subscription_expires: newDate.toISOString(),
        last_payment_ref: req.reference
      }).eq('id', req.user_id);

      if (updateProfileErr) throw new Error("Error al actualizar la suscripción del negocio: " + updateProfileErr.message);
    }

    // 4. Actualizar estado de solicitud
    const { error: updateReqErr } = await supabase.from('subscription_requests').update({ status }).eq('id', requestId);
    if (updateReqErr) throw updateReqErr;
  },

  // Cortes Mensuales
  async checkMonthlyClosureSent(yearMonth: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('expenses')
      .select('id')
      .filter('description', 'eq', `⚙️ [CORTE_ENVIADO] ${yearMonth}`)
      .limit(1);
    
    return !error && data && data.length > 0;
  },

  async markMonthlyClosureSent(yearMonth: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from('expenses').insert({
      id: generateUUID(),
      description: `⚙️ [CORTE_ENVIADO] ${yearMonth}`,
      amount: 0,
      date: new Date().toISOString(),
      user_id: user.id
    });
  }
};
