"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, ArrowRight, PiggyBank, RefreshCw, Smartphone, TrendingUp } from "lucide-react";
import styles from "./WhatsNewModal.module.css";

interface WhatsNewModalProps {
  onClose?: () => void;
}

export default function WhatsNewModal({ onClose }: WhatsNewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const version = "1.1.0";

  useEffect(() => {
    // Show only when user has not seen this version yet
    const seen = localStorage.getItem("sentra_whats_new_seen");
    if (seen !== version) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("sentra_whats_new_seen", version);
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  const updates = [
    {
      icon: <Sparkles className={styles.iconYellow} size={22} />,
      title: "Smart Input Superpowers 🚀",
      description: "Pencatatan alami tanpa simbol (#/@) berbasis NLP Indonesia, Colored Tagging Chips real-time, dan selector manual untuk kelancaran input."
    },
    {
      icon: <PiggyBank className={styles.iconGreen} size={22} />,
      title: "Alokasi Gaji Multi-Target 🎯",
      description: "Bagi pemasukan gaji Anda ke beberapa target tabungan sekaligus secara dinamis (persentase) langsung di dalam modal pencatatan."
    },
    {
      icon: <Smartphone className={styles.iconBlue} size={22} />,
      title: "UX Input Persentase Halus ⚙️",
      description: "Pengisian persentase alokasi kini bersih dari tombol spinner panah yang mengganggu dan aman dari pergeseran angka akibat scroll."
    },
    {
      icon: <RefreshCw className={styles.iconPurple} size={22} />,
      title: "Pembaruan Kurs Harian & Real-time 💱",
      description: "Auto-fetch harian kurs valas (USD/SGD/EUR) secara silent di latar belakang serta tombol manual dengan sensor pembaruan UTC."
    },
    {
      icon: <TrendingUp className={styles.iconTeal} size={22} />,
      title: "Akurasi Kekayaan Bersih Valas 📈",
      description: "Perhitungan Kekayaan Bersih (Net Worth) di sidebar kini mengonversi secara otomatis saldo seluruh rekening valas Anda mengikuti kurs terkini."
    }
  ];

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.header}>
          <div className={styles.logoBadge}>Update v{version}</div>
          <h2>Ada yang Baru di Sentra! 🎉</h2>
          <p>Kami baru saja meningkatkan pengalaman Sentra untuk membantu pencatatan keuangan Anda lebih efisien.</p>
        </div>

        <div className={styles.updatesList}>
          {updates.map((up, idx) => (
            <div key={idx} className={styles.updateRow}>
              <div className={styles.iconWrap}>{up.icon}</div>
              <div className={styles.updateText}>
                <h4>{up.title}</h4>
                <p>{up.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <button onClick={handleClose} className={styles.actionBtn}>
            Bagus, Mulai Eksplorasi! <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
