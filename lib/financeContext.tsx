"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { FinanceService } from "./financeService";
import { 
  Account, Transaction, Category, Budget, SavingsGoal, 
  Debt, Subscription, Settings, InAppNotification, FinanceContextType,
  Investment, InvestmentTransaction 
} from "./types";

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<Settings>({ baseCurrency: "IDR", exchangeRates: { IDR: 1 } });
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>([]);
  const [hideBalances, setHideBalances] = useState<boolean>(false);

  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hide_balances");
      if (saved === "true") {
        setHideBalances(true);
      }
    }
  }, []);

  const toggleHideBalances = () => {
    setHideBalances(prev => {
      const nextVal = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("hide_balances", String(nextVal));
      }
      return nextVal;
    });
  };

  // Load all data on mount
  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [accs, txs, cats, buds, sgs, dbs, subs, sets, invs, invTxs] = await Promise.all([
        FinanceService.getAccounts(),
        FinanceService.getTransactions(),
        FinanceService.getCategories(),
        FinanceService.getBudgets(),
        FinanceService.getSavingsGoals(),
        FinanceService.getDebts(),
        FinanceService.getSubscriptions(),
        FinanceService.getSettings(),
        FinanceService.getInvestments(),
        FinanceService.getInvestmentTransactions()
      ]);

      setAccounts(accs);
      setTransactions(txs);
      setCategories(cats);
      setBudgets(buds);
      setSavingsGoals(sgs);
      setDebts(dbs);
      setSubscriptions(subs);
      setSettings(sets);
      setInvestments(invs);
      setInvestmentTransactions(invTxs);
      
      // Run automatic subscription checks on load
      checkRecurringBills(subs, txs, accs);
      // Run budget threshold warning checks on load
      checkBudgetThresholds(buds, txs, cats, sets);
      // Run auto-yield simulation for fixed-income investments
      checkAutoYield(invs, invTxs);
      // Run daily exchange rates check on load
      checkDailyExchangeRates(sets);
    } catch (error) {
      console.error("Failed to load financial records:", error);
      pushNotification("Gagal menyinkronkan data dengan penyimpanan.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Monitor Firebase Auth State Changes
  useEffect(() => {
    const unsubscribe = FinanceService.onAuthStateChanged((usr) => {
      setUser(usr);
      setAuthLoading(false);
      if (usr) {
        refreshData();
      } else {
        // Clear all data on logout
        setAccounts([]);
        setTransactions([]);
        setCategories([]);
        setBudgets([]);
        setSavingsGoals([]);
        setDebts([]);
        setSubscriptions([]);
        setInvestments([]);
        setInvestmentTransactions([]);
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Notification System ---
  const pushNotification = (message: string, type: 'info' | 'success' | 'warning' | 'error' = "info") => {
    const id = `noti-${Date.now()}`;
    const newNoti: InAppNotification = { id, message, type, date: new Date().toLocaleTimeString() };
    
    // Add to in-app notification state
    setNotifications(prev => [newNoti, ...prev]);

    // System Push Notification (Option 2 choice)
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("Keuangan Dashboard", {
        body: message,
        icon: "/icon.png" // Fallback icon path
      });
    }

    // Auto-dismiss toaster notification after 4 seconds (within 3 - 5 seconds range)
    setTimeout(() => {
      clearNotification(id);
    }, 4000);
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // --- Multi-Currency Converter ---
  const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string): number => {
    if (fromCurrency === toCurrency) return amount;
    const rates = settings.exchangeRates || { USD: 16200, IDR: 1 };
    
    // Convert to IDR base first, then to target
    const amountInBase = fromCurrency === "IDR" ? amount : amount * (rates[fromCurrency] || 1);
    const amountInTarget = toCurrency === "IDR" ? amountInBase : amountInBase / (rates[toCurrency] || 1);
    
    return Number(amountInTarget.toFixed(2));
  };

  // Format currency value neatly
  const formatCurrency = (amount: number, currency: string = "IDR"): string => {
    if (hideBalances) {
      return currency === "IDR" ? "Rp ••••••" : `${currency} ••••••`;
    }
    const locale = currency === "IDR" ? "id-ID" : "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: currency === "IDR" ? 0 : 2
    }).format(amount);
  };

  // Check and update exchange rates silently once a day
  const checkDailyExchangeRates = async (currentSettings: Settings) => {
    const today = new Date().toISOString().split("T")[0];
    if (
      currentSettings.autoExchangeRatesEnabled !== false &&
      currentSettings.lastExchangeRatesFetchDate !== today
    ) {
      try {
        const response = await fetch("https://open.er-api.com/v6/latest/IDR");
        if (!response.ok) return;
        const data = await response.json();
        if (data && data.rates) {
          const usdRateFromApi = data.rates.USD;
          const sgdRateFromApi = data.rates.SGD;
          const eurRateFromApi = data.rates.EUR;
          
          if (usdRateFromApi && sgdRateFromApi && eurRateFromApi) {
            const usd = Math.round(1 / usdRateFromApi);
            const sgd = Math.round(1 / sgdRateFromApi);
            const eur = Math.round(1 / eurRateFromApi);
            
            const updatedSettings: Settings = {
              ...currentSettings,
              exchangeRates: {
                ...currentSettings.exchangeRates,
                USD: usd,
                SGD: sgd,
                EUR: eur,
                IDR: 1
              },
              lastExchangeRatesFetchDate: today
            };
            
            await FinanceService.saveSettings(updatedSettings);
            setSettings(updatedSettings);
            console.log("Daily exchange rates successfully updated silently.");
          }
        }
      } catch (err) {
        console.error("Failed to fetch daily exchange rates silently:", err);
      }
    }
  };

  // --- Custom UX Verification Checks ---
  
  // 1. Subscription & Bill Hub Checker
  const checkRecurringBills = async (subs: Subscription[], txs: Transaction[], accs: Account[]) => {
    const today = new Date().toISOString().split("T")[0];
    const newTransactionsToAdd: Omit<Transaction, "id">[] = [];

    for (const sub of subs) {
      if (sub.nextDueDate && sub.nextDueDate <= today) {
        if (sub.type === "auto") {
          // Auto log the payment
          const paymentTx: Omit<Transaction, "id"> = {
            amount: sub.amount,
            type: "expense",
            categoryId: sub.categoryId || "cat-bills",
            description: `${sub.name} (Tagihan Berulang)`,
            date: today,
            accountId: sub.accountId,
            linkedSubId: sub.id
          };
          
          newTransactionsToAdd.push(paymentTx);
          pushNotification(`Tagihan otomatis ${sub.name} sebesar ${formatCurrency(sub.amount, "IDR")} telah dicatat.`, "success");
        } else {
          // Manual prompt
          pushNotification(`Tagihan ${sub.name} sebesar ${formatCurrency(sub.amount, "IDR")} jatuh tempo hari ini!`, "warning");
        }

        // Calculate next billing date (add 1 month)
        const nextDate = new Date(sub.nextDueDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
        const nextDueDateStr = nextDate.toISOString().split("T")[0];
        
        // Update subscription record
        await FinanceService.saveSubscription({ ...sub, nextDueDate: nextDueDateStr });
      }
    }

    if (newTransactionsToAdd.length > 0) {
      for (const tx of newTransactionsToAdd) {
        await FinanceService.addTransaction(tx as any);
      }
      // Reload states
      const updatedTxs = await FinanceService.getTransactions();
      const updatedAccs = await FinanceService.getAccounts();
      setTransactions(updatedTxs);
      setAccounts(updatedAccs);
    }
  };

  // 2. Budget Alert System
  const checkBudgetThresholds = (buds: Budget[], txs: Transaction[], cats: Category[], sets: Settings) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    buds.forEach(bud => {
      // Calculate spent for this category this month
      const spent = txs
        .filter(tx => {
          if (tx.type !== "expense" || tx.categoryId !== bud.categoryId) return false;
          const txDate = new Date(tx.date);
          return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
        })
        .reduce((sum, tx) => {
          // Convert transaction currency to base currency before comparing
          const amountInBase = convertCurrency(tx.amount, tx.currency || "IDR", sets.baseCurrency || "IDR");
          return sum + amountInBase;
        }, 0);

      const limit = bud.amountLimit;
      const cat = cats.find(c => c.id === bud.categoryId);
      const catName = cat ? cat.name : "Kategori";

      if (spent >= limit) {
        pushNotification(`Anggaran ${catName} telah MELEBIHI batas! Terpakai ${formatCurrency(spent, sets.baseCurrency)} dari limit ${formatCurrency(limit, sets.baseCurrency)}`, "error");
      } else if (spent >= limit * 0.85) {
        pushNotification(`Anggaran ${catName} mendekati batas (85% terpakai).`, "warning");
      }
    });
  };

  // --- CRUD Wrappers with State Updates ---

  const addTransaction = async (tx: Omit<Transaction, "id">, linkOptions: { savingsGoalId?: string; debtId?: string; autoAllocate?: boolean; allocations?: { goalId: string; percent: number }[] } = {}): Promise<Transaction> => {
    const newTx = await FinanceService.addTransaction(tx as any);
    
    // Handle Savings Goal integration check
    if (linkOptions.savingsGoalId) {
      const goal = savingsGoals.find(g => g.id === linkOptions.savingsGoalId);
      if (goal) {
        // If expense, it means adding funds, if income, it means withdrawing
        const factor = tx.type === "expense" || tx.type === "transfer" ? 1 : -1;
        const newGoalAmount = goal.currentAmount + (tx.amount * factor);
        await FinanceService.saveSavingsGoal({ ...goal, currentAmount: newGoalAmount });
      }
    }

    // Handle Debt/Loan payment integration check
    if (linkOptions.debtId) {
      const debt = debts.find(d => d.id === linkOptions.debtId);
      if (debt) {
        const factor = 1; // Payment always adds to paidAmount
        const newPaidAmount = debt.paidAmount + (tx.amount * factor);
        const status = newPaidAmount >= debt.totalAmount ? "paid" : "active";
        await FinanceService.saveDebt({ ...debt, paidAmount: newPaidAmount, status });
      }
    }

    // Handle Custom Multi-Target Salary Allocation split
    if (
      tx.type === "income" &&
      tx.categoryId === "cat-salary" &&
      linkOptions.allocations &&
      linkOptions.allocations.length > 0
    ) {
      let totalAllocatedAmount = 0;
      for (const alloc of linkOptions.allocations) {
        const targetGoal = savingsGoals.find(g => g.id === alloc.goalId);
        if (targetGoal && alloc.percent > 0) {
          const allocAmount = Math.round(tx.amount * (alloc.percent / 100));
          if (allocAmount > 0) {
            const companionTx: Omit<Transaction, "id"> = {
              amount: allocAmount,
              type: "expense",
              categoryId: "cat-investment",
              description: `Penyisihan Gaji Otomatis (${alloc.percent}%) ke ${targetGoal.name}`,
              date: tx.date || new Date().toISOString().split("T")[0],
              accountId: tx.accountId,
              linkedSavingsGoalId: targetGoal.id
            };
            await FinanceService.addTransaction(companionTx as any);
            const newGoalAmount = targetGoal.currentAmount + allocAmount;
            await FinanceService.saveSavingsGoal({ ...targetGoal, currentAmount: newGoalAmount });
            totalAllocatedAmount += allocAmount;
          }
        }
      }
      if (totalAllocatedAmount > 0) {
        pushNotification(
          `Dana berhasil dialokasikan: ${formatCurrency(totalAllocatedAmount, "IDR")} disisihkan ke target tabungan Anda.`, 
          "success"
        );
      }
    }


    // Push local success message
    const formattedAmount = formatCurrency(tx.amount, tx.currency || "IDR");
    pushNotification(`Transaksi "${tx.description}" (${formattedAmount}) berhasil dicatat.`, "success");
    
    // Refresh to update accounts balance dynamically
    await refreshData();
    return newTx;
  };

  const deleteTransaction = async (id: string) => {
    await FinanceService.deleteTransaction(id);
    pushNotification("Transaksi berhasil dihapus.", "info");
    await refreshData();
  };

  const saveAccount = async (account: Omit<Account, "id"> & { id?: string }) => {
    await FinanceService.saveAccount(account);
    pushNotification(`Rekening "${account.name}" berhasil disimpan.`, "success");
    await refreshData();
  };

  const deleteAccount = async (id: string) => {
    await FinanceService.deleteAccount(id);
    pushNotification("Rekening berhasil dihapus.", "info");
    await refreshData();
  };

  const saveCategory = async (cat: Omit<Category, "id"> & { id?: string }) => {
    await FinanceService.saveCategory(cat);
    pushNotification(`Kategori "${cat.name}" berhasil disimpan.`, "success");
    await refreshData();
  };

  const deleteCategory = async (id: string) => {
    await FinanceService.deleteCategory(id);
    pushNotification("Kategori berhasil dihapus.", "info");
    await refreshData();
  };

  const saveBudget = async (bud: Omit<Budget, "id"> & { id?: string }) => {
    await FinanceService.saveBudget(bud);
    pushNotification("Limit anggaran berhasil disetel.", "success");
    await refreshData();
  };

  const deleteBudget = async (id: string) => {
    await FinanceService.deleteBudget(id);
    pushNotification("Anggaran berhasil dihapus.", "info");
    await refreshData();
  };

  const saveSavingsGoal = async (goal: Omit<SavingsGoal, "id"> & { id?: string }) => {
    await FinanceService.saveSavingsGoal(goal);
    pushNotification(`Tabungan Target "${goal.name}" berhasil diperbarui.`, "success");
    await refreshData();
  };

  const deleteSavingsGoal = async (id: string) => {
    await FinanceService.deleteSavingsGoal(id);
    pushNotification("Target tabungan berhasil dihapus.", "info");
    await refreshData();
  };

  const saveDebt = async (debt: Omit<Debt, "id"> & { id?: string }) => {
    await FinanceService.saveDebt(debt);
    pushNotification(`Catatan utang "${debt.name}" berhasil diperbarui.`, "success");
    await refreshData();
  };

  const deleteDebt = async (id: string) => {
    await FinanceService.deleteDebt(id);
    pushNotification("Catatan utang berhasil dihapus.", "info");
    await refreshData();
  };

  const saveSubscription = async (sub: Omit<Subscription, "id"> & { id?: string }) => {
    await FinanceService.saveSubscription(sub);
    pushNotification(`Langganan "${sub.name}" berhasil disimpan.`, "success");
    await refreshData();
  };

  const deleteSubscription = async (id: string) => {
    await FinanceService.deleteSubscription(id);
    pushNotification("Langganan berhasil dihapus.", "info");
    await refreshData();
  };

  const saveSettings = async (sets: Settings) => {
    await FinanceService.saveSettings(sets);
    pushNotification("Pengaturan berhasil disimpan.", "success");
    await refreshData();
  };

  const resetAllData = async () => {
    await FinanceService.resetAllData();
    await refreshData();
    pushNotification("Seluruh data simulasi telah di-reset.", "info");
  };

  // --- Auto-Yield Simulation Engine ---
  const checkAutoYield = async (invs: Investment[], invTxs: InvestmentTransaction[]) => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    for (const inv of invs) {
      if (!inv.yieldRate || inv.yieldRate <= 0) continue;
      if (!['deposit', 'bond', 'p2p'].includes(inv.type)) continue;

      // Calculate the principal from buy transactions
      const buyTxs = invTxs.filter(t => t.investmentId === inv.id && t.type === 'buy');
      const totalPrincipal = buyTxs.reduce((sum, t) => sum + t.amount, 0);
      if (totalPrincipal <= 0) continue;

      const lastPayment = inv.lastYieldPaymentDate ? new Date(inv.lastYieldPaymentDate) : null;
      if (!lastPayment) continue;

      const freq = inv.yieldFrequency || 'monthly';
      const msPerPeriod = freq === 'monthly' ? 30 * 24 * 60 * 60 * 1000 : 365 * 24 * 60 * 60 * 1000;
      const elapsed = today.getTime() - lastPayment.getTime();

      if (elapsed >= msPerPeriod) {
        const periodsElapsed = Math.floor(elapsed / msPerPeriod);
        const divisor = freq === 'monthly' ? 12 : 1;
        const interestPerPeriod = Math.round(totalPrincipal * (inv.yieldRate / 100) / divisor);

        for (let i = 0; i < periodsElapsed; i++) {
          const payDate = new Date(lastPayment.getTime() + (i + 1) * msPerPeriod);
          const payDateStr = payDate.toISOString().split("T")[0];

          // Find an associated account from the first buy transaction
          const sourceAccountId = buyTxs[0]?.accountId;

          const interestTx: Omit<InvestmentTransaction, 'id'> = {
            investmentId: inv.id,
            type: 'interest',
            amount: interestPerPeriod,
            quantity: 0,
            pricePerUnit: 0,
            date: payDateStr,
            accountId: sourceAccountId
          };
          await FinanceService.addInvestmentTransaction(interestTx as any);

          // Create companion income transaction in main cashflow
          if (sourceAccountId) {
            await FinanceService.addTransaction({
              amount: interestPerPeriod,
              type: 'income',
              categoryId: 'cat-investment',
              description: `Bunga Otomatis: ${inv.name} (${inv.yieldRate}% p.a.)`,
              date: payDateStr,
              accountId: sourceAccountId,
              linkedInvTxId: inv.id
            } as any);
          }
        }

        // Update the last yield payment date on the investment
        const newLastDate = new Date(lastPayment.getTime() + periodsElapsed * msPerPeriod).toISOString().split("T")[0];
        await FinanceService.saveInvestment({ ...inv, lastYieldPaymentDate: newLastDate });

        pushNotification(
          `Bunga otomatis ${inv.name}: ${formatCurrency(interestPerPeriod * periodsElapsed, "IDR")} (${periodsElapsed} periode) telah dicatat.`,
          "success"
        );
      }
    }
  };

  // --- Investment CRUD Wrappers ---
  const saveInvestment = async (inv: Omit<Investment, 'id'> & { id?: string }) => {
    await FinanceService.saveInvestment(inv);
    pushNotification(`Aset investasi "${inv.name}" berhasil disimpan.`, "success");
    await refreshData();
  };

  const deleteInvestment = async (id: string) => {
    await FinanceService.deleteInvestment(id);
    pushNotification("Aset investasi berhasil dihapus.", "info");
    await refreshData();
  };

  const addInvestmentTransaction = async (tx: Omit<InvestmentTransaction, 'id'>) => {
    const newInvTx = await FinanceService.addInvestmentTransaction(tx as any);

    // Companion cashflow sync: create a linked transaction in the main ledger
    if (tx.accountId) {
      const inv = investments.find(i => i.id === tx.investmentId);
      const invName = inv?.name || 'Investasi';

      if (tx.type === 'buy') {
        // Debit from account (expense)
        await FinanceService.addTransaction({
          amount: tx.amount,
          type: 'expense',
          categoryId: 'cat-investment',
          description: `Pembelian ${invName} (${tx.quantity} unit @ ${tx.pricePerUnit})`,
          date: tx.date || new Date().toISOString().split("T")[0],
          accountId: tx.accountId,
          linkedInvTxId: newInvTx.id
        } as any);
      } else if (tx.type === 'sell') {
        // Credit to account (income)
        await FinanceService.addTransaction({
          amount: tx.amount,
          type: 'income',
          categoryId: 'cat-investment',
          description: `Penjualan ${invName} (${tx.quantity} unit @ ${tx.pricePerUnit})`,
          date: tx.date || new Date().toISOString().split("T")[0],
          accountId: tx.accountId,
          linkedInvTxId: newInvTx.id
        } as any);
      } else if (tx.type === 'dividend' || tx.type === 'interest') {
        // Credit to account (income)
        await FinanceService.addTransaction({
          amount: tx.amount,
          type: 'income',
          categoryId: 'cat-investment',
          description: `${tx.type === 'dividend' ? 'Dividen' : 'Bunga'} dari ${invName}`,
          date: tx.date || new Date().toISOString().split("T")[0],
          accountId: tx.accountId,
          linkedInvTxId: newInvTx.id
        } as any);
      }
    }

    const typeLabels: Record<string, string> = { buy: 'Pembelian', sell: 'Penjualan', dividend: 'Dividen', interest: 'Bunga' };
    pushNotification(`Transaksi investasi (${typeLabels[tx.type] || tx.type}) berhasil dicatat.`, "success");
    await refreshData();
  };

  const deleteInvestmentTransaction = async (id: string) => {
    // Also remove companion cashflow transaction
    const allTxs = await FinanceService.getTransactions();
    const companion = allTxs.find(t => t.linkedInvTxId === id);
    if (companion && companion.id) {
      await FinanceService.deleteTransaction(companion.id);
    }
    await FinanceService.deleteInvestmentTransaction(id);
    pushNotification("Transaksi investasi berhasil dihapus.", "info");
    await refreshData();
  };

  const loginWithEmail = async (email: string, password: string) => {
    return FinanceService.loginWithEmail(email, password);
  };

  const registerWithEmail = async (email: string, password: string, displayName: string) => {
    return FinanceService.registerWithEmail(email, password, displayName);
  };

  const loginWithGoogle = async () => {
    return FinanceService.loginWithGoogle();
  };

  const logout = async () => {
    return FinanceService.logout();
  };

  const forgotPassword = async (email: string) => {
    await FinanceService.sendPasswordReset(email);
    pushNotification("Permintaan reset kata sandi telah diproses.", "info");
  };

  return (
    <FinanceContext.Provider
      value={{
        user,
        authLoading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        forgotPassword,
        accounts,
        transactions,
        categories,
        budgets,
        savingsGoals,
        debts,
        subscriptions,
        settings,
        notifications,
        hideBalances,
        toggleHideBalances,
        isLoading,
        isQuickAddOpen,
        setIsQuickAddOpen,
        refreshData,
        pushNotification,
        clearNotification,
        clearAllNotifications,
        convertCurrency,
        formatCurrency,
        addTransaction,
        deleteTransaction,
        saveAccount,
        deleteAccount,
        saveCategory,
        deleteCategory,
        saveBudget,
        deleteBudget,
        saveSavingsGoal,
        deleteSavingsGoal,
        saveDebt,
        deleteDebt,
        saveSubscription,
        deleteSubscription,
        saveSettings,
        resetAllData,
        investments,
        investmentTransactions,
        saveInvestment,
        deleteInvestment,
        addInvestmentTransaction,
        deleteInvestmentTransaction
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error("useFinance must be used within a FinanceProvider");
  }
  return context;
}
