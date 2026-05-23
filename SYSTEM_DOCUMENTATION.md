# Dokumentasi Sistem Sentra - Personal Finance Manager

Selamat datang di Dokumentasi Sistem **Sentra**. Dokumen ini dirancang untuk menjelaskan arsitektur teknis, desain sistem, aliran data, serta algoritma inti dari aplikasi manajemen keuangan pribadi Sentra. Dokumen ini disiapkan secara komprehensif agar dapat disertakan dalam portofolio pengembangan web profesional Anda.

---

## 1. Pendahuluan & Ringkasan Proyek

### 1.1 Deskripsi Aplikasi
**Sentra** adalah platform manajemen keuangan pribadi (*Personal Finance Manager*) berskala enterprise yang dirancang menggunakan **Next.js (App Router)**, **React 19**, **TypeScript**, dan **Firebase**. Aplikasi ini menawarkan antarmuka dasbor modular yang fleksibel (*flexible reorderable widgets*), visualisasi analitik berbasis SVG interaktif, sistem manajemen aset investasi terintegrasi dengan simulasi imbal hasil (*yield engine*), otomatisasi pencatatan tagihan berulang, integrasi kecerdasan buatan (**Gemini AI Financial Advisor**), serta perlindungan privasi mutlak melalui enkripsi data di sisi klien (*client-side zero-knowledge encryption*).

### 1.2 Problem Statement (Pernyataan Masalah)
1. **Fragmentasi Aset Finansial**: Pengguna modern memiliki akun keuangan yang tersebar di berbagai bank, dompet digital (e-wallet), kas fisik, kartu kredit, hingga portofolio investasi. Sulit bagi mereka untuk mengonsolidasikan semua data ini untuk melihat nilai kekayaan bersih (*net worth*) yang akurat secara *real-time*.
2. **Kekhawatiran Keamanan & Privasi Data Awan**: Data keuangan adalah informasi yang sangat sensitif. Mengunggah detail transaksi, nominal saldo, dan nama akun ke basis data cloud pihak ketiga memicu ketakutan akan kebocoran data, penyalahgunaan oleh penyedia cloud, atau akses tidak sah oleh administrator basis data (*zero-trust concerns*).
3. **Ketiadaan Evaluasi Kesehatan Finansial yang Objektif**: Kebanyakan pelacak keuangan hanya bertindak sebagai buku kas digital statis. Mereka mencatat pemasukan dan pengeluaran, tetapi tidak memberikan evaluasi objektif mengenai kondisi kesehatan keuangan pengguna secara keseluruhan (seperti rasio utang, rasio dana darurat, dan kepatuhan anggaran).
4. **Kurangnya Otomatisasi Tagihan & Simulasi Investasi**: Pengguna sering lupa mencatat tagihan berulang (seperti langganan bulanan). Di sisi lain, instrumen investasi pasif (seperti deposito berjangka atau obligasi) tidak tercatat secara otomatis ketika menghasilkan bunga, sehingga pengguna harus melakukan pencatatan manual yang melelahkan.
5. **Friksi Penginputan Manual (Manual Entry Fatigue)**: Proses mencatat transaksi harian sering kali dirasa melelahkan karena pengguna harus mengisi banyak kolom formulir secara manual (deskripsi, nominal, memilih kategori dari dropdown, memilih rekening asal/tujuan, dsb.). Akibatnya, pencatatan menjadi tidak konsisten karena pengguna merasa proses pengetikan terlalu panjang dan memakan waktu.

### 1.3 Target Pengguna
- **Individu Finansial Aktif**: Orang yang ingin mengonsolidasikan seluruh akun kas, utang, tabungan target, dan portofolio investasi mereka dalam satu dasbor terpadu.
- **Pengguna Global/Multi-Mata Uang**: Pengguna yang bertransaksi dengan berbagai mata uang (IDR, USD, SGD, EUR) dan membutuhkan konversi dinamis otomatis ke mata uang utama (*base currency*).
- **Pengguna Sadar Privasi (*Privacy-First Users*)**: Profesional IT atau individu yang menolak mengunggah data keuangan mentah (plaintext) ke cloud dan menuntut enkripsi tingkat lanjut di sisi browser.
- **Pengguna yang Memerlukan Bimbingan Keuangan**: Individu yang membutuhkan analisis taktis dan terarah tentang cara mengoptimalkan anggaran bulanan atau mempercepat pelunasan utang dengan bantuan asisten AI.

### 1.4 Solusi yang Ditawarkan (Sentra)
- **Dasbor Konsolidasi Keuangan**: Sistem yang menggabungkan seluruh akun aset dan liabilitas (kartu kredit/utang) menjadi nilai *Net Worth* tunggal yang dinamis.
- **Enkripsi Klien Zero-Knowledge (RC4 Stream Cipher)**: Sistem enkripsi yang berjalan di browser pengguna. Data sensitif dienkripsi sebelum dikirim ke Firebase Firestore dan hanya dapat didekripsi menggunakan kunci enkripsi unik yang diturunkan dari kredensial pengguna di sisi klien. Cloud database hanya menyimpan cipher text mentah.
- **Algoritma Skor Kesehatan Keuangan (Financial Health Score)**: Mesin kalkulator dinamis yang menghasilkan skor 0-100 secara *real-time* berdasarkan 4 pilar standar perencana keuangan (Savings Rate, Emergency Fund, Debt-to-Income, dan Budget Compliance).
- **Yield Engine Investasi & Automator Tagihan**: Simulasi imbal hasil otomatis untuk aset deposito/obligasi yang menyinkronkan bunga ke saldo akun secara otomatis, serta scheduler tagihan bulanan (auto-pay vs manual approval).
- **Context-Aware AI Advisor**: Integrasi langsung dengan Gemini API menggunakan API Key pengguna yang disimpan lokal. AI menganalisis kondisi keuangan pengguna secara anonim untuk memberikan rekomendasi taktis.
- **NLP Smart Input Engine**: Pengurangan friksi input melalui satu baris kolom teks bergaya chat. Pengguna dapat mengetik transaksi panjang dalam bentuk kalimat ringkas (contoh: `45k kopi #food @cash`) yang akan langsung diparse otomatis menjadi objek transaksi lengkap oleh sistem, meminimalisir waktu pengetikan dan mencegah kelelahan mencatat.

---

## 2. Arsitektur Sistem & Aliran Data

### 2.1 Arsitektur Dual-Storage (Hybrid Demo/Production)
Sentra dirancang dengan pendekatan modular yang mendeteksi ketersediaan variabel lingkungan Firebase secara dinamis melalui fungsi `isFirebaseEnabled()`.
- **Mode Demo (Default/Offline)**: Jika konfigurasi Firebase tidak terdeteksi, aplikasi akan berjalan penuh secara lokal menggunakan `LocalStorage` browser dengan data simulasi berkualitas tinggi (*high-fidelity seed data*) untuk mempermudah uji coba instan (*instant onboarding*).
- **Mode Produksi (Cloud Sync)**: Jika variabel lingkungan Firebase disetel, aplikasi secara otomatis beralih menggunakan **Firebase Authentication** untuk manajemen sesi pengguna dan **Firebase Firestore** sebagai database penyimpanan awan yang terenkripsi.

### 2.2 Aliran Data Enkripsi Zero-Knowledge
Untuk menjamin privasi pengguna, Sentra mengimplementasikan siklus enkripsi-dekripsi data pada browser klien sebelum menyentuh jaringan internet:
1. **Pembangkitan Kunci (Key Derivation)**: Kunci enkripsi unik diturunkan secara dinamis saat runtime dengan menggabungkan Firebase API Key dan UID pengguna yang login:
   $$\text{Key} = \text{SHA256}(\text{FirebaseApiKey} + \text{"\_"} + \text{UserUID})$$
2. **Enkripsi Sebelum Kirim (Client-Side Encryption)**: Sebelum objek data disimpan ke Firestore, fungsi `FinanceService` mengirimkan properti sensitif (deskripsi, jumlah nominal, nama akun, saldo awal) ke modul `crypto.ts` untuk dienkripsi dengan RC4 stream cipher dan diubah ke representasi heksadesimal dengan awalan string `enc_`.
3. **Penyimpanan Cloud**: Firestore menyimpan dokumen terenkripsi. Bahkan jika database Firestore bocor atau diakses oleh pihak ketiga, data tersebut tetap aman karena berupa teks acak (*cipher text*).
4. **Dekripsi Saat Render (Decryption on Retrieval)**: Saat aplikasi melakukan fetch data, data mentah ditarik dari Firestore, dideteksi menggunakan awalan `enc_`, didekripsi menggunakan kunci lokal di sisi klien, lalu disimpan ke state React `FinanceProvider` dalam bentuk plaintext untuk dirender ke UI.

### 2.3 Diagram Aliran Data (Mermaid Diagram)
Berikut adalah visualisasi alur komponen dan distribusi data pada aplikasi Sentra:

```mermaid
graph TD
    User([Pengguna]) <-->|Interaksi UI| NextComponents[Next.js Pages & Components]
    NextComponents <-->|State & CRUD Ops| Context[FinanceContext / useFinance]
    
    subgraph Sisi Klien (Browser)
        Context <-->|Data Plaintext| Crypto[Crypto Module - RC4 Lightweight Cipher]
        Context -->|Konteks Anonim| AIAdvisor[Gemini AI Client API]
        Crypto <-->|Data Terenkripsi / enc_ | Service[FinanceService Layer]
    end

    subgraph Lapisan Data (Storage)
        Service <-->|Firebase Enabled| Firestore[(Firebase Firestore Cloud)]
        Service <-->|Fallback / Offline Mode| LocalStorage[(Browser LocalStorage)]
    end

    AIAdvisor <-->|Gemini API Key Lokal| GeminiCloud[Google Gemini API Server]
```

---

## 3. Fitur Teknis Utama & Implementasi Kode

### 3.1 Enkripsi RC4 Kustom (`lib/crypto.ts`)
Aplikasi ini mengimplementasikan algoritma enkripsi stream cipher berbasis RC4 yang dimodifikasi untuk menghasilkan output heksadesimal yang aman. Pustaka ini bekerja secara sinkron dan ringan tanpa dependensi node-specific (seperti `crypto` bawaan Node.js), memungkinkannya berjalan cepat di browser.

Berikut adalah kode modul enkripsi kustom ([lib/crypto.ts](file:///c:/Users/User/Documents/Daffa/React/tra/lib/crypto.ts)):

```typescript
function rc4(key: string, str: string): string {
  const s = new Array(256);
  let j = 0;
  let x;
  let res = "";

  for (let i = 0; i < 256; i++) {
    s[i] = i;
  }

  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    x = s[i];
    s[i] = s[j];
    s[j] = x;
  }

  let i = 0;
  j = 0;
  for (let y = 0; y < str.length; y++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    x = s[i];
    s[i] = s[j];
    s[j] = x;
    res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
  }
  return res;
}

export function encrypt(text: string | null | undefined, key: string): string {
  if (text === null || text === undefined) return "";
  const encrypted = rc4(key, text);
  let hex = "";
  for (let i = 0; i < encrypted.length; i++) {
    hex += encrypted.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return "enc_" + hex;
}

export function decrypt(cipherText: any, key: string): string {
  if (cipherText === null || cipherText === undefined) return "";
  const str = String(cipherText);
  if (!str.startsWith("enc_")) return str; // Mengembalikan string asli jika tidak terenkripsi
  
  try {
    const hex = str.substring(4);
    let encrypted = "";
    for (let i = 0; i < hex.length; i += 2) {
      encrypted += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
    }
    return rc4(key, encrypted);
  } catch (e) {
    console.error("Decryption error:", e);
    return str;
  }
}
```

### 3.2 Mesin Skor Kesehatan Keuangan (Financial Health Score Engine)
Aplikasi ini melakukan evaluasi kesehatan keuangan secara berkala berdasarkan empat pilar keuangan dasar:
1. **Savings Rate (Rasio Tabungan - Bobot 30%)**:
   - Dihitung dari perbandingan sisa pemasukan bulanan terhadap total pemasukan bulanan.
   - Formula: 
     $$\text{Savings Rate} = \frac{\text{Monthly Income} - \text{Monthly Expense}}{\text{Monthly Income}}$$
   - Batas target sehat adalah $\ge 20\%$. Skor 100 diberikan jika target tercapai, sedangkan jika kurang dari 20%, skor akan berskala linier, dan 0 jika bernilai negatif.
2. **Emergency Fund Ratio (Dana Darurat - Bobot 30%)**:
   - Dihitung dari ketersediaan saldo likuid (Kas & Bank) dibandingkan dengan rata-rata pengeluaran bulanan.
   - Formula:
     $$\text{Months Safe} = \frac{\text{Cash} + \text{Bank Balance}}{\text{Monthly Expense}}$$
   - Target ideal adalah 6 bulan pengeluaran. Skor 100 diberikan jika memiliki $\ge 6$ bulan dana darurat. Memiliki 3 bulan memberikan skor 80, dan di bawah itu diskalakan secara linier.
3. **Debt-to-Income / DTI (Rasio Utang - Bobot 20%)**:
   - Membandingkan beban cicilan/pembayaran utang bulanan terhadap total pemasukan bulanan.
   - Formula:
     $$\text{DTI} = \frac{\text{Monthly Debt Payments}}{\text{Monthly Income}}$$
   - Target ideal adalah cicilan $\le 10\%$. Skor 100 diberikan jika cicilan $\le 10\%$, skor akan menurun secara linier hingga mencapai 0 jika cicilan $\ge 50\%$.
4. **Budget Compliance (Kepatuhan Anggaran - Bobot 20%)**:
   - Mengukur kedisiplinan pengguna dalam menaati batas anggaran kategori bulanan yang telah mereka buat sendiri.
   - Formula:
     $$\text{Compliance} = \frac{\text{Jumlah Anggaran yang Sesuai Batas}}{\text{Total Anggaran yang Dibuat}} \times 100\%$$

Skor Akhir digabungkan dalam persentase (0-100) dan divisualisasikan dengan komponen **SVG Radial Gauge** yang interaktif dengan skema warna HSL yang responsif sesuai status kondisi keuangan (Hijau = Sangat Sehat/Sehat, Amber = Waspada, Merah = Perlu Perhatian).

### 3.3 Modul Investasi & Yield Engine Otomatis
Sentra mendukung pelacakan aset investasi yang canggih. Untuk instrumen investasi pendapatan tetap (*fixed income* seperti Deposito dan Obligasi), aplikasi ini memuat mesin simulasi imbal hasil berjangka (*automated yield engine*).

Setiap kali data keuangan dimuat ulang (`refreshData`), sistem akan mendeteksi investasi berjenis `deposit`, `bond`, atau `p2p` yang memiliki parameter `yieldRate` positif dan tanggal pembayaran bunga terakhir (`lastYieldPaymentDate`).
- **Simulasi Selisih Waktu**: Sistem menghitung selisih milidetik antara tanggal saat ini dan `lastYieldPaymentDate`.
- **Kalkulasi Bunga**: Jika selisih waktu tersebut melampaui frekuensi imbal hasil (misalnya 30 hari untuk bulanan, atau 365 hari untuk tahunan), sistem secara otomatis mencatat transaksi investasi bertipe `interest`.
- **Buku Besar Sinkron**: Bersamaan dengan itu, sistem menyisipkan *companion transaction* berupa pemasukan (`income`) dengan kategori investasi (`cat-investment`) pada rekening penampung terkait di dalam buku besar utama agar saldo kas bertambah secara otomatis.
- **Pembaruan Tanggal**: Terakhir, sistem memperbarui nilai `lastYieldPaymentDate` pada database agar simulasi bunga berikutnya dihitung secara akurat.

### 3.4 Asisten Keuangan Context-Aware (Gemini AI Advisor)
Integrasi kecerdasan buatan Gemini AI dilakukan secara langsung dari peramban pengguna menggunakan model `gemini-1.5-flash` untuk memberikan performa yang cepat dan hemat kuota. 

Sistem prompt dikembangkan secara hati-hati agar AI memahami situasi finansial pengguna tanpa mengekspos identitas pribadi mereka:
1. Data saldo akun, aset, sisa limit anggaran bulanan, rincian sisa utang aktif, dan 4 pilar skor kesehatan keuangan diekstraksi ke dalam format string anonim terstruktur.
2. Konteks ini dimasukkan ke dalam objek `systemInstruction` API Gemini bersamaan dengan pesan obrolan pengguna.
3. Objek permintaan dikirim menggunakan header JSON terenkripsi langsung ke endpoint Google.
4. Tanggapan Markdown yang dihasilkan AI kemudian diparse secara dinamis di sisi klien menggunakan parser khusus (`parseMarkdownText`) untuk menghindari celah keamanan XSS (*Cross-Site Scripting*), tanpa menggunakan pustaka eksternal yang rentan.

### 3.5 Input Pintar Cepat (NLP Smart Input Engine)
Untuk mempercepat pencatatan transaksi tanpa memerlukan penginputan formulir manual satu per satu, Sentra menyediakan fitur **Smart Input** berbasis simulasi *Natural Language Processing* (NLP) di dalam berkas [QuickAddModal.tsx](file:///c:/Users/User/Documents/Daffa/React/tra/components/QuickAddModal.tsx).

Fitur ini memiliki mekanisme pemrosesan teks cerdas sebagai berikut:
1. **Tokenisasi & Parsing Teks**: Mesin parsing memecah teks masukan pengguna menjadi kata-kata terpisah untuk menganalisis parameter transaksi secara otomatis:
   - **Nominal Keuangan**: Mendeteksi angka serta singkatan numerik secara otomatis. Karakter `k`/`K` dikonversi menjadi ribuan (contoh: `50k` $\rightarrow 50.000$), sedangkan `m`/`M` atau `jt`/`JT` dikonversi menjadi jutaan (contoh: `1.5m` atau `2jt` $\rightarrow 1.500.000$).
   - **Kategori Otomatis (`#`)**: Karakter `#` bertindak sebagai tag kategori. Sistem mencocokkan teks setelah `#` dengan daftar kategori yang ada (contoh: `#food` $\rightarrow$ Kategori Makanan).
   - **Metode Pembayaran / Akun (`@`)**: Karakter `@` bertindak sebagai tag rekening. Sistem mencocokkan teks setelah `@` dengan akun aktif pengguna (contoh: `@bca` $\rightarrow$ Akun Bank BCA).
   - **Tipe Transaksi**: Kata kunci `transfer` atau `kirim` akan memicu transaksi bertipe *transfer*, sedangkan kata kunci seperti `gaji`, `bonus`, atau simbol `+` memicu bertipe *income* (pemasukan). Sisanya dianggap sebagai *expense* (pengeluaran).
2. **Autocomplete Dropdown & Aksesibilitas Keyboard**: Ketika pengguna mengetik `#` atau `@`, sebuah jendela dropdown muncul menampilkan saran kategori atau akun yang relevan. Dropdown ini dapat dinavigasi sepenuhnya menggunakan keyboard (panah atas/bawah, enter untuk memilih, dan escape untuk menutup) agar pengguna tidak perlu menggunakan tetikus (*mouse*).
3. **Kategorisasi Prediktif Berbasis Riwayat (History-Based Auto-Categorization)**: Jika pengguna tidak menuliskan tag kategori `#` secara eksplisit, sistem akan memindai riwayat transaksi terakhir mereka. Jika deskripsi yang diketik (misalnya "kopi starbucks") memiliki kemiripan dengan transaksi lama yang sudah diklasifikasikan ke dalam suatu kategori (misalnya "Kopi dan Camilan" dengan kategori Makanan), sistem akan otomatis mengisi kategori tersebut sebagai saran default.
4. **Alokasi Gaji Otomatis**: Jika terdeteksi transaksi pemasukan berdeskripsi gaji ke akun tertentu, dan pengaturan alokasi diaktifkan, Smart Input akan menyisipkan companion transaction ke target tabungan secara otomatis.

---

## 4. Pemodelan Data (TypeScript Interfaces)

Penyusunan data terstruktur dideklarasikan dalam tipe TypeScript yang kuat untuk memastikan keandalan manipulasi objek di seluruh aplikasi ([lib/types.ts](file:///c:/Users/User/Documents/Daffa/React/tra/lib/types.ts)):

```typescript
export interface Account {
  id: string;
  name: string;
  balance: number;
  currency: string;
  type: 'bank' | 'cash' | 'e_wallet' | 'credit_card' | 'investment';
  icon: string;
  color: string;
}

export interface Transaction {
  id?: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId: string;
  description: string;
  date: string;
  accountId: string;
  toAccountId?: string; // Khusus untuk transaksi transfer antar rekening
  linkedSubId?: string; // Relasi ke subscription tagihan berulang
  linkedSavingsGoalId?: string; // Relasi ke target tabungan
  linkedDebtId?: string; // Relasi ke pembayaran cicilan utang
  linkedInvTxId?: string; // Relasi ke transaksi investasi
  currency?: string;
  exchangeRate?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
}

export interface Budget {
  id: string;
  categoryId: string;
  amountLimit: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
}

export interface Debt {
  id: string;
  name: string;
  type: 'debt' | 'loan';
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
  status: 'active' | 'paid';
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  type: 'auto' | 'manual'; // Auto-pay mencatat otomatis, manual memicu notifikasi peringatan
  accountId: string;
  categoryId: string;
  nextDueDate: string;
  active: boolean;
}

export interface Investment {
  id: string;
  name: string;
  type: 'stock' | 'mutual_fund' | 'crypto' | 'gold' | 'bond' | 'deposit' | 'p2p' | 'property' | 'other';
  currentPrice: number;
  symbol?: string;
  description?: string;
  yieldRate?: number;
  yieldFrequency?: 'monthly' | 'annually';
  lastYieldPaymentDate?: string;
  color?: string;
  icon?: string;
}

export interface InvestmentTransaction {
  id?: string;
  investmentId: string;
  type: 'buy' | 'sell' | 'dividend' | 'interest';
  amount: number;
  quantity: number;
  pricePerUnit: number;
  date: string;
  accountId?: string;
}

export interface Settings {
  baseCurrency: string;
  exchangeRates: Record<string, number>;
  notificationPermitted?: boolean;
  autoAllocationEnabled?: boolean;
  autoAllocationPercent?: number;
  autoAllocationGoalId?: string;
  passcodeEnabled?: boolean;
  passcodePIN?: string; // Disimpan secara terenkripsi dengan RC4 di Firestore
}
```

---

## 5. Keamanan Database (Firestore Security Rules)

Untuk mengamankan database ketika beralih ke Mode Produksi (sinkronisasi awan), Sentra dilengkapi dengan konfigurasi keamanan deklaratif pada Firebase Firestore ([firestore.rules](file:///c:/Users/User/Documents/Daffa/React/tra/firestore.rules)). 

Konfigurasi ini memastikan bahwa pengguna hanya dapat membaca dan menulis dokumen mereka sendiri, serta memvalidasi struktur data secara ketat di tingkat server:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // =========================================================
    // HELPER FUNCTIONS
    // =========================================================

    // Memastikan request berasal dari pengguna yang sudah login
    function isAuthenticated() {
      return request.auth != null;
    }

    // Memastikan user hanya mengakses data miliknya sendiri
    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // Kombinasi: terautentikasi DAN merupakan pemilik dokumen data
    function isAuthOwner(userId) {
      return isAuthenticated() && isOwner(userId);
    }

    // Memastikan field yang dikirimkan adalah bagian dari skema yang diizinkan
    function hasOnly(fields) {
      return request.resource.data.keys().hasOnly(fields);
    }

    // Memastikan semua field wajib dikirimkan dalam request
    function hasAll(fields) {
      return request.resource.data.keys().hasAll(fields);
    }

    // =========================================================
    // BLOK ATURAN: Di bawah naungan dokumen /users/{userId}/
    // =========================================================
    match /users/{userId} {
      allow read, write: if isAuthOwner(userId);

      // Rekening / Akun
      match /accounts/{accountId} {
        allow read:   if isAuthOwner(userId);
        allow create: if isAuthOwner(userId)
                      && hasAll(['name', 'balance', 'currency', 'type', 'icon', 'color'])
                      && request.resource.data.name is string
                      && (request.resource.data.balance is number || request.resource.data.balance is string)
                      && request.resource.data.type in ['bank', 'cash', 'e_wallet', 'credit_card', 'investment'];
        allow update: if isAuthOwner(userId)
                      && request.resource.data.name is string
                      && (request.resource.data.balance is number || request.resource.data.balance is string)
                      && request.resource.data.type in ['bank', 'cash', 'e_wallet', 'credit_card', 'investment'];
        allow delete: if isAuthOwner(userId);
      }

      // Ledger Transaksi
      match /transactions/{transactionId} {
        allow read:   if isAuthOwner(userId);
        allow create: if isAuthOwner(userId)
                      && hasAll(['amount', 'type', 'categoryId', 'description', 'date', 'accountId'])
                      && (request.resource.data.amount is number || request.resource.data.amount is string)
                      && request.resource.data.type in ['income', 'expense', 'transfer'];
        allow update: if isAuthOwner(userId)
                      && (request.resource.data.amount is number || request.resource.data.amount is string)
                      && request.resource.data.type in ['income', 'expense', 'transfer'];
        allow delete: if isAuthOwner(userId);
      }

      // Kategori Pengeluaran & Pemasukan
      match /categories/{categoryId} {
        allow read:   if isAuthOwner(userId);
        allow create: if isAuthOwner(userId)
                      && hasAll(['name', 'icon', 'color', 'type'])
                      && request.resource.data.type in ['income', 'expense'];
        allow update: if isAuthOwner(userId)
                      && request.resource.data.type in ['income', 'expense'];
        allow delete: if isAuthOwner(userId);
      }

      // Batas Anggaran
      match /budgets/{budgetId} {
        allow read:   if isAuthOwner(userId);
        allow create: if isAuthOwner(userId)
                      && hasAll(['categoryId', 'amountLimit'])
                      && (request.resource.data.amountLimit is number || request.resource.data.amountLimit is string);
        allow update: if isAuthOwner(userId)
                      && (request.resource.data.amountLimit is number || request.resource.data.amountLimit is string);
        allow delete: if isAuthOwner(userId);
      }

      // Target Tabungan
      match /savingsGoals/{goalId} {
        allow read:   if isAuthOwner(userId);
        allow create: if isAuthOwner(userId)
                      && hasAll(['name', 'targetAmount', 'currentAmount', 'targetDate']);
        allow update: if isAuthOwner(userId)
                      && (request.resource.data.targetAmount is number || request.resource.data.targetAmount is string)
                      && (request.resource.data.currentAmount is number || request.resource.data.currentAmount is string);
        allow delete: if isAuthOwner(userId);
      }

      // Aset Investasi
      match /investments/{investmentId} {
        allow read:   if isAuthOwner(userId);
        allow create: if isAuthOwner(userId)
                      && hasAll(['name', 'type', 'currentPrice'])
                      && request.resource.data.type in [
                           'stock', 'mutual_fund', 'crypto', 'gold',
                           'bond', 'deposit', 'p2p', 'property', 'other'
                         ];
        allow update: if isAuthOwner(userId)
                      && request.resource.data.type in [
                           'stock', 'mutual_fund', 'crypto', 'gold',
                           'bond', 'deposit', 'p2p', 'property', 'other'
                         ];
        allow delete: if isAuthOwner(userId);
      }

      // Pengaturan Aplikasi (Settings)
      match /config/{document} {
        allow read:   if isAuthOwner(userId);
        allow write:  if isAuthOwner(userId)
                      && document == 'settings'
                      && hasAll(['baseCurrency', 'exchangeRates']);
      }
    }

    // Default Deny All - Blokir semua akses lain yang tidak terdefinisi
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 6. Panduan Menjalankan Proyek (Getting Started)

### 6.1 Prasyarat & Dependensi
Pastikan komputer Anda memiliki Node.js v18+ dan NPM terpasang. Instalasi dependensi dilakukan dengan perintah:

```bash
npm install
```

### 6.2 Konfigurasi Lingkungan (`.env.local`)
Buat berkas `.env.local` pada direktori root proyek untuk mengaktifkan sinkronisasi Firebase Cloud. Jika dikosongkan, aplikasi akan secara otomatis beroperasi dalam **Mode Demo Offline**:

```env
# Konfigurasi Sinkronisasi Firebase Cloud (Opsional untuk Mode Produksi)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
```

### 6.3 Menjalankan Server Pengembangan
Jalankan server lokal dengan perintah:

```bash
npm run dev
```

Aplikasi akan berjalan pada alamat [http://localhost:3000](http://localhost:3000).

### 6.4 Mengaktifkan AI Advisor & Kunci PIN Keamanan
1. Buka halaman **Pengaturan** (Settings) di pojok dasbor untuk mengatur mata uang basis (misalnya IDR atau USD).
2. Jika ingin membatasi akses dasbor dari orang lain, aktifkan fitur **Passcode PIN** dan buat 4 digit angka PIN Anda. PIN ini akan dienkripsi secara RC4 sebelum disimpan.
3. Buka halaman **Analisis & AI Advisor**. Masukkan **Gemini API Key** Anda pada kolom kunci API di bagian atas halaman (dapat diperoleh secara gratis melalui Google AI Studio). Kunci ini akan disimpan dengan aman di LocalStorage browser Anda untuk panggilan langsung, tanpa tersimpan di server cloud eksternal apa pun.
