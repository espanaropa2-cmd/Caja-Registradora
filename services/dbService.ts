
import { supabase } from '../supabaseClient';
import { Product, Client, Sale, Expense, SaleStatus } from '../types';

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
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("No autenticado");

    const productData = { 
      id: product.id || crypto.randomUUID(),
      name: product.name,
      price: product.price,
      cost: product.cost,
      stock: product.stock,
      barcode: product.barcode,
      category: product.category,
      user_id: userData.user.id 
    };
    
    const { error: productError } = await supabase
      .from('products')
      .upsert(productData);

    if (productError) throw productError;

    // Si es un producto nuevo y tiene stock, registramos el gasto inicial
    if (isNew && product.stock && product.stock > 0 && product.cost) {
      const totalCost = product.stock * product.cost;
      const { error: expenseError } = await supabase.from('expenses').insert({
        user_id: userData.user.id,
        description: `Inversión Inicial: ${product.name} (${product.stock} uds)`,
        amount: totalCost,
        date: new Date().toISOString()
      });
      if (expenseError) console.error("Error registrando gasto inicial:", expenseError);
    }
  },

  async updateStockAndRecordExpense(productId: string, quantityToAdd: number, cost: number, productName: string) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("No autenticado");
    
    const { data: prod, error: fetchError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();
    
    if (fetchError || !prod) throw new Error("Producto no encontrado");

    const { error: updateError } = await supabase
      .from('products')
      .update({ 
        stock: prod.stock + quantityToAdd,
        cost: cost 
      })
      .eq('id', productId);

    if (updateError) throw updateError;

    const totalCost = quantityToAdd * cost;
    const { error: expenseError } = await supabase.from('expenses').insert({
      user_id: userData.user.id,
      description: `Reposición Stock: ${productName} (+${quantityToAdd} uds)`,
      amount: totalCost,
      date: new Date().toISOString()
    });

    if (expenseError) throw expenseError;
  },

  async deleteProduct(id: string) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Clientes
  async getClients(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*');
    if (error) throw error;
    return (data || []).map(c => ({
      id: c.id,
      userId: c.user_id,
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      currentDebt: c.current_debt || 0
    }));
  },

  async saveClient(client: Partial<Client>): Promise<Client> {
    const { data: userData } = await supabase.auth.getUser();
    const { error, data } = await supabase
      .from('clients')
      .upsert({ 
        id: client.id || crypto.randomUUID(),
        name: client.name,
        phone: client.phone || '',
        email: client.email || '',
        current_debt: client.currentDebt || 0,
        user_id: userData.user?.id 
      })
      .select()
      .single();

    if (error) throw error;
    
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      phone: data.phone || '',
      email: data.email || '',
      currentDebt: data.current_debt || 0
    };
  },

  async deleteClient(id: string) {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
  },

  async addPaymentToClient(clientId: string, amount: number) {
    const { data: client } = await supabase.from('clients').select('current_debt').eq('id', clientId).single();
    if (client) {
      await supabase.from('clients').update({ current_debt: Math.max(0, client.current_debt - amount) }).eq('id', clientId);
    }
  },

  async processDistributedAbono(clientId: string, totalAmount: number, saleIds: string[]) {
    const { data: sales, error: fetchError } = await supabase
      .from('sales')
      .select('*')
      .in('id', saleIds)
      .order('date', { ascending: true });

    if (fetchError) throw fetchError;

    let remainingPayment = totalAmount;

    for (const sale of sales) {
      if (remainingPayment <= 0) break;

      const pending = sale.total - sale.amount_paid;
      const paymentToApply = Math.min(remainingPayment, pending);
      const newAmountPaid = sale.amount_paid + paymentToApply;
      const newStatus = newAmountPaid >= sale.total ? SaleStatus.COMPLETED : SaleStatus.CREDIT;

      const { error: updateError } = await supabase
        .from('sales')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus
        })
        .eq('id', sale.id);

      if (updateError) throw updateError;
      remainingPayment -= paymentToApply;
    }

    const { data: client } = await supabase.from('clients').select('current_debt').eq('id', clientId).single();
    if (client) {
      await supabase.from('clients').update({ 
        current_debt: Math.max(0, client.current_debt - totalAmount) 
      }).eq('id', clientId);
    }
  },

  // Ventas
  async getSales(): Promise<Sale[]> {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(s => ({
      id: s.id,
      userId: s.user_id,
      clientId: s.client_id,
      items: s.items || [],
      total: s.total,
      date: s.date,
      status: s.status,
      amountPaid: s.amount_paid
    }));
  },

  async createSale(sale: Partial<Sale>) {
    const { data: userData } = await supabase.auth.getUser();
    
    const { data: newSale, error: saleError } = await supabase
      .from('sales')
      .insert({
        user_id: userData.user?.id,
        client_id: sale.clientId,
        total: sale.total,
        amount_paid: sale.amountPaid,
        status: sale.status,
        items: sale.items
      })
      .select()
      .single();

    if (saleError) throw saleError;

    for (const item of sale.items || []) {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.productId).single();
      if (prod) {
        await supabase.from('products').update({ stock: prod.stock - item.quantity }).eq('id', item.productId);
      }
    }

    if (sale.status === SaleStatus.CREDIT && sale.clientId) {
      const pending = (sale.total || 0) - (sale.amountPaid || 0);
      const { data: client } = await supabase.from('clients').select('current_debt').eq('id', sale.clientId).single();
      if (client) {
        await supabase.from('clients').update({ current_debt: client.current_debt + pending }).eq('id', sale.clientId);
      }
    }

    return newSale;
  },

  async deleteSale(saleId: string) {
    const { data: sale } = await supabase.from('sales').select('*').eq('id', saleId).single();
    if (!sale) return;

    for (const item of sale.items || []) {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.productId).single();
      if (prod) {
        await supabase.from('products').update({ stock: prod.stock + item.quantity }).eq('id', item.productId);
      }
    }

    if (sale.status === SaleStatus.CREDIT && sale.client_id) {
      const pending = sale.total - sale.amount_paid;
      const { data: client } = await supabase.from('clients').select('current_debt').eq('id', sale.client_id).single();
      if (client) {
        await supabase.from('clients').update({ current_debt: Math.max(0, client.current_debt - pending) }).eq('id', sale.client_id);
      }
    }

    const { error } = await supabase.from('sales').delete().eq('id', saleId);
    if (error) throw error;
  },

  // Egresos / Gastos
  async getExpenses(): Promise<Expense[]> {
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(e => ({
      id: e.id,
      userId: e.user_id,
      amount: e.amount,
      description: e.description,
      date: e.date
    }));
  },

  async saveExpense(expense: Partial<Expense>) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("No autenticado");

    const expenseData = {
      description: expense.description,
      amount: expense.amount,
      user_id: userData.user.id,
      date: expense.date || new Date().toISOString()
    };

    if (expense.id) {
      const { error } = await supabase
        .from('expenses')
        .update(expenseData)
        .eq('id', expense.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('expenses')
        .insert(expenseData);
      if (error) throw error;
    }
  },

  async deleteExpense(id: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
  }
};
