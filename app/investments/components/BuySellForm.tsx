"use client";

import React, { useState, useEffect } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import BaseModal from "@/components/BaseModal";
import InputGroup from "@/components/InputGroup";
import { Hash, Calendar, Wallet } from "lucide-react";
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

interface BuySellFormProps {
  isOpen: boolean;
  onClose: () => void;
  type: "buy" | "sell";
  investmentId: string;
  investments: Investment[];
  holdings: any[];
  accounts: any[];
  baseCurrency: string;
  formatCurrency: (value: number, currency?: string) => string;
  onSave: (tx: {
    investmentId: string;
    type: "buy" | "sell";
    amount: number;
    quantity: number;
    pricePerUnit: number;
    date: string;
    accountId?: string;
  }) => Promise<void>;
}

export default function BuySellForm({
  isOpen,
  onClose,
  type,
  investmentId,
  investments,
  holdings,
  accounts,
  baseCurrency,
  formatCurrency,
  onSave
}: BuySellFormProps) {
  const activeAsset = investments.find(i => i.id === investmentId);
  const activeHolding = holdings.find(h => h.id === investmentId);
  const isFixed = activeAsset ? ["deposit", "bond", "p2p"].includes(activeAsset.type) : false;

  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [accountId, setAccountId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confirm = useConfirm();

  // Prefill the price if activeAsset exists
  useEffect(() => {
    if (activeAsset) {
      setPricePerUnit(String(activeAsset.currentPrice));
    }
  }, [activeAsset]);

  if (!activeAsset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity) || 0;
    const storedQty = activeAsset.type === "stock" ? qty * 100 : qty;
    const ppu = isFixed ? 1 : Number(pricePerUnit) || 0;
    const amt = isFixed ? qty : storedQty * ppu;

    if (qty <= 0 || amt <= 0) return;

    // Additional check for selling: can't sell more than owned
    if (type === "sell" && activeHolding && storedQty > activeHolding.holdingQty) {
      const ownedDisplay = activeAsset.type === "stock"
        ? `${(activeHolding.holdingQty / 100).toLocaleString("id-ID")} Lot`
        : `${activeHolding.holdingQty.toLocaleString("id-ID")} Unit`;
      const sellDisplay = activeAsset.type === "stock"
        ? `${qty.toLocaleString("id-ID")} Lot`
        : `${qty.toLocaleString("id-ID")} Unit`;

      await confirm({
        title: "Jumlah Melebihi Kepemilikan",
        message: `Jumlah penjualan (${sellDisplay}) melebihi kepemilikan Anda saat ini (${ownedDisplay}).`,
        variant: "warning",
        confirmText: "Mengerti",
        cancelText: "Tutup",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        investmentId,
        type,
        amount: amt,
        quantity: storedQty,
        pricePerUnit: ppu,
        date: txDate,
        accountId: accountId || undefined
      });
      onClose();
    } catch (error) {
      console.error("Gagal mencatat transaksi:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatedTotal = isFixed
    ? Number(quantity)
    : activeAsset.type === "stock"
    ? (Number(quantity) || 0) * 100 * (Number(pricePerUnit) || 0)
    : (Number(quantity) || 0) * (Number(pricePerUnit) || 0);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={type === "buy" ? "Beli Aset Investasi" : "Jual Aset Investasi"}
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
                      : activeAsset.type === "stock"
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

        <InputGroup
          label={isFixed ? "Jumlah Nominal" : activeAsset.type === "stock" ? "Jumlah Lot" : "Jumlah Unit / Kuantitas"}
          type={isFixed ? "text" : "number"}
          step="any"
          placeholder={isFixed ? "10.000.000" : activeAsset.type === "stock" ? "1" : "100"}
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          prefixText={isFixed ? baseCurrency : undefined}
          prefixIcon={!isFixed ? <Hash size={16} /> : undefined}
          suffixText={!isFixed ? (activeAsset.type === "stock" ? "Lot" : "Unit") : undefined}
          isCurrency={isFixed}
          currency={baseCurrency}
          required
          autoFocus
          disabled={isSubmitting}
        />

        {activeAsset.type === "stock" && quantity && (
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "-12px", marginBottom: "16px", paddingLeft: "4px" }}>
            = { (Number(quantity) * 100).toLocaleString("id-ID") } Lembar Saham (1 Lot = 100 Lembar)
          </div>
        )}

        {!isFixed && (
          <InputGroup
            label={activeAsset.type === "stock" ? "Harga per Lembar Saham" : "Harga per Unit"}
            type="text"
            value={pricePerUnit}
            onChange={e => setPricePerUnit(e.target.value)}
            prefixText={baseCurrency}
            suffixText={activeAsset.type === "stock" ? "/ Lembar" : "/ Unit"}
            isCurrency={true}
            currency={baseCurrency}
            required
            disabled={isSubmitting}
          />
        )}

        {calculatedTotal > 0 && (
          <div className={styles.totalValBox}>
            Total Transaksi: {formatCurrency(calculatedTotal)}
          </div>
        )}

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
          <option value="">Non-Akun (Tidak potong/tambah saldo)</option>
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
            disabled={!(calculatedTotal > 0) || isSubmitting}
          >
            {isSubmitting
              ? "Memproses..."
              : type === "buy"
              ? "Konfirmasi Beli"
              : "Konfirmasi Jual"}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
