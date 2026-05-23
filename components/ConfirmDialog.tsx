"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { AlertTriangle, Trash2, Info, HelpCircle, X } from "lucide-react";
import styles from "./ConfirmDialog.module.css";

// --- Types ---
type ConfirmVariant = "danger" | "warning" | "info" | "default";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  showCancel?: boolean;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmDialogProvider");
  return ctx.confirm;
}

// --- Provider ---
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") handleCancel();
    if (e.key === "Enter") handleConfirm();
  }, [handleCancel, handleConfirm]);

  const variant = options?.variant || "default";

  const iconMap: Record<ConfirmVariant, React.ReactNode> = {
    danger: <Trash2 size={22} />,
    warning: <AlertTriangle size={22} />,
    info: <Info size={22} />,
    default: <HelpCircle size={22} />,
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && options && (
        <div
          className={styles.overlay}
          onClick={handleCancel}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div
            className={`${styles.dialog} ${styles[variant]}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button className={styles.closeBtn} onClick={handleCancel} aria-label="Tutup">
              <X size={18} />
            </button>

            {/* Icon */}
            <div className={`${styles.iconCircle} ${styles[`icon${variant.charAt(0).toUpperCase() + variant.slice(1)}`]}`}>
              {iconMap[variant]}
            </div>

            {/* Title */}
            <h3 className={styles.title}>
              {options.title || (variant === "danger" ? "Konfirmasi Hapus" : "Konfirmasi")}
            </h3>

            {/* Message */}
            <p className={styles.message}>{options.message}</p>

            {/* Actions */}
            <div className={styles.actions}>
              {options.showCancel !== false && (
                <button
                  className={styles.cancelBtn}
                  onClick={handleCancel}
                >
                  {options.cancelText || "Batal"}
                </button>
              )}
              <button
                className={`${styles.confirmBtn} ${styles[`confirm${variant.charAt(0).toUpperCase() + variant.slice(1)}`]}`}
                onClick={handleConfirm}
                autoFocus
                style={options.showCancel === false ? { width: "100%" } : {}}
              >
                {options.confirmText || (variant === "danger" ? "Ya, Hapus" : "Ya, Lanjutkan")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
