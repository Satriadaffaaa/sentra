"use client";

import React, { useState, useEffect, useRef } from "react";
import { useFinance } from "@/lib/financeContext";
import { X, Keyboard, Plus, ArrowRightLeft, Sparkles, Check, Calculator } from "lucide-react";
import { Account, Category, Transaction } from "@/lib/types";
import styles from "./QuickAddModal.module.css";
import { formatNumberWithSeparator, parseFormattedNumber } from "@/lib/formatHelpers";

interface QuickAddModalProps {
  onClose: () => void;
}

interface ParsedPreview {
  type: "expense" | "income" | "transfer";
  amount: number;
  description: string;
  category: Category | null;
  account: Account | null;
  fromAccount: Account | null;
  toAccount: Account | null;
  error: string | null;
}

export default function QuickAddModal({ onClose }: QuickAddModalProps) {
  const { 
    accounts, 
    categories, 
    savingsGoals, 
    debts,
    addTransaction, 
    formatCurrency,
    settings,
    transactions
  } = useFinance();

  const [activeTab, setActiveTab] = useState<"smart" | "visual">("smart");
  
  // --- Tab 1: Smart Parsing State ---
  const [smartText, setSmartText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ParsedPreview | null>(null);
  const [smartType, setSmartType] = useState<"auto" | "expense" | "income" | "transfer">("auto");


  // --- Autocomplete Dropdown State ---
  const [dropdownType, setDropdownType] = useState<"category" | "account" | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [dropdownIndex, setDropdownIndex] = useState(0);
  const [wordStart, setWordStart] = useState(0);
  const [wordEnd, setWordEnd] = useState(0);
  const [applySalaryAllocation, setApplySalaryAllocation] = useState(true);
  
  // --- Tab 2: Visual Form State ---
  const [txType, setTxType] = useState<"expense" | "income" | "transfer">("expense");
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  
  // Interconnected Linkage Options
  const [linkTarget, setLinkTarget] = useState<"" | "savings" | "debt">("");
  const [linkedGoalId, setLinkedGoalId] = useState("");
  const [linkedDebtId, setLinkedDebtId] = useState("");
  const [shouldAutoTransact, setShouldAutoTransact] = useState(true);
  const [customAllocations, setCustomAllocations] = useState<Record<string, number>>({});

  // Keypad Calculator state
  const [calcDisplay, setCalcDisplay] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);

  const smartInputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    if (activeTab === "smart" && smartInputRef.current) {
      smartInputRef.current.focus();
    }
  }, [activeTab]);

  // Set default account and category
  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
      setFromAccountId(accounts[0].id);
      if (accounts.length > 1) {
        setToAccountId(accounts[1].id);
      }
    }
    if (categories.length > 0 && !categoryId) {
      const expCat = categories.find(c => c.type === "expense");
      setCategoryId(expCat ? expCat.id : categories[0].id);
    }
  }, [accounts, categories, accountId, categoryId]);

  // Initialize custom allocations based on savings goals
  useEffect(() => {
    if (savingsGoals.length > 0) {
      const initial: Record<string, number> = {};
      savingsGoals.forEach(g => {
        initial[g.id] = 0;
      });
      setCustomAllocations(initial);
    }
  }, [savingsGoals]);

  // --- Smart Parsing Engine (NLP Simulation) ---
  useEffect(() => {
    if (activeTab !== "smart" || !smartText.trim()) {
      setParsedPreview(null);
      return;
    }

    const text = smartText.trim();
    
    const parsed: ParsedPreview = {
      type: "expense",
      amount: 0,
      description: "",
      category: null,
      account: null,
      fromAccount: null,
      toAccount: null,
      error: null
    };

    // 1. Determine Transaction Type
    if (smartType !== "auto") {
      parsed.type = smartType;
    } else {
      const lowerText = text.toLowerCase();
      const isTransfer = lowerText.includes("transfer") || lowerText.includes("kirim") || lowerText.includes("pindah") || lowerText.includes("mutasi");
      const isIncome = lowerText.includes("gaji") || lowerText.includes("bonus") || lowerText.includes("income") || lowerText.includes("+") || lowerText.includes("pemasukan");
      
      if (isTransfer) {
        parsed.type = "transfer";
      } else if (isIncome) {
        parsed.type = "income";
      } else {
        parsed.type = "expense";
      }
    }

    // Helper: Parse numerical abbreviations (50k, 1.5m, 2jt, etc.)
    const parseAmount = (str: string) => {
      let cleaned = str.replace(/rp\.?/i, "").replace(/\$/g, "").trim().toLowerCase();
      if (!cleaned) return 0;
      
      let multiplier = 1;
      if (cleaned.endsWith("k")) {
        multiplier = 1000;
        cleaned = cleaned.slice(0, -1);
      } else if (cleaned.endsWith("jt") || cleaned.endsWith("m") || cleaned.endsWith("juta")) {
        multiplier = 1000000;
        if (cleaned.endsWith("juta")) cleaned = cleaned.slice(0, -4);
        else cleaned = cleaned.slice(0, -2);
      }
      
      if (multiplier === 1) {
        cleaned = cleaned.replace(/[.,]/g, "");
      } else {
        cleaned = cleaned.replace(",", ".");
      }
      
      const num = parseFloat(cleaned);
      if (isNaN(num)) return 0;
      return Math.round(num * multiplier);
    };

    // 2. Define Category and Account Aliases (Indonesian Friendly)
    const categoryAliases: Record<string, string[]> = {
      "cat-food": ["makan", "minum", "kopi", "food", "kuliner", "resto", "restoran", "cafe", "warung", "bakso", "mie", "nasi", "sarapan", "snack", "camilan", "starbucks", "indomaret", "alfamart", "jajan", "cemilan", "susu", "kulineran", "kopi pagi", "kopi susu"],
      "cat-transport": ["transport", "transportasi", "bensin", "ojek", "gojek", "grab", "taksi", "taxi", "mrt", "busway", "krl", "parkir", "toll", "tol", "go-car", "grabcar", "go-ride", "grabride", "lrt", "commuter", "fuel", "pertalite", "pertamax"],
      "cat-shopping": ["belanja", "shopping", "baju", "celana", "sepatu", "tokopedia", "shopee", "lazada", "mall", "supermarket", "beli", "toko", "olshop", "minimarket", "pasar"],
      "cat-salary": ["gaji", "income", "pendapatan", "salary", "upah", "honor", "bonus", "sampingan", "payday", "payroll", "proyek", "fee", "omset", "omzet"],
      "cat-bills": ["tagihan", "listrik", "pln", "air", "pdam", "wifi", "internet", "indihome", "pulsa", "kuota", "langganan", "kos", "kontrakan", "token", "bpjs", "asuransi"],
      "cat-entertainment": ["hiburan", "entertainment", "nonton", "bioskop", "netflix", "spotify", "game", "steam", "topup", "karaoke", "traveling", "jalan-jalan", "cinema", "xxi", "rekreasi", "liburan", "healing"],
      "cat-investment": ["investasi", "investment", "saham", "reksadana", "reksa dana", "crypto", "emas", "deposito", "bond", "obligasi", "p2p", "bibit", "bareksa", "pluang", "dividen", "bunga", "yield"],
      "cat-others": ["lain", "others", "nyasar", "lain-lain"]
    };

    const accountAliases: Record<string, string[]> = {
      "acc-1": ["tunai", "cash", "dompet", "kantong", "pegangan"],
      "acc-2": ["bca", "bank bca", "bca bank"],
      "acc-3": ["gopay", "go-pay", "gopi", "go pay"],
      "acc-4": ["mandiri", "usd", "mandiri usd"],
      "acc-5": ["kartu kredit", "cc", "credit card", "kk", "limit", "utang kk"]
    };

    const getCategoryAliases = (cat: Category): string[] => {
      const staticAliases = categoryAliases[cat.id] || [];
      const dynamicAliases = [cat.name.toLowerCase()];
      cat.name.toLowerCase().split(/[^a-z0-9]/).forEach(word => {
        if (word.length > 2) dynamicAliases.push(word);
      });
      return Array.from(new Set([...staticAliases, ...dynamicAliases])).sort((a, b) => b.length - a.length);
    };

    const getAccountAliases = (acc: Account): string[] => {
      const staticAliases = accountAliases[acc.id] || [];
      const dynamicAliases = [acc.name.toLowerCase()];
      acc.name.toLowerCase().split(/[^a-z0-9]/).forEach(word => {
        if (word.length > 2) dynamicAliases.push(word);
      });
      return Array.from(new Set([...staticAliases, ...dynamicAliases])).sort((a, b) => b.length - a.length);
    };

    // 3. Tokenize Words and Identify Explicit Tags
    const words = text.split(/\s+/);
    let categoryTagged = false;
    let accountTagged = false;
    let fromAccountTagged = false;
    let toAccountTagged = false;
    let amountFound = false;

    // We will collect words that form the description
    const descWords: string[] = [];

    // Explicit Tag Extraction Loop
    words.forEach(word => {
      if (word.startsWith("#")) {
        const catSlug = word.slice(1).toLowerCase();
        const foundCat = categories.find(c => 
          c.name.toLowerCase().replace(/\s+/g, "").includes(catSlug) || 
          c.id.toLowerCase().includes(catSlug)
        );
        if (foundCat) {
          parsed.category = foundCat;
          categoryTagged = true;
        }
      } 
      else if (word.startsWith("@")) {
        const accSlug = word.slice(1).toLowerCase();
        const foundAcc = accounts.find(a => 
          a.name.toLowerCase().replace(/\s+/g, "").includes(accSlug) || 
          a.id.toLowerCase().includes(accSlug)
        );
        if (foundAcc) {
          if (parsed.type === "transfer") {
            if (!parsed.fromAccount) {
              parsed.fromAccount = foundAcc;
              fromAccountTagged = true;
            } else if (!parsed.toAccount) {
              parsed.toAccount = foundAcc;
              toAccountTagged = true;
            }
          } else {
            parsed.account = foundAcc;
            accountTagged = true;
          }
        }
      }
      else if (/[0-9]/.test(word) && !amountFound) {
        // Parse numerical amount
        parsed.amount = parseAmount(word);
        if (parsed.amount > 0) amountFound = true;
      }
      else {
        // Keep in description for now
        descWords.push(word);
      }
    });

    // 4. Natural NLP / Preposition Parsing on Remaining Words
    // We clean the text for matching
    const remainingText = descWords.join(" ");
    const normalizedText = " " + remainingText.toLowerCase().replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim() + " ";

    // Helper functions for checking word boundary matches
    const hasWordBoundary = (fullText: string, word: string) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(fullText);
    };

    const findPrepTarget = (fullText: string, prep: string, aliases: string[]): string | null => {
      for (const alias of aliases) {
        const escapedPrep = prep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedPrep}\\s+${escapedAlias}\\b`, 'i');
        if (regex.test(fullText)) {
          return alias;
        }
      }
      return null;
    };

    // Preposition matching for Accounts (if not explicitly tagged with @)
    if (parsed.type === "transfer") {
      // 1. From account
      if (!fromAccountTagged) {
        for (const acc of accounts) {
          const aliases = getAccountAliases(acc);
          const matchedAlias = findPrepTarget(normalizedText, "dari", aliases);
          if (matchedAlias) {
            parsed.fromAccount = acc;
            fromAccountTagged = true;
            break;
          }
        }
      }
      // 2. To account
      if (!toAccountTagged) {
        for (const acc of accounts) {
          const aliases = getAccountAliases(acc);
          const matchedAlias = findPrepTarget(normalizedText, "ke", aliases);
          if (matchedAlias) {
            parsed.toAccount = acc;
            toAccountTagged = true;
            break;
          }
        }
      }
    } else {
      // Single Account (for income/expense)
      if (!accountTagged) {
        // Look for: pakai/dengan/menggunakan/via/dari
        const preps = ["pakai", "dengan", "menggunakan", "via", "dari", "ke"];
        let found = false;
        for (const prep of preps) {
          for (const acc of accounts) {
            const aliases = getAccountAliases(acc);
            const matchedAlias = findPrepTarget(normalizedText, prep, aliases);
            if (matchedAlias) {
              parsed.account = acc;
              accountTagged = true;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
    }

    // Preposition matching for Categories (if not explicitly tagged with #)
    if (parsed.type !== "transfer" && !categoryTagged) {
      const preps = ["untuk", "kategori", "buat"];
      let found = false;
      for (const prep of preps) {
        for (const cat of categories) {
          const aliases = getCategoryAliases(cat);
          const matchedAlias = findPrepTarget(normalizedText, prep, aliases);
          if (matchedAlias) {
            parsed.category = cat;
            categoryTagged = true;
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    // 5. Fallback General Scanning (Implicit detection without prepositions)
    if (parsed.type === "transfer") {
      // Find any unmatched accounts
      accounts.forEach(acc => {
        const aliases = getAccountAliases(acc);
        const hasAlias = aliases.some(alias => hasWordBoundary(normalizedText, alias));
        if (hasAlias) {
          if (!parsed.fromAccount) {
            parsed.fromAccount = acc;
          } else if (!parsed.toAccount && parsed.fromAccount.id !== acc.id) {
            parsed.toAccount = acc;
          }
        }
      });
    } else {
      // For expense/income, check account
      if (!parsed.account) {
        for (const acc of accounts) {
          const aliases = getAccountAliases(acc);
          const hasAlias = aliases.some(alias => hasWordBoundary(normalizedText, alias));
          if (hasAlias) {
            parsed.account = acc;
            break;
          }
        }
      }
      // Check category
      if (!parsed.category) {
        for (const cat of categories) {
          const aliases = getCategoryAliases(cat);
          const hasAlias = aliases.some(alias => hasWordBoundary(normalizedText, alias));
          if (hasAlias) {
            parsed.category = cat;
            break;
          }
        }
      }
    }

    // 6. Clean Description Text (Strip connector words, matched accounts, amount, and category prep triggers)
    let cleanedDesc = remainingText;

    const connectorsToStrip = [
      "dari", "ke", "pakai", "menggunakan", "dengan", "via", "untuk", "kategori", "buat",
      "transfer", "kirim", "pindah", "mutasi", "gaji", "bonus", "income", "pemasukan", "rp", "rupiah"
    ];

    const finalDescWords = cleanedDesc.split(/\s+/).filter(word => {
      const lowerWord = word.toLowerCase().replace(/[^a-z0-9]/g, "");
      
      if (connectorsToStrip.includes(lowerWord)) return false;

      let isAccountWord = false;
      const matchedAccounts = parsed.type === "transfer" 
        ? [parsed.fromAccount, parsed.toAccount]
        : [parsed.account];
        
      matchedAccounts.forEach(acc => {
        if (!acc) return;
        const aliases = getAccountAliases(acc);
        if (aliases.some(alias => alias.split(/\s+/).includes(lowerWord) || lowerWord === acc.name.toLowerCase().replace(/[^a-z0-9]/g, ""))) {
          isAccountWord = true;
        }
      });
      if (isAccountWord) return false;

      return true;
    });

    parsed.description = finalDescWords.join(" ").trim() || (parsed.type === "transfer" ? "Transfer Saldo" : "Transaksi Baru");

    // 7. Fallback Defaults
    if (!parsed.category && parsed.type !== "transfer") {
      parsed.category = categories.find(c => c.type === parsed.type) || categories[0];
    }
    if (!parsed.account && parsed.type !== "transfer") {
      parsed.account = accounts[0];
    }
    if (parsed.type === "transfer") {
      if (!parsed.fromAccount) parsed.fromAccount = accounts[0];
      if (!parsed.toAccount) parsed.toAccount = accounts[1] || accounts[0];
    }

    setParsedPreview(parsed);
  }, [smartText, categories, accounts, transactions, activeTab, smartType]);

  // Handle Smart Submit
  const handleSmartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedPreview || parsedPreview.amount <= 0) return;

    const allocations = Object.entries(customAllocations)
      .filter(([_, pct]) => pct > 0)
      .map(([goalId, percent]) => ({ goalId, percent }));

    const totalPercent = allocations.reduce((sum, a) => sum + a.percent, 0);
    if (totalPercent > 100) return; // Prevent submitting invalid allocation

    const tx: Omit<Transaction, "id"> = {
      amount: parsedPreview.amount,
      type: parsedPreview.type,
      description: parsedPreview.description,
      date: new Date().toISOString().split("T")[0],
      categoryId: parsedPreview.type === "transfer" ? "" : (parsedPreview.category?.id || ""),
      accountId: parsedPreview.type === "transfer" 
        ? (parsedPreview.fromAccount?.id || "") 
        : (parsedPreview.account?.id || ""),
      ...(parsedPreview.type === "transfer" ? { toAccountId: parsedPreview.toAccount?.id || "" } : {})
    };

    await addTransaction(tx, { 
      allocations: parsedPreview.type === "income" && parsedPreview.category?.id === "cat-salary" ? allocations : undefined,
      autoAllocate: false
    });
    onClose();
  };

  // --- Visual Calculator Keypad Logic ---
  const handleKeypadPress = (val: string) => {
    if (val === "C") {
      setCalcDisplay("");
      setAmountStr("");
    } else if (val === "⌫") {
      setCalcDisplay(prev => prev.slice(0, -1));
    } else if (val === "=") {
      try {
        const cleanExpression = calcDisplay.replace(/[^0-9+\-*/.]/g, "");
        const res = Function(`"use strict"; return (${cleanExpression})`)();
        if (res !== undefined && !isNaN(res)) {
          setAmountStr(Math.round(res).toString());
          setCalcDisplay(Math.round(res).toString());
        }
      } catch (e) {
        setCalcDisplay("Error");
      }
    } else {
      if (["+", "-", "*", "/"].includes(val) && ["+", "-", "*", "/"].includes(calcDisplay.slice(-1))) {
        return;
      }
      const newDisplay = calcDisplay + val;
      setCalcDisplay(newDisplay);
      
      if (!isNaN(Number(val)) || val === ".") {
        try {
          const cleanExpression = newDisplay.replace(/[^0-9+\-*/.]/g, "");
          const res = Function(`"use strict"; return (${cleanExpression})`)();
          if (res !== undefined && !isNaN(res)) {
            setAmountStr(Math.round(res).toString());
          }
        } catch (e) {}
      }
    }
  };

  // Handle Visual Submit
  const handleVisualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(amountStr);
    if (amount <= 0) return;

    const tx: Omit<Transaction, "id"> = {
      amount,
      type: txType,
      description: description || (txType === "transfer" ? "Transfer Saldo" : "Transaksi Manual"),
      date: txDate,
      categoryId: txType === "transfer" ? "" : categoryId,
      accountId: txType === "transfer" ? fromAccountId : accountId,
      ...(txType === "transfer" ? { toAccountId } : {})
    };

    const linkOptions: { savingsGoalId?: string; debtId?: string; autoAllocate?: boolean; allocations?: { goalId: string; percent: number }[] } = {};

    if (txType !== "transfer") {
      if (linkTarget === "savings" && linkedGoalId) {
        linkOptions.savingsGoalId = linkedGoalId;
      } else if (linkTarget === "debt" && linkedDebtId) {
        linkOptions.debtId = linkedDebtId;
      }
      
      if (txType === "income" && categoryId === "cat-salary") {
        const allocations = Object.entries(customAllocations)
          .filter(([_, pct]) => pct > 0)
          .map(([goalId, percent]) => ({ goalId, percent }));
        
        const totalPercent = allocations.reduce((sum, a) => sum + a.percent, 0);
        if (totalPercent > 100) return; // Prevent submitting invalid allocation
        
        linkOptions.allocations = allocations;
        linkOptions.autoAllocate = false;
      }
    }

    await addTransaction(tx, linkOptions);
    onClose();
  };

  // --- Autocomplete Dropdown & Chip Helpers ---
  const getWordAtPosition = (text: string, pos: number) => {
    let start = pos - 1;
    while (start >= 0 && !/\s/.test(text[start])) {
      start--;
    }
    start++;
    
    let end = pos;
    while (end < text.length && !/\s/.test(text[end])) {
      end++;
    }
    
    return {
      word: text.slice(start, end),
      start,
      end
    };
  };

  const checkAutocomplete = (text: string, pos: number) => {
    if (!text) {
      setDropdownType(null);
      return;
    }

    const { word, start, end } = getWordAtPosition(text, pos);
    
    if (word.startsWith("#")) {
      setDropdownType("category");
      setDropdownSearch(word.slice(1));
      setWordStart(start);
      setWordEnd(end);
      setDropdownIndex(0);
    } else if (word.startsWith("@")) {
      setDropdownType("account");
      setDropdownSearch(word.slice(1));
      setWordStart(start);
      setWordEnd(end);
      setDropdownIndex(0);
    } else {
      setDropdownType(null);
    }
  };

  const handleSmartTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSmartText(val);
    checkAutocomplete(val, e.target.selectionStart || 0);
  };

  const handleSmartInputClickOrKeyUp = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    checkAutocomplete(target.value, target.selectionStart || 0);
  };

  const selectAutocompleteItem = (name: string) => {
    if (!smartInputRef.current) return;
    
    const cleanName = name.replace(/\s+/g, "");
    const tag = dropdownType === "category" ? "#" : "@";
    const replacement = `${tag}${cleanName}`;
    
    const prefix = smartText.slice(0, wordStart);
    const suffix = smartText.slice(wordEnd);
    
    const newText = prefix + replacement + " " + suffix;
    setSmartText(newText);
    setDropdownType(null);
    
    const newCursorPos = wordStart + replacement.length + 1;
    setTimeout(() => {
      if (smartInputRef.current) {
        smartInputRef.current.focus();
        smartInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const getFilteredDropdownItems = () => {
    if (dropdownType === "category") {
      return categories.filter(c => 
        c.name.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        c.name.toLowerCase().replace(/\s+/g, "").includes(dropdownSearch.toLowerCase())
      );
    }
    if (dropdownType === "account") {
      return accounts.filter(a => 
        a.name.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        a.name.toLowerCase().replace(/\s+/g, "").includes(dropdownSearch.toLowerCase())
      );
    }
    return [];
  };

  const filteredItems = getFilteredDropdownItems();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (dropdownType && filteredItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setDropdownIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setDropdownIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selectedItem = filteredItems[dropdownIndex];
        if (selectedItem) {
          selectAutocompleteItem(selectedItem.name);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDropdownType(null);
      }
    }
  };

  const handleChipClick = (type: "category" | "account", name: string) => {
    const cleanName = name.replace(/\s+/g, "").toLowerCase();
    
    setSmartText(prev => {
      const trimmed = prev.trim();
      const currentType = smartType !== "auto" ? smartType : (parsedPreview?.type || "expense");
      
      if (!trimmed) {
        if (type === "category") {
          const defaultAcc = accounts[0] ? accounts[0].name.toLowerCase().replace(/\s+/g, "") : "cash";
          return `50k [deskripsi] #${cleanName} @${defaultAcc} `;
        } else {
          if (currentType === "transfer") {
            return `500k transfer dari @${cleanName} ke @`;
          } else {
            return `50k [deskripsi] @${cleanName} `;
          }
        }
      }
      
      if (type === "category") {
        if (/#\S+/.test(trimmed)) {
          return trimmed.replace(/#\S+/, `#${cleanName}`) + " ";
        }
        return `${trimmed} #${cleanName} `;
      } else {
        if (currentType === "transfer") {
          const matches = [...trimmed.matchAll(/@\S+/g)];
          if (matches.length >= 2) {
            const secondMatch = matches[1];
            const start = secondMatch.index!;
            const end = start + secondMatch[0].length;
            return trimmed.substring(0, start) + `@${cleanName}` + trimmed.substring(end) + " ";
          }
          
          const hasFromAccount = trimmed.includes("@") || trimmed.toLowerCase().includes("dari");
          if (hasFromAccount) {
            const hasToPreposition = trimmed.toLowerCase().endsWith("ke");
            if (hasToPreposition) {
              return `${trimmed} @${cleanName} `;
            }
            return `${trimmed} ke @${cleanName} `;
          }
          return `${trimmed} dari @${cleanName} `;
        } else {
          if (/@\S+/.test(trimmed)) {
            return trimmed.replace(/@\S+/, `@${cleanName}`) + " ";
          }
          return `${trimmed} @${cleanName} `;
        }
      }
    });
    
    setTimeout(() => {
      if (smartInputRef.current) {
        smartInputRef.current.focus();
        const value = smartInputRef.current.value;
        const descIndex = value.indexOf("[deskripsi]");
        if (descIndex !== -1) {
          smartInputRef.current.setSelectionRange(descIndex, descIndex + "[deskripsi]".length);
        } else {
          smartInputRef.current.setSelectionRange(value.length, value.length);
        }
      }
    }, 50);
  };

  // Generate suggestions based on available accounts & categories
  const getSuggestions = () => {
    const list = [];
    const firstAcc = accounts[0];
    const secondAcc = accounts[1] || accounts[0];
    
    const accSlug = firstAcc ? firstAcc.name.toLowerCase().split(/[^\w]/)[0] : "cash";
    const toAccSlug = secondAcc ? secondAcc.name.toLowerCase().split(/[^\w]/)[0] : "bca";

    if (smartType === "auto" || smartType === "expense") {
      const firstExpCat = categories.find(c => c.type === "expense");
      const expCatSlug = firstExpCat ? firstExpCat.name.toLowerCase().split(/[^\w]/)[0] : "food";
      list.push({
        text: `50k makan bakso pakai ${accSlug}`,
        desc: `Pengeluaran alami: Rp 50.000 kategori Makanan dari dompet ${firstAcc?.name || "Cash"}`
      });
      list.push({
        text: `150k bayar wifi #${expCatSlug} @${accSlug}`,
        desc: `Gunakan simbol manual: Rp 150.000 dengan kategori dan rekening manual`
      });
    }

    if (smartType === "auto" || smartType === "income") {
      const firstIncCat = categories.find(c => c.type === "income");
      const incCatSlug = firstIncCat ? firstIncCat.name.toLowerCase().split(/[^\w]/)[0] : "salary";
      list.push({
        text: `10jt gaji bulanan ke ${accSlug}`,
        desc: `Pemasukan alami: Rp 10.000.000 masuk ke ${firstAcc?.name || "rekening"}`
      });
      list.push({
        text: `1.5jt bonus proyek #${incCatSlug} @${accSlug}`,
        desc: `Gunakan simbol manual: Rp 1.500.000 kategori Gaji ke ${firstAcc?.name || "rekening"}`
      });
    }

    if (smartType === "auto" || smartType === "transfer") {
      list.push({
        text: `500k transfer dari ${accSlug} ke ${toAccSlug}`,
        desc: `Transfer alami: Kirim Rp 500.000 dari ${firstAcc?.name || "BCA"} ke ${secondAcc?.name || "GoPay"}`
      });
      list.push({
        text: `200k @${accSlug} @${toAccSlug}`,
        desc: `Gunakan simbol manual: Kirim Rp 200.000 dari ${firstAcc?.name || "BCA"} ke ${secondAcc?.name || "GoPay"}`
      });
    }

    return list;
  };

  const suggestions = getSuggestions();

  // Get categories sorted by transaction frequency, excluding investments
  const getSortedHelperCategories = () => {
    const counts: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.categoryId) {
        counts[t.categoryId] = (counts[t.categoryId] || 0) + 1;
      }
    });
    return [...categories]
      .filter(c => c.id !== "cat-investment")
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
  };

  // Get active cash accounts, excluding investment accounts
  const getSortedHelperAccounts = () => {
    return accounts.filter(a => a.type !== "investment");
  };

  const handleRedirectToInvestments = () => {
    onClose();
    window.location.href = "/investments";
  };

  const totalPercent = Object.values(customAllocations).reduce((sum, v) => sum + v, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${styles.quickAddCard} ${activeTab === "visual" && showCalculator ? styles.expanded : ""}`} onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div className={styles.tabTriggers}>
            <button 
              type="button"
              className={`${styles.tabBtn} ${activeTab === "smart" ? styles.active : ""}`}
              onClick={() => setActiveTab("smart")}
            >
              <Sparkles size={16} />
              Smart Input
            </button>
            <button 
              type="button"
              className={`${styles.tabBtn} ${activeTab === "visual" ? styles.active : ""}`}
              onClick={() => setActiveTab("visual")}
            >
              <Keyboard size={16} />
              Visual Form
            </button>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tab 1: Smart Parsing */}
        {activeTab === "smart" && (
          <form onSubmit={handleSmartSubmit} className={styles.tabPane}>
            
            {/* Forced-Type Toggle */}
            <div className={styles.smartTypeSelector}>
              <button 
                type="button" 
                className={`${styles.smartTypeBtn} ${smartType === "auto" ? styles.activeAuto : ""}`}
                onClick={() => setSmartType("auto")}
              >
                <Sparkles size={13} />
                Auto-Deteksi
              </button>
              <button 
                type="button" 
                className={`${styles.smartTypeBtn} ${smartType === "expense" ? styles.activeExpense : ""}`}
                onClick={() => setSmartType("expense")}
              >
                🔴 Pengeluaran
              </button>
              <button 
                type="button" 
                className={`${styles.smartTypeBtn} ${smartType === "income" ? styles.activeIncome : ""}`}
                onClick={() => setSmartType("income")}
              >
                🟢 Pemasukan
              </button>
              <button 
                type="button" 
                className={`${styles.smartTypeBtn} ${smartType === "transfer" ? styles.activeTransfer : ""}`}
                onClick={() => setSmartType("transfer")}
              >
                🔵 Transfer
              </button>
            </div>

            <div className={styles.smartInputContainer} style={{ position: "relative" }}>
              <input
                ref={smartInputRef}
                type="text"
                className={styles.smartTextInput}
                placeholder={
                  smartType === "expense" 
                    ? "Contoh: 45k makan bakso pakai gopay atau #food @gopay" 
                    : smartType === "income" 
                    ? "Contoh: 10jt gaji bulanan ke bca atau #salary @bca" 
                    : smartType === "transfer" 
                    ? "Contoh: 500k dari bca ke gopay atau @bca @gopay" 
                    : "Contoh: 45k kopi starbucks #food @cash atau pakai bahasa alami"
                }
                value={smartText}
                onChange={handleSmartTextChange}
                onClick={handleSmartInputClickOrKeyUp}
                onKeyUp={handleSmartInputClickOrKeyUp}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
              <span className={styles.smartHint}>
                {smartType === "transfer" ? (
                  <>
                    Ketik nominal dan nama rekening. Sistem otomatis mendeteksi arah transfer (misal: <strong>dari bca ke gopay</strong>).
                  </>
                ) : (
                  <>
                    Ketik nominal, lalu tambahkan <strong>kategori</strong> dan <strong>rekening</strong> secara alami atau menggunakan simbol <strong>#</strong> dan <strong>@</strong>.
                  </>
                )}
              </span>

              {/* Visual Parser Board (Live Tagging) */}
              {parsedPreview && (
                <div className={styles.parserTagBoard}>
                  <div className={styles.parserBoardLabel}>
                    <Sparkles size={12} style={{ color: "var(--color-brand)" }} />
                    Hasil Deteksi Sistem (Real-time):
                  </div>
                  
                  {/* Tag 1: Tipe */}
                  <span className={`${styles.parserTag} ${styles[parsedPreview.type]}`}>
                    Tipe: {parsedPreview.type === "expense" ? "🔴 Pengeluaran" : parsedPreview.type === "income" ? "🟢 Pemasukan" : "🔵 Transfer"}
                  </span>
                  
                  {/* Tag 2: Nominal */}
                  <span className={`${styles.parserTag} ${styles.amount} ${parsedPreview.amount > 0 ? styles.hasValue : styles.missing}`}>
                    Nominal: {parsedPreview.amount > 0 ? formatCurrency(parsedPreview.amount, "IDR") : "❓ Rp 0"}
                  </span>
                  
                  {/* Tag 3: Kategori atau Detail Transfer */}
                  {parsedPreview.type !== "transfer" ? (
                    <span className={`${styles.parserTag} ${styles.category} ${parsedPreview.category ? styles.hasValue : styles.missing}`}>
                      Kategori: {parsedPreview.category ? `${parsedPreview.category.icon} ${parsedPreview.category.name}` : "❓ Pilih Kategori"}
                    </span>
                  ) : null}
                  
                  {/* Tag 4: Akun / Rekening */}
                  {parsedPreview.type === "transfer" ? (
                    <>
                      <span className={`${styles.parserTag} ${styles.account} ${parsedPreview.fromAccount ? styles.hasValue : styles.missing}`}>
                        Dari: {parsedPreview.fromAccount ? `${parsedPreview.fromAccount.icon} ${parsedPreview.fromAccount.name}` : "❓ Rekening Asal"}
                      </span>
                      <span className={`${styles.parserTag} ${styles.account} ${parsedPreview.toAccount ? styles.hasValue : styles.missing}`}>
                        Ke: {parsedPreview.toAccount ? `${parsedPreview.toAccount.icon} ${parsedPreview.toAccount.name}` : "❓ Rekening Tujuan"}
                      </span>
                    </>
                  ) : (
                    <span className={`${styles.parserTag} ${styles.account} ${parsedPreview.account ? styles.hasValue : styles.missing}`}>
                      Dompet: {parsedPreview.account ? `${parsedPreview.account.icon} ${parsedPreview.account.name}` : "❓ Rekening"}
                    </span>
                  )}
                </div>
              )}

              {/* Smart Redirect Banner for Investments */}
              {(smartText.toLowerCase().includes("investasi") || 
                parsedPreview?.category?.id === "cat-investment") && (
                <div className={styles.redirectBanner}>
                  <span>
                    💡 Transaksi investasi sebaiknya dicatat langsung di halaman portofolio untuk mendukung pencatatan unit asset & yield engine.
                  </span>
                  <button 
                    type="button" 
                    className={styles.redirectLink}
                    onClick={handleRedirectToInvestments}
                  >
                    Buka Portofolio &rarr;
                  </button>
                </div>
              )}


              {/* Floating Autocomplete Dropdown */}
              {dropdownType && filteredItems.length > 0 && (
                <div className={styles.autocompleteDropdown}>
                  {filteredItems.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.dropdownItem} ${idx === dropdownIndex ? styles.dropdownItemActive : ""}`}
                      onClick={() => selectAutocompleteItem(item.name)}
                    >
                      <span>{item.icon} {item.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Helper Chips */}
            <div className={styles.quickChipsSection}>
              <span className={styles.chipsLabel}>Kategori Cepat (Terpopuler):</span>
              <div className={styles.quickChipsScroll}>
                {getSortedHelperCategories().map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.helperChip}
                    onClick={() => handleChipClick("category", c.name)}
                  >
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
              
              <span className={styles.chipsLabel} style={{ marginTop: "6px" }}>Rekening Cepat:</span>
              <div className={styles.quickChipsScroll}>
                {getSortedHelperAccounts().map(a => (
                  <button
                    key={a.id}
                    type="button"
                    className={styles.helperChip}
                    onClick={() => handleChipClick("account", a.name)}
                  >
                    {a.icon} {a.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Suggestions List */}
            <div className={styles.suggestionsContainer}>
              <span className={styles.suggestionsLabel}>Saran Input Cepat:</span>
              <div className={styles.suggestionsList}>
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={styles.suggestionBtn}
                    onClick={() => {
                      setSmartText(s.text);
                      if (smartInputRef.current) {
                        smartInputRef.current.focus();
                      }
                    }}
                  >
                    <span className={styles.suggestionText}>{s.text}</span>
                    <span className={styles.suggestionDesc}>{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Parsing Preview Card */}
            {parsedPreview && (
              <div className={styles.parsedPreviewCard}>
                <div className={styles.previewHeader}>
                  <span className={`${styles.badgeType} ${styles[parsedPreview.type] || ""}`}>
                    {parsedPreview.type === "expense" ? "PENGELUARAN" : parsedPreview.type === "income" ? "PEMASUKAN" : "TRANSFER"}
                  </span>
                  <div className={styles.previewAmount}>
                    {formatCurrency(parsedPreview.amount, "IDR")}
                  </div>
                </div>

                <div className={styles.previewDetails}>
                  <div className={styles.previewRow}>
                    <span className={styles.rowLabel}>Deskripsi</span>
                    <span className={`${styles.rowVal} font-semibold`}>{parsedPreview.description}</span>
                  </div>

                  {parsedPreview.type === "transfer" ? (
                    <>
                      <div className={styles.previewRow}>
                        <span className={styles.rowLabel}>Dari Rekening</span>
                        <span className={styles.rowVal}>
                          {parsedPreview.fromAccount?.icon} {parsedPreview.fromAccount?.name}
                        </span>
                      </div>
                      <div className={styles.previewRow}>
                        <span className={styles.rowLabel}>Ke Rekening</span>
                        <span className={styles.rowVal}>
                          {parsedPreview.toAccount?.icon} {parsedPreview.toAccount?.name}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.previewRow}>
                        <span className={styles.rowLabel}>Kategori</span>
                        <span className={styles.rowVal}>
                          {parsedPreview.category?.icon} {parsedPreview.category?.name}
                        </span>
                      </div>
                      <div className={styles.previewRow}>
                        <span className={styles.rowLabel}>Metode Pembayaran</span>
                        <span className={styles.rowVal}>
                          {parsedPreview.account?.icon} {parsedPreview.account?.name}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {parsedPreview.type === "income" && 
                 parsedPreview.category?.id === "cat-salary" && 
                 savingsGoals.length > 0 && (
                  <div className={styles.multiAllocContainer}>
                    <div className={styles.multiAllocHeader}>
                      <span>Alokasi Gaji ke Tabungan Target (Multi-Split):</span>
                      <span className={styles.totalAllocBadge} style={{ color: totalPercent > 100 ? "var(--color-expense)" : "var(--color-income)", fontWeight: "bold" }}>
                        Total: {totalPercent}% / 100%
                      </span>
                    </div>
                    <div className={styles.multiAllocList}>
                      {savingsGoals.map(goal => {
                        const percent = customAllocations[goal.id] || 0;
                        const isChecked = percent > 0;
                        const allocatedAmt = Math.round(parsedPreview.amount * (percent / 100));
                        return (
                          <div key={goal.id} className={styles.multiAllocRow}>
                            <label className={styles.multiAllocLabel}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setCustomAllocations(prev => ({
                                    ...prev,
                                    [goal.id]: e.target.checked ? 10 : 0
                                  }));
                                }}
                                style={{ cursor: "pointer" }}
                              />
                              <span className={styles.goalInfo}>
                                <strong>{"🎯"} {goal.name}</strong>
                                <small style={{ fontSize: "10px", color: "var(--text-muted)" }}>Terisi: {formatCurrency(goal.currentAmount)}</small>
                              </span>
                            </label>
                            <div className={styles.percentInputWrap}>
                              {isChecked && (
                                <>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className={styles.percentField}
                                    value={percent}
                                    onChange={(e) => {
                                      const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                      setCustomAllocations(prev => ({
                                        ...prev,
                                        [goal.id]: val
                                      }));
                                    }}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    style={{ width: "50px", textAlign: "center", border: "1px solid var(--border-color)", borderRadius: "4px" }}
                                  />
                                  <span style={{ fontSize: "12px", fontWeight: "bold" }}>%</span>
                                  {allocatedAmt > 0 && (
                                    <span className={styles.allocValue} style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                      ({formatCurrency(allocatedAmt)})
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {totalPercent > 100 && (
                      <div className={styles.allocError} style={{ color: "var(--color-expense)", fontSize: "11px", fontWeight: "600", marginTop: "6px" }}>
                        ⚠️ Total persentase alokasi melebihi 100%!
                      </div>
                    )}
                  </div>
                )}

                {parsedPreview.amount > 0 ? (
                  <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={totalPercent > 100}>
                    <Check size={18} /> Simpan Transaksi
                  </button>
                ) : (
                  <div className="preview-error text-center text-muted">
                    Masukkan nominal transaksi untuk menyimpan.
                  </div>
                )}
              </div>
            )}
          </form>
        )}

        {/* Tab 2: Visual Form with calculator */}
        {activeTab === "visual" && (
          <form onSubmit={handleVisualSubmit} className={`${styles.tabPane} ${styles.visualFormPane}`}>
            
            {/* Type selector */}
            <div className={styles.typeSelector}>
              <button 
                type="button" 
                className={`${styles.typeBtn} ${styles.expense} ${txType === "expense" ? styles.active : ""}`}
                onClick={() => setTxType("expense")}
              >
                Pengeluaran
              </button>
              <button 
                type="button" 
                className={`${styles.typeBtn} ${styles.income} ${txType === "income" ? styles.active : ""}`}
                onClick={() => setTxType("income")}
              >
                Pemasukan
              </button>
              <button 
                type="button" 
                className={`${styles.typeBtn} ${styles.transfer} ${txType === "transfer" ? styles.active : ""}`}
                onClick={() => setTxType("transfer")}
              >
                Transfer
              </button>
            </div>

            <div className={`${styles.visualFormLayout} ${showCalculator ? styles.hasCalculator : ""}`}>
              
              {/* Amount input with Keypad trigger */}
              <div className="form-group relative">
                <label className="form-label">Nominal (Rp)</label>
                <div className={styles.amountInputWrap}>
                  <input
                    type="text"
                    className={`form-input ${styles.amountField}`}
                    placeholder="0"
                    value={amountStr ? formatNumberWithSeparator(amountStr, "IDR") : ""}
                    onChange={(e) => {
                      const raw = parseFormattedNumber(e.target.value, "IDR").toString();
                      setAmountStr(raw || "");
                    }}
                    required
                  />
                  <button 
                    type="button" 
                    className={`${styles.calcTrigger} ${showCalculator ? styles.active : ""}`}
                    onClick={() => setShowCalculator(!showCalculator)}
                  >
                    <Calculator size={18} />
                  </button>
                </div>
              </div>

              {/* Keypad Calculator directly under Nominal input */}
              {showCalculator && (
                <div className={styles.calculatorWrapper}>
                  <div className={styles.inlineCalculator} style={{ marginTop: 0 }}>
                    <div className={styles.calcScreen}>{calcDisplay || amountStr || "0"}</div>
                    <div className={styles.calcKeys}>
                      {["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "⌫", "+", "C", "="].map(key => (
                        <button
                          key={key}
                          type="button"
                          className={`${styles.calcKey} ${key === "=" ? styles.equals : ["+", "-", "*", "/", "⌫", "C"].includes(key) ? styles.op : ""}`}
                          onClick={() => handleKeypadPress(key)}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Deskripsi</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Kopi pagi, Gaji bulanan, dsb"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Dynamic inputs based on transaction type */}
              {txType === "transfer" ? (
                <div className={styles.transferAccountsGrid}>
                  <div className="form-group">
                    <label className="form-label">Dari Rekening</label>
                    <select 
                      className="form-input" 
                      value={fromAccountId} 
                      onChange={(e) => setFromAccountId(e.target.value)}
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.icon} {acc.name} ({formatCurrency(acc.balance)})</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.transferArrowIcon}>
                    <ArrowRightLeft size={16} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ke Rekening</label>
                    <select 
                      className="form-input" 
                      value={toAccountId} 
                      onChange={(e) => setToAccountId(e.target.value)}
                    >
                      {accounts.filter(a => a.id !== fromAccountId).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.icon} {acc.name} ({formatCurrency(acc.balance)})</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className={styles.normalInputsGrid}>
                  <div className="form-group">
                    <label className="form-label">Dompet / Rekening</label>
                    <select 
                      className="form-input" 
                      value={accountId} 
                      onChange={(e) => setAccountId(e.target.value)}
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.icon} {acc.name} ({formatCurrency(acc.balance)})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kategori</label>
                    <select 
                      className="form-input" 
                      value={categoryId} 
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      {categories.filter(c => c.type === txType).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Date selection */}
              <div className="form-group">
                <label className="form-label">Tanggal</label>
                <input
                  type="date"
                  className="form-input"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                />
              </div>

              {/* Interconnection links (Savings Goal / Debt Linkage) */}
              {txType !== "transfer" && (
                <div className={styles.linkageContainer}>
                  <div className="form-group">
                    <label className="form-label">Hubungkan dengan Modul Lain? (Opsional)</label>
                    <div className={styles.linkOptionsRow}>
                      <button
                        type="button"
                        className={`${styles.linkOptBtn} ${linkTarget === "" ? styles.active : ""}`}
                        onClick={() => { setLinkTarget(""); setLinkedGoalId(""); setLinkedDebtId(""); }}
                      >
                        Tidak Ada
                      </button>
                      
                      {txType === "expense" && (
                        <>
                          <button
                            type="button"
                            className={`${styles.linkOptBtn} ${linkTarget === "savings" ? styles.active : ""}`}
                            onClick={() => { setLinkTarget("savings"); setLinkedDebtId(""); }}
                          >
                            Target Tabungan
                          </button>
                          <button
                            type="button"
                            className={`${styles.linkOptBtn} ${linkTarget === "debt" ? styles.active : ""}`}
                            onClick={() => { setLinkTarget("debt"); setLinkedGoalId(""); }}
                          >
                            Utang Piutang
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Savings Goals dropdown */}
                  {linkTarget === "savings" && (
                    <div className={`form-group ${styles.linkageSubGroup} ${styles.animateSlide}`}>
                      <label className="form-label">Pilih Target Tabungan</label>
                      <select
                        className="form-input"
                        value={linkedGoalId}
                        onChange={(e) => setLinkedGoalId(e.target.value)}
                        required
                      >
                        <option value="">-- Pilih Target --</option>
                        {savingsGoals.map(g => (
                          <option key={g.id} value={g.id}>{g.name} (Terkumpul: {formatCurrency(g.currentAmount)})</option>
                        ))}
                      </select>
                      <div className={styles.linkageConsentCheck}>
                        <input
                          type="checkbox"
                          id="autoGoalTransact"
                          checked={shouldAutoTransact}
                          onChange={(e) => setShouldAutoTransact(e.target.checked)}
                        />
                        <label htmlFor="autoGoalTransact">Otomatis tambahkan dana ke target di atas</label>
                      </div>
                    </div>
                  )}

                  {/* Debts dropdown */}
                  {linkTarget === "debt" && (
                    <div className={`form-group ${styles.linkageSubGroup} ${styles.animateSlide}`}>
                      <label className="form-label">Pilih Catatan Utang / Cicilan</label>
                      <select
                        className="form-input"
                        value={linkedDebtId}
                        onChange={(e) => setLinkedDebtId(e.target.value)}
                        required
                      >
                        <option value="">-- Pilih Catatan --</option>
                        {debts.filter(d => d.status === "active").map(d => (
                          <option key={d.id} value={d.id}>{d.name} (Sisa: {formatCurrency(d.totalAmount - d.paidAmount)})</option>
                        ))}
                      </select>
                      <div className={styles.linkageConsentCheck}>
                        <input
                          type="checkbox"
                          id="autoDebtTransact"
                          checked={shouldAutoTransact}
                          onChange={(e) => setShouldAutoTransact(e.target.checked)}
                        />
                        <label htmlFor="autoDebtTransact">Otomatis bayar cicilan/utang di atas</label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {txType === "income" && 
               categoryId === "cat-salary" && 
               savingsGoals.length > 0 && (
                <div className={styles.multiAllocContainer}>
                  <div className={styles.multiAllocHeader}>
                    <span>Alokasi Gaji ke Tabungan Target (Multi-Split):</span>
                    <span className={styles.totalAllocBadge} style={{ color: totalPercent > 100 ? "var(--color-expense)" : "var(--color-income)", fontWeight: "bold" }}>
                      Total: {totalPercent}% / 100%
                    </span>
                  </div>
                  <div className={styles.multiAllocList}>
                    {savingsGoals.map(goal => {
                      const percent = customAllocations[goal.id] || 0;
                      const isChecked = percent > 0;
                      const allocatedAmt = Math.round((Number(amountStr) || 0) * (percent / 100));
                      return (
                        <div key={goal.id} className={styles.multiAllocRow}>
                          <label className={styles.multiAllocLabel}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                 setCustomAllocations(prev => ({
                                   ...prev,
                                   [goal.id]: e.target.checked ? 10 : 0
                                 }));
                              }}
                              style={{ cursor: "pointer" }}
                            />
                            <span className={styles.goalInfo}>
                              <strong>{"🎯"} {goal.name}</strong>
                              <small style={{ fontSize: "10px", color: "var(--text-muted)" }}>Terisi: {formatCurrency(goal.currentAmount)}</small>
                            </span>
                          </label>
                          <div className={styles.percentInputWrap}>
                            {isChecked && (
                              <>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  className={styles.percentField}
                                  value={percent}
                                  onChange={(e) => {
                                    const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                    setCustomAllocations(prev => ({
                                      ...prev,
                                      [goal.id]: val
                                    }));
                                  }}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  style={{ width: "50px", textAlign: "center", border: "1px solid var(--border-color)", borderRadius: "4px" }}
                                />
                                <span style={{ fontSize: "12px", fontWeight: "bold" }}>%</span>
                                {allocatedAmt > 0 && (
                                  <span className={styles.allocValue} style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                    ({formatCurrency(allocatedAmt)})
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {totalPercent > 100 && (
                    <div className={styles.allocError} style={{ color: "var(--color-expense)", fontSize: "11px", fontWeight: "600", marginTop: "6px" }}>
                      ⚠️ Total persentase alokasi melebihi 100%!
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={totalPercent > 100}>
                <Plus size={18} /> Simpan Transaksi
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
