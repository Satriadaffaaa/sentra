"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useFinance } from "@/lib/financeContext";
import { 
  Search, 
  Download, Printer, Filter, X, Trash2 
} from "lucide-react";
import styles from "./transactions.module.css";
import { Transaction } from "@/lib/types";

function TransactionsContent() {
  const searchParams = useSearchParams();
  const { 
    transactions, 
    accounts, 
    categories, 
    deleteTransaction, 
    formatCurrency,
    settings 
  } = useFinance();

  // Filter States
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Sync category filter from URL query param (e.g. from Dashboard click)
  useEffect(() => {
    const urlCategory = searchParams.get("category");
    if (urlCategory) {
      setFilterCategory(urlCategory);
    }
  }, [searchParams]);

  // Reset Filters
  const clearFilters = () => {
    setSearch("");
    setFilterType("");
    setFilterAccount("");
    setFilterCategory("");
    setStartDate("");
    setEndDate("");
  };

  // --- Filtering Logic ---
  const filteredTxs = transactions.filter(tx => {
    // Search Description
    if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    // Transaction Type
    if (filterType && tx.type !== filterType) {
      return false;
    }
    // Account filter (handles both regular accounts and transfers)
    if (filterAccount) {
      if (tx.type === "transfer") {
        if (tx.accountId !== filterAccount && tx.toAccountId !== filterAccount) {
          return false;
        }
      } else if (tx.accountId !== filterAccount) {
        return false;
      }
    }
    // Category filter
    if (filterCategory && tx.categoryId !== filterCategory) {
      return false;
    }
    // Date Filters
    if (startDate && tx.date < startDate) {
      return false;
    }
    if (endDate && tx.date > endDate) {
      return false;
    }
    return true;
  });

  // --- Export to CSV ---
  const exportToCSV = () => {
    // Header row
    const headers = ["ID", "Tanggal", "Deskripsi", "Tipe", "Nominal", "Mata Uang", "Kategori", "Akun Asal", "Akun Tujuan"];
    
    // Map data rows
    const rows = filteredTxs.map(tx => {
      const cat = categories.find(c => c.id === tx.categoryId)?.name || "";
      const fromAcc = accounts.find(a => a.id === tx.accountId)?.name || "";
      const toAcc = accounts.find(a => a.id === tx.toAccountId)?.name || "";
      
      return [
        tx.id || "",
        tx.date,
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.type,
        tx.amount,
        tx.currency || "IDR",
        cat,
        fromAcc,
        toAcc
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Transaksi_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Print/PDF Triggers ---
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className={styles.transactionsRoot}>
      
      {/* Title Bar & Exporters */}
      <div className={`page-header-flex ${styles.printHide}`}>
        <div className="page-header-info">
          <h1 className="page-header-title">Buku Kas / Transaksi</h1>
          <p className="page-header-subtitle">Daftar pencatatan riwayat transaksi keuangan Anda secara detail.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={exportToCSV} disabled={filteredTxs.length === 0}>
            <Download size={16} /> Ekspor CSV
          </button>
          <button className="btn btn-secondary" onClick={handlePrint} disabled={filteredTxs.length === 0}>
            <Printer size={16} /> Cetak PDF
          </button>
        </div>
      </div>


      {/* Print PDF Custom Header */}
      <div className={styles.printOnlyHeader}>
        <h2>Satriadaffa Finance Tracker - Laporan Transaksi</h2>
        <p>Tanggal Cetak: {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</p>
        {startDate || endDate ? (
          <p>Periode: {startDate || "Awal"} s/d {endDate || "Sekarang"}</p>
        ) : null}
      </div>

      {/* Filter Toolbar Card */}
      <div className={`card ${styles.filterCard} ${styles.printHide}`}>
        <div className={styles.filterGrid}>
          {/* Search bar */}
          <div className={`form-group ${styles.searchGroup}`}>
            <label className="form-label">Cari Deskripsi</label>
            <div className={styles.inputWithIcon}>
              <Search size={16} className={styles.inputIcon} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Cari transaksi..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="form-group">
            <label className="form-label">Tipe</label>
            <select className="form-input" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">Semua Tipe</option>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          {/* Account Filter */}
          <div className="form-group">
            <label className="form-label">Rekening / Dompet</label>
            <select className="form-input" value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
              <option value="">Semua Dompet</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.icon} {acc.name}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="form-group">
            <label className="form-label">Kategori</label>
            <select className="form-input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">Semua Kategori</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>

          {/* Date range selection */}
          <div className={`form-group ${styles.dateRangeGroup}`}>
            <label className="form-label">Rentang Tanggal</label>
            <div className={styles.dateInputsRow}>
              <input 
                type="date" 
                className="form-input" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
              <span className={styles.dateSep}>s/d</span>
              <input 
                type="date" 
                className="form-input" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* Clear filter triggers */}
        {(search || filterType || filterAccount || filterCategory || startDate || endDate) && (
          <div className={styles.clearFiltersRow}>
            <button className={styles.clearFilterBtn} onClick={clearFilters}>
              <X size={14} /> Hapus Semua Filter
            </button>
          </div>
        )}
      </div>

      {/* Ledger Table Card */}
      <div className={`card ${styles.ledgerTableCard}`}>
        {filteredTxs.length === 0 ? (
          <div className={`${styles.emptyLedger} ${styles.textCenter} text-muted`}>
            <Filter size={48} className="text-muted" style={{ marginBottom: "16px" }} />
            <p>Tidak ada transaksi yang cocok dengan filter yang dipilih.</p>
            {(search || filterType || filterAccount || filterCategory || startDate || endDate) && (
              <button className="btn btn-secondary btn-sm" style={{ marginTop: "12px" }} onClick={clearFilters}>
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.ledgerTable}>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kategori</th>
                  <th>Deskripsi</th>
                  <th>Akun / Wallet</th>
                  <th className={styles.textRight}>Nominal</th>
                  <th className={`${styles.printHide} ${styles.textCenter}`} style={{ width: "80px" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxs.map((tx) => {
                  const isExpense = tx.type === "expense";
                  const isTransfer = tx.type === "transfer";
                  const cat = categories.find(c => c.id === tx.categoryId);
                  
                  let accountDetails = "";
                  if (isTransfer) {
                    const fromAcc = accounts.find(a => a.id === tx.accountId);
                    const toAcc = accounts.find(a => a.id === tx.toAccountId);
                    accountDetails = `${fromAcc?.icon || "💵"} ${fromAcc?.name || "Asal"} → ${toAcc?.icon || "💵"} ${toAcc?.name || "Tujuan"}`;
                  } else {
                    const acc = accounts.find(a => a.id === tx.accountId);
                    accountDetails = `${acc?.icon || "💵"} ${acc?.name || "Wallet"}`;
                  }

                  return (
                    <tr key={tx.id} className={styles.ledgerRow}>
                      <td className={styles.txDateCell}>
                        {new Date(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td>
                        <span className={styles.categoryBadge} style={{ backgroundColor: isTransfer ? "var(--color-brand-light)" : cat?.color + "15", color: isTransfer ? "var(--color-brand)" : cat?.color }}>
                          <span className={styles.badgeIcon}>{isTransfer ? "⇆" : cat?.icon || "🏷️"}</span>
                          {isTransfer ? "Transfer" : cat?.name || "Lain-lain"}
                        </span>
                      </td>
                      <td className={`${styles.txDescCell} ${styles.fontSemibold}`}>
                        {tx.description}
                      </td>
                      <td className={styles.txWalletCell}>
                        {accountDetails}
                      </td>
                      <td className={`${styles.txAmountCell} ${styles.textRight} ${styles.fontSemibold} ${isExpense ? styles.expense : isTransfer ? styles.transfer : styles.income}`}>
                        {isExpense ? "-" : isTransfer ? "" : "+"}
                        {formatCurrency(tx.amount, tx.currency || "IDR")}
                      </td>
                      <td className={`${styles.printHide} ${styles.textCenter}`}>
                        <button className={`${styles.rowActionBtn} ${styles.delete}`} onClick={() => tx.id ? deleteTransaction(tx.id) : undefined}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Transactions() {
  return (
    <Suspense fallback={
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Memuat buku kas...</p>
      </div>
    }>
      <TransactionsContent />
    </Suspense>
  );
}
