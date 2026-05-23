"use client";

import React, { useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useFinance } from "@/lib/financeContext";
import { 
  Plus, Edit2, Trash2, ShieldAlert, Award, Save, 
  X, AlertTriangle, CheckCircle2 
} from "lucide-react";
import { Budget, Category } from "@/lib/types";
import styles from "./budgets.module.css";
import { formatNumberWithSeparator, parseFormattedNumber } from "@/lib/formatHelpers";

export default function Budgets() {
  const { 
    budgets, 
    transactions, 
    categories, 
    saveBudget, 
    deleteBudget, 
    formatCurrency,
    convertCurrency,
    settings 
  } = useFinance();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Form Fields
  const [categoryId, setCategoryId] = useState("");
  const [amountLimit, setAmountLimit] = useState("");

  const handleEdit = (bud: Budget) => {
    setEditingBudget(bud);
    setCategoryId(bud.categoryId);
    setAmountLimit(bud.amountLimit.toString());
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setEditingBudget(null);
    // Find first category that doesn't have a budget set yet
    const budgetedIds = budgets.map(b => b.categoryId);
    const availableCat = categories.find(c => c.type === "expense" && !budgetedIds.includes(c.id));
    
    setCategoryId(availableCat ? availableCat.id : "");
    setAmountLimit("");
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !amountLimit) return;

    const budData: Omit<Budget, "id"> & { id?: string } = {
      categoryId,
      amountLimit: Number(amountLimit)
    };

    if (editingBudget) {
      budData.id = editingBudget.id;
    }

    await saveBudget(budData);
    setIsFormOpen(false);
  };

  const confirm = useConfirm();

  const handleDelete = async (id: string) => {
    const yes = await confirm({
      title: "Hapus Anggaran",
      message: "Apakah Anda yakin ingin menghapus anggaran ini?",
      variant: "danger",
      confirmText: "Ya, Hapus",
    });
    if (yes) {
      await deleteBudget(id);
    }
  };

  // --- Financial Calculations for Budgets ---
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const baseCurr = settings.baseCurrency || "IDR";

  // Calculate monthly spent per category
  const getCategorySpent = (catId: string) => {
    return transactions
      .filter(tx => {
        if (tx.type !== "expense" || tx.categoryId !== catId) return false;
        const txDate = new Date(tx.date);
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      })
      .reduce((sum, tx) => sum + convertCurrency(tx.amount, tx.currency || "IDR", baseCurr), 0);
  };

  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amountLimit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + getCategorySpent(b.categoryId), 0);
  
  // Available categories for adding new budgets (filter out already budgeted ones, unless editing)
  const budgetedIds = budgets.map(b => b.categoryId);
  const eligibleCategories = categories.filter(c => 
    c.type === "expense" && 
    (!budgetedIds.includes(c.id) || (editingBudget && editingBudget.categoryId === c.id))
  );

  return (
    <div className={styles.budgetsRoot}>
      
      {/* Title Bar */}
      <div className="page-header-flex">
        <div className="page-header-info">
          <h1 className="page-header-title">Batas Anggaran Bulanan</h1>
          <p className="page-header-subtitle">Kendalikan pengeluaran Anda dengan menetapkan batas spending per kategori.</p>
        </div>
        <div className="page-header-actions">
          <button 
            className="btn btn-primary" 
            onClick={handleAddNew}
          >
            <Plus size={16} /> Buat Anggaran
          </button>
        </div>
      </div>


      {/* High-Level Overview Widget */}
      <div className={`card ${styles.overviewCard}`}>
        <div className={styles.overviewRow}>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLbl}>TOTAL ANGGARAN</span>
            <div className={`${styles.overviewVal} font-semibold`}>{formatCurrency(totalBudgeted, baseCurr)}</div>
          </div>
          <div className={styles.overviewDivider}></div>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLbl}>TERPAKAI BULAN INI</span>
            <div className={`${styles.overviewVal} font-semibold ${styles.textExpense}`}>{formatCurrency(totalSpent, baseCurr)}</div>
          </div>
          <div className={styles.overviewDivider}></div>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLbl}>SISA ANGGARAN GABUNGAN</span>
            <div className={`${styles.overviewVal} font-semibold ${totalBudgeted - totalSpent >= 0 ? styles.textIncome : styles.textExpense}`}>
              {formatCurrency(totalBudgeted - totalSpent, baseCurr)}
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className={styles.globalProgress}>
          <div className={`${styles.progressBarContainer} ${styles.large}`}>
            <div 
              className={`${styles.progressFill} ${totalSpent > totalBudgeted ? styles.danger : totalSpent >= totalBudgeted * 0.8 ? styles.warning : styles.success}`}
              style={{ width: `${Math.min((totalSpent / (totalBudgeted || 1)) * 100, 100)}%` }}
            ></div>
          </div>
          <div className={styles.progressLabels}>
            <span>0%</span>
            <span>Terpakai: {totalBudgeted > 0 ? ((totalSpent / totalBudgeted) * 100).toFixed(0) : 0}%</span>
            <span>Limit: 100%</span>
          </div>
        </div>
      </div>

      {/* Grid List of budgets */}
      <div className={styles.budgetsGrid}>
        {budgets.length === 0 ? (
          <div className={`card ${styles.emptyBudgets} text-center text-muted`}>
            <Award size={48} className="text-muted" style={{ marginBottom: "16px" }} />
            <p>Anda belum menyetel batas anggaran bulanan.</p>
            <p className={styles.subText}>Menyetel anggaran dapat menghemat pengeluaran hingga 20%!</p>
          </div>
        ) : (
          budgets.map(bud => {
            const cat = categories.find(c => c.id === bud.categoryId) || { name: "Kategori", icon: "🏷️", color: "#64748b" };
            const spent = getCategorySpent(bud.categoryId);
            const limit = bud.amountLimit;
            const ratio = limit > 0 ? (spent / limit) : 0;
            const percent = Math.min(ratio * 100, 100);
            
            const isExceeded = spent > limit;
            const isWarning = spent >= limit * 0.8 && spent <= limit;

            return (
              <div key={bud.id} className={`card ${styles.budgetCardItem}`}>
                
                {/* Actions */}
                <div className={styles.cardActions}>
                  <button className={styles.iconBtnSm} onClick={() => handleEdit(bud)}>
                    <Edit2 size={12} />
                  </button>
                  <button className={`${styles.iconBtnSm} ${styles.delete}`} onClick={() => handleDelete(bud.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className={styles.cardTopInfo}>
                  <div className={styles.categoryMeta}>
                    <span className={styles.catIconLarge} style={{ backgroundColor: cat.color + "15", color: cat.color }}>
                      {cat.icon}
                    </span>
                    <div>
                      <h4 className="font-semibold">{cat.name}</h4>
                      <span className={styles.periodBadge}>Bulanan</span>
                    </div>
                  </div>
                  
                  {isExceeded ? (
                    <div className={`${styles.statusPill} ${styles.exceeded}`}>
                      <ShieldAlert size={12} /> Over Limit
                    </div>
                  ) : isWarning ? (
                    <div className={`${styles.statusPill} ${styles.warning}`}>
                      <AlertTriangle size={12} /> Kritis
                    </div>
                  ) : (
                    <div className={`${styles.statusPill} ${styles.safe}`}>
                      <CheckCircle2 size={12} /> Aman
                    </div>
                  )}
                </div>

                <div className={styles.cardBudgetData}>
                  <div className={styles.dataRow}>
                    <span className={styles.lbl}>Terpakai</span>
                    <span className={`${styles.val} font-semibold`}>{formatCurrency(spent, baseCurr)}</span>
                  </div>
                  <div className={styles.dataRow}>
                    <span className={styles.lbl}>Limit Anggaran</span>
                    <span className={`${styles.val} font-semibold`}>{formatCurrency(limit, baseCurr)}</span>
                  </div>
                </div>

                <div className={styles.progressBarContainer}>
                  <div 
                    className={`${styles.progressFill} ${isExceeded ? styles.danger : isWarning ? styles.warning : styles.success}`}
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>

                <div className={styles.budgetCardFooter}>
                  {isExceeded ? (
                    <span className={styles.warningText}>Melebihi batas sebesar {formatCurrency(spent - limit, baseCurr)}!</span>
                  ) : (
                    <span className={styles.safeText}>Sisa kuota belanja: {formatCurrency(limit - spent, baseCurr)}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Set/Edit Budget Modal Form */}
      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className={`modal-content ${styles.formModal}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingBudget ? "Edit Batas Anggaran" : "Buat Anggaran Kategori"}</h2>
              <button className={styles.closeBtn} onClick={() => setIsFormOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalBody}>
              <div className="form-group">
                <label className="form-label">Pilih Kategori Belanja</label>
                {eligibleCategories.length === 0 && !editingBudget ? (
                  <p style={{ fontSize: "13px", color: "var(--color-income)", fontWeight: 600, padding: "10px 0" }}>
                    ✅ Semua kategori pengeluaran sudah memiliki batas anggaran.
                  </p>
                ) : (
                  <select 
                    className="form-input" 
                    value={categoryId} 
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={!!editingBudget}
                    required
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {eligibleCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                )}
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Catatan: Satu kategori belanja hanya bisa memiliki satu batas anggaran bulanan.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Batas Limit Bulanan ({settings.baseCurrency || "Rp"})</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={settings.baseCurrency === "USD" ? "Example: 150" : "Contoh: 1.500.000"} 
                  value={amountLimit ? formatNumberWithSeparator(amountLimit, settings.baseCurrency || "IDR") : ""}
                  onChange={(e) => {
                    const raw = parseFormattedNumber(e.target.value, settings.baseCurrency || "IDR").toString();
                    setAmountLimit(raw || "");
                  }}
                  required
                />
              </div>

              <button type="submit" className={`btn btn-primary ${styles.submitBtn}`}>
                <Save size={16} /> Simpan Anggaran
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
