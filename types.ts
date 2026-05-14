
export enum SubscriptionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  DECLINED = 'DECLINED'
}

export interface SubscriptionRequest {
  id: string;
  userId: string;
  businessName: string;
  months: number;
  amountUsd: number;
  method: string;
  reference: string;
  status: SubscriptionStatus;
  date: string;
}

export interface UserProfile {
  id: string;
  businessName: string;
  email: string;
  sheetsUrl?: string;
  subscriptionExpires?: string;
  isBanned?: boolean;
  alias?: string;
  contactPhone?: string;
  lastPaymentRef?: string;
  archived?: boolean;
  role?: 'admin' | 'user';
  useParallelRate?: boolean;
  isDarkMode?: boolean;
}

export interface AppConfig {
  id: 'global';
  bankName: string;
  accountNumber: string;
  phone: string;
  idNumber: string;
  binanceUser: string;
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

export enum PaymentMethod {
  PUNTO = 'PUNTO',
  PAGOMOVIL = 'PAGOMOVIL',
  EFECTIVO = 'EFECTIVO'
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
  payments?: SalePayment[];
}

export interface SalePayment {
  id: string;
  saleId: string;
  clientId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  date: string;
}

export interface CreditPayment extends SalePayment {
  // Keeping this for compatibility or simpler overall tracking
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

export type ViewType = 'dashboard' | 'inventory' | 'sales' | 'sales_history' | 'clients' | 'credit' | 'expenses' | 'settings' | 'admin';
