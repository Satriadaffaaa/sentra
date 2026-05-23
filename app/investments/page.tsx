"use client";

import React, { useState, useMemo } from "react";
import { useFinance } from "@/lib/financeContext";
import { Investment } from "@/lib/types";
import {
  TrendingUp, Plus, RefreshCw, Trash2,
  ArrowUpRight, ArrowDownRight, DollarSign, BarChart3
} from "lucide-react";
import styles from "./investments.module.css";

// --- Modular Form Components ---
import AddAssetForm from "./components/AddAssetForm";
import BuySellForm from "./components/BuySellForm";
import DividendForm from "./components/DividendForm";
import UpdatePriceForm from "./components/UpdatePriceForm";
import { FinanceService } from "@/lib/financeService";

// --- Type Labels & Colors ---
const TYPE_LABELS: Record<string, string> = {
  stock: "Saham", mutual_fund: "Reksa Dana", crypto: "Kripto",
  gold: "Emas", bond: "Obligasi/SBN", deposit: "Deposito",
  p2p: "P2P Lending", property: "Properti", other: "Lainnya"
};
const TYPE_COLORS: Record<string, string> = {
  stock: "#2563eb", mutual_fund: "#8b5cf6", crypto: "#f97316",
  gold: "#f59e0b", bond: "#06b6d4", deposit: "#10b981",
  p2p: "#ec4899", property: "#ef4444", other: "#64748b"
};
const TYPE_ICONS: Record<string, string> = {
  stock: "📊", mutual_fund: "📈", crypto: "₿",
  gold: "🥇", bond: "📄", deposit: "🏦",
  p2p: "🤝", property: "🏠", other: "📦"
};

type ModalType = null | "addAsset" | "buy" | "sell" | "dividend" | "updatePrice";

export default function InvestmentsPage() {
  const {
    investments,
    investmentTransactions,
    accounts,
    formatCurrency,
    saveInvestment,
    deleteInvestment,
    addInvestmentTransaction,
    deleteInvestmentTransaction,
    settings,
    pushNotification,
    refreshData
  } = useFinance();

  const baseCurrency = settings?.baseCurrency || "IDR";

  // --- Modal Active States ---
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedInvId, setSelectedInvId] = useState<string>("");
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshPrices = async () => {
    const assetsToUpdate = investments.filter(
      inv => inv.symbol && ["stock", "crypto"].includes(inv.type)
    );

    if (assetsToUpdate.length === 0) {
      pushNotification("Tidak ada aset Saham atau Kripto dengan simbol ticker yang terdaftar.", "warning");
      return;
    }

    setIsRefreshing(true);
    pushNotification("Mulai memperbarui harga aset dari API...", "info");

    try {
      const results = await Promise.allSettled(
        assetsToUpdate.map(async (asset) => {
          const isCrypto = asset.type === "crypto";
          const endpoint = isCrypto
            ? `/api/crypto?symbol=${encodeURIComponent(asset.symbol!)}`
            : `/api/stocks?symbol=${encodeURIComponent(asset.symbol!)}`;

          const res = await fetch(endpoint);
          if (!res.ok) {
            throw new Error(`Koneksi API gagal`);
          }
          const data = await res.json();
          if (data.error || data.price === undefined || data.price === null) {
            throw new Error(data.error || `Harga tidak ditemukan`);
          }
          
          // Save directly to the storage service to prevent spamming notifications from saveInvestment context wrapper
          const updatedAsset = { ...asset, currentPrice: Number(data.price) };
          await FinanceService.saveInvestment(updatedAsset);
          return { name: asset.name, price: data.price };
        })
      );

      const successList: string[] = [];
      const failList: string[] = [];

      results.forEach((res, index) => {
        const asset = assetsToUpdate[index];
        if (res.status === "fulfilled") {
          successList.push(asset.name);
        } else {
          const reason = res.reason as any;
          failList.push(`${asset.name} (${reason?.message || "Gagal"})`);
        }
      });

      await refreshData();

      if (successList.length > 0) {
        pushNotification(`Berhasil memperbarui: ${successList.join(", ")}`, "success");
      }
      if (failList.length > 0) {
        pushNotification(`Gagal memperbarui: ${failList.join(", ")}`, "error");
      }
    } catch (err: any) {
      console.error("Error refreshing prices:", err);
      pushNotification("Terjadi kesalahan saat memperbarui harga aset.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Form input states are handled locally inside form components

  // --- Computed Holdings ---
  const holdings = useMemo(() => {
    return investments.map(inv => {
      const txs = investmentTransactions.filter(t => t.investmentId === inv.id);
      const buys = txs.filter(t => t.type === "buy");
      const sells = txs.filter(t => t.type === "sell");
      const dividends = txs.filter(t => t.type === "dividend" || t.type === "interest");

      const totalBoughtQty = buys.reduce((s, t) => s + t.quantity, 0);
      const totalSoldQty = sells.reduce((s, t) => s + t.quantity, 0);
      const holdingQty = totalBoughtQty - totalSoldQty;

      const totalBoughtCost = buys.reduce((s, t) => s + t.amount, 0);
      const totalSoldProceeds = sells.reduce((s, t) => s + t.amount, 0);
      const totalDividends = dividends.reduce((s, t) => s + t.amount, 0);

      const avgBuyPrice = totalBoughtQty > 0 ? totalBoughtCost / totalBoughtQty : 0;
      const currentValue = holdingQty * inv.currentPrice;
      const costBasis = holdingQty * avgBuyPrice;
      const unrealizedGL = currentValue - costBasis;
      const unrealizedGLPercent = costBasis > 0 ? (unrealizedGL / costBasis) * 100 : 0;

      return {
        ...inv,
        holdingQty,
        avgBuyPrice,
        currentValue,
        costBasis,
        unrealizedGL,
        unrealizedGLPercent,
        totalDividends,
        totalBoughtCost,
        totalSoldProceeds
      };
    });
  }, [investments, investmentTransactions]);

  // --- KPI Calculations ---
  const totalPortfolioValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalCapitalInvested = holdings.reduce((s, h) => s + h.costBasis, 0);
  const totalUnrealizedGL = totalPortfolioValue - totalCapitalInvested;
  const totalUnrealizedGLPercent = totalCapitalInvested > 0 ? (totalUnrealizedGL / totalCapitalInvested) * 100 : 0;
  const totalDividendsReceived = holdings.reduce((s, h) => s + h.totalDividends, 0);

  // --- Donut Chart Data ---
  const allocationData = useMemo(() => {
    const typeMap: Record<string, number> = {};
    holdings.forEach(h => {
      if (h.currentValue > 0) {
        const key = h.type;
        typeMap[key] = (typeMap[key] || 0) + h.currentValue;
      }
    });
    const total = Object.values(typeMap).reduce((s, v) => s + v, 0);
    return Object.entries(typeMap).map(([type, value]) => ({
      type,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
      color: TYPE_COLORS[type] || "#64748b",
      label: TYPE_LABELS[type] || type
    })).sort((a, b) => b.value - a.value);
  }, [holdings]);

  // SVG donut slices
  let accPercent = 0;
  const donutSlices = allocationData.map(item => {
    const slice = {
      ...item,
      dashArray: `${item.percent} ${100 - item.percent}`,
      dashOffset: -accPercent
    };
    accPercent += item.percent;
    return slice;
  });

  // --- Historical Portfolio Valuation ---
  const getLast6MonthsPoints = () => {
    const result = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      let year = now.getFullYear();
      let month = now.getMonth() - i;
      while (month < 0) {
        month += 12;
        year -= 1;
      }
      const d = new Date(year, month + 1, 0, 23, 59, 59, 999);
      const shortLabel = d.toLocaleDateString("id-ID", { month: "short" });
      const yearLabel = d.getFullYear().toString().substring(2);
      
      result.push({
        time: i === 0 ? Date.now() : d.getTime(),
        label: `${shortLabel} '${yearLabel}`,
        fullLabel: d.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
      });
    }
    return result;
  };

  const historicalValuationData = useMemo(() => {
    const points = getLast6MonthsPoints();

    const getAssetQtyAtDate = (invId: string, targetTime: number) => {
      const filteredTxs = investmentTransactions.filter(
        t => t.investmentId === invId && new Date(t.date).getTime() <= targetTime
      );
      const buys = filteredTxs.filter(t => t.type === "buy");
      const sells = filteredTxs.filter(t => t.type === "sell");
      const totalBoughtQty = buys.reduce((s, t) => s + t.quantity, 0);
      const totalSoldQty = sells.reduce((s, t) => s + t.quantity, 0);
      return Math.max(0, totalBoughtQty - totalSoldQty);
    };

    const getAssetPriceAtDate = (inv: Investment, targetTime: number) => {
      const pricePoints = investmentTransactions
        .filter(t => t.investmentId === inv.id && (t.type === "buy" || t.type === "sell"))
        .map(t => ({
          time: new Date(t.date).getTime(),
          price: t.pricePerUnit
        }));

      pricePoints.push({
        time: Date.now(),
        price: inv.currentPrice
      });

      pricePoints.sort((a, b) => a.time - b.time);

      if (pricePoints.length === 0) {
        return inv.currentPrice;
      }

      if (targetTime <= pricePoints[0].time) {
        return pricePoints[0].price;
      }
      if (targetTime >= pricePoints[pricePoints.length - 1].time) {
        return pricePoints[pricePoints.length - 1].price;
      }

      for (let i = 0; i < pricePoints.length - 1; i++) {
        const p1 = pricePoints[i];
        const p2 = pricePoints[i + 1];
        if (targetTime >= p1.time && targetTime <= p2.time) {
          const ratio = (targetTime - p1.time) / (p2.time - p1.time);
          return p1.price + ratio * (p2.price - p1.price);
        }
      }

      return inv.currentPrice;
    };

    return points.map(pt => {
      const value = investments.reduce((sum, inv) => {
        const qty = getAssetQtyAtDate(inv.id, pt.time);
        if (qty <= 0) return sum;
        const price = getAssetPriceAtDate(inv, pt.time);
        return sum + qty * price;
      }, 0);

      return {
        ...pt,
        value
      };
    });
  }, [investments, investmentTransactions]);

  // Math for SVG trend chart
  const trendSvgW = 500;
  const trendSvgH = 150;
  const trendPadL = 65;
  const trendPadR = 20;
  const trendPadT = 15;
  const trendPadB = 25;
  const trendInnerW = trendSvgW - trendPadL - trendPadR;
  const trendInnerH = trendSvgH - trendPadT - trendPadB;

  const trendValues = historicalValuationData.map(d => d.value);
  const trendMaxVal = Math.max(...trendValues, 1000000);
  const trendMinVal = 0;
  const trendValRange = trendMaxVal - trendMinVal;

  const getTrendX = (idx: number) => trendPadL + (idx / 5) * trendInnerW;
  const getTrendY = (val: number) => trendSvgH - trendPadB - ((val - trendMinVal) / trendValRange) * trendInnerH;

  const trendLinePath = historicalValuationData
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getTrendX(i).toFixed(1)} ${getTrendY(d.value).toFixed(1)}`)
    .join(" ");

  const trendAreaPath = `${trendLinePath} L ${getTrendX(5).toFixed(1)} ${(trendSvgH - trendPadB).toFixed(1)} L ${trendPadL.toFixed(1)} ${(trendSvgH - trendPadB).toFixed(1)} Z`;

  // --- Handlers ---
  const resetForm = () => {
    setSelectedInvId("");
    setActiveModal(null);
  };

  const openModal = (type: ModalType, invId?: string) => {
    setActiveModal(type);
    if (invId) {
      setSelectedInvId(invId);
    }
  };

  return (
    <div className={styles.investRoot}>
      {/* Header */}
      <div className="page-header-flex">
        <div className="page-header-info">
          <h1 className="page-header-title">Portofolio Investasi</h1>
          <p className="page-header-subtitle">Pantau semua aset investasi Anda secara real-time.</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-secondary"
            onClick={handleRefreshPrices}
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? styles.spinIcon : ""} />
            {isRefreshing ? "Memperbarui..." : "Perbarui Harga (API)"}
          </button>
          <button className="btn btn-primary" onClick={() => openModal("addAsset")}>
            <Plus size={16} /> Tambah Aset Baru
          </button>
        </div>
      </div>


      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Portofolio</span>
          <span className={styles.kpiValue}>{formatCurrency(totalPortfolioValue)}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Modal Disetor</span>
          <span className={styles.kpiValue}>{formatCurrency(totalCapitalInvested)}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Keuntungan / Kerugian</span>
          <span className={`${styles.kpiValue} ${totalUnrealizedGL >= 0 ? styles.positive : styles.negative}`}>
            {totalUnrealizedGL >= 0 ? "+" : ""}{formatCurrency(totalUnrealizedGL)}
          </span>
          <span className={`${styles.kpiChange} ${totalUnrealizedGL >= 0 ? styles.positive : styles.negative}`}>
            {totalUnrealizedGL >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {totalUnrealizedGLPercent.toFixed(2)}%
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Dividen & Bunga</span>
          <span className={`${styles.kpiValue} ${styles.positive}`}>{formatCurrency(totalDividendsReceived)}</span>
        </div>
      </div>

      {/* Historical Trend Chart */}
      <div className={styles.chartCard}>
        <h3 className={styles.chartTitle}>Perkembangan Nilai Portofolio (6 Bulan Terakhir)</h3>
        <div className={styles.chartContainer}>
          <svg className={styles.svgChart} viewBox={`0 0 ${trendSvgW} ${trendSvgH}`}>
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = trendPadT + ratio * trendInnerH;
              return (
                <line
                  key={idx}
                  x1={trendPadL}
                  y1={y}
                  x2={trendSvgW - trendPadR}
                  y2={y}
                  stroke="var(--border-color)"
                  strokeWidth="0.8"
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Area under the line */}
            <polygon points={trendAreaPath} fill="url(#trendGrad)" />

            {/* Main line path */}
            <path
              d={trendLinePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Points on the line */}
            {historicalValuationData.map((d, i) => (
              <circle
                key={i}
                cx={getTrendX(i)}
                cy={getTrendY(d.value)}
                r="4"
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            ))}

            {/* Hover highlight line & marker */}
            {hoveredTrendIndex !== null && (
              <>
                <line
                  x1={getTrendX(hoveredTrendIndex)}
                  y1={trendPadT}
                  x2={getTrendX(hoveredTrendIndex)}
                  y2={trendSvgH - trendPadB}
                  stroke="var(--color-brand)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={getTrendX(hoveredTrendIndex)}
                  cy={getTrendY(historicalValuationData[hoveredTrendIndex].value)}
                  r="6"
                  fill="#10b981"
                  stroke="var(--bg-card)"
                  strokeWidth="2"
                />
              </>
            )}

            {/* Interactive hit areas */}
            {historicalValuationData.map((d, i) => {
              const step = trendInnerW / 5;
              const xStart = getTrendX(i) - step / 2;
              return (
                <rect
                  key={i}
                  x={i === 0 ? trendPadL : xStart}
                  y={trendPadT}
                  width={i === 0 || i === 5 ? step / 2 : step}
                  height={trendInnerH}
                  fill="transparent"
                  onMouseEnter={() => setHoveredTrendIndex(i)}
                  onMouseLeave={() => setHoveredTrendIndex(null)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </svg>

          {/* X-Axis labels */}
          <div className={styles.xAxisLabels}>
            {historicalValuationData.map((d, i) => (
              <span key={i} className={styles.xLabel} style={{ transform: "translateX(-15px)" }}>
                {d.label}
              </span>
            ))}
          </div>

          {/* Interactive Tooltip */}
          {hoveredTrendIndex !== null && (
            <div
              className={styles.chartTooltip}
              style={{
                left: hoveredTrendIndex <= 3 ? `calc(${(getTrendX(hoveredTrendIndex) / trendSvgW) * 100}% + 8px)` : "auto",
                right: hoveredTrendIndex > 3 ? `calc(${((trendSvgW - getTrendX(hoveredTrendIndex)) / trendSvgW) * 100}% + 8px)` : "auto",
              }}
            >
              <div className={styles.tooltipTitle}>{historicalValuationData[hoveredTrendIndex].fullLabel}</div>
              <div className={styles.tooltipRow}>
                <span>Nilai Portofolio:</span>
                <span style={{ color: "#10b981" }}>
                  {formatCurrency(historicalValuationData[hoveredTrendIndex].value)}
                </span>
              </div>
              {hoveredTrendIndex > 0 && (
                <div
                  className={styles.tooltipRow}
                  style={{ borderTop: "1px solid var(--border-color)", paddingTop: "4px", marginTop: "2px" }}
                >
                  <span>Pertumbuhan:</span>
                  {(() => {
                    const prevVal = historicalValuationData[hoveredTrendIndex - 1].value;
                    const curVal = historicalValuationData[hoveredTrendIndex].value;
                    const diff = curVal - prevVal;
                    const pct = prevVal > 0 ? (diff / prevVal) * 100 : 0;
                    const isGrow = diff >= 0;
                    return (
                      <span style={{ color: isGrow ? "#10b981" : "#ef4444" }}>
                        {isGrow ? "+" : ""}
                        {pct.toFixed(1)}% ({formatCurrency(diff)})
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Donut + Holdings */}
      <div className={styles.mainGrid}>
        {/* Donut Chart */}
        <div className={styles.donutCard}>
          <h3>Alokasi Aset</h3>
          {allocationData.length > 0 ? (
            <>
              <div className={styles.donutContainer}>
                <svg viewBox="0 0 42 42" width="200" height="200">
                  <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--color-border)" strokeWidth="3" />
                  {donutSlices.map((slice, idx) => (
                    <circle
                      key={idx}
                      cx="21" cy="21" r="15.9155"
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={hoveredSlice === slice.type ? "4.5" : "3.5"}
                      strokeDasharray={slice.dashArray}
                      strokeDashoffset={slice.dashOffset}
                      strokeLinecap="butt"
                      transform="rotate(-90 21 21)"
                      style={{ transition: "stroke-width 0.2s", cursor: "pointer" }}
                      onMouseEnter={() => setHoveredSlice(slice.type)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    />
                  ))}
                </svg>
                <div className={styles.donutCenter}>
                  {hoveredSlice ? (
                    <>
                      <div className={styles.donutCenterLabel}>{TYPE_LABELS[hoveredSlice]}</div>
                      <div className={styles.donutCenterValue}>
                        {allocationData.find(d => d.type === hoveredSlice)?.percent.toFixed(1)}%
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.donutCenterLabel}>Total Aset</div>
                      <div className={styles.donutCenterValue}>{investments.length}</div>
                    </>
                  )}
                </div>
              </div>
              <div className={styles.donutLegend}>
                {allocationData.map(item => (
                  <div key={item.type} className={styles.legendItem}
                    onMouseEnter={() => setHoveredSlice(item.type)}
                    onMouseLeave={() => setHoveredSlice(null)}>
                    <span className={styles.legendDot} style={{ backgroundColor: item.color }} />
                    <span className={styles.legendName}>{item.label}</span>
                    <span className={styles.legendPercent}>{item.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <BarChart3 size={40} />
              <p>Belum ada data alokasi.</p>
            </div>
          )}
        </div>

        {/* Holdings Table */}
        <div className={styles.holdingsCard}>
          <h3>Daftar Kepemilikan Aset</h3>
          {holdings.length > 0 ? (
            <div className={styles.tableScroll}>
              <table className={styles.holdingsTable}>
                <thead>
                  <tr>
                    <th>Aset</th>
                    <th className={styles.textRight}>Kuantitas</th>
                    <th className={styles.textRight}>Harga Avg.</th>
                    <th className={styles.textRight}>Harga Saat Ini</th>
                    <th className={styles.textRight}>Nilai Sekarang</th>
                    <th className={styles.textRight}>Gain / Loss</th>
                    <th className={styles.textCenter}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => {
                    const isFixed = ["deposit", "bond", "p2p"].includes(h.type);
                    return (
                      <tr key={h.id}>
                        <td>
                          <div className={styles.assetNameCell}>
                            <div className={styles.assetIcon} style={{ backgroundColor: (h.color || TYPE_COLORS[h.type]) + "18" }}>
                              {h.icon || TYPE_ICONS[h.type]}
                            </div>
                            <div className={styles.assetNameText}>
                              <span className={styles.assetName}>{h.name}</span>
                              <span className={styles.assetType}>{TYPE_LABELS[h.type]}</span>
                            </div>
                          </div>
                        </td>
                        <td className={styles.textRight}>
                          {isFixed
                            ? formatCurrency(h.holdingQty)
                            : h.type === "stock"
                            ? `${(h.holdingQty / 100).toLocaleString("id-ID", { maximumFractionDigits: 6 })} Lot`
                            : `${h.holdingQty.toLocaleString("id-ID", { maximumFractionDigits: 6 })} Unit`}
                        </td>
                        <td className={styles.textRight}>
                          {isFixed ? "-" : formatCurrency(h.avgBuyPrice)}
                        </td>
                        <td className={styles.textRight}>
                          {isFixed ? "-" : formatCurrency(h.currentPrice)}
                        </td>
                        <td className={`${styles.textRight}`} style={{ fontWeight: 700 }}>
                          {formatCurrency(h.currentValue)}
                        </td>
                        <td className={styles.textRight}>
                          <div className={styles.gainCell}>
                            <span className={`${styles.gainValue} ${h.unrealizedGL >= 0 ? styles.positive : styles.negative}`}>
                              {h.unrealizedGL >= 0 ? "+" : ""}{formatCurrency(h.unrealizedGL)}
                            </span>
                            {!isFixed && (
                              <span className={`${styles.gainPercent} ${h.unrealizedGL >= 0 ? styles.positive : styles.negative}`}>
                                {h.unrealizedGLPercent >= 0 ? "+" : ""}{h.unrealizedGLPercent.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={styles.textCenter}>
                          <div className={styles.actionBtnGroup}>
                            <button className={styles.actionBtn} onClick={() => openModal("buy", h.id)}>Beli</button>
                            <button className={`${styles.actionBtn} ${styles.sell}`} onClick={() => openModal("sell", h.id)}>Jual</button>
                            <button className={styles.actionBtn} onClick={() => openModal("dividend", h.id)}>
                              {isFixed ? "Bunga" : "Dividen"}
                            </button>
                            {!isFixed && (
                              <button className={styles.actionBtn} onClick={() => openModal("updatePrice", h.id)}>
                                <RefreshCw size={12} />
                              </button>
                            )}
                            <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => deleteInvestment(h.id)}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <TrendingUp size={40} />
              <p>Belum ada aset investasi. Klik &quot;Tambah Aset Baru&quot; untuk memulai.</p>
            </div>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div className={styles.historyCard}>
        <h3>Riwayat Transaksi Investasi</h3>
        {investmentTransactions.length > 0 ? (
          <div className={styles.tableScroll}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Aset</th>
                  <th>Tipe</th>
                  <th className={styles.textRight}>Kuantitas</th>
                  <th className={styles.textRight}>Harga / Unit</th>
                  <th className={styles.textRight}>Total Nilai</th>
                  <th>Rekening</th>
                  <th className={styles.textCenter}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {investmentTransactions.slice(0, 20).map(tx => {
                  const inv = investments.find(i => i.id === tx.investmentId);
                  const acc = accounts.find(a => a.id === tx.accountId);
                  const typeClass = tx.type === "buy" ? styles.typeBuy
                    : tx.type === "sell" ? styles.typeSell
                    : tx.type === "dividend" ? styles.typeDividend
                    : styles.typeInterest;
                  return (
                    <tr key={tx.id}>
                      <td>{new Date(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td style={{ fontWeight: 600 }}>{inv?.name || "—"}</td>
                      <td>
                        <span className={`${styles.typeBadge} ${typeClass}`}>
                          {tx.type === "buy" ? "Beli" : tx.type === "sell" ? "Jual" : tx.type === "dividend" ? "Dividen" : "Bunga"}
                        </span>
                      </td>
                      <td className={styles.textRight}>
                        {tx.quantity > 0
                          ? inv?.type === "stock"
                            ? `${(tx.quantity / 100).toLocaleString("id-ID", { maximumFractionDigits: 6 })} Lot`
                            : `${tx.quantity.toLocaleString("id-ID", { maximumFractionDigits: 6 })} Unit`
                          : "—"}
                      </td>
                      <td className={styles.textRight}>{tx.pricePerUnit > 0 ? formatCurrency(tx.pricePerUnit) : "—"}</td>
                      <td className={`${styles.textRight}`} style={{ fontWeight: 700 }}>
                        <span className={tx.type === "sell" || tx.type === "dividend" || tx.type === "interest" ? styles.positive : ""}>
                          {tx.type === "sell" || tx.type === "dividend" || tx.type === "interest" ? "+" : "-"}
                          {formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td>{acc ? `${acc.icon} ${acc.name}` : "Non-Akun"}</td>
                      <td className={styles.textCenter}>
                        <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => tx.id && deleteInvestmentTransaction(tx.id)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <DollarSign size={40} />
            <p>Belum ada riwayat transaksi investasi.</p>
          </div>
        )}
      </div>

      {/* === MODALS === */}
      {activeModal === "addAsset" && (
        <AddAssetForm
          isOpen={true}
          onClose={resetForm}
          onSave={saveInvestment}
          baseCurrency={baseCurrency}
        />
      )}

      {(activeModal === "buy" || activeModal === "sell") && (
        <BuySellForm
          isOpen={true}
          type={activeModal}
          investmentId={selectedInvId}
          investments={investments}
          holdings={holdings}
          accounts={accounts}
          baseCurrency={baseCurrency}
          formatCurrency={formatCurrency}
          onSave={addInvestmentTransaction}
          onClose={resetForm}
        />
      )}

      {activeModal === "dividend" && (
        <DividendForm
          isOpen={true}
          investmentId={selectedInvId}
          investments={investments}
          holdings={holdings}
          accounts={accounts}
          baseCurrency={baseCurrency}
          formatCurrency={formatCurrency}
          onSave={addInvestmentTransaction}
          onClose={resetForm}
        />
      )}

      {activeModal === "updatePrice" && (
        <UpdatePriceForm
          isOpen={true}
          investmentId={selectedInvId}
          investments={investments}
          holdings={holdings}
          baseCurrency={baseCurrency}
          formatCurrency={formatCurrency}
          onSave={saveInvestment}
          onClose={resetForm}
        />
      )}
    </div>
  );
}
