"use client";

import React, { useState, useEffect, useRef } from "react";
import { useFinance } from "@/lib/financeContext";
import { Delete, LogOut } from "lucide-react";
import styles from "./PasscodeLock.module.css";
import { useConfirm } from "./ConfirmDialog";

interface PasscodeLockProps {
  children: React.ReactNode;
}

export default function PasscodeLock({ children }: PasscodeLockProps) {
  const { settings, user, logout } = useFinance();
  const confirm = useConfirm();
  const passcodeEnabled = settings?.passcodeEnabled;
  const passcodePIN = settings?.passcodePIN;

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [pin, setPin] = useState<string>("");
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize lock state based on session storage & settings
  useEffect(() => {
    if (user && passcodeEnabled && passcodePIN) {
      const unlocked = sessionStorage.getItem("sentra_unlocked") === "true";
      if (!unlocked) {
        setIsLocked(true);
      }
    } else {
      setIsLocked(false);
    }
  }, [user, passcodeEnabled, passcodePIN]);

  // Handle inactivity timeout (5 minutes)
  useEffect(() => {
    if (!user || !passcodeEnabled || !passcodePIN || isLocked) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      return;
    }

    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setIsLocked(true);
        sessionStorage.removeItem("sentra_unlocked");
      }, 300000); // 5 minutes (300,000 ms)
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetIdleTimer));

    // Initialize timer
    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetIdleTimer));
    };
  }, [user, passcodeEnabled, passcodePIN, isLocked]);

  // Handle visibility change (backgrounding timeout)
  useEffect(() => {
    if (!user || !passcodeEnabled || !passcodePIN) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App went to background, store current time
        localStorage.setItem("sentra_bg_time", Date.now().toString());
      } else {
        // App returned to foreground, check elapsed time
        const bgTimeStr = localStorage.getItem("sentra_bg_time");
        if (bgTimeStr) {
          const bgTime = parseInt(bgTimeStr, 10);
          const elapsed = Date.now() - bgTime;
          if (elapsed >= 300000) { // 5 minutes
            setIsLocked(true);
            sessionStorage.removeItem("sentra_unlocked");
          }
          localStorage.removeItem("sentra_bg_time");
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, passcodeEnabled, passcodePIN, isLocked]);

  // Handle keypress logic
  const handleNumberPress = (num: string) => {
    if (isShaking) return; // Prevent input during shake animation
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);

      // Auto-validate once 4 digits are entered
      if (newPin.length === 4) {
        if (newPin === passcodePIN) {
          // Success! Unlock
          sessionStorage.setItem("sentra_unlocked", "true");
          setIsLocked(false);
          setPin("");
        } else {
          // Shake and reset PIN
          setIsShaking(true);
          setTimeout(() => {
            setIsShaking(false);
            setPin("");
          }, 500);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0 && !isShaking) {
      setPin(pin.slice(0, -1));
    }
  };

  const handleLogout = async () => {
    const yes = await confirm({
      title: "Keluar Akun",
      message: "Apakah Anda ingin keluar dari akun karena lupa PIN?",
      confirmText: "Keluar",
      cancelText: "Batal",
      variant: "danger",
    });
    if (yes) {
      sessionStorage.removeItem("sentra_unlocked");
      await logout();
      setIsLocked(false);
      setPin("");
    }
  };

  // Keyboard support for numeric inputs
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleNumberPress(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLocked, pin, passcodePIN, isShaking]);

  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className={styles.lockOverlay}>
      <div className={styles.lockContainer}>
        <div className={styles.lockHeader}>
          <div className={styles.logoText}>sentra<span className={styles.logoDot}>.</span></div>
          <p className={styles.lockSubtitle}>Keuangan Anda Aman Bersama Kami</p>
        </div>

        <div className={styles.pinDisplaySection}>
          <p className={styles.pinTitle}>Masukkan PIN Keamanan</p>
          <div className={`${styles.dotsContainer} ${isShaking ? styles.shake : ""}`}>
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`${styles.dot} ${index < pin.length ? styles.filled : ""}`}
              />
            ))}
          </div>
        </div>

        <div className={styles.keypadContainer}>
          <div className={styles.keypadGrid}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                className={styles.keyButton}
                onClick={() => handleNumberPress(num)}
              >
                {num}
              </button>
            ))}
            <button className={`${styles.keyButton} ${styles.dangerButton}`} onClick={handleLogout} title="Keluar Akun">
              <LogOut size={20} />
              <span className={styles.buttonLabel}>Keluar</span>
            </button>
            <button className={styles.keyButton} onClick={() => handleNumberPress("0")}>
              0
            </button>
            <button className={`${styles.keyButton} ${styles.actionButton}`} onClick={handleBackspace} title="Hapus">
              <Delete size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
