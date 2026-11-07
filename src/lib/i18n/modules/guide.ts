// guide translations — split from translations.ts (refactor per module)
export const guide = {
  id: {
      title: "Buku Panduan Penggunaan Pocketly",
      subtitle:
        "Panduan lengkap cara kerja, alur pencatatan, serta tips memaksimalkan seluruh fitur keuangan Pocketly.",
      badge: "Panduan Resmi",
      auditTrailBadge: "Riwayat Perubahan",
      sections: {
        quickStart: {
          title: "1. Pengenalan, Pencatatan Kilat & Tagar (#tags)",
          subtitle:
            "Pencatatan keuangan cepat, ergonomis, dan pengelompokan tagar",
          content:
            "Pocketly dirancang sebagai buku kas keuangan pribadi yang mengutamakan kecepatan input dan akurasi tanpa jeda waktu.",
          steps: [
            "Tekan tombol (+) di menu bawah atau header untuk membuka jendela pencatatan transaksi kilat.",
            "Tombol Tanggal: Klik untuk memilih tanggal transaksi lewat kalender interaktif.",
            "Tombol Akun & Kategori: Geser dan pilih dompet serta pos kategori belanja dengan mudah.",
            "Ketik nominal uang pada papan angka, lalu tekan tombol Simpan untuk mencatat dalam 1-2 detik.",
            "Tagar (#tags): Tambahkan tagar seperti #liburan, #proyek, #ngedate untuk memfilter dan mengelompokkan laporan belanja multi-kategori.",
            "Sematan Favorit (Pinned Preset): Tekan ikon Pin pada form transaksi untuk menjadikannya tombol pintasan 1-klik di Dashboard.",
            "Saldo rekening dompet otomatis terpotong (pengeluaran) atau bertambah (pemasukan) seketika.",
          ],
        },
        ocrReceiptScanner: {
          title: "2. Scan Struk Belanja Otomatis (OCR Cepat & Gratis)",
          subtitle:
            "Ekstraksi otomatis struk belanja fisik langsung ke buku kas tanpa biaya penyimpanan",
          content:
            "Fitur OCR cerdas membaca dan merinci struk belanja secara otomatis dengan pemrosesan in-memory tanpa membebani penyimpanan database:",
          steps: [
            "Buka jendela Catat Cepat (+), lalu klik ikon Kamera / Scan Struk.",
            "Ambil foto struk belanjaan fisik (Indomaret, Alfamart, restoran, kafe) atau upload gambar dari galeri.",
            "Sistem OCR langsung mengekstrak Nama Toko / Merchant, Tanggal Transaksi, Rincian Barang (Item Breakdown), serta Total Tagihan secara otomatis.",
            "Tekan Simpan untuk langsung memasukkan seluruh rincian belanja ke buku kas dalam hitungan detik.",
            "Zero Storage Cost: Pemrosesan gambar dilakukan sepenuhnya di memori perangkat sehingga 100% gratis dan hemat.",
          ],
        },
        dueCenter: {
          title:
            "3. Pusat Tagihan & Jadwal Jatuh Tempo (Due Dates & Bills Hub)",
          subtitle:
            "Satu pusat kendali untuk seluruh tagihan rutin, cicilan utang, dan target tabungan",
          content:
            "Fitur Pusat Tagihan menyatukan seluruh komitmen dan kewajiban finansial Anda dalam satu pusat kendali terpadu:",
          steps: [
            "Jadwal Terpadu: Menggabungkan Tagihan Rutin, Cicilan Utang/Pinjaman, dan Tenggat Target Tabungan secara kronologis.",
            "Filter Dropdown Cerdas: Saring berdasarkan Sumber Kewajiban dan Tingkat Urgensi (Terlewat, Jatuh Tempo Hari Ini, 7 Hari Ke Depan, Mendatang).",
            "Tombol Bayar 1-Klik: Klik tombol Bayar Tagihan atau Bayar Cicilan untuk langsung memotong saldo rekening kas Anda tanpa input manual berulang.",
            "Banner Pengingat di Dashboard: Menampilkan notifikasi ringkas 1 baris saat ada kewajiban yang mendesak.",
          ],
        },
        investments: {
          title: "4. Portofolio Saham, Deposito & Reksa Dana",
          subtitle:
            "Kelola aset saham BEI (IDX), tabungan deposito berjangka, dan reksa dana terintegrasi",
          content:
            "Pocketly mendukung pencatatan seluruh instrumen investasi Anda secara terstruktur tanpa mengganggu anggaran belanja harian:",
          steps: [
            "Saham IDX & Akun RDN: Beli/jual saham BEI langsung di menu Investasi menggunakan akun RDN. Sistem otomatis menghitung harga modal rata-rata dan keuntungan (Realized P&L).",
            "Pencatatan Deposito: Buat akun terpisah (misal: 'Deposito BCA'). Pindahkan dana pokok via Transfer. Catat bunga bulanan/jatuh tempo sebagai Pemasukan kategori 'Investasi & Dividen'.",
            "Reksa Dana (Bibit/Bareksa): Buat akun platform (misal: 'Bibit'). Catat top-up atau tarik modal via Transfer, lalu catat keuntungan (Capital Gain) saat pencairan sebagai Pemasukan.",
            "Sinkronisasi Total Kekayaan (Net Worth): Seluruh saldo kas RDN, modal saham aktif, deposito, dan reksa dana otomatis tercermin di Neraca Kekayaan Bersih Anda.",
          ],
        },
        savingsGoals: {
          title: "5. Target Tabungan & Celengan Impian (Savings Goals)",
          subtitle:
            "Pantau progres pencapaian dana darurat, liburan, dan impian finansial",
          content:
            "Rencanakan dan wujudkan berbagai target tabungan dengan kalkulasi yang terukur:",
          steps: [
            "Buat target baru lengkap dengan nominal sasaran, tanggal tenggat, dan mata uang yang diinginkan.",
            "Kalkulator Nabung Bulanan: Sistem otomatis menghitung berapa nominal yang perlu Anda sisihkan setiap bulan agar target tercapai tepat waktu.",
            "Tombol Setor & Tarik Dana: Catat alokasi tabungan kapan saja dengan opsi pembuatan mutasi otomatis di rekening sumber.",
            "Status Fleksibel: Target dapat berjalan aktif, tercapai (completed), atau dijeda (paused) sesuai kondisi finansial Anda.",
          ],
        },
        recurring: {
          title: "6. Tagihan Rutin & Pemasukan Tetap (Subscriptions & Inflow)",
          subtitle:
            "Jadwal otomatis untuk langganan bulanan dan arus kas masuk berkala",
          content:
            "Otomatisasi pengingat tagihan berkala agar tidak ada kewajiban yang terlewat:",
          steps: [
            "Tagihan & Langganan (Outflow): Catat WiFi bulanan, sewa rumah, BPJS, Netflix, Spotify, atau listrik.",
            "Pemasukan Tetap (Inflow): Jadwalkan gaji bulanan, uang sewa masuk, atau dividen rutin.",
            "Pilihan Frekuensi: Tersedia jadwal Harian, Mingguan, Bulanan, hingga Tahunan.",
            "Eksekusi Cepat: Saat tanggal jatuh tempo tiba, cukup tekan tombol Bayar untuk langsung mencatat transaksi ke buku kas.",
          ],
        },
        accounts: {
          title: "7. Rekening Likuid, Transfer Valas Alami & Koreksi Saldo",
          subtitle:
            "Pengelolaan dompet multi-valas, transfer valas alami, dan rekonsiliasi saldo riil",
          content:
            "Pocketly mendukung berbagai tipe rekening dan mata uang (IDR, USD, SGD) dengan kurs langsung dan rekonsiliasi fisik:",
          steps: [
            "5 Tipe Akun: Rekening Bank, Dompet Digital (E-Wallet), Kas Tunai, Kartu Kredit, dan Investasi / RDN.",
            "Tombol Transfer Cepat: Di halaman rincian akun (/accounts/[id]), klik tombol Transfer untuk langsung mengisi rekening asal secara otomatis (Auto-Prefill).",
            "Tukar Valas Alami (Smart Natural Forex): Input kurs langsung dalam angka wajar manusia (misal: 1 SGD = Rp 12.000 atau 1 USD = Rp 16.200) dengan kalkulasi otomatis 2 arah dan tombol sinkronisasi kurs pasar live.",
            "Rincian Mutasi Transfer: Klik baris riwayat transfer kapan saja untuk melihat rincian lengkap nominal kirim, nominal terima, nilai kurs transaksi, dan catatan.",
            "Koreksi Saldo (Sesuaikan Saldo): Samakan saldo catatan Pocketly dengan uang fisik riil di dompet/bank secara instan cukup dengan memasukkan angka saldo nyata Anda.",
            "Biaya Admin / Transfer (Opsional): Masukkan biaya admin bank (misal Rp 2.500 BI-FAST); sistem otomatis mencatat pemotongan biaya tersebut.",
          ],
        },
        debts: {
          title: "8. Buku Catatan Utang & Piutang Multi-Valas",
          subtitle:
            "Pencatatan pinjaman, piutang uang, filter mata uang, dan cicilan pelunasan",
          content:
            "Pisahkan catatan utang dan piutang dari transaksi belanja harian dengan pencatatan rekening yang sinkron:",
          steps: [
            "Utang (Saya Berutang): Catat pinjaman bank atau uang yang Anda pinjam dari pihak lain. Saldo rekening penerima otomatis bertambah.",
            "Piutang (Orang Lain Berutang): Catat dana yang Anda pinjamkan ke orang lain. Saldo rekening sumber otomatis terpotong.",
            "Filter Rekening Sesuai Mata Uang: Dropdown rekening pencairan/penerima saldo otomatis hanya menampilkan akun yang bermata uang sama.",
            "Sinkronisasi Saldo Kas Langsung: Centang opsi sinkronisasi saldo agar saldo kas riil langsung terpotong saat meminjamkan uang atau bertambah saat meminjam.",
            "Catatan Bebas (Free-Text Notes): Tuliskan keterangan perjanjian, referensi, atau termin pinjaman secara leluasa.",
            "Pencatatan Cicilan: Saat piutang dicicil/dilunasi, saldo rekening Anda otomatis bertambah kembali secara transparan.",
          ],
        },
        budgets: {
          title: "9. Alokasi Anggaran Bulanan & Pagu Otomatis",
          subtitle:
            "Kendalikan batas pengeluaran per kategori agar disiplin finansial",
          content:
            "Pantau pemakaian anggaran belanja secara terpisah untuk setiap mata uang dengan perhitungan yang rapi:",
          steps: [
            "Alokasi Mandiri per Mata Uang: Tentukan batas anggaran terpisah untuk IDR, USD, atau SGD pada kategori yang sama.",
            "Pagu Anggaran Berlanjut Otomatis: Batas maksimal anggaran bulanan otomatis dilanjutkan ke bulan berikutnya tanpa perlu diisi ulang.",
            "Reset Pemakaian Bulanan: Total pengeluaran aktual otomatis di-reset dari 0 setiap tanggal 1 awal bulan.",
            "Riwayat Tren 6 Bulan: Pantau grafik perbandingan batas vs realisasi belanja dalam 6 bulan terakhir.",
          ],
        },
        netWorth: {
          title: "10. Laporan Kekayaan Bersih & Rasio Solvabilitas (Net Worth)",
          subtitle:
            "Ketahui posisi riil seluruh aset, portofolio investasi, dan liabilitas Anda",
          content:
            "Laporan Neraca menghitung total nilai kekayaan bersih dan tingkat kesehatan solvabilitas Anda secara akurat:",
          steps: [
            "Formula Lengkap: (Saldo Kas Likuid) + (Aset Investasi & Portofolio) + (Piutang Aktif) - (Total Utang).",
            "Bar Rasio Solvabilitas: Memvisualisasikan perbandingan Total Aset vs Total Hutang. Status '100% Bebas Hutang' muncul otomatis jika Anda tidak memiliki kewajiban hutang aktif.",
            "Deteksi Neraca Negatif: Jika total tanggungan hutang melebihi seluruh aset likuid dan investasi yang dimiliki, neraca akan menunjukkan posisi defisit (insolven).",
            "Dikonversi otomatis ke Mata Uang Utama tampilan berdasarkan nilai kurs valas realtime terkini.",
          ],
        },
        cashflowAnalytics: {
          title: "11. Laporan & Analitik Keuangan Mendalam",
          subtitle:
            "Wawasan komprehensif atas arus kas, rasio tabungan, dan distribusi belanja",
          content:
            "Fitur Laporan menyajikan metrik kesehatan keuangan mendalam:",
          steps: [
            "Rasio Tabungan (Savings Rate): Mengetahui berapa % penghasilan yang berhasil disisihkan (status Sehat, Waspada, Defisit).",
            "Grafik Arus Kas: Perbandingan pemasukan vs pengeluaran per periode (Bulan Ini, Bulan Lalu, Tahun Ini, Kustom).",
            "Distribusi Kategori: Diagram proporsi belanja dari pos terbesar hingga terkecil.",
          ],
        },
        auditTrail: {
          title: "12. Riwayat Aktivitas Universal (Audit Trail)",
          subtitle:
            "Pantau seluruh kronologi perubahan data di semua modul aplikasi",
          content:
            "Seluruh aktivitas keuangan di akun Anda tercatat secara transparan dan aman:",
          steps: [
            "Pencatatan Menyeluruh: Menelusuri mutasi di Transaksi, Transfer, Saham, Target Tabungan, Tagihan Rutin, Utang Piutang, Akun, Kategori, dan Anggaran.",
            "Jejak Nilai Sebelum & Sesudah: Menyimpan rincian sebelum dan sesudah data diubah atau dihapus.",
            "Filter & Pencarian: Saring riwayat berdasarkan modul fitur, tipe aksi (Baru, Ubah, Hapus), rentang tanggal, atau kata kunci.",
          ],
        },
        search: {
          title: "13. Pencarian Cepat Global (Ctrl + K / Cmd + K)",
          subtitle:
            "Temukan transaksi, akun, atau menu secara instan dari papan ketik",
          content:
            "Tekan tombol Ctrl+K (Windows) atau Cmd+K (Mac) dari halaman mana saja:",
          steps: [
            "Ketik nama toko, catatan memo, tagar (#tags), nominal angka, atau kategori untuk mencari transaksi.",
            "Ketik nama rekening untuk langsung membuka riwayat mutasi dompet tersebut.",
            "Navigasi kilat ke halaman mana pun tanpa perlu menggeser kursor mouse.",
          ],
        },
        backup: {
          title: "14. Mode Privasi, Tema Tampilan & Ekspor Data",
          subtitle:
            "Kustomisasi preferensi tampilan, privasi saldo, dan pencadangan data",
          content: "Fitur pengaturan lengkap pada menu Pengaturan:",
          steps: [
            "Mode Privasi (Sensor Saldo): Tekan ikon mata di navigasi atas untuk menyamarkan seluruh angka nominal saat berada di tempat umum.",
            "Tema Gelap & Terang: Beralih tema tampilan sesuai kenyamanan mata Anda.",
            "Pilihan Bahasa: Beralih antara Bahasa Indonesia dan English secara instan.",
            "Instalasi PWA ke Layar HP: Gunakan menu 'Add to Home Screen' di browser HP (Chrome/Safari) untuk memasang Pocketly seperti aplikasi native.",
            "Ekspor Cadangan Data: Unduh seluruh data keuangan Anda dalam format Excel (.CSV) atau JSON.",
          ],
        },
      },
  },
  en: {
      title: "Pocketly User Manual & Guide",
      subtitle:
        "Comprehensive step-by-step walkthrough of features, workflows, calculations, and financial tracking tips.",
      badge: "Official Guide",
      auditTrailBadge: "Activity History",
      sections: {
        quickStart: {
          title: "1. Overview, Rapid Logging & Tags (#tags)",
          subtitle:
            "Fast, ergonomic, and frictionless daily expense logging with tags",
          content:
            "Pocketly is designed as a high-precision personal financial ledger optimized for rapid recordkeeping without lag or unnecessary steps.",
          steps: [
            "Tap the (+) button in the bottom navigation or desktop header to open the quick transaction logger.",
            "Date Button: Tap to select custom dates via the interactive popup calendar.",
            "Account & Category Buttons: Easily switch wallets and spending categories with smooth scrolling.",
            "Type the amount on the keypad and tap Save to record transactions in 1-2 seconds.",
            "Tags (#tags): Add hashtags like #vacation, #project, #dining to filter and group multi-category expenses.",
            "Pinned Presets: Tap the Pin icon on the transaction form to create a 1-tap quick logging shortcut on your Dashboard.",
            "Your account balance automatically synchronizes immediately upon saving.",
          ],
        },
        ocrReceiptScanner: {
          title: "2. Automated Receipt Scanner (Fast & Free In-Memory OCR)",
          subtitle:
            "Instantly scan paper receipts directly into your ledger with zero cloud storage costs",
          content:
            "Smart OCR extracts receipt data on-the-fly directly in device memory without bloating database storage:",
          steps: [
            "Open the Quick Log window (+), then tap the Camera / Scan Receipt button.",
            "Snap a photo of any physical receipt (supermarket, restaurant, retail) or upload from your gallery.",
            "The OCR engine automatically extracts Merchant Name, Transaction Date, Line-Item Breakdown, Subtotal, and Total Bill.",
            "Tap Save to record the full itemized purchase into your ledger in seconds.",
            "Zero Storage Cost: Image processing happens transiently in-memory on your device—100% free and private.",
          ],
        },
        dueCenter: {
          title: "3. Due Dates & Bills Center (Obligation Hub)",
          subtitle:
            "Unified command center for recurring bills, debt installments, and goal milestones",
          content:
            "The Due Dates & Bills Center consolidates all your upcoming financial deadlines in one unified command center:",
          steps: [
            "Unified Timelines: Merges Recurring Bills, Debt Installments, and Savings Goal Deadlines into a single chronological feed.",
            "Smart Dropdown Filters: Filter by Source and Urgency (Overdue, Due Today, Due in 7 Days, Later > 7 Days).",
            "1-Click Payment Execution: Tap 'Pay Bill' or 'Pay Installment' to settle obligations directly from your wallet balance.",
            "Compact Dashboard Banner: Displays sleek 1-line urgency alerts on your dashboard when dues approach.",
          ],
        },
        investments: {
          title: "4. Stock Portfolio, Deposits & Mutual Funds",
          subtitle:
            "Track Indonesian stock trades (IDX), bank time deposits, and mutual funds seamlessly",
          content:
            "Pocketly supports all of your investment vehicles in one unified ledger without contaminating daily budgets:",
          steps: [
            "IDX Stocks & RDN Account: Buy/sell equities directly in the Investments menu linked to your RDN wallet. Average cost and realized P&L gains are calculated automatically.",
            "Time Deposits (Deposito): Create a dedicated account (e.g. 'BCA Deposit'). Move principal via Transfer. Log monthly/maturity interest yields as Income under 'Investments & Dividends'.",
            "Mutual Funds (Bibit/Bareksa): Create a platform account (e.g. 'Bibit'). Log top-ups and principal withdrawals via Transfer, and record profits (Capital Gains) on redemption as Income.",
            "Net Worth Synchronization: All RDN cash, active stock holdings, time deposits, and mutual funds automatically reflect in your Net Worth Balance Sheet.",
          ],
        },
        savingsGoals: {
          title: "5. Savings Goals & Dream Piggybanks",
          subtitle:
            "Track progress towards emergency funds, vacations, and financial milestones",
          content:
            "Plan and achieve your savings targets with clear, milestone-driven tracking:",
          steps: [
            "Create target goals with target amounts, target dates, and currency preferences.",
            "Monthly Needed Calculator: Computes exact monthly savings required to hit your target on time.",
            "Deposit & Withdraw Actions: Allocate funds anytime with optional automatic ledger transaction logging.",
            "Flexible Goal Status: Switch between In Progress, Completed, or Paused as life happens.",
          ],
        },
        recurring: {
          title: "6. Recurring Bills & Inflow Schedules",
          subtitle:
            "Automated schedules for subscriptions and predictable cash inflows",
          content:
            "Stay ahead of recurring obligations with automated frequency tracking:",
          steps: [
            "Bills & Subscriptions (Outflow): Track monthly WiFi, rent, insurance, streaming, or utility bills.",
            "Recurring Inflow: Schedule predictable salary, rental income, or dividend cashflows.",
            "Flexible Frequencies: Choose Daily, Weekly, Monthly, or Yearly recurrence cycles.",
            "1-Click Execution: Settle due items when ready with a single click.",
          ],
        },
        accounts: {
          title:
            "7. Liquid Accounts, Natural Forex Transfer & Balance Adjustment",
          subtitle:
            "Multi-currency wallet management, smart forex quoting, and physical cash reconciliation",
          content:
            "Pocketly supports multiple account types and currencies (IDR, USD, SGD) with live exchange rates and physical balance calibration:",
          steps: [
            "5 Account Types: Bank Account, Digital Wallet (E-Wallet), Cash, Credit Card, and Investment / RDN.",
            "Quick Transfer Button: On the account detail page (/accounts/[id]), click the Transfer button to automatically prefill the source account.",
            "Smart Natural Forex Transfer: Input rates naturally (e.g. 1 SGD = Rp 12,000 or 1 USD = Rp 16,200) with automatic two-way calculations and live market rate syncing.",
            "Interactive Transfer History: Click any transfer mutation row to inspect full route details, nominal sent/received, effective exchange rates, and notes.",
            "Adjust Balance (Reconciliation): Instantly calibrate Pocketly's recorded balance to match your real-world cash or bank balance simply by entering your actual balance.",
            "Optional Transfer / Admin Fee: Enter bank transfer fees (e.g. Rp 2,500 BI-FAST); the fee deduction is automatically logged without manual calculation.",
          ],
        },
        debts: {
          title: "8. Multi-Currency Debts & Receivables Ledger",
          subtitle:
            "Track borrowed loans, lent funds, currency filtering, and installment settlements",
          content:
            "Keep liabilities and receivables cleanly separated from daily cashflow with synchronized account ledger tracking:",
          steps: [
            "Payables (I Owe): Record loans or money you borrow from banks or third parties. Destination account balance automatically increases.",
            "Receivables (Owed to Me): Record money lent to others. Source account balance automatically decreases.",
            "Currency-Matched Account Filter: Selecting a currency (IDR, USD, SGD) automatically filters the account dropdown to show only accounts matching that currency.",
            "Direct Account Balance Sync: Check the synchronization option to immediately debit cash when lending or credit cash when borrowing.",
            "Free-Text Notes: Freely document loan terms, reference agreements, or notes without rigid formatting constraints.",
            "Installment Payments: When receivables are settled or repaid, your wallet balance automatically increases with clean, transparent records.",
          ],
        },
        budgets: {
          title: "9. Monthly Budget Allocations & Automated Limits",
          subtitle:
            "Keep category spending disciplined with automated month-to-month limits",
          content:
            "Monitor category spending independently per currency with clear tracking:",
          steps: [
            "Independent Multi-Currency Allocations: Set separate spending limits for IDR, USD, or SGD under the same category.",
            "Automated Target Carryover: Active budget limits established in previous months automatically continue into new months.",
            "Monthly Spending Reset: Your actual consumption tracker automatically restarts from zero on the 1st of every month.",
            "6-Month Trend Logs: Inspect historical allocations and spending trends over the past 6 months.",
          ],
        },
        netWorth: {
          title: "10. Net Worth Balance Sheet & Solvency Ratio",
          subtitle:
            "Understand your real net wealth, portfolio assets, and debt solvency",
          content:
            "The Balance Sheet calculates your real net financial health and debt coverage accurately:",
          steps: [
            "Calculation Formula: (Liquid Bank Balances) + (Investment & Portfolio Assets) + (Active Receivables) - (Total Debts).",
            "Solvency Ratio Bar: Visually compares Total Assets against Total Liabilities. Automatically indicates '100% Debt Free' when you hold zero debt.",
            "Negative Net Worth Warning: If total active liabilities exceed all liquid and portfolio assets, the ledger reflects an insolvent/deficit position.",
            "Multi-Currency Conversion: Automatically converted into your Primary Currency using live exchange rates.",
          ],
        },
        cashflowAnalytics: {
          title: "11. Comprehensive Reports & Cashflow Analytics",
          subtitle:
            "Deep insights into cashflow, savings rates, and expense distribution",
          content:
            "The Reports page provides essential personal finance health metrics:",
          steps: [
            "Savings Rate Metric: Understand what percentage of income you save each month (Healthy, Warning, Deficit).",
            "Cashflow Comparison: Visual breakdown of total money in versus total money out across time periods.",
            "Category Distribution: Proportional expenditure breakdown ranked from largest to smallest.",
          ],
        },
        auditTrail: {
          title: "12. Universal Activity History & Audit Trail",
          subtitle:
            "Review your complete financial timeline and data modifications across all modules",
          content:
            "All financial activities across your account are recorded safely and transparently:",
          steps: [
            "Comprehensive Tracking: Traces all actions across Transactions, Transfers, Stocks, Goals, Recurring Bills, Debts, Accounts, and Budgets.",
            "Before-and-After Records: Preserves snapshot changes whenever data is modified or deleted.",
            "Filter & Search: Filter logs by module, action type (Created, Updated, Deleted), date range, or keyword.",
          ],
        },
        search: {
          title: "13. Quick Global Search (Ctrl + K / Cmd + K)",
          subtitle:
            "Quickly find any transaction, account, or page directly from your keyboard",
          content: "Press Ctrl+K (Windows) or Cmd+K (Mac) from any screen:",
          steps: [
            "Type a vendor name, memo note, tag (#tags), amount, or category to find transactions.",
            "Type an account name to jump directly into its ledger history.",
            "Navigate anywhere in the app instantly without reaching for your mouse.",
          ],
        },
        backup: {
          title: "14. Privacy Mode, Display Themes & Data Backups",
          subtitle:
            "Display preferences, balance privacy, and data export features",
          content: "Manage your system settings in the Settings menu:",
          steps: [
            "Privacy Mode (Hide Balances): Tap the eye icon in the header to blur all sensitive figures in public spaces.",
            "Dark & Light Themes: Switch theme modes anytime for optimal visual comfort.",
            "Language Switcher: Toggle between English and Bahasa Indonesia on-the-fly.",
            "Install PWA to Home Screen: Use 'Add to Home Screen' in your mobile browser (Chrome/Safari) for a native fullscreen experience.",
            "Download Backups: Export your financial records to Excel spreadsheets (.CSV) or JSON backup files.",
          ],
        },
      },
  },
};
