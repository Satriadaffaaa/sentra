"use client";

import React, { useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useFinance } from "@/lib/financeContext";
import { CreditCard, Plus, Calendar, Trash2, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { Debt, Account, Transaction } from "@/lib/types";
import styles from "./debts.module.css";
import { formatNumberWithSeparator, parseFormattedNumber } from "@/lib/formatHelpers";

export default function DebtsPage() {
  const {
    debts,
    accounts,
    isLoading,
    formatCurrency,
    saveDebt,
    deleteDebt,
    addTransaction,
    settings
  } = useFinance();

  const [activeTab, setActiveTab] = useState<"debt" | "loan">("debt");
  const [statusFilter, setStatusFilter] = useState<"active" | "paid" | "all">("active");
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<string | null>(null);

  // Form states for creating debt/loan
  const [debtName, setDebtName] = useState("");
  const [debtType, setDebtType] = useState<"debt" | "loan">("debt");
  const [totalAmount, setTotalAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [dueDate, setDueDate] = useState("");

  // Form states for payments
  const [paymentAmount, setPaymentAmount] = useState("");
  const [linkWallet, setLinkWallet] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const baseCurrency = settings.baseCurrency || "IDR";

  // Loading
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Memuat catatan utang & piutang...</p>
      </div>
    );
  }

  // Submit Handler for New Debt/Loan
  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtName || !totalAmount || !dueDate) return;

    try {
      const initialPaid = Number(paidAmount) || 0;
      const total = Number(totalAmount);
      await saveDebt({
        name: debtName,
        type: debtType,
        totalAmount: total,
        paidAmount: initialPaid,
        dueDate: dueDate,
        status: initialPaid >= total ? "paid" : "active"
      });

      // Reset Form
      setDebtName("");
      setTotalAmount("");
      setPaidAmount("0");
      setDueDate("");
      setIsDebtModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Handler for Debt Payment
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || !paymentAmount || Number(paymentAmount) <= 0) return;

    const amount = Number(paymentAmount);
    const item = debts.find(d => d.id === selectedDebt);
    if (!item) return;

    const remaining = item.totalAmount - item.paidAmount;
    if (amount > remaining) {
      await confirm({
        title: "Jumlah Melebihi Sisa Kewajiban",
        message: `Jumlah pembayaran (${formatCurrency(amount, baseCurrency)}) melebihi sisa kewajiban (${formatCurrency(remaining, baseCurrency)})`,
        variant: "warning",
        confirmText: "Mengerti",
        cancelText: "Tutup",
      });
      return;
    }

    try {
      if (linkWallet && selectedAccountId) {
        const account = accounts.find(a => a.id === selectedAccountId);
        if (!account) return;

        // Validation for wallet balance in case we are PAYING a debt (expense)
        if (item.type === "debt" && account.type !== "credit_card" && account.balance < amount) {
          await confirm({
            title: "Saldo Tidak Cukup",
            message: `Saldo di ${account.name} tidak mencukupi untuk pembayaran sebesar ${formatCurrency(amount, baseCurrency)}`,
            variant: "warning",
            confirmText: "Mengerti",
            cancelText: "Tutup",
          });
          return;
        }

        // Record linked transaction
        // Debt (What I owe) -> Wallet expense (money leaves to pay debt)
        // Loan (What I am owed) -> Wallet income (money comes in as repayment)
        const tx: Omit<Transaction, "id"> = {
          amount: amount,
          type: item.type === "debt" ? "expense" : "income",
          categoryId: item.type === "debt" ? "cat-bills" : "cat-investment",
          description: item.type === "debt"
            ? `Bayar Cicilan: ${item.name}`
            : `Terima Pembayaran: ${item.name}`,
          date: new Date().toISOString().split("T")[0],
          accountId: selectedAccountId,
          currency: account.currency
        };

        await addTransaction(tx, { debtId: item.id });
      } else {
        // Direct unlinked payment
        const newPaid = item.paidAmount + amount;
        await saveDebt({
          ...item,
          paidAmount: newPaid,
          status: newPaid >= item.totalAmount ? "paid" : "active"
        });
      }

      setPaymentAmount("");
      setIsPaymentModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const confirm = useConfirm();

  // Delete Handler
  const handleDeleteDebt = async (id: string) => {
    const yes = await confirm({
      title: "Hapus Utang/Piutang",
      message: "Apakah Anda yakin ingin menghapus catatan utang/piutang ini?",
      variant: "danger",
      confirmText: "Ya, Hapus",
    });
    if (yes) {
      await deleteDebt(id);
    }
  };

  const openPaymentModal = (debtId: string) => {
    setSelectedDebt(debtId);
    if (accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
    setIsPaymentModalOpen(true);
  };

  // Filtered List
  const filteredDebts = debts.filter(d => {
    const isMatchingType = d.type === activeTab;
    if (statusFilter === "all") return isMatchingType;
    return isMatchingType && d.status === statusFilter;
  });

  // Aggregated totals
  const activeDebts = debts.filter(d => d.type === "debt" && d.status === "active");
  const activeLoans = debts.filter(d => d.type === "loan" && d.status === "active");

  const totalOwed = activeDebts.reduce((sum, d) => sum + (d.totalAmount - d.paidAmount), 0);
  const totalLent = activeLoans.reduce((sum, d) => sum + (d.totalAmount - d.paidAmount), 0);

  // Check for critical due alerts (due date within 7 days or overdue)
  const dueAlerts = debts.filter(d => {
    if (d.status === "paid") return false;
    const diffDays = Math.ceil((new Date(d.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  });

  return (
    <div className={styles.debtsContainer}>
      {/* Page Header */}
      <div className="page-header-flex">
        <div className="page-header-info">
          <h1 className="page-header-title">Utang & Piutang</h1>
          <p className="page-header-subtitle">Kelola kewajiban pembayaran Anda dan pantau pinjaman yang Anda berikan.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => { setDebtType(activeTab); setIsDebtModalOpen(true); }}>
            <Plus size={18} />
            <span>Tambah Catatan</span>
          </button>
        </div>
      </div>


      {/* Due Alerts Alert Center */}
      {dueAlerts.length > 0 && (
        <div className={styles.alertBanner}>
          <AlertCircle size={20} className={styles.alertBannerIcon} />
          <div className={styles.alertBannerContent}>
            <strong>Perhatian:</strong> Ada {dueAlerts.length} tagihan yang jatuh tempo segera atau terlewat.
            <div className={styles.alertList}>
              {dueAlerts.map(item => {
                const diffDays = Math.ceil((new Date(item.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                const remaining = item.totalAmount - item.paidAmount;
                return (
                  <div key={item.id} className={styles.alertListItem}>
                    • <strong>{item.name}</strong> ({item.type === "debt" ? "Utang" : "Piutang"}) sebesar {formatCurrency(remaining, baseCurrency)} 
                    {diffDays < 0 
                      ? <span className={styles.dueDanger}> Terlewat {Math.abs(diffDays)} hari!</span>
                      : diffDays === 0 
                      ? <span className={styles.dueWarning}> Jatuh tempo HARI INI!</span>
                      : <span className={styles.dueInfo}> Jatuh tempo dalam {diffDays} hari.</span>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Aggregated Summaries Grid */}
      <div className={styles.summaryGrid}>
        <div className={`card ${styles.summaryCard}`}>
          <div className={`${styles.cardIndicator} ${styles.red}`}></div>
          <div className={styles.summaryContent}>
            <div className={`${styles.iconWrapper} ${styles.red}`}>
              <TrendingDown size={24} />
            </div>
            <div>
              <span className={styles.summaryLabel}>Saya Berutang (Kewajiban)</span>
              <h2 className={`${styles.summaryValue} text-danger`}>{formatCurrency(totalOwed, baseCurrency)}</h2>
              <span className={styles.summaryDescription}>Dari {activeDebts.length} tagihan aktif</span>
            </div>
          </div>
        </div>

        <div className={`card ${styles.summaryCard}`}>
          <div className={`${styles.cardIndicator} ${styles.green}`}></div>
          <div className={styles.summaryContent}>
            <div className={`${styles.iconWrapper} ${styles.green}`}>
              <TrendingUp size={24} />
            </div>
            <div>
              <span className={styles.summaryLabel}>Orang Berutang ke Saya (Piutang)</span>
              <h2 className={`${styles.summaryValue} text-success`}>{formatCurrency(totalLent, baseCurrency)}</h2>
              <span className={styles.summaryDescription}>Dari {activeLoans.length} pinjaman aktif</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher & Filter */}
      <div className={styles.filterBar}>
        <div className={styles.tabs}>
          <button 
            className={`${styles.tabBtn} ${activeTab === "debt" ? styles.active : ""}`} 
            onClick={() => setActiveTab("debt")}
          >
            Utang Saya (Kewajiban)
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === "loan" ? styles.active : ""}`} 
            onClick={() => setActiveTab("loan")}
          >
            Piutang Saya (Lent)
          </button>
        </div>

        <div className={styles.filters}>
          <span className={styles.filterLabel}>Status:</span>
          <select 
            className={`form-input ${styles.filterSelect}`} 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "active" | "paid" | "all")}
          >
            <option value="active">Aktif / Belum Lunas</option>
            <option value="paid">Lunas</option>
            <option value="all">Semua Catatan</option>
          </select>
        </div>
      </div>

      {/* List Ledger */}
      <div className={styles.ledgerList}>
        {filteredDebts.map((item) => {
          const remaining = item.totalAmount - item.paidAmount;
          const percentage = (item.paidAmount / item.totalAmount) * 100;
          const isLunas = item.status === "paid" || remaining <= 0;
          
          return (
            <div key={item.id} className={`card ${styles.ledgerCard} ${isLunas ? styles.lunas : ""}`}>
              <div className={styles.ledgerHeader}>
                <div>
                  <div className={styles.ledgerTitle}>
                    <span className={styles.ledgerName}>{item.name}</span>
                    {isLunas ? (
                      <span className={`${styles.badgeStatus} ${styles.success}`}>Lunas</span>
                    ) : (
                      <span className={`${styles.badgeStatus} ${styles.warning}`}>Aktif</span>
                    )}
                  </div>
                  <div className={styles.ledgerDuedate}>
                    <Calendar size={12} style={{ marginRight: "4px" }} />
                    Jatuh tempo: {new Date(item.dueDate).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" })}
                  </div>
                </div>

                <div className={styles.ledgerActions}>
                  {!isLunas && (
                    <button className={`btn btn-primary ${styles.btnSm}`} onClick={() => openPaymentModal(item.id)}>
                      Bayar / Cicil
                    </button>
                  )}
                  <button className={styles.deleteBtn} onClick={() => handleDeleteDebt(item.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Progress Visual */}
              <div className={styles.ledgerProgress}>
                <div className={styles.ledgerProgressText}>
                  <span>Progres Pelunasan</span>
                  <span>{percentage.toFixed(0)}% ({formatCurrency(item.paidAmount, baseCurrency)} / {formatCurrency(item.totalAmount, baseCurrency)})</span>
                </div>
                <div className={styles.progressBarContainer}>
                  <div 
                    className={`${styles.progressBar} ${isLunas ? styles.bgSuccess : ""}`} 
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Balances detail */}
              <div className={styles.ledgerFooter}>
                <span>Kekurangan:</span>
                <strong className={isLunas ? "text-success" : "text-danger"}>
                  {isLunas ? "LUNAS" : formatCurrency(remaining, baseCurrency)}
                </strong>
              </div>
            </div>
          );
        })}

        {filteredDebts.length === 0 && (
          <div className={`card ${styles.emptyLedgerCard}`}>
            <CreditCard size={48} className={styles.emptyIcon} />
            <h3>Tidak Ada Catatan Ditemukan</h3>
            <p>Tidak ada catatan {activeTab === "debt" ? "utang" : "piutang"} yang berstatus {statusFilter === "active" ? "aktif" : statusFilter === "paid" ? "lunas" : ""}.</p>
          </div>
        )}
      </div>

      {/* MODAL 1: Create Debt/Loan */}
      {isDebtModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDebtModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Catatan {debtType === "debt" ? "Utang Baru" : "Piutang Baru"}</h2>
              <button className={styles.closeBtn} onClick={() => setIsDebtModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateDebt} className={styles.modalBody}>
              <div className="form-group">
                <label className="form-label">Tipe Transaksi</label>
                <select 
                  className="form-input" 
                  value={debtType} 
                  onChange={(e) => setDebtType(e.target.value as "debt" | "loan")}
                >
                  <option value="debt">Utang (Saya Berutang ke Orang Lain)</option>
                  <option value="loan">Piutang (Orang Lain Berutang ke Saya)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Catatan / Deskripsi</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Misal: Cicilan Laptop BCA, Pinjaman Andi" 
                  value={debtName}
                  onChange={(e) => setDebtName(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Total Nominal ({baseCurrency})</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Jumlah keseluruhan pinjaman" 
                  value={totalAmount ? formatNumberWithSeparator(totalAmount, baseCurrency) : ""}
                  onChange={(e) => {
                    const raw = parseFormattedNumber(e.target.value, baseCurrency).toString();
                    setTotalAmount(raw || "");
                  }}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Terbayar Awal (Opsional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Jumlah yang sudah dicicil/terbayar saat ini" 
                  value={paidAmount ? formatNumberWithSeparator(paidAmount, baseCurrency) : ""}
                  onChange={(e) => {
                    const raw = parseFormattedNumber(e.target.value, baseCurrency).toString();
                    setPaidAmount(raw || "");
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Batas Waktu Pelunasan (Due Date)</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required 
                />
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsDebtModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan Catatan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Record Payment */}
      {isPaymentModalOpen && selectedDebt && (
        <div className="modal-overlay" onClick={() => setIsPaymentModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Catat Angsuran Pelunasan</h2>
              <button className={styles.closeBtn} onClick={() => setIsPaymentModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handlePaymentSubmit} className={styles.modalBody}>
              <div className={styles.goalBanner}>
                <div className={styles.bannerIcon}><CreditCard size={20} /></div>
                <div>
                  <div className={styles.bannerName}>
                    {debts.find(d => d.id === selectedDebt)?.name}
                  </div>
                  <div className={styles.bannerAmount}>
                    Sisa Tagihan: {formatCurrency((debts.find(d => d.id === selectedDebt)?.totalAmount || 0) - (debts.find(d => d.id === selectedDebt)?.paidAmount || 0), baseCurrency)}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Jumlah Pembayaran / Angsuran ({baseCurrency})</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Nominal pembayaran" 
                  value={paymentAmount ? formatNumberWithSeparator(paymentAmount, baseCurrency) : ""}
                  onChange={(e) => {
                    const raw = parseFormattedNumber(e.target.value, baseCurrency).toString();
                    setPaymentAmount(raw || "");
                  }}
                  required 
                  autoFocus
                />
              </div>

              <div className={`form-group ${styles.checkboxGroup}`}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox" 
                    checked={linkWallet}
                    onChange={(e) => setLinkWallet(e.target.checked)}
                  />
                  <span>Hubungkan dengan Dompet / Rekening</span>
                </label>
                <p className={styles.checkboxDescription}>
                  {debts.find(d => d.id === selectedDebt)?.type === "debt" 
                    ? "Mengurangi saldo dompet secara riil sebagai Pengeluaran." 
                    : "Menambah saldo dompet secara riil sebagai Pendapatan."}
                </p>
              </div>

              {linkWallet && (
                <div className="form-group">
                  <label className="form-label">Pilih Rekening Dompet</label>
                  <select 
                    className="form-input"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    required={linkWallet}
                  >
                    <option value="" disabled>-- Pilih Akun --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.icon} {acc.name} (Saldo: {formatCurrency(acc.balance, acc.currency)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">Konfirmasi Pembayaran</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
