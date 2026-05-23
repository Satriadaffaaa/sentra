export interface Account {
  id: string;
  name: string;
  balance: number;
  currency: string;
  type: 'bank' | 'cash' | 'e_wallet' | 'credit_card' | 'investment';
  icon: string;
  color: string;
}

export interface Transaction {
  id?: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId: string;
  description: string;
  date: string;
  accountId: string;
  toAccountId?: string; // for transfer transactions
  linkedSubId?: string;
  linkedSavingsGoalId?: string;
  linkedDebtId?: string;
  linkedInvTxId?: string;
  currency?: string;
  exchangeRate?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
}

export interface Budget {
  id: string;
  categoryId: string;
  amountLimit: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
}

export interface Debt {
  id: string;
  name: string;
  type: 'debt' | 'loan';
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
  status: 'active' | 'paid';
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  type: 'auto' | 'manual';
  accountId: string;
  categoryId: string;
  nextDueDate: string;
  active: boolean;
}

export interface Investment {
  id: string;
  name: string;
  type: 'stock' | 'mutual_fund' | 'crypto' | 'gold' | 'bond' | 'deposit' | 'p2p' | 'property' | 'other';
  currentPrice: number;
  symbol?: string;
  description?: string;
  yieldRate?: number;
  yieldFrequency?: 'monthly' | 'annually';
  lastYieldPaymentDate?: string;
  color?: string;
  icon?: string;
}

export interface InvestmentTransaction {
  id?: string;
  investmentId: string;
  type: 'buy' | 'sell' | 'dividend' | 'interest';
  amount: number;
  quantity: number;
  pricePerUnit: number;
  date: string;
  accountId?: string;
}

export interface Settings {
  baseCurrency: string;
  exchangeRates: Record<string, number>;
  notificationPermitted?: boolean;
  autoAllocationEnabled?: boolean;
  autoAllocationPercent?: number;
  autoAllocationGoalId?: string;
  passcodeEnabled?: boolean;
  passcodePIN?: string;
}

export interface InAppNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  date: string;
}

export interface FinanceContextType {
  user: any;
  authLoading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<any>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<any>;
  loginWithGoogle: () => Promise<any>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  debts: Debt[];
  subscriptions: Subscription[];
  settings: Settings;
  notifications: InAppNotification[];
  hideBalances: boolean;
  toggleHideBalances: () => void;
  isLoading: boolean;
  isQuickAddOpen: boolean;
  setIsQuickAddOpen: (isOpen: boolean) => void;
  refreshData: () => Promise<void>;
  pushNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
  convertCurrency: (amount: number, fromCurrency: string, toCurrency: string) => number;
  formatCurrency: (amount: number, currency?: string) => string;
  addTransaction: (tx: Omit<Transaction, 'id'>, linkOptions?: { savingsGoalId?: string; debtId?: string; autoAllocate?: boolean }) => Promise<Transaction>;
  deleteTransaction: (id: string) => Promise<void>;
  saveAccount: (account: Omit<Account, 'id'> & { id?: string }) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  saveCategory: (category: Omit<Category, 'id'> & { id?: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  saveBudget: (budget: Omit<Budget, 'id'> & { id?: string }) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  saveSavingsGoal: (goal: Omit<SavingsGoal, 'id'> & { id?: string }) => Promise<void>;
  deleteSavingsGoal: (id: string) => Promise<void>;
  saveDebt: (debt: Omit<Debt, 'id'> & { id?: string }) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  saveSubscription: (sub: Omit<Subscription, 'id'> & { id?: string }) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  saveSettings: (settings: Settings) => Promise<void>;
  resetAllData: () => Promise<void>;
  investments: Investment[];
  investmentTransactions: InvestmentTransaction[];
  saveInvestment: (inv: Omit<Investment, 'id'> & { id?: string }) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  addInvestmentTransaction: (tx: Omit<InvestmentTransaction, 'id'>, accountId?: string) => Promise<void>;
  deleteInvestmentTransaction: (id: string) => Promise<void>;
}
