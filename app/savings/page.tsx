"use client";

import React, { useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useFinance } from "@/lib/financeContext";
import { PiggyBank, Plus, Calendar, Trash2 } from "lucide-react";
import { SavingsGoal, Account, Transaction } from "@/lib/types";
import { formatNumberWithSeparator, parseFormattedNumber } from "@/lib/formatHelpers";
import styles from "./savings.module.css";

export default function SavingsPage() {
  const {
    savingsGoals,
    accounts,
    isLoading,
    formatCurrency,
    saveSavingsGoal,
    deleteSavingsGoal,
    addTransaction,
    settings,
    pushNotification
  } = useFinance();

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  // Form states for adding goal
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [initialAmount, setInitialAmount] = useState("0");

  // Form states for contributing funds
  const [fundAction, setFundAction] = useState<"deposit" | "withdraw">("deposit"); // deposit or withdraw
  const [fundAmount, setFundAmount] = useState("");
  const [linkWallet, setLinkWallet] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const baseCurrency = settings.baseCurrency || "IDR";

  // Loading indicator
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Memuat target tabungan Anda...</p>
      </div>
    );
  }

  // Handle saving new goal
  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName || !targetAmount || !targetDate) return;

    try {
      await saveSavingsGoal({
        name: goalName,
        targetAmount: Number(targetAmount),
        currentAmount: Number(initialAmount) || 0,
        targetDate: targetDate
      });

      // Reset form
      setGoalName("");
      setTargetAmount("");
      setTargetDate("");
      setInitialAmount("0");
      setIsGoalModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const confirm = useConfirm();

  // Handle deleting a goal
  const handleDeleteGoal = async (id: string) => {
    const yes = await confirm({
      title: "Hapus Target Tabungan",
      message: "Apakah Anda yakin ingin menghapus target tabungan ini?",
      variant: "danger",
      confirmText: "Ya, Hapus",
    });
    if (yes) {
      await deleteSavingsGoal(id);
    }
  };

  // Handle funding transaction
  const handleFundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !fundAmount || Number(fundAmount) <= 0) return;

    const amount = Number(fundAmount);
    const goal = savingsGoals.find(g => g.id === selectedGoal);
    if (!goal) return;

    try {
      if (linkWallet && selectedAccountId) {
        // Link to wallet
        const account = accounts.find(a => a.id === selectedAccountId);
        if (!account) return;

        // If depositing, check if balance is sufficient
        if (fundAction === "deposit" && account.type !== "credit_card" && account.balance < amount) {
          pushNotification(`Saldo di ${account.name} tidak mencukupi untuk menabung sebesar ${formatCurrency(amount, baseCurrency)}`, "error");
          return;
        }

        // Record a transaction
        // Setor (deposit) -> wallet expense (money leaves wallet to enter savings jar)
        // Tarik (withdraw) -> wallet income (money returns to wallet from savings jar)
        const tx: Omit<Transaction, "id"> = {
          amount: amount,
          type: fundAction === "deposit" ? "expense" : "income",
          categoryId: "cat-investment", // or another category
          description: fundAction === "deposit" 
            ? `Setoran Tabungan: ${goal.name}`
            : `Penarikan Tabungan: ${goal.name}`,
          date: new Date().toISOString().split("T")[0],
          accountId: selectedAccountId,
          currency: account.currency
        };

        await addTransaction(tx, { savingsGoalId: goal.id });
      } else {
        // Unlinked direct update
        const factor = fundAction === "deposit" ? 1 : -1;
        const newCurrentAmount = goal.currentAmount + (amount * factor);
        if (newCurrentAmount < 0) {
          pushNotification("Jumlah penarikan melebihi total tabungan saat ini.", "error");
          return;
        }
        await saveSavingsGoal({
          ...goal,
          currentAmount: newCurrentAmount
        });
      }

      // Reset
      setFundAmount("");
      setIsFundModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const openFundModal = (goalId: string, action: "deposit" | "withdraw" = "deposit") => {
    setSelectedGoal(goalId);
    setFundAction(action);
    if (accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
    setIsFundModalOpen(true);
  };

  // Calculate overall savings stats
  const totalSavings = savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = savingsGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const overallPercentage = totalTarget > 0 ? (totalSavings / totalTarget) * 100 : 0;

  return (
    <div className={styles.savingsContainer}>
      {/* Header Panel */}
      <div className="page-header-flex">
        <div className="page-header-info">
          <h1 className="page-header-title">Tabungan & Target</h1>
          <p className="page-header-subtitle">Rencanakan masa depan keuangan Anda dengan menabung secara disiplin.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsGoalModalOpen(true)}>
            <Plus size={18} />
            <span>Buat Target Baru</span>
          </button>
        </div>
      </div>


      {/* Aggregate Stats Card */}
      <div className={`card ${styles.statsCard}`}>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Terkumpul</span>
            <span className={`${styles.statValue} ${styles.textPrimary}`}>{formatCurrency(totalSavings, baseCurrency)}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Kebutuhan Target</span>
            <span className={styles.statValue}>{formatCurrency(totalTarget, baseCurrency)}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Persentase Kumulatif</span>
            <span className={`${styles.statValue} ${styles.textSuccess}`}>{overallPercentage.toFixed(1)}%</span>
          </div>
        </div>
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBar} style={{ width: `${Math.min(overallPercentage, 100)}%` }}></div>
        </div>
      </div>

      {/* Jars Grid View */}
      <div className={styles.jarsGrid}>
        {savingsGoals.map((goal) => {
          const percentage = (goal.currentAmount / goal.targetAmount) * 100;
          const isCompleted = goal.currentAmount >= goal.targetAmount;
          
          // Calculate remaining days
          const today = new Date();
          const target = new Date(goal.targetDate);
          const diffTime = target.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          return (
            <div key={goal.id} className={`card jar-card ${isCompleted ? styles.completed : ""}`}>
              <div className={styles.jarHeader}>
                <div className={styles.jarTitleWrapper}>
                  <div className={styles.jarIcon}>
                    <PiggyBank size={24} />
                  </div>
                  <div>
                    <h3 className={styles.jarName}>{goal.name}</h3>
                    <p className={styles.jarDeadline}>
                      <Calendar size={12} style={{ marginRight: "4px" }} />
                      Target: {new Date(goal.targetDate).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" })}
                      {diffDays > 0 ? ` (${diffDays} hari lagi)` : " (Terlewati)"}
                    </p>
                  </div>
                </div>
                <button className={styles.deleteBtn} onClick={() => handleDeleteGoal(goal.id)}>
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Graphical Jar Visualisation */}
              <div className={styles.jarVisualContainer}>
                <div className={styles.jarGlass}>
                  {/* Liquid fill animation */}
                  <div 
                    className={styles.jarFill} 
                    style={{ height: `${Math.min(percentage, 100)}%` }}
                  >
                    {percentage > 10 && (
                      <span className={styles.fillPercentage}>{percentage.toFixed(0)}%</span>
                    )}
                  </div>
                </div>
                
                {/* Numeric values on the right */}
                <div className={styles.jarDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Terkumpul</span>
                    <span className={`${styles.detailValue} ${styles.textSuccess}`}>{formatCurrency(goal.currentAmount, baseCurrency)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Target</span>
                    <span className={styles.detailValue}>{formatCurrency(goal.targetAmount, baseCurrency)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Kekurangan</span>
                    <span className={`${styles.detailValue} ${styles.textDanger}`}>
                      {formatCurrency(Math.max(goal.targetAmount - goal.currentAmount, 0), baseCurrency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fund Action Buttons */}
              <div className={styles.jarActions}>
                <button 
                  className={`btn btn-secondary ${styles.flex1}`} 
                  onClick={() => openFundModal(goal.id, "withdraw")}
                  disabled={goal.currentAmount <= 0}
                >
                  Tarik Dana
                </button>
                <button 
                  className={`btn btn-primary ${styles.flex1}`} 
                  onClick={() => openFundModal(goal.id, "deposit")}
                >
                  Setor Uang
                </button>
              </div>
            </div>
          );
        })}

        {/* Empty state or quick add card */}
        {savingsGoals.length === 0 && (
          <div className={`card ${styles.emptyJarCard}`} onClick={() => setIsGoalModalOpen(true)}>
            <PiggyBank size={48} className={styles.emptyIcon} />
            <h3>Belum Ada Target Tabungan</h3>
            <p>Klik di sini untuk membuat jar tabungan pertama Anda.</p>
          </div>
        )}
      </div>

      {/* MODAL 1: Create Goal */}
      {isGoalModalOpen && (
        <div className="modal-overlay" onClick={() => setIsGoalModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Target Tabungan Baru</h2>
              <button className={styles.closeBtn} onClick={() => setIsGoalModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateGoal} className={styles.modalBody}>
              <div className="form-group">
                <label className="form-label">Nama Target / Keinginan</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Misal: Dana Darurat, Liburan Jepang" 
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Jumlah Target ({baseCurrency})</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Berapa uang yang dibutuhkan?" 
                  value={targetAmount ? formatNumberWithSeparator(targetAmount, baseCurrency) : ""}
                  onChange={(e) => {
                    const raw = parseFormattedNumber(e.target.value, baseCurrency).toString();
                    setTargetAmount(raw || "");
                  }}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Saldo Awal (Opsional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Uang yang sudah disisihkan saat ini" 
                  value={initialAmount ? formatNumberWithSeparator(initialAmount, baseCurrency) : ""}
                  onChange={(e) => {
                    const raw = parseFormattedNumber(e.target.value, baseCurrency).toString();
                    setInitialAmount(raw || "");
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Target Dicapai</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  required 
                />
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsGoalModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan Target</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Fund Adjustments (Deposit / Withdraw) */}
      {isFundModalOpen && (
        <div className="modal-overlay" onClick={() => setIsFundModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{fundAction === "deposit" ? "Setor ke" : "Tarik dari"} Tabungan</h2>
              <button className={styles.closeBtn} onClick={() => setIsFundModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleFundSubmit} className={styles.modalBody}>
              <div className={styles.goalBanner}>
                <div className={styles.bannerIcon}>
                  <PiggyBank size={20} />
                </div>
                <div>
                  <div className={styles.bannerName}>
                    {savingsGoals.find(g => g.id === selectedGoal)?.name}
                  </div>
                  <div className={styles.bannerAmount}>
                    Saat ini: {formatCurrency(savingsGoals.find(g => g.id === selectedGoal)?.currentAmount || 0, baseCurrency)}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Jumlah Uang ({baseCurrency})</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Jumlah nominal" 
                  value={fundAmount ? formatNumberWithSeparator(fundAmount, baseCurrency) : ""}
                  onChange={(e) => {
                    const raw = parseFormattedNumber(e.target.value, baseCurrency).toString();
                    setFundAmount(raw || "");
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
                  Catat transaksi otomatis sehingga saldo akun/dompet Anda berkurang/bertambah secara riil.
                </p>
              </div>

              {linkWallet && (
                <div className="form-group">
                  <label className="form-label">Pilih Akun / Dompet Sumber</label>
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
                <button type="button" className="btn btn-secondary" onClick={() => setIsFundModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">
                  Konfirmasi {fundAction === "deposit" ? "Setoran" : "Penarikan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
