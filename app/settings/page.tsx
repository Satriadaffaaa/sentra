"use client";

import React, { useState, useEffect } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useFinance } from "@/lib/financeContext";
import { FinanceService } from "@/lib/financeService";
import { Bell, AlertTriangle, Coins, Database, Check, Lock, Shield, RefreshCw } from "lucide-react";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const {
    settings,
    saveSettings,
    resetAllData,
    pushNotification,
    isLoading,
    savingsGoals,
    formatCurrency
  } = useFinance();

  const confirm = useConfirm();

  const [baseCurrency, setBaseCurrency] = useState("IDR");
  const [usdRate, setUsdRate] = useState("16200");
  const [sgdRate, setSgdRate] = useState("12100");
  const [eurRate, setEurRate] = useState("17600");
  
  // Notification toggle states
  const [browserPermission, setBrowserPermission] = useState("default");
  
  // Firebase status
  const [isFirebase, setIsFirebase] = useState(false);

  // Real-time exchange rate states
  const [isFetchingRates, setIsFetchingRates] = useState(false);
  const [ratesLastUpdated, setRatesLastUpdated] = useState("");
  const [autoExchangeRatesEnabled, setAutoExchangeRatesEnabled] = useState(true);

  // Passcode Settings state
  const [passcodeEnabled, setPasscodeEnabled] = useState(false);
  const [passcodePIN, setPasscodePIN] = useState("");
  const [newPIN, setNewPIN] = useState("");
  const [confirmPIN, setConfirmPIN] = useState("");
  const [currentPINInput, setCurrentPINInput] = useState("");
  const [isSettingPIN, setIsSettingPIN] = useState(false);

  useEffect(() => {
    if (settings) {
      if (settings.baseCurrency) setBaseCurrency(settings.baseCurrency);
      if (settings.exchangeRates) {
        if (settings.exchangeRates.USD) setUsdRate(settings.exchangeRates.USD.toString());
        if (settings.exchangeRates.SGD) setSgdRate(settings.exchangeRates.SGD.toString());
        if (settings.exchangeRates.EUR) setEurRate(settings.exchangeRates.EUR.toString());
      }
      setPasscodeEnabled(!!settings.passcodeEnabled);
      setPasscodePIN(settings.passcodePIN || "");
      setAutoExchangeRatesEnabled(settings.autoExchangeRatesEnabled !== false);
    }
    
    // Check firebase support
    setIsFirebase(FinanceService.isFirebase());

    // Check browser notification permission
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserPermission(Notification.permission);
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Memuat pengaturan...</p>
      </div>
    );
  }

  // Fetch real-time exchange rates from ExchangeRate-API (relative to IDR base)
  const fetchRealtimeRates = async () => {
    setIsFetchingRates(true);
    try {
      const response = await fetch("https://open.er-api.com/v6/latest/IDR");
      if (!response.ok) throw new Error("Gagal mengambil data kurs.");
      const data = await response.json();
      
      if (data && data.rates) {
        const usdRateFromApi = data.rates.USD;
        const sgdRateFromApi = data.rates.SGD;
        const eurRateFromApi = data.rates.EUR;
        
        if (usdRateFromApi && sgdRateFromApi && eurRateFromApi) {
          const usd = Math.round(1 / usdRateFromApi);
          const sgd = Math.round(1 / sgdRateFromApi);
          const eur = Math.round(1 / eurRateFromApi);
          
          setUsdRate(usd.toString());
          setSgdRate(sgd.toString());
          setEurRate(eur.toString());
          
          if (data.time_last_update_utc) {
            setRatesLastUpdated(data.time_last_update_utc);
          }
          
          pushNotification("Kurs mata uang berhasil diperbarui ke harga realtime. Silakan simpan untuk menerapkan.", "success");
        } else {
          throw new Error("Data kurs mata uang dari API tidak lengkap.");
        }
      } else {
        throw new Error("Data rates tidak ditemukan.");
      }
    } catch (err: any) {
      console.error(err);
      pushNotification(err.message || "Gagal memperbarui kurs real-time.", "error");
    } finally {
      setIsFetchingRates(false);
    }
  };

  // Handle saving general configurations
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const today = new Date().toISOString().split("T")[0];
      const updatedSettings = {
        ...settings,
        baseCurrency,
        autoExchangeRatesEnabled,
        exchangeRates: {
          ...settings.exchangeRates,
          USD: Number(usdRate) || 16200,
          SGD: Number(sgdRate) || 12100,
          EUR: Number(eurRate) || 17600,
          IDR: 1
        },
        // If they did manual refresh or toggle, save today's date so auto-update doesn't run again today
        ...(ratesLastUpdated ? { lastExchangeRatesFetchDate: today } : {})
      };

      await saveSettings(updatedSettings);
      pushNotification("Konfigurasi mata uang dan kurs berhasil diperbarui.", "success");
    } catch (err) {
      console.error(err);
      pushNotification("Gagal menyimpan pengaturan.", "error");
    }
  };

  // Handle Passcode settings toggle/change
  const handleSavePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If enabling or changing PIN
    if (!passcodePIN || isSettingPIN) {
      if (newPIN.length !== 4 || !/^\d+$/.test(newPIN)) {
        pushNotification("PIN harus terdiri dari 4 digit angka.", "warning");
        return;
      }
      if (newPIN !== confirmPIN) {
        pushNotification("Konfirmasi PIN tidak cocok.", "warning");
        return;
      }
      
      try {
        const updatedSettings = {
          ...settings,
          passcodeEnabled: true,
          passcodePIN: newPIN
        };
        await saveSettings(updatedSettings);
        pushNotification("PIN Keamanan berhasil diaktifkan/diubah.", "success");
        setPasscodePIN(newPIN);
        setNewPIN("");
        setConfirmPIN("");
        setIsSettingPIN(false);
      } catch (err) {
        console.error(err);
        pushNotification("Gagal mengaktifkan PIN Keamanan.", "error");
      }
    } else {
      // If turning off passcode
      if (currentPINInput !== passcodePIN) {
        pushNotification("PIN saat ini salah.", "error");
        return;
      }
      
      try {
        const updatedSettings = {
          ...settings,
          passcodeEnabled: false,
          passcodePIN: ""
        };
        await saveSettings(updatedSettings);
        pushNotification("PIN Keamanan berhasil dinonaktifkan.", "success");
        setPasscodePIN("");
        setCurrentPINInput("");
        setPasscodeEnabled(false);
      } catch (err) {
        console.error(err);
        pushNotification("Gagal menonaktifkan PIN Keamanan.", "error");
      }
    }
  };

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      pushNotification("Browser Anda tidak mendukung push notifications.", "error");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission === "granted") {
        pushNotification("Notifikasi push browser berhasil diaktifkan!", "success");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reset entire simulator
  const handleResetData = async () => {
    const yes = await confirm({
      title: "⚠️ Reset Setelan Pabrik",
      message: "PERINGATAN! Ini akan menghapus seluruh data transaksi, rekening, anggaran, tagihan, dan target tabungan Anda untuk dikembalikan ke setelan pabrik. Tindakan ini tidak bisa dibatalkan.",
      variant: "danger",
      confirmText: "Ya, Reset Semua Data",
      cancelText: "Batal",
    });
    if (yes) {
      resetAllData();
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  };

  return (
    <div className={styles.settingsContainer}>
      {/* Page Header */}
      <div className="page-header-flex">
        <div className="page-header-info">
          <h1 className="page-header-title">Pengaturan Aplikasi</h1>
          <p className="page-header-subtitle">Sesuaikan preferensi mata uang, notifikasi, database cloud dan reset simulasi.</p>
        </div>
      </div>

      {/* Grid for settings layouts */}
      <div className={styles.settingsGrid}>
        {/* Left Col: Configurations */}
        <div className={styles.settingsMain}>
          {/* Card 1: Currency Settings */}
          <form onSubmit={handleSaveGeneral} className={`card ${styles.settingsCard}`}>
            <div className={styles.cardHeader}>
              <Coins size={20} className={styles.cardHeaderIcon} />
              <h3>Konfigurasi Mata Uang & Kurs</h3>
            </div>
            <p className={styles.cardDescription}>Setel mata uang pelaporan utama (Base Currency) serta nilai tukar konversi mata uang asing.</p>

            <div className="form-group">
              <label className="form-label">Mata Uang Utama Dasbor (Base)</label>
              <select 
                className="form-input"
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
              >
                <option value="IDR">Rupiah Indonesia (IDR)</option>
                <option value="USD">Dolar Amerika Serikat (USD)</option>
                <option value="SGD">Dolar Singapura (SGD)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
              <span className={styles.inputHelper}>Semua saldo rekening valas akan dikonversi ke mata uang ini untuk perhitungan kekayaan bersih.</span>
            </div>

            <div className="form-group" style={{ marginBottom: "16px", borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="checkbox"
                  id="autoExchangeRatesEnabled"
                  checked={autoExchangeRatesEnabled}
                  onChange={(e) => setAutoExchangeRatesEnabled(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <label htmlFor="autoExchangeRatesEnabled" className="form-label" style={{ marginBottom: 0, cursor: "pointer", fontWeight: 600 }}>
                  Perbarui Kurs Secara Otomatis (Harian)
                </label>
              </div>
              <span className={styles.inputHelper}>Mengambil kurs pasar terbaru USD, SGD, EUR secara otomatis setiap hari saat aplikasi pertama dibuka.</span>
            </div>

            <div className={styles.exchangeRatesSection}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Kurs Konversi Valuta (terhadap IDR)</label>
                <button
                  type="button"
                  onClick={fetchRealtimeRates}
                  disabled={isFetchingRates}
                  className="btn btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", padding: "4px 8px" }}
                >
                  <RefreshCw size={12} className={isFetchingRates ? styles.spinIcon : ""} />
                  {isFetchingRates ? "Memuat..." : "Perbarui Kurs Real-Time"}
                </button>
              </div>
              
              <div className={styles.rateInputs}>
                <div className={styles.rateInputGroup}>
                  <span className={styles.rateAddon}>1 USD =</span>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={usdRate} 
                    onChange={(e) => setUsdRate(e.target.value)}
                    placeholder="16200"
                    min="1"
                    required
                  />
                  <span className={styles.rateAddonRight}>IDR</span>
                </div>

                <div className={styles.rateInputGroup}>
                  <span className={styles.rateAddon}>1 SGD =</span>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={sgdRate} 
                    onChange={(e) => setSgdRate(e.target.value)}
                    placeholder="12100"
                    min="1"
                    required
                  />
                  <span className={styles.rateAddonRight}>IDR</span>
                </div>

                <div className={styles.rateInputGroup}>
                  <span className={styles.rateAddon}>1 EUR =</span>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={eurRate} 
                    onChange={(e) => setEurRate(e.target.value)}
                    placeholder="17600"
                    min="1"
                    required
                  />
                  <span className={styles.rateAddonRight}>IDR</span>
                </div>
              </div>
              {ratesLastUpdated && (
                <span className={styles.inputHelper} style={{ display: "block", marginTop: "4px", fontSize: "10px", color: "var(--text-muted)", textAlign: "right" }}>
                  Sumber: ExchangeRate-API. Terakhir diperbarui UTC: {ratesLastUpdated}
                </span>
              )}
            </div>

            <div className={styles.formActions}>
              <button type="submit" className="btn btn-primary">
                Simpan Konfigurasi
              </button>
            </div>
          </form>

          {/* Card 2: Notifications */}
          <div className={`card ${styles.settingsCard}`}>
            <div className={styles.cardHeader}>
              <Bell size={20} className={styles.cardHeaderIcon} />
              <h3>Notifikasi Push Browser</h3>
            </div>
            <p className={styles.cardDescription}>Aktifkan peringatan browser sehingga Anda menerima pop-up pengingat anggaran melebihi batas atau tagihan jatuh tempo meskipun tab ditutup.</p>

            <div className={styles.notificationStatusRow}>
              <div className={styles.statusDetails}>
                <span className={styles.statusLabel}>Izin Notifikasi Saat Ini:</span>
                <strong className={`${styles.statusBadge} ${styles[browserPermission] || ""}`}>
                  {browserPermission === "granted" ? "Diizinkan" : browserPermission === "denied" ? "Diblokir" : "Belum Ditentukan"}
                </strong>
              </div>
              
              {browserPermission !== "granted" ? (
                <button className="btn btn-primary" onClick={requestNotificationPermission}>
                  Aktifkan Notifikasi
                </button>
              ) : (
                <div className={styles.grantedBanner}>
                  <Check size={16} />
                  <span>Notifikasi browser aktif</span>
                </div>
              )}
            </div>
          </div>

          {/* Card: PIN Security settings */}
          <div className={`card ${styles.settingsCard}`}>
            <div className={styles.cardHeader}>
              <Lock size={20} className={styles.cardHeaderIcon} />
              <h3>Kunci PIN Keamanan (4 Digit)</h3>
            </div>
            <p className={styles.cardDescription}>
              Lindungi data keuangan Anda dengan kunci PIN 4-digit. Aplikasi akan terkunci otomatis setelah 5 menit tidak ada aktivitas.
            </p>

            {passcodePIN ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className={styles.notificationStatusRow}>
                  <div className={styles.statusDetails}>
                    <span className={styles.statusLabel}>Status Kunci PIN:</span>
                    <strong className={`${styles.statusBadge} ${styles.granted}`}>
                      Aktif
                    </strong>
                  </div>
                  {!isSettingPIN && (
                    <button 
                      className="btn btn-primary" 
                      onClick={() => setIsSettingPIN(true)}
                    >
                      Ubah PIN
                    </button>
                  )}
                </div>

                {isSettingPIN ? (
                  <form onSubmit={handleSavePasscode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">PIN Baru (4 Digit)</label>
                      <input
                        type="password"
                        className="form-input"
                        value={newPIN}
                        onChange={(e) => {
                          if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) {
                            setNewPIN(e.target.value);
                          }
                        }}
                        placeholder="••••"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Konfirmasi PIN Baru</label>
                      <input
                        type="password"
                        className="form-input"
                        value={confirmPIN}
                        onChange={(e) => {
                          if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) {
                            setConfirmPIN(e.target.value);
                          }
                        }}
                        placeholder="••••"
                        required
                      />
                    </div>
                    <div className={styles.formActions} style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" className="btn btn-primary">
                        Simpan PIN Baru
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => {
                          setIsSettingPIN(false);
                          setNewPIN("");
                          setConfirmPIN("");
                        }}
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleSavePasscode} style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Masukkan PIN Saat Ini untuk Menonaktifkan</label>
                      <input
                        type="password"
                        className="form-input"
                        value={currentPINInput}
                        onChange={(e) => {
                          if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) {
                            setCurrentPINInput(e.target.value);
                          }
                        }}
                        placeholder="••••"
                        required
                      />
                    </div>
                    <div className={styles.formActions}>
                      <button type="submit" className="btn btn-danger">
                        Nonaktifkan Kunci PIN
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <form onSubmit={handleSavePasscode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className={styles.notificationStatusRow}>
                  <div className={styles.statusDetails}>
                    <span className={styles.statusLabel}>Status Kunci PIN:</span>
                    <strong className={`${styles.statusBadge} ${styles.denied}`}>
                      Tidak Aktif
                    </strong>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Masukkan PIN Baru (4 Digit)</label>
                  <input
                    type="password"
                    className="form-input"
                    value={newPIN}
                    onChange={(e) => {
                      if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) {
                        setNewPIN(e.target.value);
                      }
                    }}
                    placeholder="••••"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Konfirmasi PIN Baru</label>
                  <input
                    type="password"
                    className="form-input"
                    value={confirmPIN}
                    onChange={(e) => {
                      if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) {
                        setConfirmPIN(e.target.value);
                      }
                    }}
                    placeholder="••••"
                    required
                  />
                </div>
                <div className={styles.formActions}>
                  <button type="submit" className="btn btn-primary">
                    Aktifkan Kunci PIN
                  </button>
                </div>
              </form>
            )}
          </div>


        </div>

        {/* Right Col: Database Info & Reset */}
        <div className={styles.settingsSidebar}>
          {/* Card 3: Storage State */}
          <div className={`card ${styles.settingsCard}`}>
            <div className={styles.cardHeader}>
              <Database size={20} className={styles.cardHeaderIcon} />
              <h3>Status Database</h3>
            </div>
            <p className={styles.cardDescription}>Melihat jenis penyimpanan aktif aplikasi keuangan Anda.</p>

            <div className={styles.dbStatusBox}>
              {isFirebase ? (
                <div className={`${styles.dbStatusIndicator} ${styles.active}`}>
                  <span className={`${styles.indicatorDot} pulse`}></span>
                  <div>
                    <strong>Firebase Cloud Firestore</strong>
                    <p>Sinkronisasi data cloud real-time aktif.</p>
                  </div>
                </div>
              ) : (
                <div className={`${styles.dbStatusIndicator} ${styles.demo}`}>
                  <span className={`${styles.indicatorDot} amber`}></span>
                  <div>
                    <strong>Demo Mode (LocalStorage)</strong>
                    <p>Data disimpan di browser lokal Anda secara offline.</p>
                  </div>
                </div>
              )}
            </div>

            {!isFirebase && (
              <div className={styles.dbTipBox}>
                <strong>Cara Hubungkan ke Cloud:</strong>
                <p>Tambahkan file <code>.env.local</code> di direktori root project dengan variabel berikut:</p>
                <pre>
{`NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx`}
                </pre>
                <p className={styles.tipDesc}>Lalu restart Next.js dev server. Data Anda akan terhubung otomatis.</p>
              </div>
            )}
          </div>

          {/* Card 4: Factory Reset (Danger Area) */}
          <div className={`card ${styles.settingsCard} ${styles.dangerCard}`}>
            <div className={`${styles.cardHeader} text-danger`}>
              <AlertTriangle size={20} className={styles.cardHeaderIcon} />
              <h3>Zona Bahaya</h3>
            </div>
            <p className={styles.cardDescription}>Tindakan pembersihan database menyeluruh.</p>
            
            <div className={styles.dangerBox}>
              <p>Tombol di bawah akan menghapus seluruh data simulasi dan mengembalikan data bawaan demo (Gaji, BCA, Gopay, Netflix dll).</p>
              <button className="btn btn-danger" onClick={handleResetData}>
                Reset Seluruh Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
