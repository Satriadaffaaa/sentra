"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useFinance } from "@/lib/financeContext";
import { 
  ArrowUpRight, ArrowDownRight, TrendingUp, 
  ChevronUp, ChevronDown, EyeOff, Eye, Plus 
} from "lucide-react";
import { Category } from "@/lib/types";
import styles from "./page.module.css";

interface WidgetConfig {
  id: string;
  title: string;
  visible: boolean;
}

interface ChartCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  percent: number;
}

export default function Dashboard() {
  const { 
    accounts, 
    transactions, 
    categories, 
    budgets, 
    formatCurrency, 
    convertCurrency,
    settings,
    setIsQuickAddOpen,
    debts
  } = useFinance();

  // Widget Order State (Flex-Dashboard requirement)
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    { id: "kpis", title: "Ringkasan Keuangan", visible: true },
    { id: "health", title: "Kesehatan Keuangan & AI Advisor", visible: true },
    { id: "analytics", title: "Grafik & Analisis", visible: true },
    { id: "budgets", title: "Batas Anggaran Bulanan", visible: true },
    { id: "recent", title: "Transaksi Terakhir", visible: true }
  ]);

  const [hoveredSlice, setHoveredSlice] = useState<ChartCategory | null>(null);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

  // Load widget configuration from LocalStorage if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dashboard_widgets_order");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as WidgetConfig[];
          const defaultWidgets = [
            { id: "kpis", title: "Ringkasan Keuangan", visible: true },
            { id: "health", title: "Kesehatan Keuangan & AI Advisor", visible: true },
            { id: "analytics", title: "Grafik & Analisis", visible: true },
            { id: "budgets", title: "Batas Anggaran Bulanan", visible: true },
            { id: "recent", title: "Transaksi Terakhir", visible: true }
          ];
          // Find any default widgets that are not in parsed, and append them
          const missing = defaultWidgets.filter(dw => !parsed.some(pw => pw.id === dw.id));
          if (missing.length > 0) {
            setWidgets([...parsed, ...missing]);
          } else {
            setWidgets(parsed);
          }
        } catch (e) {}
      }
    }
  }, []);

  const saveWidgetOrder = (newWidgets: WidgetConfig[]) => {
    setWidgets(newWidgets);
    if (typeof window !== "undefined") {
      localStorage.setItem("dashboard_widgets_order", JSON.stringify(newWidgets));
    }
  };

  // Reordering functions
  const moveWidget = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= widgets.length) return;
    
    const updated = [...widgets];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    saveWidgetOrder(updated);
  };

  const toggleWidgetVisibility = (id: string) => {
    const updated = widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    saveWidgetOrder(updated);
  };

  // --- Financial Aggregations (Calculated in base currency) ---
  const baseCurr = settings.baseCurrency || "IDR";

  // Balance calculation
  const totalBalanceBase = accounts.reduce((sum, acc) => {
    const balInBase = convertCurrency(acc.balance || 0, acc.currency || "IDR", baseCurr);
    return sum + balInBase;
  }, 0);

  // Income & Expense calculation for current month
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
  });

  const monthlyIncomeBase = monthlyTransactions
    .filter(tx => tx.type === "income")
    .reduce((sum, tx) => sum + convertCurrency(tx.amount, tx.currency || "IDR", baseCurr), 0);

  const monthlyExpenseBase = monthlyTransactions
    .filter(tx => tx.type === "expense")
    .reduce((sum, tx) => sum + convertCurrency(tx.amount, tx.currency || "IDR", baseCurr), 0);

  // Net Worth (Total Assets - Debts)
  const totalAssets = accounts
    .filter(acc => acc.type !== "credit_card")
    .reduce((sum, acc) => sum + convertCurrency(acc.balance || 0, acc.currency || "IDR", baseCurr), 0);
  const totalDebts = accounts
    .filter(acc => acc.type === "credit_card")
    .reduce((sum, acc) => sum + Math.abs(convertCurrency(acc.balance || 0, acc.currency || "IDR", baseCurr)), 0);

  // --- Financial Health Score Calculation (0-100) ---
  // 1. Savings Rate (30% weight)
  const savingsRate = monthlyIncomeBase > 0 ? (monthlyIncomeBase - monthlyExpenseBase) / monthlyIncomeBase : 0;
  const savingsRateScore = savingsRate >= 0.20 ? 100 : savingsRate > 0 ? (savingsRate / 0.20) * 100 : 0;

  // 2. Emergency Fund Ratio (30% weight) - Target: 3-6 months
  const bankAndCashBalance = accounts
    .filter(acc => acc.type === "bank" || acc.type === "cash")
    .reduce((sum, acc) => sum + convertCurrency(acc.balance || 0, acc.currency || "IDR", baseCurr), 0);
  const averageMonthlyExpense = monthlyExpenseBase > 0 ? monthlyExpenseBase : 1000000; // fallback to 1M IDR if zero
  const emergencyFundMonths = bankAndCashBalance / averageMonthlyExpense;
  const emergencyFundScore = emergencyFundMonths >= 6 ? 100 : emergencyFundMonths >= 3 ? 80 + ((emergencyFundMonths - 3) / 3) * 20 : (emergencyFundMonths / 3) * 80;

  // 3. Debt-to-Income (DTI) Ratio (20% weight) - Target: < 10%
  const monthlyDebtPayments = transactions
    .filter(tx => tx.type === "expense" && (tx.linkedDebtId || tx.description.toLowerCase().includes("cicilan") || tx.description.toLowerCase().includes("bayar utang")) && new Date(tx.date).getMonth() === currentMonth)
    .reduce((sum, tx) => sum + convertCurrency(tx.amount, tx.currency || "IDR", baseCurr), 0);
  const activeDebtsList = debts ? debts.filter(d => d.type === "debt" && d.status === "active") : [];
  const totalOwedAmount = activeDebtsList.reduce((sum, d) => sum + (d.totalAmount - d.paidAmount), 0);
  
  const estimatedDti = monthlyIncomeBase > 0 
    ? (monthlyDebtPayments / monthlyIncomeBase) 
    : (totalOwedAmount > 0 ? 0.35 : 0); // fallback estimation if no income but has active debt
  
  const dtiScore = estimatedDti <= 0.10 ? 100 : estimatedDti >= 0.50 ? 0 : 100 - ((estimatedDti - 0.10) / 0.40) * 100;

  // 4. Budget Compliance (20% weight)
  let compliantCount = 0;
  budgets.forEach(bud => {
    const spent = transactions
      .filter(tx => tx.type === "expense" && tx.categoryId === bud.categoryId && new Date(tx.date).getMonth() === currentMonth)
      .reduce((sum, tx) => sum + convertCurrency(tx.amount, tx.currency || "IDR", baseCurr), 0);
    if (spent <= bud.amountLimit) {
      compliantCount++;
    }
  });
  const budgetComplianceScore = budgets.length > 0 ? (compliantCount / budgets.length) * 100 : 100;

  // Final Health Score
  const healthScore = Math.round(
    savingsRateScore * 0.30 +
    emergencyFundScore * 0.30 +
    dtiScore * 0.20 +
    budgetComplianceScore * 0.20
  );

  // Health Score Rating & Status
  let healthRating = "Sangat Sehat";
  let healthColor = "var(--color-income)"; // HSL success color
  let healthDesc = "Luar biasa! Pengelolaan keuangan Anda sangat solid. Pertahankan savings rate dan dana darurat Anda.";
  
  if (healthScore < 40) {
    healthRating = "Perlu Perhatian";
    healthColor = "var(--color-expense)"; // HSL danger color
    healthDesc = "Kondisi keuangan Anda kritis. Prioritaskan membangun dana darurat dan kurangi pengeluaran non-esensial.";
  } else if (healthScore < 70) {
    healthRating = "Waspada";
    healthColor = "#f59e0b"; // HSL warning color (amber/gold)
    healthDesc = "Keuangan Anda cukup stabil, namun ada beberapa area seperti dana darurat atau cicilan yang perlu dioptimalkan.";
  } else if (healthScore < 90) {
    healthRating = "Sehat";
    healthColor = "var(--color-income)";
    healthDesc = "Kondisi keuangan Anda sehat. Anda berada di jalur yang benar untuk mencapai kebebasan finansial.";
  }

  // --- Chart 1: Donut Chart Data (Expense by Category) ---
  const expenseByCategory: Record<string, number> = {};
  let totalExpenseForChart = 0;

  transactions
    .filter(tx => tx.type === "expense")
    .forEach(tx => {
      const amtBase = convertCurrency(tx.amount, tx.currency || "IDR", baseCurr);
      const catId = tx.categoryId || "cat-others";
      expenseByCategory[catId] = (expenseByCategory[catId] || 0) + amtBase;
      totalExpenseForChart += amtBase;
    });

  const chartCategories: ChartCategory[] = Object.keys(expenseByCategory).map(catId => {
    const cat = categories.find(c => c.id === catId) || { name: "Lain-lain", color: "#64748b", icon: "🏷️" };
    const amount = expenseByCategory[catId];
    const percent = totalExpenseForChart > 0 ? (amount / totalExpenseForChart) * 100 : 0;
    return { id: catId, name: cat.name, color: (cat as Category).color || "#64748b", icon: (cat as Category).icon || "🏷️", amount, percent };
  }).sort((a, b) => b.amount - a.amount);

  // SVG Donut Slices Helper
  let accumulatedPercent = 0;
  const donutSlices = chartCategories.map((item) => {
    const slice = {
      ...item,
      dashArray: `${item.percent} ${100 - item.percent}`,
      dashOffset: -accumulatedPercent
    };
    accumulatedPercent += item.percent;
    return slice;
  });

  // --- Chart 2: 7-Day Trend Coordinates Generator ---
  const getLast7Days = () => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("id-ID", { weekday: "short" });
      result.push({ dateStr: str, label });
    }
    return result;
  };

  const last7Days = getLast7Days();
  const trendData = last7Days.map(day => {
    const dayTxs = transactions.filter(t => t.date === day.dateStr);
    const inc = dayTxs.filter(t => t.type === "income").reduce((sum, t) => sum + convertCurrency(t.amount, t.currency || "IDR", baseCurr), 0);
    const exp = dayTxs.filter(t => t.type === "expense").reduce((sum, t) => sum + convertCurrency(t.amount, t.currency || "IDR", baseCurr), 0);
    return { label: day.label, income: inc, expense: exp };
  });

  // Calculate coordinates for SVG paths (Area Chart)
  const chartHeight = 120;
  const chartWidth = 500;
  const maxVal = Math.max(...trendData.map(d => Math.max(d.income, d.expense)), 100000); // minimum scale 100k

  const getPoints = (key: "income" | "expense") => {
    return trendData.map((d, i) => {
      const x = (i * (chartWidth / 6)).toFixed(1);
      const val = d[key];
      const y = (chartHeight - (val / maxVal) * (chartHeight - 20)).toFixed(1);
      return `${x},${y}`;
    }).join(" ");
  };

  const incomePoints = getPoints("income");
  const expensePoints = getPoints("expense");

  // Create SVG Area points (must close the path at the bottom)
  const incomeAreaPoints = `0,${chartHeight} ${incomePoints} ${chartWidth},${chartHeight}`;
  const expenseAreaPoints = `0,${chartHeight} ${expensePoints} ${chartWidth},${chartHeight}`;

  const renderWidget = (id: string) => {
    switch (id) {
      case "health": {
        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (healthScore / 100) * circumference;

        return (
          <div className="card">
            <div className={styles.healthWidgetContainer}>
              <div className={styles.healthGaugeWrapper}>
                <svg className={styles.healthGaugeSvg} viewBox="0 0 100 100">
                  <circle
                    className={styles.healthGaugeBg}
                    cx="50"
                    cy="50"
                    r={radius}
                  />
                  <circle
                    className={styles.healthGaugeValueArc}
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke={healthColor}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className={styles.healthGaugeCenterText}>
                  <span className={styles.healthScoreNum}>{healthScore}</span>
                  <span className={styles.healthScoreLabel}>SKOR</span>
                </div>
              </div>
              <div className={styles.healthContent}>
                <h4 className={styles.healthStatusTitle}>{healthRating}</h4>
                <p className={styles.healthStatusDesc}>{healthDesc}</p>
                <Link href="/analytics" className={`btn btn-secondary btn-sm ${styles.healthActionBtn}`}>
                  Lihat Analisis Detail & AI Advisor
                </Link>
              </div>
            </div>
          </div>
        );
      }

      case "kpis":
        return (
          <div className={styles.dashboardGridKpi}>
            {/* Total Balance Card */}
            <div className={`card ${styles.kpiCard} ${styles.brand}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiTitle}>TOTAL SALDO</span>
                <span className={styles.iconWrap}><TrendingUp size={18} /></span>
              </div>
              <div className={styles.kpiValue}>{formatCurrency(totalBalanceBase, baseCurr)}</div>
              <div className={styles.kpiDesc}>Gabungan saldo seluruh rekening</div>
            </div>

            {/* Income Card */}
            <div className={`card ${styles.kpiCard} ${styles.success}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiTitle}>PENDAPATAN BULAN INI</span>
                <span className={`${styles.iconWrap} text-success`}><ArrowUpRight size={18} /></span>
              </div>
              <div className={`${styles.kpiValue} text-success`}>{formatCurrency(monthlyIncomeBase, baseCurr)}</div>
              <div className={styles.kpiDesc}>Bulan {new Date().toLocaleDateString("id-ID", { month: "long" })}</div>
            </div>

            {/* Expense Card */}
            <div className={`card ${styles.kpiCard} ${styles.danger}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiTitle}>PENGELUARAN BULAN INI</span>
                <span className={`${styles.iconWrap} text-danger`}><ArrowDownRight size={18} /></span>
              </div>
              <div className={`${styles.kpiValue} text-danger`}>{formatCurrency(monthlyExpenseBase, baseCurr)}</div>
              <div className={styles.kpiDesc}>Bulan {new Date().toLocaleDateString("id-ID", { month: "long" })}</div>
            </div>
          </div>
        );

      case "analytics":
        return (
          <div className={styles.analyticsSection}>
            {/* Chart 1: Donut Spending */}
            <div className={`card ${styles.chartCard}`}>
              <h4 className={styles.cardTitle}>Pengeluaran per Kategori</h4>
              
              <div className={styles.donutChartContainer}>
                <div className={styles.svgWrapper}>
                  <svg viewBox="0 0 36 36" className={styles.donutSvg}>
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
                    {donutSlices.map((slice) => (
                      <circle
                        key={slice.id}
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="none"
                        stroke={slice.color}
                        strokeWidth="3.2"
                        strokeDasharray={slice.dashArray}
                        strokeDashoffset={slice.dashOffset}
                        transform="rotate(-90 18 18)"
                        className={styles.donutSlice}
                        onMouseEnter={() => setHoveredSlice(slice)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        style={{ cursor: "pointer" }}
                      />
                    ))}
                  </svg>
                  
                  {/* Center Text displaying active hover stats */}
                  <div className={styles.donutCenterText}>
                    {hoveredSlice ? (
                      <>
                        <span className={styles.centerIcon}>{hoveredSlice.icon}</span>
                        <span className={styles.centerLabel}>{hoveredSlice.name}</span>
                        <span className={styles.centerValue}>{hoveredSlice.percent.toFixed(0)}%</span>
                      </>
                    ) : (
                      <>
                        <span className={styles.centerLabel}>Total Belanja</span>
                        <span className={`${styles.centerTotal} font-semibold`}>
                          {formatCurrency(totalExpenseForChart, baseCurr)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Legend */}
                <div className={styles.chartLegend}>
                  {chartCategories.slice(0, 4).map(cat => (
                    <Link 
                      key={cat.id} 
                      href={`/transactions?category=${cat.id}`}
                      className={styles.legendItem}
                    >
                      <div className={styles.legendDot} style={{ backgroundColor: cat.color }}></div>
                      <span className={styles.legendText}>{cat.icon} {cat.name}</span>
                      <span className={`${styles.legendVal} font-semibold`}>{cat.percent.toFixed(0)}%</span>
                    </Link>
                  ))}
                  {chartCategories.length > 4 && (
                    <Link href="/transactions" className={styles.moreLegendLink}>
                      Lihat kategori lainnya...
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Chart 2: 7-Day cashflow area trend */}
            <div className={`card ${styles.chartCard} flex-1`}>
              <h4 className={styles.cardTitle}>Arus Kas (7 Hari Terakhir)</h4>
              
              <div className={styles.areaChartContainer}>
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className={styles.areaSvg}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-income)" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="var(--color-income)" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-expense)" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="var(--color-expense)" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = chartHeight - ratio * (chartHeight - 20);
                    return (
                      <line 
                        key={idx} 
                        x1="0" 
                        y1={y} 
                        x2={chartWidth} 
                        y2={y} 
                        stroke="var(--border-subtle)" 
                        strokeWidth="0.8" 
                        strokeDasharray="4 4" 
                      />
                    );
                  })}

                  {/* Income Area & Line */}
                  <polygon points={incomeAreaPoints} fill="url(#incomeGrad)" />
                  <polyline points={incomePoints} fill="none" stroke="var(--color-income)" strokeWidth="2.5" />

                  {/* Expense Area & Line */}
                  <polygon points={expenseAreaPoints} fill="url(#expenseGrad)" />
                  <polyline points={expensePoints} fill="none" stroke="var(--color-expense)" strokeWidth="2.5" />

                  {/* Hover Indicator Line & Circles */}
                  {hoveredTrendIndex !== null && (
                    <>
                      <line 
                        x1={hoveredTrendIndex * (chartWidth / 6)} 
                        y1={0} 
                        x2={hoveredTrendIndex * (chartWidth / 6)} 
                        y2={chartHeight} 
                        stroke="var(--color-brand)" 
                        strokeWidth="1.2" 
                        strokeDasharray="3 3" 
                      />
                      <circle
                        cx={hoveredTrendIndex * (chartWidth / 6)}
                        cy={chartHeight - (trendData[hoveredTrendIndex].income / maxVal) * (chartHeight - 20)}
                        r="5"
                        fill="var(--color-income)"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={hoveredTrendIndex * (chartWidth / 6)}
                        cy={chartHeight - (trendData[hoveredTrendIndex].expense / maxVal) * (chartHeight - 20)}
                        r="5"
                        fill="var(--color-expense)"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </>
                  )}

                  {/* Invisible rects for horizontal hover zones */}
                  {trendData.map((d, i) => {
                    const segmentWidth = chartWidth / 6;
                    let xStart = i * segmentWidth - segmentWidth / 2;
                    let width = segmentWidth;
                    if (i === 0) {
                      xStart = 0;
                      width = segmentWidth / 2;
                    } else if (i === 6) {
                      width = segmentWidth / 2;
                    }
                    return (
                      <rect
                        key={i}
                        x={xStart}
                        y={0}
                        width={width}
                        height={chartHeight}
                        fill="transparent"
                        onMouseEnter={() => setHoveredTrendIndex(i)}
                        onMouseLeave={() => setHoveredTrendIndex(null)}
                        style={{ cursor: "pointer" }}
                      />
                    );
                  })}
                </svg>

                {/* Floating Tooltip Box */}
                {hoveredTrendIndex !== null && (
                  <div 
                    className={styles.chartTooltip}
                    style={{
                      left: hoveredTrendIndex <= 3 ? `calc(${(hoveredTrendIndex / 6) * 100}% + 12px)` : "auto",
                      right: hoveredTrendIndex > 3 ? `calc(${((6 - hoveredTrendIndex) / 6) * 100}% + 12px)` : "auto",
                    }}
                  >
                    <div className={styles.tooltipTitle}>Arus Kas: {trendData[hoveredTrendIndex].label}</div>
                    <div className={styles.tooltipRow}>
                      <span>Pemasukan:</span>
                      <span className={styles.tooltipIncome}>{formatCurrency(trendData[hoveredTrendIndex].income, baseCurr)}</span>
                    </div>
                    <div className={styles.tooltipRow}>
                      <span>Pengeluaran:</span>
                      <span className={styles.tooltipExpense}>{formatCurrency(trendData[hoveredTrendIndex].expense, baseCurr)}</span>
                    </div>
                  </div>
                )}

                {/* X-axis Labels */}
                <div className={styles.chartXLabels}>
                  {trendData.map((d, idx) => (
                    <span key={idx} className={styles.xLabel}>{d.label}</span>
                  ))}
                </div>

                <div className={styles.chartInfoBadges}>
                  <div className={`${styles.infoBadge} ${styles.inc}`}>
                    <span className={styles.dot}></span> Pemasukan
                  </div>
                  <div className={`${styles.infoBadge} ${styles.exp}`}>
                    <span className={styles.dot}></span> Pengeluaran
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "budgets":
        // Calculate monthly budget progress
        const activeBudgets = budgets.slice(0, 3);
        return (
          <div className={`card ${styles.budgetSummaryCard}`}>
            <div className={styles.cardHeaderFlex}>
              <h4 className={styles.cardTitle}>Kemajuan Anggaran Bulanan</h4>
              <Link href="/budgets" className={styles.textLink}>Selengkapnya</Link>
            </div>
            
            {activeBudgets.length === 0 ? (
              <div className="empty-budget text-center text-muted">
                Belum ada anggaran disetel bulan ini. <Link href="/budgets">Buat Anggaran</Link>
              </div>
            ) : (
              <div className={styles.budgetListVertical}>
                {activeBudgets.map(bud => {
                  const cat = categories.find(c => c.id === bud.categoryId) || { name: "Kategori", icon: "🏷️", color: "#64748b" };
                  // Calculate spent this month
                  const spent = transactions
                    .filter(tx => tx.type === "expense" && tx.categoryId === bud.categoryId && new Date(tx.date).getMonth() === currentMonth)
                    .reduce((sum, tx) => sum + convertCurrency(tx.amount, tx.currency || "IDR", baseCurr), 0);
                  const limit = bud.amountLimit;
                  const ratio = limit > 0 ? (spent / limit) : 0;
                  const percent = Math.min(ratio * 100, 100);
                  const isExceeded = spent > limit;
                  const isWarning = spent >= limit * 0.8 && spent <= limit;

                  return (
                    <div key={bud.id} className={styles.budgetRowItem}>
                      <div className={styles.budgetMeta}>
                        <span className={styles.budgetName}>{cat.icon} {cat.name}</span>
                        <span className={styles.budgetAmounts}>
                          <strong>{formatCurrency(spent, baseCurr)}</strong> / {formatCurrency(limit, baseCurr)}
                        </span>
                      </div>
                      <div className={styles.progressBarContainer}>
                        <div 
                          className={`${styles.progressFill} ${isExceeded ? styles.danger : isWarning ? styles.warning : styles.success}`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case "recent":
        const recentTxs = transactions.slice(0, 4);
        return (
          <div className={`card ${styles.recentTxCard}`}>
            <div className={styles.cardHeaderFlex}>
              <h4 className={styles.cardTitle}>Transaksi Terakhir</h4>
              <Link href="/transactions" className={styles.textLink}>Semua Transaksi</Link>
            </div>

            {recentTxs.length === 0 ? (
              <div className="empty-tx text-center text-muted">
                Belum ada transaksi. Klik "Catat Baru" di bawah atau tekan tombol <strong>N</strong>.
              </div>
            ) : (
              <div className={styles.txListVertical}>
                {recentTxs.map(tx => {
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
                    <div key={tx.id} className={styles.txRowItem}>
                      <div className={styles.txIconDesc}>
                        <div className={styles.txCategoryIcon} style={{ backgroundColor: isTransfer ? "var(--color-brand-light)" : (cat?.color || "#64748b") + "15", color: isTransfer ? "var(--color-brand)" : (cat?.color || "#64748b") }}>
                          {isTransfer ? "⇆" : cat?.icon || "🏷️"}
                        </div>
                        <div className={styles.txDetails}>
                          <span className={`${styles.txDesc} font-semibold`}>{tx.description}</span>
                          <span className={styles.txMetaInfo}>{accountDetails} • {new Date(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                        </div>
                      </div>
                      <div className={`${styles.txAmountCol} font-semibold ${isExpense ? styles.expense : isTransfer ? styles.transfer : styles.income}`}>
                        {isExpense ? "-" : isTransfer ? "" : "+"}
                        {formatCurrency(tx.amount, tx.currency || "IDR")}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.dashboardRoot}>
      
      {/* Top Welcome Title */}
      <div className="page-header-flex">
        <div className="page-header-info">
          <h1 className="page-header-title">Halo, Selamat Datang!</h1>
          <p className="page-header-subtitle">Berikut ringkasan kondisi finansial Anda hari ini.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsQuickAddOpen(true)}>
            <Plus size={16} /> Catat Transaksi
          </button>
        </div>
      </div>


      {/* Grid containing Flex-Dashboard widgets */}
      <div className={styles.dashboardSectionsFlow}>
        {widgets.map((widget, index) => {
          if (!widget.visible) return null;
          return (
            <div key={widget.id} className={styles.widgetWrapperCard}>
              <div className={styles.widgetDragBar}>
                <span className={styles.widgetLabelTitle}>{widget.title}</span>
                <div className={styles.widgetActionsWrap}>
                  <button 
                    disabled={index === 0} 
                    onClick={() => moveWidget(index, "up")}
                    className={styles.widgetArrBtn}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button 
                    disabled={index === widgets.length - 1} 
                    onClick={() => moveWidget(index, "down")}
                    className={styles.widgetArrBtn}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button 
                    onClick={() => toggleWidgetVisibility(widget.id)}
                    className={`${styles.widgetArrBtn} hide`}
                  >
                    <EyeOff size={14} />
                  </button>
                </div>
              </div>
              <div className={styles.widgetBodyRender}>
                {renderWidget(widget.id)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hidden Widgets Control Panel */}
      {widgets.some(w => !w.visible) && (
        <div className={`card ${styles.hiddenWidgetsPanel}`}>
          <h5>Widget yang tersembunyi:</h5>
          <div className={styles.hiddenButtonsRow}>
            {widgets.filter(w => !w.visible).map(w => (
              <button key={w.id} className="btn btn-secondary btn-sm" onClick={() => toggleWidgetVisibility(w.id)}>
                <Eye size={12} /> Tampilkan {w.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
