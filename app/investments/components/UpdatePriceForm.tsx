"use client";

import React, { useState, useEffect, useCallback } from "react";
import BaseModal from "@/components/BaseModal";
import InputGroup from "@/components/InputGroup";
import { Zap, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Investment } from "@/lib/types";
import styles from "../investments.module.css";

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

interface UpdatePriceFormProps {
  isOpen: boolean;
  onClose: () => void;
  investmentId: string;
  investments: Investment[];
  holdings: any[];
  baseCurrency: string;
  formatCurrency: (value: number, currency?: string) => string;
  onSave: (asset: Investment) => Promise<void>;
}

type FetchStatus = "idle" | "loading" | "success" | "error";

export default function UpdatePriceForm({
  isOpen,
  onClose,
  investmentId,
  investments,
  holdings,
  baseCurrency,
  formatCurrency,
  onSave
}: UpdatePriceFormProps) {
  const activeAsset = investments.find(i => i.id === investmentId);
  const activeHolding = holdings.find(h => h.id === investmentId);

  const [price, setPrice] = useState("");
  const [symbol, setSymbol] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fetch states
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [fetchMessage, setFetchMessage] = useState("");

  useEffect(() => {
    if (activeAsset) {
      setPrice(String(activeAsset.currentPrice));
      setSymbol(activeAsset.symbol || "");
      setFetchStatus("idle");
      setFetchMessage("");
    }
  }, [activeAsset]);

  const canFetchPrice = activeAsset && ["stock", "crypto"].includes(activeAsset.type) && symbol.trim().length > 0;

  const handleFetchPrice = useCallback(async () => {
    if (!canFetchPrice || !activeAsset) return;

    setFetchStatus("loading");
    setFetchMessage("Mengambil harga terbaru...");

    try {
      const isCrypto = activeAsset.type === "crypto";
      const endpoint = isCrypto
        ? `/api/crypto?symbol=${encodeURIComponent(symbol.trim())}`
        : `/api/stocks?symbol=${encodeURIComponent(symbol.trim())}`;

      const res = await fetch(endpoint);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Gagal mengambil harga");
      }

      if (data.price !== undefined && data.price !== null) {
        setPrice(String(data.price));
        const providerLabel = data.provider === "yahoo" ? "Yahoo Finance" : "CoinGecko";
        const change24h = data.change24h ? ` (${data.change24h > 0 ? "+" : ""}${data.change24h}% 24h)` : "";
        setFetchStatus("success");
        setFetchMessage(`${providerLabel}: ${Number(data.price).toLocaleString("id-ID")}${change24h}`);

        setTimeout(() => {
          setFetchStatus("idle");
          setFetchMessage("");
        }, 5000);
      } else {
        throw new Error("Harga tidak ditemukan untuk simbol ini");
      }
    } catch (err: any) {
      setFetchStatus("error");
      setFetchMessage(err.message || "Gagal mengambil harga");
      setTimeout(() => {
        setFetchStatus("idle");
        setFetchMessage("");
      }, 5000);
    }
  }, [activeAsset, symbol, canFetchPrice]);

  if (!activeAsset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPrice = Number(price);
    if (newPrice <= 0) return;

    setIsSubmitting(true);
    try {
      await onSave({
        ...activeAsset,
        currentPrice: newPrice,
        symbol: ["stock", "crypto"].includes(activeAsset.type) && symbol.trim() ? symbol.trim() : undefined
      });
      onClose();
    } catch (error) {
      console.error("Gagal memperbarui harga:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Harga Pasar"
    >
      <form onSubmit={handleSubmit}>
        <div className={styles.assetBanner}>
          <div
            className={styles.bannerIcon}
            style={{
              backgroundColor: (activeAsset.color || TYPE_COLORS[activeAsset.type]) + "18",
              color: activeAsset.color || TYPE_COLORS[activeAsset.type]
            }}
          >
            {activeAsset.icon || TYPE_ICONS[activeAsset.type]}
          </div>
          <div className={styles.bannerDetails}>
            <div className={styles.bannerNameRow}>
              <span className={styles.bannerName}>{activeAsset.name}</span>
              <span
                className={styles.bannerBadge}
                style={{ backgroundColor: activeAsset.color || TYPE_COLORS[activeAsset.type] }}
              >
                {TYPE_LABELS[activeAsset.type]}
              </span>
            </div>
            <div className={styles.bannerMetaGrid}>
              <div className={styles.bannerMetaItem}>
                <strong>Harga Pasar Saat Ini</strong>
                {formatCurrency(activeAsset.currentPrice)}
              </div>
              {activeHolding && (
                <>
                  <div className={styles.bannerMetaItem}>
                    <strong>Kepemilikan</strong>
                    {activeAsset.type === "stock"
                      ? `${(activeHolding.holdingQty / 100).toLocaleString("id-ID", {
                          maximumFractionDigits: 6
                        })} Lot`
                      : `${activeHolding.holdingQty.toLocaleString("id-ID", {
                          maximumFractionDigits: 6
                        })} Unit`}
                  </div>
                  <div className={styles.bannerMetaItem}>
                    <strong>Nilai Sekarang</strong>
                    {formatCurrency(activeHolding.currentValue)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {["stock", "crypto"].includes(activeAsset.type) && (
          <>
            <div className={styles.symbolFetchRow}>
              <div className={styles.symbolInputWrapper}>
                <InputGroup
                  label={activeAsset.type === "stock" ? "Simbol / Ticker Saham" : "Simbol / Ticker Kripto"}
                  placeholder={activeAsset.type === "stock" ? "Contoh: BBCA.JK, AAPL" : "Contoh: BTC, ETH"}
                  value={symbol}
                  onChange={e => {
                    setSymbol(e.target.value);
                    setFetchStatus("idle");
                    setFetchMessage("");
                  }}
                  prefixText="Ticker"
                  disabled={isSubmitting}
                />
              </div>
              <button
                type="button"
                className={styles.fetchPriceBtn}
                onClick={handleFetchPrice}
                disabled={!canFetchPrice || fetchStatus === "loading" || isSubmitting}
                title="Ambil harga terbaru otomatis dari API"
              >
                {fetchStatus === "loading" ? (
                  <Loader2 size={15} className={styles.spinIcon} />
                ) : (
                  <Zap size={15} />
                )}
                {fetchStatus === "loading" ? "Mengambil..." : "Ambil Harga"}
              </button>
            </div>

            {/* Fetch status feedback */}
            {fetchMessage && (
              <div className={`${styles.fetchFeedback} ${styles[`fetch${fetchStatus.charAt(0).toUpperCase() + fetchStatus.slice(1)}`]}`}>
                {fetchStatus === "success" && <CheckCircle size={14} />}
                {fetchStatus === "error" && <AlertCircle size={14} />}
                {fetchStatus === "loading" && <Loader2 size={14} className={styles.spinIcon} />}
                <span>{fetchMessage}</span>
              </div>
            )}
          </>
        )}

        <InputGroup
          label={activeAsset.type === "stock" ? "Harga Pasar Terbaru (per Lembar Saham)" : "Harga Pasar Terbaru (per unit)"}
          type="text"
          value={price}
          onChange={e => setPrice(e.target.value)}
          prefixText={baseCurrency}
          suffixText={activeAsset.type === "stock" ? "/ Lembar" : "/ Unit"}
          isCurrency={true}
          currency={baseCurrency}
          required
          autoFocus={!canFetchPrice}
          disabled={isSubmitting}
        />

        <div className={styles.modalFooter}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Batal
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!(Number(price) > 0) || isSubmitting}
          >
            {isSubmitting ? "Mengupdate..." : "Update Harga"}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
