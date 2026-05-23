"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useFinance } from "@/lib/financeContext";
import QuickAddModal from "./QuickAddModal";
import NotificationCenter from "./NotificationCenter";
import { useConfirm } from "./ConfirmDialog";
import PasscodeLock from "./PasscodeLock";
import { 
  LayoutDashboard, Receipt, Wallet, PiggyBank, 
  Percent, CreditCard, Settings, Menu, X, Plus, Bell, TrendingUp, Sparkles,
  Eye, EyeOff, LogOut
} from "lucide-react";
import styles from "./AppShell.module.css";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const confirm = useConfirm();
  const { 
    isQuickAddOpen, 
    setIsQuickAddOpen, 
    notifications, 
    clearNotification,
    formatCurrency,
    accounts,
    settings,
    hideBalances,
    toggleHideBalances,
    user,
    authLoading,
    logout
  } = useFinance();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);

  // Keyboard shortcut listener ('n' to open quick add modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ensure we don't open modal when typing in inputs
      if (
        document.activeElement && (
          document.activeElement.tagName === "INPUT" || 
          document.activeElement.tagName === "TEXTAREA" ||
          (document.activeElement as HTMLElement).isContentEditable
        )
      ) {
        return;
      }
      
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setIsQuickAddOpen(true);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setIsQuickAddOpen]);

  // Prevent scroll wheel changes on focused number inputs globally
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (
        document.activeElement &&
        document.activeElement.tagName === "INPUT" &&
        (document.activeElement as HTMLInputElement).type === "number"
      ) {
        (document.activeElement as HTMLInputElement).blur();
      }
    };
    document.addEventListener("wheel", handleWheel);
    return () => document.removeEventListener("wheel", handleWheel);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Auth routing redirect logic
  useEffect(() => {
    if (!authLoading) {
      if (!user && pathname !== "/login" && pathname !== "/register") {
        router.push("/login");
      } else if (user && (pathname === "/login" || pathname === "/register")) {
        router.push("/");
      }
    }
  }, [user, authLoading, pathname, router]);

  // Calculate Net Worth for sidebar
  const totalAssets = accounts
    .filter(acc => acc.type !== "credit_card")
    .reduce((sum, acc) => sum + (acc.balance || 0), 0);
  const totalDebts = accounts
    .filter(acc => acc.type === "credit_card")
    .reduce((sum, acc) => sum + Math.abs(acc.balance || 0), 0);
  const netWorth = totalAssets - totalDebts;

  const menuItems = [
    { name: "Dasbor", href: "/", icon: LayoutDashboard },
    { name: "Transaksi", href: "/transactions", icon: Receipt },
    { name: "Rekening / Dompet", href: "/accounts", icon: Wallet },
    { name: "Anggaran", href: "/budgets", icon: Percent },
    { name: "Tabungan / Target", href: "/savings", icon: PiggyBank },
    { name: "Investasi", href: "/investments", icon: TrendingUp },
    { name: "Analisis & AI", href: "/analytics", icon: Sparkles },
    { name: "Utang & Piutang", href: "/debts", icon: CreditCard },
    { name: "Tagihan & Langganan", href: "/subscriptions", icon: CreditCard },
    { name: "Pengaturan", href: "/settings", icon: Settings }
  ];

  if (authLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "#04342C" }}>
        <img 
          src="/icon-dark.png" 
          alt="Sentra Logo" 
          style={{ width: "96px", height: "96px", borderRadius: "24px", animation: "pulse 2s infinite ease-in-out" }}
        />
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.05); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  if (!user && pathname !== "/login" && pathname !== "/register") {
    return null;
  }

  if (pathname === "/login" || pathname === "/register") {
    return <>{children}</>;
  }

  return (
    <PasscodeLock>
      <div className="app-container">
      {/* Mobile Top Bar */}
      <header className={styles.mobileHeader}>
        <button className={styles.menuBtn} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <span className={styles.logoText}>sentra<span className={styles.logoDot}>.</span></span>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button className={styles.iconBtn} onClick={toggleHideBalances} title={hideBalances ? "Tampilkan Saldo" : "Sembunyikan Saldo"}>
            {hideBalances ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
          <button className={`${styles.iconBtn} ${styles.relative}`} onClick={() => setIsNotificationOpen(true)}>
            <Bell size={20} />
            {notifications.filter(n => n.type === "warning" || n.type === "error").length > 0 && (
              <span className={`${styles.badge} pulse`}></span>
            )}
          </button>
          <button className={styles.mobileQuickAdd} onClick={() => setIsQuickAddOpen(true)}>
            <Plus size={20} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className={styles.mobileOverlay} 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`${styles.sidebar} ${isSidebarOpen ? "" : styles.collapsed} ${isMobileMenuOpen ? styles.mobileOpen : ""}`}>
        <div className={styles.sidebarHeader}>
          <span className={styles.logoText}>sentra<span className={styles.logoDot}>.</span></span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button 
              className={styles.collapseBtn} 
              onClick={toggleHideBalances} 
              title={hideBalances ? "Tampilkan Saldo" : "Sembunyikan Saldo"}
              style={{ display: isSidebarOpen ? "flex" : "none" }}
            >
              {hideBalances ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button 
              className={styles.collapseBtn} 
              onClick={() => {
                setIsSidebarOpen(!isSidebarOpen);
                setIsMobileMenuOpen(false);
              }}
            >
              {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Dynamic Net Worth indicator in Sidebar */}
        <div className={styles.sidebarStats}>
          <div className={styles.statLabel}>KEKAYAAN BERSIH</div>
          <div className={`${styles.statValue} ${netWorth >= 0 ? styles.positive : styles.negative}`}>
            {formatCurrency(netWorth, settings.baseCurrency || "IDR")}
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.active : ""}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Icon size={20} />
                <span className={styles.navText}>{item.name}</span>
              </Link>
            );
          })}
          
          {user && (
            <button
              onClick={async () => {
                const yes = await confirm({
                  title: "Keluar Akun",
                  message: "Apakah Anda yakin ingin keluar dari akun?",
                  confirmText: "Keluar",
                  cancelText: "Batal",
                  variant: "danger"
                });
                if (yes) {
                  await logout();
                }
              }}
              className={styles.logoutBtn}
            >
              <LogOut size={20} />
              <span className={styles.navText}>Keluar Akun</span>
            </button>
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <button 
            className={styles.quickAddBtn} 
            onClick={() => {
              setIsQuickAddOpen(true);
              setIsMobileMenuOpen(false);
            }}
          >
            <Plus size={18} />
            <span className={styles.navText}>Catat Baru</span>
            <span className={styles.shortcutHint}>N</span>
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className={`main-content ${isSidebarOpen ? "" : "collapsed"}`}>
        {children}
      </main>

      {/* Quick Add Modal */}
      {isQuickAddOpen && <QuickAddModal onClose={() => setIsQuickAddOpen(false)} />}

      {/* Notification Center */}
      {isNotificationOpen && <NotificationCenter onClose={() => setIsNotificationOpen(false)} />}

      {/* In-App Toast popups in Bottom-Right */}
      <div className={styles.toastContainer}>
        {notifications.slice(0, 3).map((noti) => (
          <div key={noti.id} className={`${styles.toastCard} ${styles[noti.type] || ""}`} onClick={() => clearNotification(noti.id)}>
            <div className={styles.toastMessage}>{noti.message}</div>
            <div className={styles.toastTime}>{noti.date}</div>
          </div>
        ))}
      </div>
    </div>
    </PasscodeLock>
  );
}
