"use client";

import React, { useState, useEffect } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useFinance } from "@/lib/financeContext";
import { 
  Plus, Edit2, Trash2, Wallet, Building2, Smartphone, 
  CreditCard, Save, X 
} from "lucide-react";
import { Account, Transaction } from "@/lib/types";
import styles from "./accounts.module.css";
import { formatNumberWithSeparator, parseFormattedNumber } from "@/lib/formatHelpers";

export default function Accounts() {
  const { 
    accounts, 
    transactions, 
    categories,
    saveAccount, 
    deleteAccount, 
    formatCurrency 
  } = useFinance();

  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("bank");
  const [initialBalance, setInitialBalance] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [icon, setIcon] = useState("🏛️");
  const [color, setColor] = useState("#2563eb");

  useEffect(() => {
    if (accounts.length > 0 && !activeAccount) {
      setActiveAccount(accounts[0]);
    } else if (activeAccount) {
      // Keep activeAccount state synced with context updates
      const updated = accounts.find(a => a.id === activeAccount.id);
      if (updated) {
        setActiveAccount(updated);
      } else {
        setActiveAccount(accounts[0] || null);
      }
    }
  }, [accounts, activeAccount]);

  const handleEdit = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    setInitialBalance((acc as any).initialBalance?.toString() || acc.balance.toString() || "0");
    setCurrency(acc.currency || "IDR");
    setIcon(acc.icon || "🏛️");
    setColor(acc.color || "#2563eb");
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setEditingAccount(null);
    setName("");
    setType("bank");
    setInitialBalance("");
    setCurrency("IDR");
    setIcon("🏛️");
    setColor("#2563eb");
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const accData: Omit<Account, "id"> & { id?: string; initialBalance?: number } = {
      name,
      type,
      initialBalance: Number(initialBalance) || 0,
      balance: Number(initialBalance) || 0,
      currency,
      icon,
      color
    };

    if (editingAccount) {
      accData.id = editingAccount.id;
    }

    await saveAccount(accData);
    setIsFormOpen(false);
  };

  const confirm = useConfirm();

  const handleDelete = async (id: string) => {
    const yes = await confirm({
      title: "Hapus Rekening",
      message: "Apakah Anda yakin ingin menghapus rekening ini? Seluruh transaksi yang terhubung akan kehilangan referensi dompet ini.",
      variant: "danger",
      confirmText: "Ya, Hapus",
    });
    if (yes) {
      await deleteAccount(id);
      if (activeAccount?.id === id) {
        setActiveAccount(accounts[0] || null);
      }
    }
  };

  // Get Wallet Icon helper
  const getWalletTypeIcon = (walletType: Account["type"]) => {
    switch (walletType) {
      case "cash": return <Wallet size={20} />;
      case "e_wallet": return <Smartphone size={20} />;
      case "credit_card": return <CreditCard size={20} />;
      default: return <Building2 size={20} />;
    }
  };

  // Filter transactions for currently active account
  const accountTxs = activeAccount
    ? transactions.filter(tx => {
        if (tx.type === "transfer") {
          return tx.accountId === activeAccount.id || tx.toAccountId === activeAccount.id;
        }
        return tx.accountId === activeAccount.id;
      })
    : [];

  return (
    <div className={styles.accountsRoot}>
      
      {/* Title Bar */}
      <div className="page-header-flex">
        <div className="page-header-info">
          <h1 className="page-header-title">Rekening & Dompet</h1>
          <p className="page-header-subtitle">Atur dan pantau saldo dari seluruh akun bank, e-wallet, kartu kredit, dan tunai Anda.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleAddNew}>
            <Plus size={16} /> Tambah Rekening
          </button>
        </div>
      </div>


      {/* Main Grid: Left Side accounts list, Right Side details */}
      <div className={styles.accountsLayout}>
        
        {/* Left Column: Wallet cards list */}
        <div className={styles.accountsListPane}>
          <div className={styles.accountsGrid}>
            {accounts.map(acc => {
              const isSelected = activeAccount?.id === acc.id;
              return (
                <div 
                  key={acc.id} 
                  className={`card ${styles.accountCardItem} ${isSelected ? styles.selected : ""}`}
                  style={{ borderLeft: `5px solid ${acc.color || "#2563eb"}` }}
                  onClick={() => setActiveAccount(acc)}
                >
                  <div className={styles.cardActionsOverlay}>
                    <button className={styles.iconBtnSm} onClick={(e) => { e.stopPropagation(); handleEdit(acc); }}>
                      <Edit2 size={12} />
                    </button>
                    <button className={`${styles.iconBtnSm} ${styles.delete}`} onClick={(e) => { e.stopPropagation(); handleDelete(acc.id); }}>
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className={styles.accCardHeader}>
                    <span className={styles.accIcon} style={{ backgroundColor: acc.color + "15", color: acc.color }}>
                      {acc.icon}
                    </span>
                    <span className={styles.accTypeBadge}>
                      {getWalletTypeIcon(acc.type)}
                    </span>
                  </div>

                  <div className={styles.accCardBody}>
                    <h4 className={`${styles.accName} font-semibold`}>{acc.name}</h4>
                    <div className={`${styles.accBalance} font-semibold`}>
                      {formatCurrency(acc.balance || 0, acc.currency)}
                    </div>
                  </div>
                  
                  {(acc as any).initialBalance !== undefined && (acc as any).initialBalance !== 0 && (
                    <div className={styles.accInitialHint}>
                      Saldo Awal: {formatCurrency((acc as any).initialBalance || 0, acc.currency)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active wallet ledger history */}
        <div className={styles.accountDetailsPane}>
          {activeAccount ? (
            <div className={`card ${styles.detailsInnerCard}`}>
              <div className={styles.detailsHeader}>
                <div className={styles.headerMeta}>
                  <span className={styles.detailsIcon}>{activeAccount.icon}</span>
                  <div>
                    <h3>{activeAccount.name}</h3>
                    <span className={styles.badgeType}>{activeAccount.type.toUpperCase().replace("_", " ")}</span>
                  </div>
                </div>
                <div className={`${styles.detailsBalance} font-semibold`}>
                  {formatCurrency(activeAccount.balance || 0, activeAccount.currency)}
                </div>
              </div>

              {/* Transactions list inside selected wallet details */}
              <div className={styles.detailsTransactionsLog}>
                <h4 className={styles.logTitle}>Riwayat Transaksi Dompet</h4>
                
                {accountTxs.length === 0 ? (
                  <div className="empty-log text-center text-muted">
                    Belum ada catatan transaksi pada rekening ini.
                  </div>
                ) : (
                  <div className={styles.logListVertical}>
                    {accountTxs.slice(0, 10).map(tx => {
                      const isExpense = tx.type === "expense";
                      const isTransfer = tx.type === "transfer";
                      const cat = categories.find(c => c.id === tx.categoryId);

                      return (
                        <div key={tx.id} className={styles.logTxRow}>
                          <div className={styles.logLeftCol}>
                            <span className={styles.logCatIcon}>
                              {isTransfer ? "⇆" : cat?.icon || "🏷️"}
                            </span>
                            <div className={styles.logDescInfo}>
                              <span className={`${styles.logDesc} font-semibold`}>{tx.description}</span>
                              <span className={styles.logDate}>{new Date(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                            </div>
                          </div>
                          
                          <div className={styles.logRightCol}>
                            {isTransfer && (
                              <span className={styles.transferDirection}>
                                {tx.accountId === activeAccount.id ? (
                                  <>Keluar ke <strong>{accounts.find(a => a.id === tx.toAccountId)?.name}</strong></>
                                ) : (
                                  <>Masuk dari <strong>{accounts.find(a => a.id === tx.accountId)?.name}</strong></>
                                )}
                              </span>
                            )}
                            <span className={`${styles.logAmount} font-semibold ${isExpense || (isTransfer && tx.accountId === activeAccount.id) ? styles.expense : styles.income}`}>
                              {isExpense || (isTransfer && tx.accountId === activeAccount.id) ? "-" : "+"}
                              {formatCurrency(tx.amount, tx.currency || "IDR")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card empty-details text-center text-muted">
              Pilih salah satu rekening di sebelah kiri untuk melihat detail riwayat.
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Wallet Modal Form */}
      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className={`modal-content ${styles.formModal}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingAccount ? "Edit Rekening" : "Tambah Rekening Baru"}</h2>
              <button className={styles.closeBtn} onClick={() => setIsFormOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalBody}>
              <div className="form-group">
                <label className="form-label">Nama Rekening</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Contoh: BCA Tabungan, Dompet Cash" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formRow2}>
                <div className="form-group">
                  <label className="form-label">Tipe Akun</label>
                  <select className="form-input" value={type} onChange={(e) => setType(e.target.value as Account["type"])}>
                    <option value="bank">Bank / Rekening</option>
                    <option value="cash">Tunai / Dompet</option>
                    <option value="e_wallet">e-Wallet / Dompet Digital</option>
                    <option value="credit_card">Kartu Kredit</option>
                    <option value="investment">Investasi</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Mata Uang</label>
                  <select className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="IDR">IDR (Rupiah)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="SGD">SGD (Singapore Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Saldo Awal</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="0" 
                  value={initialBalance ? formatNumberWithSeparator(initialBalance, currency) : ""}
                  onChange={(e) => {
                    const raw = parseFormattedNumber(e.target.value, currency).toString();
                    setInitialBalance(raw || "");
                  }}
                />
                <span className={styles.inputHint}>PENTING: Saldo saat ini akan bertambah/berkurang secara dinamis berdasarkan seluruh riwayat transaksi.</span>
              </div>

              <div className={styles.formRow2}>
                <div className="form-group">
                  <label className="form-label">Simbol Ikon</label>
                  <select className="form-input" value={icon} onChange={(e) => setIcon(e.target.value)}>
                    <option value="🏛️">🏛️ Bank</option>
                    <option value="💵">💵 Uang Kertas</option>
                    <option value="💳">💳 Kartu Kredit</option>
                    <option value="📱">📱 Handphone</option>
                    <option value="🐷">🐷 Celengan</option>
                    <option value="📈">📈 Investasi</option>
                    <option value="✈️">✈️ Travel</option>
                    <option value="🛍️">🛍️ Belanja</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Warna Tema</label>
                  <div className={styles.colorPaletteSelection}>
                    {["#2563eb", "#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#64748b"].map(c => (
                      <button
                        key={c}
                        type="button"
                        className={`${styles.colorDot} ${color === c ? styles.active : ""}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setColor(c)}
                      >
                        {color === c && <CheckIcon />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button type="submit" className={`btn btn-primary ${styles.submitBtn}`}>
                <Save size={16} /> Simpan Akun
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Check Icon helper
function CheckIcon() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 4L3.5 6L8.5 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
