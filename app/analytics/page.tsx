"use client";

import React, { useState, useEffect, useRef } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import Link from "next/link";
import { useFinance } from "@/lib/financeContext";
import { 
  Sparkles, Key, Eye, EyeOff, Send, HelpCircle, 
  TrendingUp, TrendingDown, Wallet, ArrowLeft 
} from "lucide-react";
import styles from "./analytics.module.css";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function AnalyticsPage() {
  const {
    accounts,
    transactions,
    budgets,
    debts,
    settings,
    formatCurrency,
    convertCurrency
  } = useFinance();

  const [apiKey, setApiKey] = useState<string>("");
  const [hasSavedKey, setHasSavedKey] = useState<boolean>(false);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const [hoveredCashflowIndex, setHoveredCashflowIndex] = useState<number | null>(null);
  const [hoveredNetworthIndex, setHoveredNetworthIndex] = useState<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const baseCurr = settings.baseCurrency || "IDR";

  // Load API Key and chat history from local storage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("gemini_api_key");
      if (savedKey) {
        setApiKey(savedKey);
        setHasSavedKey(true);
      }

      const savedChat = localStorage.getItem("finance_ai_chat_history");
      if (savedChat) {
        try {
          setChatHistory(JSON.parse(savedChat));
        } catch (e) {}
      } else {
        // Initial friendly welcome message
        setChatHistory([
          {
            id: "welcome",
            role: "assistant",
            content: "Halo! Saya adalah AI Advisor Keuangan Anda. Saya dapat membantu menganalisis pola pengeluaran, anggaran, rasio utang, atau memberikan tips praktis untuk mencapai target tabungan Anda. Silakan tanyakan apa saja!"
          }
        ]);
      }
    }
  }, []);

  // Save chat history
  const saveChatHistory = (newHistory: ChatMessage[]) => {
    setChatHistory(newHistory);
    if (typeof window !== "undefined") {
      localStorage.setItem("finance_ai_chat_history", JSON.stringify(newHistory));
    }
  };

  const confirm = useConfirm();

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      if (apiKey.trim()) {
        localStorage.setItem("gemini_api_key", apiKey);
        setHasSavedKey(true);
        await confirm({
          title: "Berhasil",
          message: "API Key berhasil disimpan!",
          variant: "info",
          confirmText: "OK",
          cancelText: "Tutup",
        });
      } else {
        localStorage.removeItem("gemini_api_key");
        setHasSavedKey(false);
        await confirm({
          title: "API Key Dihapus",
          message: "API Key berhasil dihapus!",
          variant: "info",
          confirmText: "OK",
          cancelText: "Tutup",
        });
      }
    }
  };

  const handleClearChat = async () => {
    const yes = await confirm({
      title: "Hapus Riwayat Percakapan",
      message: "Apakah Anda yakin ingin menghapus semua riwayat percakapan?",
      variant: "warning",
      confirmText: "Ya, Hapus",
    });
    if (yes) {
      const reset: ChatMessage[] = [
        {
          id: "welcome",
          role: "assistant",
          content: "Halo! Saya adalah AI Advisor Keuangan Anda. Saya dapat membantu menganalisis pola pengeluaran, anggaran, rasio utang, atau memberikan tips praktis untuk mencapai target tabungan Anda. Silakan tanyakan apa saja!"
        }
      ];
      saveChatHistory(reset);
    }
  };

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping]);

  // --- Financial Calculations for health score (consistent with dashboard) ---
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

  const totalAssets = accounts
    .filter(acc => acc.type !== "credit_card")
    .reduce((sum, acc) => sum + convertCurrency(acc.balance || 0, acc.currency || "IDR", baseCurr), 0);

  const totalDebts = accounts
    .filter(acc => acc.type === "credit_card")
    .reduce((sum, acc) => sum + Math.abs(convertCurrency(acc.balance || 0, acc.currency || "IDR", baseCurr)), 0);

  // 1. Savings Rate
  const savingsRate = monthlyIncomeBase > 0 ? (monthlyIncomeBase - monthlyExpenseBase) / monthlyIncomeBase : 0;
  const savingsRateScore = savingsRate >= 0.20 ? 100 : savingsRate > 0 ? (savingsRate / 0.20) * 100 : 0;

  // 2. Emergency Fund Ratio
  const bankAndCashBalance = accounts
    .filter(acc => acc.type === "bank" || acc.type === "cash")
    .reduce((sum, acc) => sum + convertCurrency(acc.balance || 0, acc.currency || "IDR", baseCurr), 0);
  const averageMonthlyExpense = monthlyExpenseBase > 0 ? monthlyExpenseBase : 1000000;
  const emergencyFundMonths = bankAndCashBalance / averageMonthlyExpense;
  const emergencyFundScore = emergencyFundMonths >= 6 ? 100 : emergencyFundMonths >= 3 ? 80 + ((emergencyFundMonths - 3) / 3) * 20 : (emergencyFundMonths / 3) * 80;

  // 3. Debt-to-Income (DTI)
  const monthlyDebtPayments = transactions
    .filter(tx => tx.type === "expense" && (tx.linkedDebtId || tx.description.toLowerCase().includes("cicilan") || tx.description.toLowerCase().includes("bayar utang")) && new Date(tx.date).getMonth() === currentMonth)
    .reduce((sum, tx) => sum + convertCurrency(tx.amount, tx.currency || "IDR", baseCurr), 0);
  const activeDebtsList = debts ? debts.filter(d => d.type === "debt" && d.status === "active") : [];
  const totalOwedAmount = activeDebtsList.reduce((sum, d) => sum + (d.totalAmount - d.paidAmount), 0);
  
  const estimatedDti = monthlyIncomeBase > 0 ? (monthlyDebtPayments / monthlyIncomeBase) : (totalOwedAmount > 0 ? 0.35 : 0);
  const dtiScore = estimatedDti <= 0.10 ? 100 : estimatedDti >= 0.50 ? 0 : 100 - ((estimatedDti - 0.10) / 0.40) * 100;

  // 4. Budget Compliance
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

  const healthScore = Math.round(
    savingsRateScore * 0.30 +
    emergencyFundScore * 0.30 +
    dtiScore * 0.20 +
    budgetComplianceScore * 0.20
  );

  let healthRating = "Sangat Sehat";
  let healthColor = "var(--color-income)";
  let healthDesc = "Luar biasa! Pengelolaan keuangan Anda sangat solid. Pertahankan savings rate dan dana darurat Anda.";
  
  if (healthScore < 40) {
    healthRating = "Perlu Perhatian";
    healthColor = "var(--color-expense)";
    healthDesc = "Kondisi keuangan Anda kritis. Prioritaskan membangun dana darurat dan kurangi pengeluaran non-esensial.";
  } else if (healthScore < 70) {
    healthRating = "Waspada";
    healthColor = "#f59e0b";
    healthDesc = "Keuangan Anda cukup stabil, namun ada beberapa area seperti dana darurat atau cicilan yang perlu dioptimalkan.";
  } else if (healthScore < 90) {
    healthRating = "Sehat";
    healthColor = "var(--color-income)";
    healthDesc = "Kondisi keuangan Anda sehat. Anda berada di jalur yang benar untuk mencapai kebebasan finansial.";
  }

  // --- Historical data gathering for last 6 months ---
  const getLast6Months = () => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthLabel = d.toLocaleDateString("id-ID", { month: "short" });
      const yearLabel = d.getFullYear().toString().substring(2);
      result.push({ year, month, label: `${monthLabel} '${yearLabel}` });
    }
    return result;
  };

  const last6Months = getLast6Months();
  const monthlyData = last6Months.map(({ year, month, label }) => {
    const monthTxs = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === month && txDate.getFullYear() === year;
    });
    const income = monthTxs.filter(t => t.type === "income").reduce((sum, t) => sum + convertCurrency(t.amount, t.currency || "IDR", baseCurr), 0);
    const expense = monthTxs.filter(t => t.type === "expense").reduce((sum, t) => sum + convertCurrency(t.amount, t.currency || "IDR", baseCurr), 0);
    return { label, income, expense };
  });

  // Calculate Net Worth history backward from current net worth
  const currentNW = totalAssets - totalDebts;
  const nwBackward: number[] = [];
  let tempNW = currentNW;
  
  // Go backwards
  for (let i = monthlyData.length - 1; i >= 0; i--) {
    nwBackward.unshift(tempNW);
    const netSavings = monthlyData[i].income - monthlyData[i].expense;
    tempNW = tempNW - netSavings;
  }

  // Calculate Forward projection (3 months)
  const totalNetSavings = monthlyData.reduce((sum, m) => sum + (m.income - m.expense), 0);
  const averageSavings = monthlyData.length > 0 ? totalNetSavings / monthlyData.length : 0;

  const projectedNW = [];
  let forwardNW = currentNW;
  for (let i = 1; i <= 3; i++) {
    forwardNW += averageSavings;
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    const monthLabel = d.toLocaleDateString("id-ID", { month: "short" });
    const yearLabel = d.getFullYear().toString().substring(2);
    projectedNW.push({ label: `${monthLabel} '${yearLabel}`, netWorth: forwardNW, isProjection: true });
  }

  const netWorthData = [
    ...monthlyData.map((m, idx) => ({ label: m.label, netWorth: nwBackward[idx], isProjection: false })),
    ...projectedNW
  ];

  // --- SVG Coordinates Math ---
  const svgW = 500;
  const svgH = 200;
  const padL = 65;
  const padR = 20;
  const padT = 20;
  const padB = 30;
  const innerW = svgW - padL - padR;
  const innerH = svgH - padT - padB;

  // 1. Cashflow coordinates
  const cashflowMax = Math.max(...monthlyData.map(d => Math.max(d.income, d.expense)), 500000);
  const getCashflowX = (idx: number) => padL + (idx / 5) * innerW;
  const getCashflowY = (val: number) => svgH - padB - (val / cashflowMax) * innerH;

  const cashflowIncPath = monthlyData.map((d, i) => `${i === 0 ? "M" : "L"} ${getCashflowX(i).toFixed(1)} ${getCashflowY(d.income).toFixed(1)}`).join(" ");
  const cashflowExpPath = monthlyData.map((d, i) => `${i === 0 ? "M" : "L"} ${getCashflowX(i).toFixed(1)} ${getCashflowY(d.expense).toFixed(1)}`).join(" ");

  const cashflowIncArea = `${cashflowIncPath} L ${getCashflowX(5).toFixed(1)} ${(svgH - padB).toFixed(1)} L ${padL.toFixed(1)} ${(svgH - padB).toFixed(1)} Z`;
  const cashflowExpArea = `${cashflowExpPath} L ${getCashflowX(5).toFixed(1)} ${(svgH - padB).toFixed(1)} L ${padL.toFixed(1)} ${(svgH - padB).toFixed(1)} Z`;

  // 2. Net Worth coordinates
  const nwValues = netWorthData.map(d => d.netWorth);
  const nwMax = Math.max(...nwValues, 1000000);
  const nwMin = Math.min(...nwValues, 0);
  const nwRange = nwMax - nwMin;

  const getNetworthX = (idx: number) => padL + (idx / 8) * innerW;
  const getNetworthY = (val: number) => svgH - padB - ((val - nwMin) / nwRange) * innerH;

  // History path (0 to 5)
  const nwHistoryPath = netWorthData.slice(0, 6).map((d, i) => `${i === 0 ? "M" : "L"} ${getNetworthX(i).toFixed(1)} ${getNetworthY(d.netWorth).toFixed(1)}`).join(" ");
  // Projection path (5 to 8)
  const nwProjPath = netWorthData.slice(5, 9).map((d, i) => `${i === 0 ? "M" : "L"} ${getNetworthX(i + 5).toFixed(1)} ${getNetworthY(d.netWorth).toFixed(1)}`).join(" ");

  const nwFullArea = `${netWorthData.map((d, i) => `${i === 0 ? "M" : "L"} ${getNetworthX(i).toFixed(1)} ${getNetworthY(d.netWorth).toFixed(1)}`).join(" ")} L ${getNetworthX(8).toFixed(1)} ${(svgH - padB).toFixed(1)} L ${padL.toFixed(1)} ${(svgH - padB).toFixed(1)} Z`;

  // --- Gemini API Call Advisor ---
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const savedKey = localStorage.getItem("gemini_api_key") || apiKey;
    if (!savedKey) {
      await confirm({
        title: "API Key Diperlukan",
        message: "Silakan masukkan Gemini API Key terlebih dahulu di atas.",
        variant: "warning",
        confirmText: "Mengerti",
        cancelText: "Tutup",
      });
      return;
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: chatInput
    };

    const newHistory = [...chatHistory, userMsg];
    saveChatHistory(newHistory);
    setChatInput("");
    setIsTyping(true);

    // Build system instruction with anonymized financial data
    const activeAccsList = accounts.map(a => `- ${a.name} (${a.type}): ${formatCurrency(a.balance, a.currency)}`).join("\n");
    const activeBudsList = budgets.map(b => {
      const cat = b.categoryId;
      const spent = transactions
        .filter(t => t.type === "expense" && t.categoryId === b.categoryId && new Date(t.date).getMonth() === currentMonth)
        .reduce((sum, t) => sum + convertCurrency(t.amount, t.currency || "IDR", baseCurr), 0);
      return `- Kategori ${cat}: Terpakai ${formatCurrency(spent, baseCurr)} dari Limit ${formatCurrency(b.amountLimit, baseCurr)}`;
    }).join("\n");
    
    const activeDebtsSummary = debts.filter(d => d.status === "active").map(d => `- ${d.name} (${d.type}): ${formatCurrency(d.totalAmount - d.paidAmount, baseCurr)} sisa`).join("\n");

    const systemPrompt = `Anda adalah AI Advisor Keuangan Pribadi yang cerdas, profesional, dan empatik bernama Satriadaffa Fin Advisor. Anda membantu pengguna menganalisis kondisi keuangan mereka secara terperinci. Gunakan bahasa Indonesia yang ramah, sopan, dan mudah dipahami.
Berikut adalah ringkasan kondisi keuangan pengguna saat ini secara riil (tanpa nama pribadi):
- Mata Uang Basis: ${baseCurr}
- Total Saldo: ${formatCurrency(totalBalanceBase, baseCurr)}
- Kekayaan Bersih: ${formatCurrency(currentNW, baseCurr)}
- Pemasukan Bulan Ini: ${formatCurrency(monthlyIncomeBase, baseCurr)}
- Pengeluaran Bulan Ini: ${formatCurrency(monthlyExpenseBase, baseCurr)}
- Savings Rate: ${(savingsRate * 100).toFixed(1)}% (Skor: ${savingsRateScore.toFixed(0)}/100)
- Dana Darurat: Cukup untuk ${emergencyFundMonths.toFixed(1)} bulan pengeluaran (Skor: ${emergencyFundScore.toFixed(0)}/100)
- Debt-to-Income (DTI) Ratio: ${(estimatedDti * 100).toFixed(1)}% (Skor: ${dtiScore.toFixed(0)}/100)
- Kepatuhan Anggaran: ${budgetComplianceScore.toFixed(0)}% (Skor: ${budgetComplianceScore.toFixed(0)}/100)
- Skor Kesehatan Keuangan Keseluruhan: ${healthScore}/100

Daftar Rekening/Dompet:
${activeAccsList || "Tidak ada rekening tercatat."}

Kemajuan Anggaran Bulan Ini:
${activeBudsList || "Tidak ada anggaran aktif disetel."}

Utang/Kewajiban Aktif:
${activeDebtsSummary || "Tidak ada utang aktif tercatat."}

Instruksi Tambahan:
- Berikan saran keuangan yang taktis, realistis, dan langkah demi langkah.
- Jangan pernah menyarankan investasi spekulatif berisiko tinggi.
- Selalu batasi panjang teks agar ringkas, gunakan bullet point untuk keterbacaan yang baik.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${savedKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: newHistory.map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
          })),
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error! Status: ${response.status}`);
      }

      const data = await response.json();
      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, terjadi kesalahan saat menghubungi AI Advisor.";

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: replyText
      };

      saveChatHistory([...newHistory, assistantMsg]);
    } catch (err) {
      console.error(err);
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: "Koneksi ke Gemini API gagal. Pastikan API Key Anda valid dan terhubung ke internet. Jika menggunakan kuota gratis, harap tunggu beberapa saat sebelum mengirim pesan lagi."
      };
      saveChatHistory([...newHistory, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const totalBalanceBase = accounts.reduce((sum, acc) => {
    const balInBase = convertCurrency(acc.balance || 0, acc.currency || "IDR", baseCurr);
    return sum + balInBase;
  }, 0);

  // Safe Markdown rendering parser (no dangerouslySetInnerHTML to prevent XSS)
  const parseMarkdownText = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const renderMessageContent = (text: string) => {
    const lines = text.split("\n");
    const resultElements = [];
    let inList = false;
    let listItems: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        if (!inList) {
          inList = true;
          listItems = [];
        }
        listItems.push(trimmed.substring(2));
      } else {
        if (inList) {
          resultElements.push(
            <ul key={`list-${i}`} style={{ paddingLeft: "20px", margin: "8px 0" }}>
              {listItems.map((item, idx) => (
                <li key={idx} style={{ marginBottom: "4px" }}>
                  {parseMarkdownText(item)}
                </li>
              ))}
            </ul>
          );
          inList = false;
        }
        if (trimmed) {
          resultElements.push(
            <p key={`p-${i}`} style={{ marginBottom: "12px", lineHeight: "1.5" }}>
              {parseMarkdownText(line)}
            </p>
          );
        }
      }
    }

    if (inList) {
      resultElements.push(
        <ul key={`list-end`} style={{ paddingLeft: "20px", margin: "8px 0" }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ marginBottom: "4px" }}>
              {parseMarkdownText(item)}
            </li>
          ))}
        </ul>
      );
    }

    return resultElements;
  };

  return (
    <div className={styles.analyticsContainer}>
      {/* Header navigasi */}
      <div className="page-header-flex">
        <div className="page-header-info">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link href="/" className="btn btn-secondary btn-sm" style={{ padding: "8px 10px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="page-header-title">Analisis & AI Advisor</h1>
              <p className="page-header-subtitle">Diagnosis kesehatan keuangan mendalam dan konsultasi AI.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rincian Skor Kesehatan Keuangan */}
      <div className={styles.scoreHeaderCard}>
        <div className={styles.scoreIntroSection}>
          <div className={styles.scoreGauge}>
            <svg className={styles.scoreGaugeSvg} viewBox="0 0 100 100">
              <circle className={styles.scoreGaugeBg} cx="50" cy="50" r="44" />
              <circle 
                className={styles.scoreGaugeFill} 
                cx="50" 
                cy="50" 
                r="44"
                stroke={healthColor}
                strokeDasharray={2 * Math.PI * 44}
                strokeDashoffset={2 * Math.PI * 44 - (healthScore / 100) * 2 * Math.PI * 44}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className={styles.scoreGaugeText}>
              <span className={styles.scoreGaugeNum}>{healthScore}</span>
              <span className={styles.scoreGaugeLabel}>SKOR</span>
            </div>
          </div>

          <div className={styles.scoreSummaryText}>
            <h2 className={styles.scoreRating} style={{ color: healthColor }}>Kondisi Keuangan Anda: {healthRating}</h2>
            <p className={styles.scoreDescription}>{healthDesc}</p>
          </div>
        </div>

        {/* 4 Pilar Grid */}
        <div className={styles.scoreBreakdownGrid}>
          {/* Pilar 1: Savings Rate */}
          <div className={styles.breakdownCard}>
            <div className={styles.breakdownHeader}>
              <span className={styles.breakdownTitle}>Savings Rate</span>
              <span className={styles.breakdownScore} style={{ color: savingsRateScore >= 70 ? "var(--color-income)" : savingsRateScore >= 40 ? "#f59e0b" : "var(--color-expense)" }}>
                {savingsRateScore.toFixed(0)}/100
              </span>
            </div>
            <div className={styles.breakdownProgress}>
              <div 
                className={styles.breakdownProgressBar} 
                style={{ 
                  width: `${savingsRateScore}%`,
                  backgroundColor: savingsRateScore >= 70 ? "var(--color-income)" : savingsRateScore >= 40 ? "#f59e0b" : "var(--color-expense)" 
                }}
              />
            </div>
            <div className={styles.breakdownValue}>
              {(savingsRate * 100).toFixed(1)}% Tabungan
            </div>
            <span className={styles.breakdownTip}>
              Target sehat &ge; 20% pemasukan bersih ditabung setiap bulan.
            </span>
          </div>

          {/* Pilar 2: Dana Darurat */}
          <div className={styles.breakdownCard}>
            <div className={styles.breakdownHeader}>
              <span className={styles.breakdownTitle}>Dana Darurat</span>
              <span className={styles.breakdownScore} style={{ color: emergencyFundScore >= 70 ? "var(--color-income)" : emergencyFundScore >= 40 ? "#f59e0b" : "var(--color-expense)" }}>
                {emergencyFundScore.toFixed(0)}/100
              </span>
            </div>
            <div className={styles.breakdownProgress}>
              <div 
                className={styles.breakdownProgressBar} 
                style={{ 
                  width: `${emergencyFundScore}%`,
                  backgroundColor: emergencyFundScore >= 70 ? "var(--color-income)" : emergencyFundScore >= 40 ? "#f59e0b" : "var(--color-expense)" 
                }}
              />
            </div>
            <div className={styles.breakdownValue}>
              {emergencyFundMonths.toFixed(1)} Bulan
            </div>
            <span className={styles.breakdownTip}>
              Amankan saldo kas & bank setara 3 - 6 kali pengeluaran bulanan.
            </span>
          </div>

          {/* Pilar 3: Debt Ratio (DTI) */}
          <div className={styles.breakdownCard}>
            <div className={styles.breakdownHeader}>
              <span className={styles.breakdownTitle}>Rasio Utang (DTI)</span>
              <span className={styles.breakdownScore} style={{ color: dtiScore >= 70 ? "var(--color-income)" : dtiScore >= 40 ? "#f59e0b" : "var(--color-expense)" }}>
                {dtiScore.toFixed(0)}/100
              </span>
            </div>
            <div className={styles.breakdownProgress}>
              <div 
                className={styles.breakdownProgressBar} 
                style={{ 
                  width: `${dtiScore}%`,
                  backgroundColor: dtiScore >= 70 ? "var(--color-income)" : dtiScore >= 40 ? "#f59e0b" : "var(--color-expense)" 
                }}
              />
            </div>
            <div className={styles.breakdownValue}>
              {(estimatedDti * 100).toFixed(1)}% Beban Cicilan
            </div>
            <span className={styles.breakdownTip}>
              Usahakan total cicilan bulanan di bawah 10% dari pemasukan.
            </span>
          </div>

          {/* Pilar 4: Kepatuhan Anggaran */}
          <div className={styles.breakdownCard}>
            <div className={styles.breakdownHeader}>
              <span className={styles.breakdownTitle}>Anggaran Patuh</span>
              <span className={styles.breakdownScore} style={{ color: budgetComplianceScore >= 70 ? "var(--color-income)" : budgetComplianceScore >= 40 ? "#f59e0b" : "var(--color-expense)" }}>
                {budgetComplianceScore.toFixed(0)}/100
              </span>
            </div>
            <div className={styles.breakdownProgress}>
              <div 
                className={styles.breakdownProgressBar} 
                style={{ 
                  width: `${budgetComplianceScore}%`,
                  backgroundColor: budgetComplianceScore >= 70 ? "var(--color-income)" : budgetComplianceScore >= 40 ? "#f59e0b" : "var(--color-expense)" 
                }}
              />
            </div>
            <div className={styles.breakdownValue}>
              {compliantCount} dari {budgets.length} Anggaran
            </div>
            <span className={styles.breakdownTip}>
              Menunjukkan seberapa baik Anda menjaga belanja dalam batas rencana.
            </span>
          </div>
        </div>
      </div>

      {/* Grafik SVG Terperinci */}
      <div className={styles.chartsGrid}>
        {/* Grafik 1: Arus Kas */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Tren Arus Kas (6 Bulan Terakhir)</h3>
          <div className={styles.chartContainer}>
            <svg className={styles.svgChart} viewBox={`0 0 ${svgW} ${svgH}`}>
              <defs>
                <linearGradient id="incGradPage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-income)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="var(--color-income)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="expGradPage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-expense)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="var(--color-expense)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => {
                const y = padT + r * innerH;
                return (
                  <line 
                    key={idx} 
                    x1={padL} 
                    y1={y} 
                    x2={svgW - padR} 
                    y2={y} 
                    stroke="var(--border-subtle)" 
                    strokeWidth="0.8" 
                    strokeDasharray="4 4" 
                  />
                );
              })}

              {/* Shaded Areas */}
              <polygon points={cashflowIncArea} fill="url(#incGradPage)" />
              <polygon points={cashflowExpArea} fill="url(#expGradPage)" />

              {/* Line Curves */}
              <path d={cashflowIncPath} fill="none" stroke="var(--color-income)" strokeWidth="2.5" strokeLinecap="round" />
              <path d={cashflowExpPath} fill="none" stroke="var(--color-expense)" strokeWidth="2.5" strokeLinecap="round" />

              {/* Points */}
              {monthlyData.map((d, i) => (
                <g key={i}>
                  <circle 
                    cx={getCashflowX(i)} 
                    cy={getCashflowY(d.income)} 
                    r="4" 
                    fill="var(--color-income)" 
                    stroke="#ffffff" 
                    strokeWidth="1.5" 
                  />
                  <circle 
                    cx={getCashflowX(i)} 
                    cy={getCashflowY(d.expense)} 
                    r="4" 
                    fill="var(--color-expense)" 
                    stroke="#ffffff" 
                    strokeWidth="1.5" 
                  />
                </g>
              ))}

              {/* Hover highlight line */}
              {hoveredCashflowIndex !== null && (
                <>
                  <line
                    x1={getCashflowX(hoveredCashflowIndex)}
                    y1={padT}
                    x2={getCashflowX(hoveredCashflowIndex)}
                    y2={svgH - padB}
                    stroke="var(--color-brand)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={getCashflowX(hoveredCashflowIndex)}
                    cy={getCashflowY(monthlyData[hoveredCashflowIndex].income)}
                    r="6"
                    fill="var(--color-income)"
                    stroke="var(--bg-card)"
                    strokeWidth="2"
                  />
                  <circle
                    cx={getCashflowX(hoveredCashflowIndex)}
                    cy={getCashflowY(monthlyData[hoveredCashflowIndex].expense)}
                    r="6"
                    fill="var(--color-expense)"
                    stroke="var(--bg-card)"
                    strokeWidth="2"
                  />
                </>
              )}

              {/* Interactive Rectangles */}
              {monthlyData.map((d, i) => {
                const step = innerW / 5;
                const xStart = getCashflowX(i) - step / 2;
                return (
                  <rect
                    key={i}
                    x={i === 0 ? padL : xStart}
                    y={padT}
                    width={i === 0 || i === 5 ? step / 2 : step}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHoveredCashflowIndex(i)}
                    onMouseLeave={() => setHoveredCashflowIndex(null)}
                    style={{ cursor: "pointer" }}
                  />
                );
              })}
            </svg>

            {/* X-Axis labels */}
            <div className={styles.xAxisLabels}>
              {monthlyData.map((d, i) => (
                <span key={i} className={styles.xLabel} style={{ transform: "translateX(-15px)" }}>{d.label}</span>
              ))}
            </div>

            {/* Legend */}
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: "var(--color-income)" }} />
                <span>Pemasukan</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: "var(--color-expense)" }} />
                <span>Pengeluaran</span>
              </div>
            </div>

            {/* Interactive Tooltip */}
            {hoveredCashflowIndex !== null && (
              <div 
                className={styles.chartTooltip}
                style={{
                  left: hoveredCashflowIndex <= 3 ? `calc(${(getCashflowX(hoveredCashflowIndex) / svgW) * 100}% + 8px)` : "auto",
                  right: hoveredCashflowIndex > 3 ? `calc(${((svgW - getCashflowX(hoveredCashflowIndex)) / svgW) * 100}% + 8px)` : "auto",
                }}
              >
                <div className={styles.tooltipTitle}>{monthlyData[hoveredCashflowIndex].label}</div>
                <div className={styles.tooltipRow}>
                  <span>In:</span>
                  <span style={{ color: "var(--color-income)" }}>{formatCurrency(monthlyData[hoveredCashflowIndex].income, baseCurr)}</span>
                </div>
                <div className={styles.tooltipRow}>
                  <span>Out:</span>
                  <span style={{ color: "var(--color-expense)" }}>{formatCurrency(monthlyData[hoveredCashflowIndex].expense, baseCurr)}</span>
                </div>
                <div className={styles.tooltipRow} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "4px", marginTop: "2px" }}>
                  <span>Bersih:</span>
                  <span style={{ color: monthlyData[hoveredCashflowIndex].income - monthlyData[hoveredCashflowIndex].expense >= 0 ? "var(--color-income)" : "var(--color-expense)" }}>
                    {formatCurrency(monthlyData[hoveredCashflowIndex].income - monthlyData[hoveredCashflowIndex].expense, baseCurr)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Grafik 2: Proyeksi Kekayaan Bersih */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Kekayaan Bersih & Proyeksi 3 Bulan</h3>
          <div className={styles.chartContainer}>
            <svg className={styles.svgChart} viewBox={`0 0 ${svgW} ${svgH}`}>
              <defs>
                <linearGradient id="nwGradPage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => {
                const y = padT + r * innerH;
                return (
                  <line 
                    key={idx} 
                    x1={padL} 
                    y1={y} 
                    x2={svgW - padR} 
                    y2={y} 
                    stroke="var(--border-subtle)" 
                    strokeWidth="0.8" 
                    strokeDasharray="4 4" 
                  />
                );
              })}

              {/* Shaded Area */}
              <polygon points={nwFullArea} fill="url(#nwGradPage)" />

              {/* Line curves */}
              <path d={nwHistoryPath} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" />
              <path d={nwProjPath} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" />

              {/* Points */}
              {netWorthData.map((d, i) => (
                <circle 
                  key={i}
                  cx={getNetworthX(i)} 
                  cy={getNetworthY(d.netWorth)} 
                  r={d.isProjection ? "3.5" : "4.5"} 
                  fill={d.isProjection ? "var(--bg-card)" : "var(--color-brand)"} 
                  stroke="var(--color-brand)" 
                  strokeWidth="2" 
                />
              ))}

              {/* Hover highlight line */}
              {hoveredNetworthIndex !== null && (
                <>
                  <line
                    x1={getNetworthX(hoveredNetworthIndex)}
                    y1={padT}
                    x2={getNetworthX(hoveredNetworthIndex)}
                    y2={svgH - padB}
                    stroke="var(--color-brand)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={getNetworthX(hoveredNetworthIndex)}
                    cy={getNetworthY(netWorthData[hoveredNetworthIndex].netWorth)}
                    r="6.5"
                    fill="var(--color-brand)"
                    stroke="var(--bg-card)"
                    strokeWidth="2.5"
                  />
                </>
              )}

              {/* Interactive Rectangles */}
              {netWorthData.map((d, i) => {
                const step = innerW / 8;
                const xStart = getNetworthX(i) - step / 2;
                return (
                  <rect
                    key={i}
                    x={i === 0 ? padL : xStart}
                    y={padT}
                    width={i === 0 || i === 8 ? step / 2 : step}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHoveredNetworthIndex(i)}
                    onMouseLeave={() => setHoveredNetworthIndex(null)}
                    style={{ cursor: "pointer" }}
                  />
                );
              })}
            </svg>

            {/* X-Axis labels */}
            <div className={styles.xAxisLabels}>
              {netWorthData.map((d, i) => (
                <span key={i} className={styles.xLabel} style={{ fontSize: "8.5px", transform: "translateX(-8px)" }}>{d.label}</span>
              ))}
            </div>

            {/* Legend */}
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: "var(--color-brand)" }} />
                <span>Kekayaan Bersih Riil</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ border: "2px dashed var(--color-brand)", backgroundColor: "transparent" }} />
                <span>Proyeksi Tren</span>
              </div>
            </div>

            {/* Interactive Tooltip */}
            {hoveredNetworthIndex !== null && (
              <div 
                className={styles.chartTooltip}
                style={{
                  left: hoveredNetworthIndex <= 4 ? `calc(${(getNetworthX(hoveredNetworthIndex) / svgW) * 100}% + 8px)` : "auto",
                  right: hoveredNetworthIndex > 4 ? `calc(${((svgW - getNetworthX(hoveredNetworthIndex)) / svgW) * 100}% + 8px)` : "auto",
                }}
              >
                <div className={styles.tooltipTitle}>
                  {netWorthData[hoveredNetworthIndex].label} {netWorthData[hoveredNetworthIndex].isProjection && "(Proyeksi)"}
                </div>
                <div className={styles.tooltipRow}>
                  <span>Net Worth:</span>
                  <span style={{ color: "var(--color-brand)" }}>{formatCurrency(netWorthData[hoveredNetworthIndex].netWorth, baseCurr)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI advisor chat console */}
      <div className={styles.aiSection}>
        <div className={styles.aiHeader}>
          <div className={styles.aiTitleSection}>
            <Sparkles className={styles.aiTitleIcon} size={24} />
            <div>
              <h2 className={styles.aiTitle}>AI Advisor Keuangan</h2>
              <p className={styles.aiSubtitle}>Dilatih khusus menggunakan riwayat keuangan Anda secara anonim.</p>
            </div>
          </div>

          {/* Form Setup API Key Gemini */}
          <form onSubmit={handleSaveApiKey} className={styles.apiKeyForm}>
            <div className={styles.apiKeyInputWrapper}>
              <input 
                type={showKey ? "text" : "password"} 
                placeholder="Masukkan Gemini API Key gratis..."
                className={`form-input ${styles.apiKeyInput}`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
              <button 
                type="button" 
                className={styles.eyeBtn}
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button type="submit" className="btn btn-secondary">
              <Key size={14} style={{ marginRight: "6px" }} />
              Simpan
            </button>
          </form>
        </div>

        {/* Warning API Key Belum Terisi */}
        {!hasSavedKey && (
          <div className={styles.apiKeyWarningBanner}>
            <HelpCircle size={24} className={styles.warningIcon} />
            <div className={styles.warningContent}>
              <span className={styles.warningTitle}>API Key Diperlukan untuk Mengaktifkan AI Advisor</span>
              <span>
                Asisten obrolan ini berjalan secara lokal di browser Anda. Dapatkan kunci API Gemini gratis dalam 1 menit dari{" "}
                <a 
                  href="https://aistudio.google.com/" 
                  target="_blank" 
                  rel="noreferrer" 
                  className={styles.warningLink}
                >
                  Google AI Studio
                </a>{" "}
                dan simpan di atas untuk mengobrol secara interaktif.
              </span>
            </div>
          </div>
        )}

        {/* Kotak Obrolan */}
        <div className={styles.chatWindow}>
          <div className={styles.chatMessages}>
            {chatHistory.map((msg) => (
              <div key={msg.id} className={`${styles.messageRow} ${msg.role === "user" ? styles.user : styles.assistant}`}>
                <div className={styles.messageBubble}>
                  {renderMessageContent(msg.content)}
                </div>
              </div>
            ))}
            
            {/* Typing Anim */}
            {isTyping && (
              <div className={`${styles.messageRow} ${styles.assistant}`}>
                <div className={styles.messageBubble} style={{ padding: "8px 16px" }}>
                  <div className={styles.typingIndicator}>
                    <div className={styles.typingDot}></div>
                    <div className={styles.typingDot}></div>
                    <div className={styles.typingDot}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Form Input Pesan */}
          <form onSubmit={handleSendChatMessage} className={styles.chatInputArea}>
            <input 
              type="text" 
              placeholder={hasSavedKey ? "Tanyakan analisis keuangan, strategi dana darurat, atau tabungan..." : "Masukkan API Key di atas terlebih dahulu..."}
              className={`form-input ${styles.chatInput}`}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={!hasSavedKey}
            />
            <button 
              type="submit" 
              className={`btn btn-primary ${styles.chatSendBtn}`}
              disabled={!hasSavedKey || !chatInput.trim() || isTyping}
            >
              <Send size={16} />
              <span>Kirim</span>
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleClearChat}
              title="Hapus Obrolan"
            >
              Reset
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
