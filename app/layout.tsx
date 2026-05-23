import React from "react";
import { FinanceProvider } from "@/lib/financeContext";
import { ConfirmDialogProvider } from "@/components/ConfirmDialog";
import AppShell from "@/components/AppShell";
import "./globals.css";

export const metadata = {
  title: "Sentra.",
  description: "Website pencatatan keuangan pribadi komprehensif, cepat, interaktif dan aman.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/icon-dark.svg" type="image/svg+xml" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="icon" href="/icons/icon-512.png" type="image/png" sizes="512x512" />
        <link rel="shortcut icon" href="/icons/icon-192.png" type="image/png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Sentra" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />
        <meta name="theme-color" content="#04342C" />
        <script>
          {`
            if ('serviceWorker' in navigator) {
              const registerSW = () => {
                navigator.serviceWorker.register('/sw.js').then(
                  function(reg) { console.log('SW registered:', reg.scope); },
                  function(err) { console.log('SW registration failed:', err); }
                );
              };
              if (document.readyState === 'complete') {
                registerSW();
              } else {
                window.addEventListener('load', registerSW);
              }
            }
          `}
        </script>
      </head>
      <body suppressHydrationWarning>
        <FinanceProvider>
          <ConfirmDialogProvider>
            <AppShell>{children}</AppShell>
          </ConfirmDialogProvider>
        </FinanceProvider>
      </body>
    </html>
  );
}
