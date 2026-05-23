"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2, TrendingUp, Wallet, Percent, Check } from "lucide-react";
import styles from "../login/auth.module.css";
import { useFinance } from "@/lib/financeContext";

export default function RegisterPage() {
  const router = useRouter();
  const { registerWithEmail, loginWithGoogle } = useFinance();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const getFriendlyError = (code: string): string => {
    switch (code) {
      case "auth/email-already-in-use":
        return "Alamat email ini sudah terdaftar. Silakan masuk atau gunakan email lain.";
      case "auth/invalid-email":
        return "Format alamat email tidak valid.";
      case "auth/weak-password":
        return "Kata sandi terlalu lemah. Gunakan minimal 6 karakter.";
      case "auth/network-request-failed":
        return "Koneksi internet gagal. Periksa jaringan Anda.";
      case "auth/popup-closed-by-user":
        return "Proses pendaftaran Google dibatalkan.";
      default:
        return "Terjadi kesalahan. Silakan coba lagi.";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirmPassword) {
      setError("Silakan isi semua bidang input.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasNumeric = /[0-9]/.test(password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

    if (password.length < 6 || !hasUppercase || !hasNumeric || !hasSpecialChar) {
      setError("Kata sandi harus memenuhi seluruh kriteria keamanan di bawah.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      await registerWithEmail(email, password, fullName);
      setSuccess("Pendaftaran berhasil! Mengalihkan ke dasbor...");
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (err: any) {
      setError(getFriendlyError(err?.code || ""));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
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
            <h1 className={styles.authCardTitle}>Mulai Perjalanan Anda</h1>
            <p className={styles.authCardSub}>
              Sudah punya akun? <Link href="/login">Masuk sekarang</Link>
            </p>
          </div>

          {error && (
            <div className={styles.errorAlert} style={{ marginBottom: "20px" }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={styles.errorAlert} style={{ marginBottom: "20px", backgroundColor: "var(--color-income-light)", color: "var(--color-income)", borderColor: "rgba(29, 158, 117, 0.2)" }}>
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.authForm}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="fullName">
                Nama Lengkap
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  id="fullName"
                  className={styles.inputField}
                  placeholder="Nama Lengkap Anda"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            </div>

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
              
              {/* Real-time Password Requirements Checklist */}
              {password && (
                <div className={styles.passwordRequirements}>
                  <div className={`${styles.requirementItem} ${password.length >= 6 ? styles.met : ""}`}>
                    <Check size={12} />
                    <span>Minimal 6 karakter</span>
                  </div>
                  <div className={`${styles.requirementItem} ${/[A-Z]/.test(password) ? styles.met : ""}`}>
                    <Check size={12} />
                    <span>Huruf besar (A-Z)</span>
                  </div>
                  <div className={`${styles.requirementItem} ${/[0-9]/.test(password) ? styles.met : ""}`}>
                    <Check size={12} />
                    <span>Angka (0-9)</span>
                  </div>
                  <div className={`${styles.requirementItem} ${/[^A-Za-z0-9]/.test(password) ? styles.met : ""}`}>
                    <Check size={12} />
                    <span>Karakter khusus (!@#$ dll.)</span>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="confirmPassword">
                Konfirmasi Kata Sandi
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  className={styles.inputField}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className={styles.inputIconRight}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  title={showConfirmPassword ? "Sembunyikan Sandi" : "Tampilkan Sandi"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={isLoading || !!success}>
              {isLoading ? (
                <>
                  <div className={styles.spinner} />
                  <span>Membuat Akun...</span>
                </>
              ) : (
                <>
                  <span>Daftar</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className={styles.separatorRow}>
              <span>Atau Daftar Dengan</span>
            </div>

            <button
              type="button"
              className={styles.socialBtn}
              onClick={handleGoogleRegister}
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
      
    </div>
  );
}
