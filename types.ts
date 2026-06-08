
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

export interface OperatingExpenseItem {
  id: string;
  name: string;
  amount: number;
}

export interface SalaryItem {
  id: string;
  employeeName: string;
  salary: number;
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
  showTriplePrice?: boolean;
  aiAuditEnabled?: boolean;
  isDarkMode?: boolean;
  monthlyOperatingExpenses?: number;
  monthlySalaries?: number;
  initialInvestmentAmount?: number;
  initialInvestmentLifeMonths?: number;
  dashboardPin?: string;
  recoveryQuestion?: string;
  recoveryAnswer?: string;
  operatingExpensesList?: OperatingExpenseItem[];
  salariesList?: SalaryItem[];
}

export interface AppConfig {
  id: 'global';
  bankName: string;
  accountNumber: string;
  phone: string;
  idNumber: string;
  binanceUser: string;
}

export interface WholesaleTier {
  qty: number;
  price: number;
}

export interface ServiceUsedProduct {
  productId: string;
  name: string;
  qty: number;
  unitCost: number;
  sellingPrice?: number;
}

export interface ServiceExtraExpense {
  name: string;
  amount: number;
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
  seasonalDiscountEnabled?: boolean;
  seasonalDiscountPrice?: number;
  cashDiscountEnabled?: boolean;
  cashDiscountPrice?: number;
  wholesaleDiscountEnabled?: boolean;
  wholesaleTiers?: WholesaleTier[];
  isService?: boolean;
  serviceBasePrice?: number;
  usedProducts?: ServiceUsedProduct[];
  extraExpenses?: ServiceExtraExpense[];
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
  cost?: number;
  isService?: boolean;
  serviceBasePrice?: number;
  usedProducts?: ServiceUsedProduct[];
  extraExpenses?: ServiceExtraExpense[];
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
  exchangeRate?: number;
  amountBs?: number;
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
  isGrouped?: boolean;
}

export type ViewType = 'dashboard' | 'inventory' | 'sales' | 'cierre_caja' | 'sales_history' | 'clients' | 'credit' | 'expenses' | 'settings' | 'admin';

export interface AppChangelog {
  id: string;
  version: string;
  releaseDate: string;
  title: string;
  description?: string;
  changes: string[];
  createdAt?: string;
}
