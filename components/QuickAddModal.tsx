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

  // --- Smart Parsing Engine (NLP Simulation) ---
  useEffect(() => {
    if (activeTab !== "smart" || !smartText.trim()) {
      setParsedPreview(null);
      return;
    }

    const text = smartText.trim();
    const words = text.split(/\s+/);
    
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

    // 1. Detect Transfers
    const isTransfer = text.toLowerCase().includes("transfer") || text.toLowerCase().includes("kirim");
    if (isTransfer) {
      parsed.type = "transfer";
    } else if (text.toLowerCase().includes("gaji") || text.toLowerCase().includes("bonus") || text.toLowerCase().includes("income") || text.toLowerCase().includes("+")) {
      parsed.type = "income";
    }

    // Helper: Parse numerical abbreviations (50k, 1.5m, 2jt, etc.)
    const parseAmount = (str: string) => {
      const cleaned = str.replace(/[^0-9.,kmjt]/gi, "").replace(",", ".");
      if (!cleaned) return 0;

      let num = parseFloat(cleaned);
      if (isNaN(num)) return 0;

      if (/k/i.test(cleaned)) num *= 1000;
      else if (/m/i.test(cleaned) || /jt/i.test(cleaned)) num *= 1000000;
      
      return Math.round(num);
    };

    // Find Amount and Filter Meta Tags
    let amountFound = false;
    const descWords: string[] = [];
    let categoryTagged = false;

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
            if (!parsed.fromAccount) parsed.fromAccount = foundAcc;
            else if (!parsed.toAccount) parsed.toAccount = foundAcc;
          } else {
            parsed.account = foundAcc;
          }
        }
      } 
      else if (/[0-9]/.test(word) && !amountFound && !word.startsWith("#") && !word.startsWith("@")) {
        parsed.amount = parseAmount(word);
        if (parsed.amount > 0) amountFound = true;
      } 
      else if (word.toLowerCase() !== "transfer" && word.toLowerCase() !== "kirim" && word.toLowerCase() !== "ke" && word.toLowerCase() !== "to") {
        descWords.push(word);
      }
    });

    parsed.description = descWords.join(" ") || (parsed.type === "transfer" ? "Transfer Saldo" : "Transaksi Baru");

    // History-based auto-categorization check (if category not explicitly tagged)
    if (!categoryTagged && parsed.type !== "transfer" && parsed.description) {
      const normalizedDesc = parsed.description.toLowerCase().trim();
      if (normalizedDesc) {
        // Find most recent matching transaction from general history
        const pastTx = transactions.find(t => 
          t.description && 
          t.description.toLowerCase().includes(normalizedDesc) && 
          t.categoryId
        );
        if (pastTx) {
          const matchedCat = categories.find(c => c.id === pastTx.categoryId);
          if (matchedCat) {
            parsed.category = matchedCat;
          }
        }
      }
    }

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
  }, [smartText, categories, accounts, transactions, activeTab]);

  // Handle Smart Submit
  const handleSmartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedPreview || parsedPreview.amount <= 0) return;

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

    await addTransaction(tx, { autoAllocate: applySalaryAllocation });
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

    const linkOptions: { savingsGoalId?: string; debtId?: string; autoAllocate?: boolean } = {};

    if (txType !== "transfer") {
      if (linkTarget === "savings" && linkedGoalId) {
        linkOptions.savingsGoalId = linkedGoalId;
      } else if (linkTarget === "debt" && linkedDebtId) {
        linkOptions.debtId = linkedDebtId;
      }
      
      if (txType === "income" && categoryId === "cat-salary") {
        linkOptions.autoAllocate = applySalaryAllocation;
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
    const cleanName = name.replace(/\s+/g, "");
    const tag = type === "category" ? "#" : "@";
    const token = `${tag}${cleanName}`;
    
    setSmartText(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return token + " ";
      return `${trimmed} ${token} `;
    });
    
    if (smartInputRef.current) {
      smartInputRef.current.focus();
    }
  };

  // Generate suggestions based on available accounts & categories
  const getSuggestions = () => {
    const list = [];
    
    // Suggestion 1: Expense
    const firstExpCat = categories.find(c => c.type === "expense");
    const firstAcc = accounts[0];
    const expCatSlug = firstExpCat ? firstExpCat.name.split(" ")[0].toLowerCase() : "food";
    const accSlug = firstAcc ? firstAcc.name.toLowerCase() : "cash";
    list.push({
      text: `50k makan siang #${expCatSlug} @${accSlug}`,
      desc: `Catat pengeluaran makanan menggunakan ${firstAcc?.name || "dompet Cash"}`
    });

    // Suggestion 2: Income
    const firstIncCat = categories.find(c => c.type === "income");
    const incCatSlug = firstIncCat ? firstIncCat.name.split(" ")[0].toLowerCase() : "salary";
    list.push({
      text: `15m gaji bulanan #${incCatSlug} @${accSlug}`,
      desc: `Catat pemasukan gaji ke ${firstAcc?.name || "rekening utama"}`
    });

    // Suggestion 3: Transfer
    const secondAcc = accounts[1];
    if (secondAcc && firstAcc) {
      const fromSlug = firstAcc.name.toLowerCase();
      const toSlug = secondAcc.name.toLowerCase();
      list.push({
        text: `500k transfer @${fromSlug} @${toSlug}`,
        desc: `Transfer dana dari ${firstAcc.name} ke ${secondAcc.name}`
      });
    }

    return list;
  };

  const suggestions = getSuggestions();

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
            <div className={styles.smartInputContainer} style={{ position: "relative" }}>
              <input
                ref={smartInputRef}
                type="text"
                className={styles.smartTextInput}
                placeholder="Contoh: 45k kopi starbucks #food @cash"
                value={smartText}
                onChange={handleSmartTextChange}
                onClick={handleSmartInputClickOrKeyUp}
                onKeyUp={handleSmartInputClickOrKeyUp}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
              <span className={styles.smartHint}>
                Ketik jumlah, lalu tambahkan <strong>#kategori</strong> dan <strong>@dompet</strong>. Gunakan <strong>k</strong> (ribu) atau <strong>m</strong> (juta).
              </span>

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
              <span className={styles.chipsLabel}>Kategori Cepat:</span>
              <div className={styles.quickChipsScroll}>
                {categories.map(c => (
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
                {accounts.map(a => (
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
                 settings.autoAllocationEnabled && 
                 settings.autoAllocationGoalId && (
                  <div className={styles.allocationNotice}>
                    <input
                      type="checkbox"
                      id="applyAllocationSmart"
                      checked={applySalaryAllocation}
                      onChange={(e) => setApplySalaryAllocation(e.target.checked)}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    <label htmlFor="applyAllocationSmart" style={{ cursor: "pointer", fontSize: "12px", color: "var(--text-secondary)" }}>
                      Alokasikan {settings.autoAllocationPercent}% ({formatCurrency(Math.round(parsedPreview.amount * (settings.autoAllocationPercent || 10) / 100))}) ke target <strong>{savingsGoals.find(g => g.id === settings.autoAllocationGoalId)?.name}</strong>
                    </label>
                  </div>
                )}

                {parsedPreview.amount > 0 ? (
                  <button type="submit" className={`btn btn-primary ${styles.submitBtn}`}>
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
               settings.autoAllocationEnabled && 
               settings.autoAllocationGoalId && (
                <div className={styles.allocationNotice}>
                  <input
                    type="checkbox"
                    id="applyAllocationVisual"
                    checked={applySalaryAllocation}
                    onChange={(e) => setApplySalaryAllocation(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <label htmlFor="applyAllocationVisual" style={{ cursor: "pointer", fontSize: "12px", color: "var(--text-secondary)" }}>
                    Alokasikan {settings.autoAllocationPercent}% ({formatCurrency(Math.round((Number(amountStr) || 0) * (settings.autoAllocationPercent || 10) / 100))}) ke target <strong>{savingsGoals.find(g => g.id === settings.autoAllocationGoalId)?.name}</strong>
                  </label>
                </div>
              )}

              <button type="submit" className={`btn btn-primary ${styles.submitBtn}`}>
                <Plus size={18} /> Simpan Transaksi
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
