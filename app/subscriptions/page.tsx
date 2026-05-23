"use client";

import React, { useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useFinance } from "@/lib/financeContext";
import { Plus, Calendar, Trash2, Check, RefreshCw } from "lucide-react";
import styles from "./subscriptions.module.css";
import { Subscription, Account, Category, Transaction } from "@/lib/types";
import { formatNumberWithSeparator, parseFormattedNumber } from "@/lib/formatHelpers";

export default function SubscriptionsPage() {
  const {
    subscriptions,
    accounts,
    categories,
    isLoading,
    formatCurrency,
    saveSubscription,
    deleteSubscription,
    addTransaction,
    settings
  } = useFinance();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);

  // Form states
  const [subName, setSubName] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [subPeriod, setSubPeriod] = useState<string>("monthly");
  const [nextDueDate, setNextDueDate] = useState("");
  const [subType, setSubType] = useState<"auto" | "manual">("auto"); // auto or manual
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const baseCurrency = settings.baseCurrency || "IDR";

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Memuat daftar langganan Anda...</p>
      </div>
    );
  }

  // Handle open modal for create
  const openCreateModal = () => {
    setEditingSub(null);
    setSubName("");
    setSubAmount("");
    setSubPeriod("monthly");
    setNextDueDate("");
    setSubType("auto");
    if (accounts.length > 0) setSelectedAccountId(accounts[0].id);
    const billCat = categories.find(c => c.id === "cat-bills") || categories[0];
    if (billCat) setSelectedCategoryId(billCat.id);
    setIsModalOpen(true);
  };

  // Handle open modal for edit
  const openEditModal = (sub: Subscription) => {
    setEditingSub(sub);
    setSubName(sub.name);
    setSubAmount(sub.amount.toString());
    setSubPeriod((sub as any).period || "monthly");
    setNextDueDate(sub.nextDueDate);
    setSubType(sub.type || "auto");
    setSelectedAccountId(sub.accountId || "");
    setSelectedCategoryId(sub.categoryId || "");
    setIsModalOpen(true);
  };

  // Submit Handler for create/edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName || !subAmount || !nextDueDate || !selectedAccountId || !selectedCategoryId) return;

    try {
      const subData: Omit<Subscription, "id"> & { id?: string; period?: string } = {
        name: subName,
        amount: Number(subAmount),
        period: subPeriod,
        nextDueDate: nextDueDate,
        type: subType,
        accountId: selectedAccountId,
        categoryId: selectedCategoryId,
        active: editingSub ? editingSub.active : true
      };

      if (editingSub) {
        subData.id = editingSub.id;
      }

      await saveSubscription(subData);
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const confirm = useConfirm();

  // Delete Handler
  const handleDeleteSub = async (id: string) => {
    const yes = await confirm({
      title: "Hapus Langganan",
      message: "Apakah Anda yakin ingin menghapus langganan ini dari pemantauan?",
      variant: "danger",
      confirmText: "Ya, Hapus",
    });
    if (yes) {
      await deleteSubscription(id);
    }
  };

  // Manual payment execution trigger
  const handlePayManual = async (sub: Subscription) => {
    const account = accounts.find(a => a.id === sub.accountId);
    const walletText = account ? `${account.icon} ${account.name}` : "akun yang dipilih";
    
    const yes = await confirm({
      title: "Konfirmasi Pembayaran",
      message: `Apakah Anda ingin mencatat pembayaran manual "${sub.name}" sebesar ${formatCurrency(sub.amount, baseCurrency)} menggunakan ${walletText}?`,
      variant: "info",
      confirmText: "Ya, Bayar",
    });
    if (yes) {
      try {
        // 1. Check balance if not credit card
        if (account && account.type !== "credit_card" && account.balance < sub.amount) {
          await confirm({
            title: "Saldo Tidak Cukup",
            message: `Saldo di ${account.name} tidak mencukupi untuk membayar tagihan ini.`,
            variant: "warning",
            confirmText: "Mengerti",
            cancelText: "Tutup",
          });
          return;
        }

        // 2. Create Transaction
        const tx: Omit<Transaction, "id"> = {
          amount: sub.amount,
          type: "expense",
          categoryId: sub.categoryId || "cat-bills",
          description: `${sub.name} (Pembayaran Manual)`,
          date: new Date().toISOString().split("T")[0],
          accountId: sub.accountId,
          linkedSubId: sub.id
        };

        // 3. Increment Next Due Date
        const nextDate = new Date(sub.nextDueDate);
        if ((sub as any).period === "yearly") {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
        const nextDueDateStr = nextDate.toISOString().split("T")[0];

        // 4. Save and Add
        await addTransaction(tx);
        await saveSubscription({ ...sub, nextDueDate: nextDueDateStr });

      } catch (err) {
        console.error(err);
      }
    }
  };

  // Calculate total monthly expenditure
  const totalMonthlyCost = subscriptions.reduce((sum, sub) => {
    let monthlyVal = sub.amount;
    if ((sub as any).period === "yearly") monthlyVal = sub.amount / 12;
    return sum + monthlyVal;
  }, 0);

  // Sort subscriptions by nearest due date
  const sortedSubs = [...subscriptions].sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());

  return (
    <div className={styles.subscriptionsContainer}>
      {/* Page Header */}
      <div className="page-header-flex">
        <div className="page-header-info">
          <h1 className="page-header-title">Tagihan & Langganan</h1>
          <p className="page-header-subtitle">Pantau pengeluaran berulang Netflix, Spotify, listrik, dan tagihan berkala lainnya.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={18} />
            <span>Tambah Langganan</span>
          </button>
        </div>
      </div>


      {/* Aggregate Cost Card */}
      <div className={`card ${styles.costCard}`}>
        <div className={styles.costInfo}>
          <div className={styles.iconWrapper}>
            <RefreshCw size={28} />
          </div>
          <div>
            <span className={styles.costLabel}>Estimasi Beban Bulanan</span>
            <h2 className={styles.costValue}>{formatCurrency(totalMonthlyCost, baseCurrency)}</h2>
            <p className={styles.costDescription}>Dihitung dari total {subscriptions.length} langganan aktif.</p>
          </div>
        </div>
      </div>

      {/* Subscription Grid list */}
      <div className={styles.subsGrid}>
        {sortedSubs.map((sub) => {
          const account = accounts.find(a => a.id === sub.accountId);
          const category = categories.find(c => c.id === sub.categoryId);
          
          // Calculate due status
          const today = new Date();
          today.setHours(0,0,0,0);
          const due = new Date(sub.nextDueDate);
          due.setHours(0,0,0,0);
          const diffTime = due.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let dueLabel = "";
          let dueClass = styles.dueNormal;
          if (diffDays < 0) {
            dueLabel = `Terlewat ${Math.abs(diffDays)} hari!`;
            dueClass = styles.dueDanger;
          } else if (diffDays === 0) {
            dueLabel = "Jatuh tempo hari ini!";
            dueClass = styles.dueWarning;
          } else if (diffDays === 1) {
            dueLabel = "Jatuh tempo besok";
            dueClass = styles.dueWarning;
          } else {
            dueLabel = `Jatuh tempo ${diffDays} hari lagi`;
            dueClass = styles.dueNormal;
          }

          return (
            <div key={sub.id} className={`card ${styles.subCard}`}>
              <div className={styles.subHeader}>
                <div>
                  <h3 className={styles.subName}>{sub.name}</h3>
                  <span className={styles.subCategoryBadge}>
                    {category?.icon || "🏷️"} {category?.name || "Tagihan"}
                  </span>
                </div>
                <div className={styles.subPriceWrapper}>
                  <span className={styles.subPrice}>{formatCurrency(sub.amount, baseCurrency)}</span>
                  <span className={styles.subPeriod}>/{(sub as any).period === "yearly" ? "tahun" : "bulan"}</span>
                </div>
              </div>

              {/* Linked Account & Payment Mode */}
              <div className={styles.subMeta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Sumber Dana:</span>
                  <span className={styles.metaValue}>
                    {account ? `${account.icon} ${account.name}` : "Tidak ditautkan"}
                  </span>
                </div>

                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Metode Pencatatan:</span>
                  <span className={`${styles.badgeMode} ${styles[sub.type] || ""}`}>
                    {sub.type === "auto" ? "Auto-Debet (Otomatis)" : "Konfirmasi Manual"}
                  </span>
                </div>

                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Jadwal Terdekat:</span>
                  <span className={`${styles.metaValue} ${styles.fontSemibold} ${dueClass}`}>
                    {new Date(sub.nextDueDate).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" })} ({dueLabel})
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className={styles.subActions}>
                <button className={styles.deleteBtn} onClick={() => handleDeleteSub(sub.id)}>
                  <Trash2 size={16} />
                </button>
                <div className={styles.rightActions}>
                  <button className={`btn btn-secondary ${styles.btnSm}`} onClick={() => openEditModal(sub)}>
                    Ubah
                  </button>
                  {sub.type === "manual" && (
                    <button className={`btn btn-primary ${styles.btnSm}`} onClick={() => handlePayManual(sub)}>
                      <Check size={14} />
                      <span>Bayar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {subscriptions.length === 0 && (
          <div className={`card ${styles.emptySubCard}`} onClick={openCreateModal}>
            <Calendar size={48} className={styles.emptyIcon} />
            <h3>Belum Ada Tagihan Langganan</h3>
            <p>Klik di sini untuk mendaftarkan Netflix, Spotify, wifi atau BPJS Anda.</p>
          </div>
        )}
      </div>

      {/* MODAL: Create / Edit Subscription */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingSub ? "Edit Langganan" : "Daftarkan Langganan Baru"}</h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className={styles.modalBody}>
              <div className="form-group">
                <label className="form-label">Nama Layanan</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Misal: Netflix Premium, Wifi Rumah" 
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  required 
                />
              </div>

              <div className={styles.formRow2}>
                <div className="form-group">
                  <label className="form-label">Nominal Tagihan ({baseCurrency})</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Biaya" 
                    value={subAmount ? formatNumberWithSeparator(subAmount, baseCurrency) : ""}
                    onChange={(e) => {
                      const raw = parseFormattedNumber(e.target.value, baseCurrency).toString();
                      setSubAmount(raw || "");
                    }}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Siklus</label>
                  <select 
                    className="form-input"
                    value={subPeriod}
                    onChange={(e) => setSubPeriod(e.target.value)}
                  >
                    <option value="monthly">Bulanan</option>
                    <option value="yearly">Tahunan</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Metode Pembayaran (Rekening/Dompet)</label>
                <select 
                  className="form-input"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  required
                >
                  <option value="" disabled>-- Pilih Rekening --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.icon} {acc.name} (Saldo: {formatCurrency(acc.balance, acc.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Kategori Transaksi</label>
                <select 
                  className="form-input"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  required
                >
                  <option value="" disabled>-- Pilih Kategori --</option>
                  {categories.filter(c => c.type === "expense").map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Jatuh Tempo Berikutnya</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Metode Pencatatan</label>
                <select 
                  className="form-input"
                  value={subType}
                  onChange={(e) => setSubType(e.target.value as any)}
                >
                  <option value="auto">Auto-Debet (Catat Transaksi Otomatis Pas Hari Jatuh Tempo)</option>
                  <option value="manual">Konfirmasi Manual (Ingatkan Melalui Notifikasi & Klik Bayar)</option>
                </select>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan Langganan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
