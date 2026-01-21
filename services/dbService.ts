
import { supabase } from '../supabaseClient';
import { Product, Client, Sale, Expense, SaleStatus, ExpenseCategory } from '../types';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Prefijos para emular categorías si la columna no existe en la DB
const REAB_PREFIX = "📦 [REAB] ";
const OTRO_PREFIX = "💸 [OTRO] ";

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

  // Egresos (Refactorizado para evitar error de columna 'category')
  async getExpenses(): Promise<Expense[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(e => {
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
    const { data, error } = await supabase.from('sales').select('*').order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(s => ({
      id: s.id, userId: s.user_id, clientId: s.client_id, items: s.items || [], total: s.total, date: s.date, status: s.status, amountPaid: s.amount_paid
    }));
  },

  async createSale(sale: Partial<Sale>) {
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

  async processDistributedAbono(clientId: string, totalAmount: number, saleIds: string[]) {
    const { data: sales } = await supabase.from('sales').select('*').in('id', saleIds).order('date', { ascending: true });
    let remaining = totalAmount;
    for (const sale of sales || []) {
      if (remaining <= 0) break;
      const pending = sale.total - sale.amount_paid;
      const applied = Math.min(remaining, pending);
      await supabase.from('sales').update({ amount_paid: sale.amount_paid + applied, status: (sale.amount_paid + applied >= sale.total ? SaleStatus.COMPLETED : SaleStatus.CREDIT) }).eq('id', sale.id);
      remaining -= applied;
    }
    const { data: client } = await supabase.from('clients').select('current_debt').eq('id', clientId).single();
    if (client) await supabase.from('clients').update({ current_debt: Math.max(0, client.current_debt - totalAmount) }).eq('id', clientId);
  }
};
