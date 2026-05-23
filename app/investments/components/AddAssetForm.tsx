"use client";

import React, { useState, useCallback } from "react";
import BaseModal from "@/components/BaseModal";
import InputGroup from "@/components/InputGroup";
import { Tag, Layers, Percent, Clock, Zap, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Investment } from "@/lib/types";
import styles from "../investments.module.css";

// --- Type Labels, Colors, and Icons ---
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

interface AddAssetFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (asset: Omit<Investment, "id">) => Promise<void>;
  baseCurrency: string;
}

type FetchStatus = "idle" | "loading" | "success" | "error";

export default function AddAssetForm({ isOpen, onClose, onSave, baseCurrency }: AddAssetFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Investment["type"]>("stock");
  const [symbol, setSymbol] = useState("");
  const [price, setPrice] = useState("");
  const [yieldRate, setYieldRate] = useState("");
  const [yieldFrequency, setYieldFrequency] = useState<"monthly" | "annually">("monthly");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fetch states
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [fetchMessage, setFetchMessage] = useState("");

  const isFixedYield = ["deposit", "bond", "p2p"].includes(type);
  const canFetchPrice = ["stock", "crypto"].includes(type) && symbol.trim().length > 0;

  const handleFetchPrice = useCallback(async () => {
    if (!canFetchPrice) return;

    setFetchStatus("loading");
    setFetchMessage("Mengambil harga...");

    try {
      const isCrypto = type === "crypto";
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
        setFetchStatus("success");
        setFetchMessage(`Harga dari ${providerLabel}: ${Number(data.price).toLocaleString("id-ID")}`);

        // Auto-clear success message after 4 seconds
        setTimeout(() => {
          setFetchStatus("idle");
          setFetchMessage("");
        }, 4000);
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
  }, [type, symbol, canFetchPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        type,
        currentPrice: isFixedYield ? 1 : Number(price) || 0,
        ...( ["stock", "crypto"].includes(type) && symbol.trim() ? { symbol: symbol.trim() } : {} ),
        color: TYPE_COLORS[type],
        icon: TYPE_ICONS[type],
        ...(isFixedYield
          ? {
              yieldRate: Number(yieldRate) || 0,
              yieldFrequency: yieldFrequency,
              lastYieldPaymentDate: new Date().toISOString().split("T")[0]
            }
          : {}
        )
      });
      onClose();
    } catch (error) {
      console.error("Gagal menyimpan aset:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Tambah Aset Investasi Baru">
      <form onSubmit={handleSubmit}>
        <div className={styles.assetBanner}>
          <div className={styles.bannerIcon} style={{ backgroundColor: "var(--color-brand-light)", color: "var(--color-brand)" }}>
            ✨
          </div>
          <div className={styles.bannerDetails}>
            <span className={styles.bannerName}>Informasi Aset Baru</span>
            <span className={styles.bannerValue}>Tambahkan instrumen investasi baru untuk mulai memantau dan mencatat portofolio Anda.</span>
          </div>
        </div>

        <InputGroup
          label="Nama Aset"
          placeholder="Contoh: BBCA, Bitcoin, Emas Antam..."
          value={name}
          onChange={e => setName(e.target.value)}
          prefixIcon={<Tag size={16} />}
          required
          autoFocus
          disabled={isSubmitting}
        />

        <InputGroup
          label="Jenis Aset"
          as="select"
          value={type}
          onChange={e => {
            setType(e.target.value as Investment["type"]);
            // Reset fetch state on type change
            setFetchStatus("idle");
            setFetchMessage("");
          }}
          prefixIcon={<Layers size={16} />}
          required
          disabled={isSubmitting}
        >
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </InputGroup>

        {["stock", "crypto"].includes(type) && (
          <>
            <div className={styles.symbolFetchRow}>
              <div className={styles.symbolInputWrapper}>
                <InputGroup
                  label={type === "stock" ? "Simbol / Ticker Saham" : "Simbol / Ticker Kripto"}
                  placeholder={type === "stock" ? "Contoh: BBCA.JK, AAPL, TLKM.JK" : "Contoh: BTC, ETH, SOL"}
                  value={symbol}
                  onChange={e => {
                    setSymbol(e.target.value);
                    setFetchStatus("idle");
                    setFetchMessage("");
                  }}
                  prefixIcon={<Tag size={16} />}
                  disabled={isSubmitting}
                />
              </div>
              <button
                type="button"
                className={styles.fetchPriceBtn}
                onClick={handleFetchPrice}
                disabled={!canFetchPrice || fetchStatus === "loading" || isSubmitting}
                title="Ambil harga otomatis dari API"
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

        {!isFixedYield ? (
          <InputGroup
            label={type === "stock" ? "Harga Pasar Saat Ini (per Lembar Saham)" : "Harga Pasar Saat Ini (per unit)"}
            type="text"
            placeholder={canFetchPrice ? "Klik 'Ambil Harga' atau isi manual" : "10.250"}
            value={price}
            onChange={e => setPrice(e.target.value)}
            prefixText={baseCurrency}
            suffixText={type === "stock" ? "/ Lembar" : "/ Unit"}
            isCurrency={true}
            currency={baseCurrency}
            required
            disabled={isSubmitting}
          />
        ) : (
          <>
            <InputGroup
              label="Imbal Hasil (% per tahun)"
              type="number"
              step="any"
              placeholder="5.5"
              value={yieldRate}
              onChange={e => setYieldRate(e.target.value)}
              prefixIcon={<Percent size={16} />}
              suffixText="% / tahun"
              required
              disabled={isSubmitting}
            />

            <InputGroup
              label="Frekuensi Pembayaran"
              as="select"
              value={yieldFrequency}
              onChange={e => setYieldFrequency(e.target.value as "monthly" | "annually")}
              prefixIcon={<Clock size={16} />}
              required
              disabled={isSubmitting}
            >
              <option value="monthly">Bulanan</option>
              <option value="annually">Tahunan</option>
            </InputGroup>
          </>
        )}

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
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? "Menyimpan..." : "Simpan Aset"}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
