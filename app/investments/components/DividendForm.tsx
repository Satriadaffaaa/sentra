"use client";

import React, { useState } from "react";
import BaseModal from "@/components/BaseModal";
import InputGroup from "@/components/InputGroup";
import { Calendar, Wallet } from "lucide-react";
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

interface DividendFormProps {
  isOpen: boolean;
  onClose: () => void;
  investmentId: string;
  investments: Investment[];
  holdings: any[];
  accounts: any[];
  baseCurrency: string;
  formatCurrency: (value: number, currency?: string) => string;
  onSave: (tx: {
    investmentId: string;
    type: "dividend";
    amount: number;
    quantity: number;
    pricePerUnit: number;
    date: string;
    accountId?: string;
  }) => Promise<void>;
}

export default function DividendForm({
  isOpen,
  onClose,
  investmentId,
  investments,
  holdings,
  accounts,
  baseCurrency,
  formatCurrency,
  onSave
}: DividendFormProps) {
  const activeAsset = investments.find(i => i.id === investmentId);
  const activeHolding = holdings.find(h => h.id === investmentId);
  const isFixed = activeAsset ? ["deposit", "bond", "p2p"].includes(activeAsset.type) : false;

  const [amount, setAmount] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [accountId, setAccountId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!activeAsset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount) || 0;
    if (amt <= 0) return;

    setIsSubmitting(true);
    try {
      await onSave({
        investmentId,
        type: "dividend", // Underlying type is always dividend/interest in db
        amount: amt,
        quantity: 0,
        pricePerUnit: 0,
        date: txDate,
        accountId: accountId || undefined
      });
      onClose();
    } catch (error) {
      console.error("Gagal mencatat dividen/bunga:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={isFixed ? "Catat Bunga Masuk" : "Catat Dividen Masuk"}
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
              {!isFixed && (
                <div className={styles.bannerMetaItem}>
                  <strong>Harga Pasar</strong>
                  {formatCurrency(activeAsset.currentPrice)}
                </div>
              )}
              {activeHolding && (
                <>
                  <div className={styles.bannerMetaItem}>
                    <strong>Kepemilikan</strong>
                    {isFixed
                      ? formatCurrency(activeHolding.holdingQty)
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

        <InputGroup
          label={isFixed ? "Jumlah Nominal Bunga" : "Jumlah Nominal Dividen"}
          type="text"
          placeholder="250.000"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          prefixText={baseCurrency}
          isCurrency={true}
          currency={baseCurrency}
          required
          autoFocus
          disabled={isSubmitting}
        />

        <InputGroup
          label="Tanggal Transaksi"
          type="date"
          value={txDate}
          onChange={e => setTxDate(e.target.value)}
          prefixIcon={<Calendar size={16} />}
          required
          disabled={isSubmitting}
        />

        <InputGroup
          label="Hubungkan Rekening (Opsional)"
          as="select"
          value={accountId}
          onChange={e => setAccountId(e.target.value)}
          prefixIcon={<Wallet size={16} />}
          disabled={isSubmitting}
        >
          <option value="">Non-Akun (Tambah saldo manual)</option>
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.icon} {acc.name} (Saldo: {formatCurrency(acc.balance, acc.currency)})
            </option>
          ))}
        </InputGroup>

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
            disabled={!(Number(amount) > 0) || isSubmitting}
          >
            {isSubmitting ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
