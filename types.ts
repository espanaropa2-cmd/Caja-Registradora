
export interface UserProfile {
  id: string;
  businessName: string;
  email: string;
  sheetsUrl?: string;
}

export interface Product {
  id: string;
  userId: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  barcode: string;
  category: string;
}

export interface Client {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  currentDebt: number;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export enum SaleStatus {
  COMPLETED = 'COMPLETED',
  CREDIT = 'CREDIT',
  CANCELLED = 'CANCELLED'
}

export interface Sale {
  id: string;
  userId: string;
  clientId?: string;
  items: SaleItem[];
  total: number;
  date: string;
  status: SaleStatus;
  amountPaid: number;
}

export interface CreditPayment {
  id: string;
  saleId: string;
  amount: number;
  date: string;
}

export type ExpenseCategory = 'Reabastecimiento' | 'Otros';

export interface Expense {
  id: string;
  userId: string;
  amount: number;
  description: string;
  date: string;
  category: ExpenseCategory;
}

export type ViewType = 'dashboard' | 'inventory' | 'sales' | 'sales_history' | 'clients' | 'credit' | 'expenses' | 'settings';
