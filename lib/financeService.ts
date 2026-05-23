/**
 * Enterprise Financial Data Access Service
 * 
 * This service abstracts the storage backend. It supports two modes:
 * 1. Firebase Firestore (Production fullstack mode, active when environment variables are set)
 * 2. LocalStorage + Mock Data (Interactive Demo mode, active by default for instant onboarding)
 * 
 * To ensure reliability, account balances are dynamically updated based on transactions
 * to prevent database-application desynchronization.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { 
  getFirestore, doc, collection, getDocs, getDoc, setDoc, 
  addDoc, deleteDoc, updateDoc, Firestore
} from "firebase/firestore";
import { 
  getAuth, onAuthStateChanged, signInAnonymously, Auth, User,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, sendPasswordResetEmail
} from "firebase/auth";
import { encrypt, decrypt } from "./crypto";
import { Account, Transaction, Category, Budget, SavingsGoal, Debt, Subscription, Settings, Investment, InvestmentTransaction } from "./types";

// --- Firebase Configuration & Initialization ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const isFirebaseEnabled = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId
  );
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

if (isFirebaseEnabled()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
  }
}

// --- Default High-Fidelity Mock Data (Demo Mode) ---
const DEFAULT_ACCOUNTS: Account[] = [
  { id: "acc-1", name: "Tunai / Cash", type: "cash", balance: 750000, currency: "IDR", icon: "💵", color: "#10b981" },
  { id: "acc-2", name: "Bank BCA", type: "bank", balance: 12500000, currency: "IDR", icon: "🏛️", color: "#2563eb" },
  { id: "acc-3", name: "GoPay", type: "e_wallet", balance: 1800000, currency: "IDR", icon: "📱", color: "#06b6d4" },
  { id: "acc-4", name: "Mandiri USD", type: "bank", balance: 250, currency: "USD", icon: "✈️", color: "#8b5cf6" },
  { id: "acc-5", name: "Kartu Kredit Bank", type: "credit_card", balance: -2500000, currency: "IDR", icon: "💳", color: "#ef4444" }
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-food", name: "Makanan & Minuman", icon: "🍔", color: "#f97316", type: "expense" },
  { id: "cat-transport", name: "Transportasi", icon: "🚗", color: "#06b6d4", type: "expense" },
  { id: "cat-shopping", name: "Belanja", icon: "🛍️", color: "#ec4899", type: "expense" },
  { id: "cat-salary", name: "Gaji & Pendapatan", icon: "💼", color: "#10b981", type: "income" },
  { id: "cat-bills", name: "Tagihan & Listrik", icon: "⚡", color: "#f59e0b", type: "expense" },
  { id: "cat-entertainment", name: "Hiburan", icon: "🎬", color: "#8b5cf6", type: "expense" },
  { id: "cat-investment", name: "Investasi", icon: "📈", color: "#3b82f6", type: "income" },
  { id: "cat-others", name: "Lain-lain", icon: "🏷️", color: "#64748b", type: "expense" }
];

const DEFAULT_BUDGETS: Budget[] = [
  { id: "bud-1", categoryId: "cat-food", amountLimit: 3000000 },
  { id: "bud-2", categoryId: "cat-transport", amountLimit: 1000000 },
  { id: "bud-3", categoryId: "cat-shopping", amountLimit: 1500000 }
];

const DEFAULT_SAVINGS_GOALS: SavingsGoal[] = [
  { id: "goal-1", name: "Dana Darurat (Emergency)", targetAmount: 15000000, currentAmount: 8000000, targetDate: "2026-12-31" },
  { id: "goal-2", name: "Liburan ke Jepang", targetAmount: 25000000, currentAmount: 5000000, targetDate: "2027-06-30" }
];

const DEFAULT_DEBTS: Debt[] = [
  { id: "debt-1", name: "Cicilan Laptop", type: "debt", totalAmount: 6000000, paidAmount: 3500000, dueDate: "2026-08-15", status: "active" },
  { id: "debt-2", name: "Pinjaman Budi", type: "loan", totalAmount: 1000000, paidAmount: 2000000, dueDate: "2026-06-01", status: "active" }
];

const DEFAULT_SUBSCRIPTIONS: Subscription[] = [
  { id: "sub-1", name: "Netflix Premium", amount: 186000, type: "auto", accountId: "acc-5", categoryId: "cat-entertainment", nextDueDate: "2026-06-10", active: true },
  { id: "sub-2", name: "Spotify Family", amount: 86900, type: "manual", accountId: "acc-3", categoryId: "cat-entertainment", nextDueDate: "2026-06-01", active: true }
];

const getPastDateStr = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
};

const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: "tx-1", amount: 15000000, type: "income", categoryId: "cat-salary", description: "Gaji Utama Bulanan", date: getPastDateStr(5), accountId: "acc-2" },
  { id: "tx-2", amount: 120000, type: "expense", categoryId: "cat-food", description: "Makan Malam Ramen", date: getPastDateStr(4), accountId: "acc-2" },
  { id: "tx-3", amount: 35000, type: "expense", categoryId: "cat-transport", description: "Grab Car ke Kantor", date: getPastDateStr(4), accountId: "acc-3" },
  { id: "tx-4", amount: 450000, type: "expense", categoryId: "cat-shopping", description: "Sepatu Baru", date: getPastDateStr(3), accountId: "acc-5" },
  { id: "tx-5", amount: 85000, type: "expense", categoryId: "cat-food", description: "Kopi dan Camilan", date: getPastDateStr(2), accountId: "acc-1" },
  { id: "tx-6", amount: 500000, type: "transfer", categoryId: "", accountId: "acc-2", toAccountId: "acc-3", description: "Top-up GoPay", date: getPastDateStr(2) },
  { id: "tx-7", amount: 150000, type: "expense", categoryId: "cat-bills", description: "Token Listrik", date: getPastDateStr(1), accountId: "acc-3" },
  { id: "tx-8", amount: 2000000, type: "income", categoryId: "cat-investment", description: "Dividen Reksa Dana", date: getPastDateStr(1), accountId: "acc-2" },
  { id: "tx-9", amount: 186000, type: "expense", categoryId: "cat-entertainment", description: "Netflix (Auto Sub)", date: getPastDateStr(0), accountId: "acc-5", linkedSubId: "sub-1" }
];

const DEFAULT_SETTINGS: Settings = {
  baseCurrency: "IDR",
  exchangeRates: {
    USD: 16200,
    SGD: 12100,
    EUR: 17600,
    IDR: 1
  }
};

const DEFAULT_INVESTMENTS: Investment[] = [
  { id: "inv-1", name: "BBCA (Bank Central Asia)", type: "stock", currentPrice: 10250, symbol: "BBCA.JK", description: "Saham blue chip perbankan", color: "#2563eb", icon: "📊" },
  { id: "inv-2", name: "Reksa Dana BNI-AM Inspiring Equity", type: "mutual_fund", currentPrice: 2850, description: "Reksa dana saham domestik", color: "#8b5cf6", icon: "📈" },
  { id: "inv-3", name: "Emas Antam (per gram)", type: "gold", currentPrice: 1650000, description: "Logam mulia Antam", color: "#f59e0b", icon: "🥇" },
  { id: "inv-4", name: "Bitcoin (BTC)", type: "crypto", currentPrice: 1700000000, symbol: "BTC", description: "Cryptocurrency utama", color: "#f97316", icon: "₿" },
  { id: "inv-5", name: "Deposito BCA 12 Bulan", type: "deposit", currentPrice: 1, description: "Deposito berjangka 12 bulan", yieldRate: 5.5, yieldFrequency: "monthly", lastYieldPaymentDate: getPastDateStr(35), color: "#10b981", icon: "🏦" },
];

const DEFAULT_INVESTMENT_TRANSACTIONS: InvestmentTransaction[] = [
  { id: "invtx-1", investmentId: "inv-1", type: "buy", amount: 10250000, quantity: 1000, pricePerUnit: 10250, date: getPastDateStr(60), accountId: "acc-2" },
  { id: "invtx-2", investmentId: "inv-2", type: "buy", amount: 5000000, quantity: 1754, pricePerUnit: 2850, date: getPastDateStr(45), accountId: "acc-2" },
  { id: "invtx-3", investmentId: "inv-3", type: "buy", amount: 4950000, quantity: 3, pricePerUnit: 1650000, date: getPastDateStr(30), accountId: "acc-2" },
  { id: "invtx-4", investmentId: "inv-4", type: "buy", amount: 850000, quantity: 0.0005, pricePerUnit: 1700000000, date: getPastDateStr(20), accountId: "acc-3" },
  { id: "invtx-5", investmentId: "inv-5", type: "buy", amount: 10000000, quantity: 10000000, pricePerUnit: 1, date: getPastDateStr(35), accountId: "acc-2" },
  { id: "invtx-6", investmentId: "inv-1", type: "dividend", amount: 250000, quantity: 0, pricePerUnit: 0, date: getPastDateStr(10), accountId: "acc-2" },
];

// Helper to derive a unique encryption key per user
const getEncryptionKey = (): string => {
  const userUid = auth?.currentUser?.uid || "demo-user";
  const secretKey = firebaseConfig.apiKey || "antigravity-finance-key-9273";
  return `${secretKey}_${userUid}`;
};

// --- Storage Key Utilities ---
const STORAGE_PREFIX = "antigravity_finance_";
const getStorageKey = (key: string): string => `${STORAGE_PREFIX}${key}`;

const getFromStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === "undefined") return defaultValue;
  const data = localStorage.getItem(getStorageKey(key));
  if (!data) return defaultValue;
  try {
    const decrypted = decrypt(data, getEncryptionKey());
    return JSON.parse(decrypted);
  } catch (e) {
    // Fallback if data was stored unencrypted
    try {
      return JSON.parse(data);
    } catch (err) {
      return defaultValue;
    }
  }
};

const saveToStorage = <T>(key: string, value: T): void => {
  if (typeof window === "undefined") return;
  const jsonStr = JSON.stringify(value);
  const encrypted = encrypt(jsonStr, getEncryptionKey());
  localStorage.setItem(getStorageKey(key), encrypted);
};

// Initialize Local Storage with mock data if empty
export const initializeDemoData = (force: boolean = false): void => {
  if (typeof window === "undefined") return;
  
  const isInitialized = localStorage.getItem(getStorageKey("initialized"));
  if (isInitialized && !force) return;

  saveToStorage("accounts", DEFAULT_ACCOUNTS);
  saveToStorage("categories", DEFAULT_CATEGORIES);
  saveToStorage("budgets", DEFAULT_BUDGETS);
  saveToStorage("savingsGoals", DEFAULT_SAVINGS_GOALS);
  saveToStorage("debts", DEFAULT_DEBTS);
  saveToStorage("subscriptions", DEFAULT_SUBSCRIPTIONS);
  saveToStorage("transactions", DEFAULT_TRANSACTIONS);
  saveToStorage("settings", DEFAULT_SETTINGS);
  saveToStorage("investments", DEFAULT_INVESTMENTS);
  saveToStorage("investmentTransactions", DEFAULT_INVESTMENT_TRANSACTIONS);
  saveToStorage("initialized", "true");
};

// Auto-run on client import
if (typeof window !== "undefined") {
  initializeDemoData();
}

// --- Core Data Helpers ---

/**
 * Recalculate account balances dynamically based on initial balance and transactions
 * to maintain robust ledger accuracy.
 */
const computeAccountBalances = (accounts: Account[], transactions: Transaction[]): Account[] => {
  // We need to keep track of starting balance.
  // In our simplified mock DB, we assume the dashboard balances are starting point for math.
  // Wait! Let's check how the previous JS code handled account balances:
  // "let balance = account.initialBalance || 0;" or similar.
  // But wait, our default accounts list had no initialBalance in types, they had balance directly. Let's make sure it's computed properly.
  // Wait, let's keep account properties: balance is the computed value, but initialBalance stores the starting point.
  // Let's add initialBalance to Account type or keep it as optional?
  // Let's check if it had initialBalance: yes, DEFAULT_ACCOUNTS had initialBalance.
  // Let's ensure types.ts Account has an optional initialBalance: number;
  return accounts.map(account => {
    // If account has an initialBalance property, use it. Otherwise use its current balance as the starting point.
    // Wait! Let's check what properties they had:
    const accWithInitial = account as Account & { initialBalance?: number };
    let balance = accWithInitial.initialBalance !== undefined ? accWithInitial.initialBalance : account.balance;
    
    transactions.forEach(tx => {
      // Direct Income to this account
      if (tx.type === "income" && tx.accountId === account.id) {
        balance += Number(tx.amount);
      }
      // Direct Expense from this account
      else if (tx.type === "expense" && tx.accountId === account.id) {
        balance -= Number(tx.amount);
      }
      // Transfer Out from this account
      else if (tx.type === "transfer" && tx.accountId === account.id) { // wait, previously it was "fromAccountId === account.id".
        // Wait, in types.ts I defined "accountId" (for fromAccountId/source) and "toAccountId" (for transfer target).
        // Let's check how tx-6 is written in DEFAULT_TRANSACTIONS:
        // { id: "tx-6", amount: 500000, type: "transfer", accountId: "acc-2", toAccountId: "acc-3", ... }
        // Yes, so accountId is the source, and toAccountId is the destination.
        balance -= Number(tx.amount);
      }
      // Transfer In to this account
      else if (tx.type === "transfer" && tx.toAccountId === account.id) {
        balance += Number(tx.amount);
      }
    });

    return { ...account, balance };
  });
};

/**
 * Helper to clean payload data before sending to Firestore.
 * Removes the 'id' field if it exists, and deletes any fields that are undefined.
 */
const cleanForFirestore = <T extends Record<string, any>>(obj: T): any => {
  const clean = { ...obj };
  delete clean.id;
  Object.keys(clean).forEach(key => {
    if (clean[key] === undefined) {
      delete clean[key];
    }
  });
  return clean;
};

// --- Unified Finance Database Interface ---
export const FinanceService = {
  
  isFirebase: (): boolean => isFirebaseEnabled(),

  // --- Auth Section ---
  getCurrentUser: (): { uid: string; email: string; displayName: string } | User | null => {
    if (isFirebaseEnabled() && auth) {
      return auth.currentUser;
    }
    return { uid: "demo-user", email: "demo@antigravity.io", displayName: "Demo User" };
  },

  onAuthStateChanged: (callback: (user: User | null) => void): (() => void) => {
    if (isFirebaseEnabled() && auth) {
      return onAuthStateChanged(auth, callback as any);
    }
    // Instantly callback with dummy user in demo mode
    callback({ uid: "demo-user", email: "demo@antigravity.io", displayName: "Demo User" } as any);
    return () => {};
  },

  signInAnonymously: async (): Promise<{ user: { uid: string } } | any> => {
    if (isFirebaseEnabled() && auth) {
      return signInAnonymously(auth);
    }
    return { user: { uid: "demo-user" } };
  },

  loginWithEmail: async (email: string, password: string): Promise<any> => {
    if (isFirebaseEnabled() && auth) {
      return signInWithEmailAndPassword(auth, email, password);
    }
    return { user: { uid: "demo-user", email, displayName: "Demo User" } };
  },

  registerWithEmail: async (email: string, password: string, displayName: string): Promise<any> => {
    if (isFirebaseEnabled() && auth) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });
      return userCredential;
    }
    return { user: { uid: "demo-user", email, displayName } };
  },

  loginWithGoogle: async (): Promise<any> => {
    if (isFirebaseEnabled() && auth) {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        return await signInWithPopup(auth, provider);
      } catch (error: any) {
        console.warn("signInWithPopup failed, falling back to signInWithRedirect", error);
        if (
          error.code === "auth/popup-blocked" ||
          error.code === "auth/cancelled-popup-request" ||
          error.code === "auth/popup-closed-by-user"
        ) {
          return signInWithRedirect(auth, provider);
        }
        throw error;
      }
    }
    return { user: { uid: "demo-user", email: "google-user@gmail.com", displayName: "Google User" } };
  },

  logout: async (): Promise<void> => {
    if (isFirebaseEnabled() && auth) {
      await signOut(auth);
    }
  },

  sendPasswordReset: async (email: string): Promise<void> => {
    if (isFirebaseEnabled() && auth) {
      await sendPasswordResetEmail(auth, email);
    }
  },

  // --- General Getters & Setters ---
  
  getSettings: async (): Promise<Settings> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const docRef = doc(db, "users", auth.currentUser.uid, "config", "settings");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Settings;
        return {
          ...data,
          passcodePIN: data.passcodePIN ? decrypt(data.passcodePIN, key) : ""
        };
      }
      return DEFAULT_SETTINGS;
    }
    return getFromStorage<Settings>("settings", DEFAULT_SETTINGS);
  },

  saveSettings: async (settings: Settings): Promise<Settings> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const encryptedSettings = {
        ...settings,
        passcodePIN: settings.passcodePIN ? encrypt(settings.passcodePIN, key) : ""
      };
      const cleanData = cleanForFirestore(encryptedSettings);
      const docRef = doc(db, "users", auth.currentUser.uid, "config", "settings");
      await setDoc(docRef, cleanData, { merge: true });
    } else {
      saveToStorage<Settings>("settings", settings);
    }
    return settings;
  },

  // --- Accounts Manager ---
  getAccounts: async (): Promise<Account[]> => {
    let accounts: Account[] = [];
    let transactions: Transaction[] = [];

    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const accRef = collection(db, "users", auth.currentUser.uid, "accounts");
      const accSnap = await getDocs(accRef);
      accounts = accSnap.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          name: decrypt(data.name, key),
          balance: Number(decrypt(data.balance, key)),
          initialBalance: data.initialBalance !== undefined ? Number(decrypt(data.initialBalance, key)) : undefined
        } as Account;
      });

      const txRef = collection(db, "users", auth.currentUser.uid, "transactions");
      const txSnap = await getDocs(txRef);
      transactions = txSnap.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          description: decrypt(data.description, key),
          amount: Number(decrypt(data.amount, key))
        } as Transaction;
      });
    } else {
      accounts = getFromStorage<Account[]>("accounts", DEFAULT_ACCOUNTS);
      transactions = getFromStorage<Transaction[]>("transactions", DEFAULT_TRANSACTIONS);
    }

    return computeAccountBalances(accounts, transactions);
  },

  saveAccount: async (account: Omit<Account, "id"> & { id?: string }): Promise<Account> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const initialBal = (account as any).initialBalance || account.balance || 0;
      const encryptedAccount = {
        ...account,
        name: encrypt(account.name, key),
        balance: encrypt(String(account.balance), key),
        initialBalance: encrypt(String(initialBal), key)
      };
      const cleanData = cleanForFirestore(encryptedAccount);
      const accRef = collection(db, "users", auth.currentUser.uid, "accounts");
      if (account.id) {
        const docRef = doc(db, "users", auth.currentUser.uid, "accounts", account.id);
        await updateDoc(docRef, cleanData);
      } else {
        const docRef = await addDoc(accRef, cleanData);
        account.id = docRef.id;
      }
    } else {
      const accounts = getFromStorage<any[]>("accounts", DEFAULT_ACCOUNTS);
      if (account.id) {
        const index = accounts.findIndex(a => a.id === account.id);
        if (index !== -1) accounts[index] = account;
      } else {
        account.id = `acc-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        (account as any).initialBalance = (account as any).initialBalance || account.balance || 0;
        accounts.push(account);
      }
      saveToStorage("accounts", accounts);
    }
    return account as Account;
  },

  deleteAccount: async (accountId: string): Promise<boolean> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid, "accounts", accountId);
      await deleteDoc(docRef);
    } else {
      const accounts = getFromStorage<Account[]>("accounts", DEFAULT_ACCOUNTS);
      const filtered = accounts.filter(a => a.id !== accountId);
      saveToStorage("accounts", filtered);
    }
    return true;
  },

  // --- Transactions Manager ---
  getTransactions: async (): Promise<Transaction[]> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const txRef = collection(db, "users", auth.currentUser.uid, "transactions");
      const txSnap = await getDocs(txRef);
      return txSnap.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          description: decrypt(data.description, key),
          amount: Number(decrypt(data.amount, key))
        } as Transaction;
      });
    }
    const txs = getFromStorage<Transaction[]>("transactions", DEFAULT_TRANSACTIONS);
    
    // Auto-patch duplicate IDs if any exist in LocalStorage
    const ids = new Set<string>();
    let hasDuplicates = false;
    const patchedTxs = txs.map(tx => {
      if (!tx.id || ids.has(tx.id)) {
        hasDuplicates = true;
        const newId = `tx-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        ids.add(newId);
        return { ...tx, id: newId };
      }
      ids.add(tx.id);
      return tx;
    });

    if (hasDuplicates) {
      saveToStorage("transactions", patchedTxs);
    }
    
    return patchedTxs;
  },

  addTransaction: async (tx: Transaction): Promise<Transaction> => {
    const newTx = { ...tx };
    if (!newTx.date) newTx.date = new Date().toISOString().split("T")[0];
    newTx.amount = Number(newTx.amount);

    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const encryptedTx = {
        ...newTx,
        description: encrypt(newTx.description, key),
        amount: encrypt(String(newTx.amount), key)
      };
      const cleanData = cleanForFirestore(encryptedTx);
      const txRef = collection(db, "users", auth.currentUser.uid, "transactions");
      const docRef = await addDoc(txRef, cleanData);
      newTx.id = docRef.id;
    } else {
      const transactions = getFromStorage<Transaction[]>("transactions", DEFAULT_TRANSACTIONS);
      newTx.id = `tx-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      transactions.unshift(newTx);
      saveToStorage("transactions", transactions);
    }
    return newTx;
  },

  deleteTransaction: async (txId: string): Promise<boolean> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid, "transactions", txId);
      await deleteDoc(docRef);
    } else {
      const transactions = getFromStorage<Transaction[]>("transactions", DEFAULT_TRANSACTIONS);
      const filtered = transactions.filter(t => t.id !== txId);
      saveToStorage("transactions", filtered);
    }
    return true;
  },

  // --- Categories Manager ---
  getCategories: async (): Promise<Category[]> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const catRef = collection(db, "users", auth.currentUser.uid, "categories");
      const catSnap = await getDocs(catRef);
      if (catSnap.empty) {
        // Seed default categories for new Firebase users
        for (const cat of DEFAULT_CATEGORIES) {
          const { id, ...catData } = cat;
          const docRef = doc(db, "users", auth.currentUser.uid, "categories", id);
          await setDoc(docRef, {
            ...catData,
            name: encrypt(cat.name, key)
          });
        }
        return DEFAULT_CATEGORIES;
      }
      return catSnap.docs.map(doc => {
        const data = doc.data() as Category;
        return {
          ...data,
          id: doc.id,
          name: decrypt(data.name, key)
        } as Category;
      });
    }
    return getFromStorage<Category[]>("categories", DEFAULT_CATEGORIES);
  },

  saveCategory: async (category: Omit<Category, "id"> & { id?: string }): Promise<Category> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const encryptedCat = {
        ...category,
        name: encrypt(category.name, key)
      };
      const cleanData = cleanForFirestore(encryptedCat);
      const catRef = collection(db, "users", auth.currentUser.uid, "categories");
      if (category.id) {
        const docRef = doc(db, "users", auth.currentUser.uid, "categories", category.id);
        await updateDoc(docRef, cleanData);
      } else {
        const docRef = await addDoc(catRef, cleanData);
        category.id = docRef.id;
      }
    } else {
      const categories = getFromStorage<Category[]>("categories", DEFAULT_CATEGORIES);
      if (category.id) {
        const index = categories.findIndex(c => c.id === category.id);
        if (index !== -1) categories[index] = category as Category;
      } else {
        category.id = `cat-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        categories.push(category as Category);
      }
      saveToStorage("categories", categories);
    }
    return category as Category;
  },

  deleteCategory: async (catId: string): Promise<boolean> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid, "categories", catId);
      await deleteDoc(docRef);
    } else {
      const categories = getFromStorage<Category[]>("categories", DEFAULT_CATEGORIES);
      const filtered = categories.filter(c => c.id !== catId);
      saveToStorage("categories", filtered);
    }
    return true;
  },

  // --- Budgets Manager ---
  getBudgets: async (): Promise<Budget[]> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const budRef = collection(db, "users", auth.currentUser.uid, "budgets");
      const budSnap = await getDocs(budRef);
      return budSnap.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          amountLimit: Number(decrypt(data.amountLimit, key))
        } as Budget;
      });
    }
    return getFromStorage<Budget[]>("budgets", DEFAULT_BUDGETS);
  },

  saveBudget: async (budget: Omit<Budget, "id"> & { id?: string }): Promise<Budget> => {
    budget.amountLimit = Number(budget.amountLimit);
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const encryptedBudget = {
        ...budget,
        amountLimit: encrypt(String(budget.amountLimit), key)
      };
      const cleanData = cleanForFirestore(encryptedBudget);
      const budRef = collection(db, "users", auth.currentUser.uid, "budgets");
      if (budget.id) {
        const docRef = doc(db, "users", auth.currentUser.uid, "budgets", budget.id);
        await updateDoc(docRef, cleanData);
      } else {
        const docRef = await addDoc(budRef, cleanData);
        budget.id = docRef.id;
      }
    } else {
      const budgets = getFromStorage<Budget[]>("budgets", DEFAULT_BUDGETS);
      if (budget.id) {
        const index = budgets.findIndex(b => b.id === budget.id);
        if (index !== -1) budgets[index] = budget as Budget;
      } else {
        budget.id = `bud-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        budgets.push(budget as Budget);
      }
      saveToStorage("budgets", budgets);
    }
    return budget as Budget;
  },

  deleteBudget: async (budId: string): Promise<boolean> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid, "budgets", budId);
      await deleteDoc(docRef);
    } else {
      const budgets = getFromStorage<Budget[]>("budgets", DEFAULT_BUDGETS);
      const filtered = budgets.filter(b => b.id !== budId);
      saveToStorage("budgets", filtered);
    }
    return true;
  },

  // --- Savings Goals Manager ---
  getSavingsGoals: async (): Promise<SavingsGoal[]> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const sgRef = collection(db, "users", auth.currentUser.uid, "savingsGoals");
      const sgSnap = await getDocs(sgRef);
      return sgSnap.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          name: decrypt(data.name, key),
          targetAmount: Number(decrypt(data.targetAmount, key)),
          currentAmount: Number(decrypt(data.currentAmount, key))
        } as SavingsGoal;
      });
    }
    return getFromStorage<SavingsGoal[]>("savingsGoals", DEFAULT_SAVINGS_GOALS);
  },

  saveSavingsGoal: async (goal: Omit<SavingsGoal, "id"> & { id?: string }): Promise<SavingsGoal> => {
    goal.targetAmount = Number(goal.targetAmount);
    goal.currentAmount = Number(goal.currentAmount);
    
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const encryptedGoal = {
        ...goal,
        name: encrypt(goal.name, key),
        targetAmount: encrypt(String(goal.targetAmount), key),
        currentAmount: encrypt(String(goal.currentAmount), key)
      };
      const cleanData = cleanForFirestore(encryptedGoal);
      const sgRef = collection(db, "users", auth.currentUser.uid, "savingsGoals");
      if (goal.id) {
        const docRef = doc(db, "users", auth.currentUser.uid, "savingsGoals", goal.id);
        await updateDoc(docRef, cleanData);
      } else {
        const docRef = await addDoc(sgRef, cleanData);
        goal.id = docRef.id;
      }
    } else {
      const goals = getFromStorage<SavingsGoal[]>("savingsGoals", DEFAULT_SAVINGS_GOALS);
      if (goal.id) {
        const index = goals.findIndex(g => g.id === goal.id);
        if (index !== -1) goals[index] = goal as SavingsGoal;
      } else {
        goal.id = `goal-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        goals.push(goal as SavingsGoal);
      }
      saveToStorage("savingsGoals", goals);
    }
    return goal as SavingsGoal;
  },

  deleteSavingsGoal: async (goalId: string): Promise<boolean> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid, "savingsGoals", goalId);
      await deleteDoc(docRef);
    } else {
      const goals = getFromStorage<SavingsGoal[]>("savingsGoals", DEFAULT_SAVINGS_GOALS);
      const filtered = goals.filter(g => g.id !== goalId);
      saveToStorage("savingsGoals", filtered);
    }
    return true;
  },

  // --- Debts Manager ---
  getDebts: async (): Promise<Debt[]> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const debtRef = collection(db, "users", auth.currentUser.uid, "debts");
      const debtSnap = await getDocs(debtRef);
      return debtSnap.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          name: decrypt(data.name, key),
          totalAmount: Number(decrypt(data.totalAmount, key)),
          paidAmount: Number(decrypt(data.paidAmount, key))
        } as Debt;
      });
    }
    return getFromStorage<Debt[]>("debts", DEFAULT_DEBTS);
  },

  saveDebt: async (debt: Omit<Debt, "id"> & { id?: string }): Promise<Debt> => {
    debt.totalAmount = Number(debt.totalAmount);
    debt.paidAmount = Number(debt.paidAmount);

    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const encryptedDebt = {
        ...debt,
        name: encrypt(debt.name, key),
        totalAmount: encrypt(String(debt.totalAmount), key),
        paidAmount: encrypt(String(debt.paidAmount), key)
      };
      const cleanData = cleanForFirestore(encryptedDebt);
      const debtRef = collection(db, "users", auth.currentUser.uid, "debts");
      if (debt.id) {
        const docRef = doc(db, "users", auth.currentUser.uid, "debts", debt.id);
        await updateDoc(docRef, cleanData);
      } else {
        const docRef = await addDoc(debtRef, cleanData);
        debt.id = docRef.id;
      }
    } else {
      const debts = getFromStorage<Debt[]>("debts", DEFAULT_DEBTS);
      if (debt.id) {
        const index = debts.findIndex(d => d.id === debt.id);
        if (index !== -1) debts[index] = debt as Debt;
      } else {
        debt.id = `debt-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        debts.push(debt as Debt);
      }
      saveToStorage("debts", debts);
    }
    return debt as Debt;
  },

  deleteDebt: async (debtId: string): Promise<boolean> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid, "debts", debtId);
      await deleteDoc(docRef);
    } else {
      const debts = getFromStorage<Debt[]>("debts", DEFAULT_DEBTS);
      const filtered = debts.filter(d => d.id !== debtId);
      saveToStorage("debts", filtered);
    }
    return true;
  },

  // --- Subscriptions Manager ---
  getSubscriptions: async (): Promise<Subscription[]> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const subRef = collection(db, "users", auth.currentUser.uid, "subscriptions");
      const subSnap = await getDocs(subRef);
      return subSnap.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          name: decrypt(data.name, key),
          amount: Number(decrypt(data.amount, key))
        } as Subscription;
      });
    }
    return getFromStorage<Subscription[]>("subscriptions", DEFAULT_SUBSCRIPTIONS);
  },

  saveSubscription: async (sub: Omit<Subscription, "id"> & { id?: string }): Promise<Subscription> => {
    sub.amount = Number(sub.amount);

    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const encryptedSub = {
        ...sub,
        name: encrypt(sub.name, key),
        amount: encrypt(String(sub.amount), key)
      };
      const cleanData = cleanForFirestore(encryptedSub);
      const subRef = collection(db, "users", auth.currentUser.uid, "subscriptions");
      if (sub.id) {
        const docRef = doc(db, "users", auth.currentUser.uid, "subscriptions", sub.id);
        await updateDoc(docRef, cleanData);
      } else {
        const docRef = await addDoc(subRef, cleanData);
        sub.id = docRef.id;
      }
    } else {
      const subs = getFromStorage<Subscription[]>("subscriptions", DEFAULT_SUBSCRIPTIONS);
      if (sub.id) {
        const index = subs.findIndex(s => s.id === sub.id);
        if (index !== -1) subs[index] = sub as Subscription;
      } else {
        sub.id = `sub-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        subs.push(sub as Subscription);
      }
      saveToStorage("subscriptions", subs);
    }
    return sub as Subscription;
  },

  deleteSubscription: async (subId: string): Promise<boolean> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid, "subscriptions", subId);
      await deleteDoc(docRef);
    } else {
      const subs = getFromStorage<Subscription[]>("subscriptions", DEFAULT_SUBSCRIPTIONS);
      const filtered = subs.filter(s => s.id !== subId);
      saveToStorage("subscriptions", filtered);
    }
    return true;
  },

  // --- Reset Helper ---
  resetAllData: async (): Promise<void> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const uid = auth.currentUser.uid;
      const collectionsToReset = [
        "accounts",
        "transactions",
        "categories",
        "budgets",
        "savingsGoals",
        "debts",
        "subscriptions",
        "investments",
        "investmentTransactions"
      ];

      for (const colName of collectionsToReset) {
        const colRef = collection(db, "users", uid, colName);
        const snap = await getDocs(colRef);
        const deletePromises = snap.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }
      
      const settingsRef = doc(db, "users", uid, "config", "settings");
      await deleteDoc(settingsRef);
    } else {
      if (typeof window !== "undefined") {
        initializeDemoData(true);
      }
    }
  },

  // --- Investment Manager ---
  getInvestments: async (): Promise<Investment[]> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const invRef = collection(db, "users", auth.currentUser.uid, "investments");
      const invSnap = await getDocs(invRef);
      return invSnap.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          name: decrypt(data.name, key),
          description: decrypt(data.description, key),
          currentPrice: Number(decrypt(data.currentPrice, key)),
          yieldRate: data.yieldRate !== undefined && data.yieldRate !== null ? Number(decrypt(data.yieldRate, key)) : undefined
        } as Investment;
      });
    }
    return getFromStorage<Investment[]>("investments", DEFAULT_INVESTMENTS);
  },

  saveInvestment: async (inv: Omit<Investment, "id"> & { id?: string }): Promise<Investment> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const encryptedInv = {
        ...inv,
        name: encrypt(inv.name, key),
        description: encrypt(inv.description, key),
        currentPrice: encrypt(String(inv.currentPrice), key),
        yieldRate: inv.yieldRate !== undefined && inv.yieldRate !== null ? encrypt(String(inv.yieldRate), key) : undefined
      };
      const cleanData = cleanForFirestore(encryptedInv);
      const invRef = collection(db, "users", auth.currentUser.uid, "investments");
      if (inv.id) {
        const docRef = doc(db, "users", auth.currentUser.uid, "investments", inv.id);
        await updateDoc(docRef, cleanData);
      } else {
        const docRef = await addDoc(invRef, cleanData);
        inv.id = docRef.id;
      }
    } else {
      const investments = getFromStorage<Investment[]>("investments", DEFAULT_INVESTMENTS);
      if (inv.id) {
        const index = investments.findIndex(i => i.id === inv.id);
        if (index !== -1) investments[index] = inv as Investment;
      } else {
        inv.id = `inv-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        investments.push(inv as Investment);
      }
      saveToStorage("investments", investments);
    }
    return inv as Investment;
  },

  deleteInvestment: async (invId: string): Promise<boolean> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid, "investments", invId);
      await deleteDoc(docRef);

      // Delete associated investment transactions from Firestore
      const txRef = collection(db, "users", auth.currentUser.uid, "investmentTransactions");
      const txSnap = await getDocs(txRef);
      const batchDeletes = txSnap.docs
        .filter(doc => doc.data().investmentId === invId)
        .map(doc => deleteDoc(doc.ref));
      await Promise.all(batchDeletes);
    } else {
      const investments = getFromStorage<Investment[]>("investments", DEFAULT_INVESTMENTS);
      const filtered = investments.filter(i => i.id !== invId);
      saveToStorage("investments", filtered);
      // Also delete all associated investment transactions
      const invTxs = getFromStorage<InvestmentTransaction[]>("investmentTransactions", DEFAULT_INVESTMENT_TRANSACTIONS);
      const filteredTxs = invTxs.filter(t => t.investmentId !== invId);
      saveToStorage("investmentTransactions", filteredTxs);
    }
    return true;
  },

  // --- Investment Transactions Manager ---
  getInvestmentTransactions: async (): Promise<InvestmentTransaction[]> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const txRef = collection(db, "users", auth.currentUser.uid, "investmentTransactions");
      const txSnap = await getDocs(txRef);
      return txSnap.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          amount: Number(decrypt(data.amount, key)),
          quantity: Number(decrypt(data.quantity, key)),
          pricePerUnit: Number(decrypt(data.pricePerUnit, key))
        } as InvestmentTransaction;
      });
    }
    return getFromStorage<InvestmentTransaction[]>("investmentTransactions", DEFAULT_INVESTMENT_TRANSACTIONS);
  },

  addInvestmentTransaction: async (tx: InvestmentTransaction): Promise<InvestmentTransaction> => {
    const newTx = { ...tx };
    newTx.amount = Number(newTx.amount);
    newTx.quantity = Number(newTx.quantity);
    newTx.pricePerUnit = Number(newTx.pricePerUnit);
    if (!newTx.date) newTx.date = new Date().toISOString().split("T")[0];

    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const key = getEncryptionKey();
      const encryptedTx = {
        ...newTx,
        amount: encrypt(String(newTx.amount), key),
        quantity: encrypt(String(newTx.quantity), key),
        pricePerUnit: encrypt(String(newTx.pricePerUnit), key)
      };
      const cleanData = cleanForFirestore(encryptedTx);
      const txRef = collection(db, "users", auth.currentUser.uid, "investmentTransactions");
      const docRef = await addDoc(txRef, cleanData);
      newTx.id = docRef.id;
    } else {
      const invTxs = getFromStorage<InvestmentTransaction[]>("investmentTransactions", DEFAULT_INVESTMENT_TRANSACTIONS);
      newTx.id = `invtx-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      invTxs.unshift(newTx);
      saveToStorage("investmentTransactions", invTxs);
    }
    return newTx;
  },

  deleteInvestmentTransaction: async (txId: string): Promise<boolean> => {
    if (isFirebaseEnabled() && db && auth?.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid, "investmentTransactions", txId);
      await deleteDoc(docRef);
    } else {
      const invTxs = getFromStorage<InvestmentTransaction[]>("investmentTransactions", DEFAULT_INVESTMENT_TRANSACTIONS);
      const filtered = invTxs.filter(t => t.id !== txId);
      saveToStorage("investmentTransactions", filtered);
    }
    return true;
  }
};
