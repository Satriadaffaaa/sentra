"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle, TrendingUp, Wallet, Percent, X, CheckCircle2 } from "lucide-react";
import styles from "./auth.module.css";
import { useFinance } from "@/lib/financeContext";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithEmail, loginWithGoogle, forgotPassword } = useFinance();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Forgot Password modal states
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotError, setForgotError] = useState("");

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotError("Silakan masukkan alamat email Anda.");
      return;
    }
    
    setForgotLoading(true);
    setForgotError("");
    setForgotSuccess("");
    
    try {
      await forgotPassword(forgotEmail);
      setForgotSuccess(
        "Link reset kata sandi telah dikirim ke email Anda! Silakan periksa Kotak Masuk (Inbox) utama Anda. Jika email belum masuk dalam beberapa menit, mohon periksa folder Spam atau Promosi Anda secara teliti."
      );
    } catch (err: any) {
      console.error(err);
      setForgotError("Gagal mengirim email reset password. Pastikan email Anda sudah terdaftar.");
    } finally {
      setForgotLoading(false);
    }
  };

  const getFriendlyError = (code: string): string => {
    switch (code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Email atau kata sandi salah. Silakan coba lagi.";
      case "auth/invalid-email":
        return "Format alamat email tidak valid.";
      case "auth/too-many-requests":
        return "Terlalu banyak percobaan. Akun sementara dikunci. Coba lagi nanti.";
      case "auth/network-request-failed":
        return "Koneksi internet gagal. Periksa jaringan Anda.";
      case "auth/popup-closed-by-user":
        return "Proses login Google dibatalkan.";
      default:
        return "Terjadi kesalahan. Silakan coba lagi.";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Silakan isi semua bidang input.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await loginWithEmail(email, password);
      router.push("/");
    } catch (err: any) {
      setError(getFriendlyError(err?.code || ""));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError("");
    try {
      await loginWithGoogle();
      router.push("/");
    } catch (err: any) {
      setError(getFriendlyError(err?.code || ""));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Google SVG Icon
  const GoogleIcon = () => (
    <svg className={styles.socialIcon} viewBox="0 0 24 24" width="18" height="18">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.1.14-.1.14a5.73 5.73 0 0 1-2.49 3.76v3.12h4.01c2.34-2.16 3.63-5.33 3.63-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-4.01-3.12c-1.12.75-2.55 1.19-3.95 1.19-3.05 0-5.63-2.06-6.55-4.83H1.31v3.22A12.003 12.003 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.45 14.33a7.14 7.14 0 0 1 0-4.66V6.45H1.31a12.014 12.014 0 0 0 0 11.1l4.14-3.22z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.96 1.19 15.24 0 12 0 7.32 0 3.28 2.69 1.31 6.45l4.14 3.22c.92-2.77 3.5-4.92 6.55-4.92z"
      />
    </svg>
  );

  return (
    <div className={styles.authContainer}>
      
      {/* Visual Showcase Panel (Left) */}
      <section className={styles.visualPanel}>
        <div className={styles.glowSphere1} />
        <div className={styles.glowSphere2} />

        <div className={styles.visualHeader}>
          <span className={styles.logo}>
            sentra<span className={styles.logoDot}>.</span>
          </span>
        </div>

        <div className={styles.visualBody}>
          <h2 className={styles.headline}>
            Kelola Kekayaan, Pantau Investasi, Kendalikan Anggaran.
          </h2>

          <div className={styles.featuresList}>
            <div className={styles.featureItem}>
              <div className={styles.featureIconWrapper}>
                <Wallet size={20} />
              </div>
              <div className={styles.featureText}>
                <h4>Pelacakan Multi-Akun</h4>
                <p>Kelola seluruh rekening bank, e-wallet, dan kas tunai Anda secara terpusat dalam satu dasbor dinamis.</p>
              </div>
            </div>

            <div className={styles.featureItem}>
              <div className={styles.featureIconWrapper}>
                <TrendingUp size={20} />
              </div>
              <div className={styles.featureText}>
                <h4>Monitor Portofolio</h4>
                <p>Pantau perkembangan real-time aset saham, kripto, emas, dan reksa dana Anda dengan grafik interaktif.</p>
              </div>
            </div>

            <div className={styles.featureItem}>
              <div className={styles.featureIconWrapper}>
                <Percent size={20} />
              </div>
              <div className={styles.featureText}>
                <h4>Anggaran Pintar</h4>
                <p>Hindari pembengkakan biaya dengan penetapan batas pengeluaran bulanan per kategori belanja.</p>
              </div>
            </div>
          </div>

          {/* Interactive Visual Glassmorphic Mockup */}
          <div className={styles.mockupCard}>
            <div className={styles.mockupHeader}>
              <span className={styles.mockupTitle}>Kekayaan Bersih Anda</span>
              <span className={styles.mockupBadge}>+14.2%</span>
            </div>
            <div className={styles.mockupValue}>Rp 245.850.000</div>
            <div className={styles.mockupSub}>Diperbarui 2 menit yang lalu dari 5 dompet</div>
            <div className={styles.mockupProgress}>
              <div className={styles.mockupProgressFill} />
            </div>
          </div>
        </div>

        <div className={styles.visualFooter}>
          &copy; {new Date().getFullYear()} sentra. All rights reserved.
        </div>
      </section>

      {/* Form Panel (Right) */}
      <section className={styles.formPanel}>
        <div className={styles.authCard}>
          <div className={styles.authCardHeader}>
            <h1 className={styles.authCardTitle}>Selamat Datang</h1>
            <p className={styles.authCardSub}>
              Belum punya akun? <Link href="/register">Daftar sekarang</Link>
            </p>
          </div>

          {error && (
            <div className={styles.errorAlert} style={{ marginBottom: "20px" }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.authForm}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="email">
                Alamat Email
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="email"
                  id="email"
                  className={styles.inputField}
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="password">
                Kata Sandi
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  className={styles.inputField}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className={styles.inputIconRight}
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Sembunyikan Sandi" : "Tampilkan Sandi"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className={styles.formOptions}>
              <label className={styles.rememberMe}>
                <input type="checkbox" />
                <span>Ingat saya</span>
              </label>
              <a href="#" className={styles.forgotPasswordLink} onClick={(e) => { 
                e.preventDefault(); 
                setForgotSuccess("");
                setForgotError("");
                setForgotEmail("");
                setIsForgotOpen(true); 
              }}>
                Lupa sandi?
              </a>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className={styles.spinner} />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className={styles.separatorRow}>
              <span>Atau Masuk Dengan</span>
            </div>

            <button
              type="button"
              className={styles.socialBtn}
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading || isLoading}
            >
              {isGoogleLoading ? (
                <div className={styles.spinner} style={{ width: 18, height: 18 }} />
              ) : (
                <GoogleIcon />
              )}
              <span>Google</span>
            </button>
          </form>
        </div>
      </section>

      {/* Forgot Password Modal Overlay */}
      {isForgotOpen && (
        <div className={styles.forgotOverlay} onClick={() => setIsForgotOpen(false)}>
          <div className={styles.forgotCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.forgotCardHeader}>
              <h3 className={styles.forgotCardTitle}>Lupa Kata Sandi</h3>
              <button 
                type="button" 
                className={styles.forgotCloseBtn} 
                onClick={() => setIsForgotOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {forgotSuccess ? (
              <div className={styles.forgotSuccessBox}>
                <div className={styles.forgotSuccessTitle}>
                  <CheckCircle2 size={18} />
                  <span>Email Terkirim!</span>
                </div>
                <p style={{ marginTop: "6px" }}>{forgotSuccess}</p>
                <button 
                  type="button" 
                  className={styles.submitBtn} 
                  style={{ marginTop: "12px" }}
                  onClick={() => {
                    setIsForgotOpen(false);
                    setForgotSuccess("");
                    setForgotEmail("");
                  }}
                >
                  Tutup
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className={styles.authForm}>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                  Masukkan alamat email Anda untuk menerima link reset kata sandi akun Anda.
                </p>

                {forgotError && (
                  <div className={styles.errorAlert}>
                    <AlertCircle size={18} />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="forgotEmail">
                    Alamat Email
                  </label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="email"
                      id="forgotEmail"
                      className={styles.inputField}
                      placeholder="name@company.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button type="submit" className={styles.submitBtn} disabled={forgotLoading}>
                  {forgotLoading ? (
                    <>
                      <div className={styles.spinner} />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <span>Kirim Link Reset</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      
    </div>
  );
}
