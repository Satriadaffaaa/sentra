"use client";

import React, { useState, useEffect } from "react";
import { useFinance } from "@/lib/financeContext";
import { Bell, X, AlertTriangle, AlertCircle, CheckCircle, Info, Settings2 } from "lucide-react";
import styles from "./NotificationCenter.module.css";

interface NotificationCenterProps {
  onClose: () => void;
}

export default function NotificationCenter({ onClose }: NotificationCenterProps) {
  const { 
    notifications, 
    clearNotification, 
    clearAllNotifications 
  } = useFinance();
  
  const [permissionStatus, setPermissionStatus] = useState<string>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
    }
  };

  const getIcon = (type: 'info' | 'success' | 'warning' | 'error') => {
    switch (type) {
      case "success": return <CheckCircle size={18} className={styles.textSuccess} />;
      case "warning": return <AlertTriangle size={18} className={styles.textWarning} />;
      case "error": return <AlertCircle size={18} className={styles.textDanger} />;
      default: return <Info size={18} className={styles.textInfo} />;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${styles.notificationPanel}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.panelHeader}>
          <div className={styles.titleGroup}>
            <Bell size={20} className={styles.textBrand} />
            <h3>Pusat Notifikasi</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Browser Permission Prompt Section */}
        <div className={styles.notificationSettings}>
          <Settings2 size={16} />
          <div className={styles.settingsDesc}>
            {permissionStatus === "granted" ? (
              <span>Notifikasi Desktop Aktif</span>
            ) : permissionStatus === "denied" ? (
              <span>Izin notifikasi diblokir oleh browser.</span>
            ) : (
              <span>Aktifkan notifikasi sistem browser?</span>
            )}
          </div>
          {permissionStatus === "default" && (
            <button className={`btn ${styles.btnSm} btn-primary`} onClick={requestPermission}>
              Aktifkan
            </button>
          )}
        </div>

        <div className={styles.notificationsList}>
          {notifications.length === 0 ? (
            <div className={styles.emptyState}>
              <Bell size={48} className="text-muted" />
              <p>Tidak ada pemberitahuan baru.</p>
            </div>
          ) : (
            notifications.map((noti) => (
              <div key={noti.id} className={`${styles.notiItem} ${styles[noti.type] || ""}`}>
                <div className="noti-icon">{getIcon(noti.type)}</div>
                <div className={styles.notiBody}>
                  <p className={styles.notiMsg}>{noti.message}</p>
                  <span className={styles.notiTime}>{noti.date}</span>
                </div>
                <button className={styles.notiDelete} onClick={() => clearNotification(noti.id)}>
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className={styles.panelFooter}>
            <button className={styles.clearAllLink} onClick={clearAllNotifications}>
              Bersihkan Semua
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
