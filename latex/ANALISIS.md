# Dasar proposal Tandara

Catatan 16 Oktober 2026: analisis ini menyimpan temuan audit awal. Naskah
publik telah direvisi dengan cakupan informasi gempa mengikuti koreksi
pengguna, roadmap yang lebih ringkas, dan aset cover/header-footer baru.
Status akses desain Figma serta asal sumber gempa dijelaskan dalam
`research/REVISI-16-OKTOBER.md`. Temuan kode di bawah tidak diperluas menjadi
klaim implementasi gempa atau kesesuaian seluruh layar Figma.

Tanggal audit: 15 Oktober 2026. Checkout: `main`, HEAD `1c427ab`.
Dokumen ini merupakan catatan kerja pendamping, bukan bagian dari PDF 10 halaman.

## Mandat dan metode

Seluruh lampiran `Pasted text.txt` (1.352 baris) menjadi spesifikasi keluaran.
Penelusuran mencakup inventaris repository milik proyek, seluruh Markdown,
PRD/TDD/PLAN, implementation plan, kontrak, controller, migrasi, modul bisnis,
UI Warga/Posko, offline/PWA, konfigurasi deployment/CI, brand, screenshot, dan
tiga PDF contoh. Dependency vendor, berkas `.env` privat, hasil build/cache,
dan kunci lokal tidak dijadikan materi proposal. Inventaris dan peta dokumen
dapat direproduksi dengan `python latex/scripts/audit_repository.py`.

Audit ini menelusuri kapabilitas dan batas klaim; bukan review keamanan setiap
baris kode. Pembacaan source membuktikan implementasi ada, bukan bahwa semua
alur beroperasi pada domain publik. Tidak ada deploy, panggilan model berbayar,
pengiriman pesan, atau perubahan aplikasi dilakukan untuk membuat proposal.

## Definisi produk dan masalah

Tandara adalah lapisan kesiapsiagaan dan koordinasi komunitas pada tahap terakhir
penyampaian informasi bencana. Nilai utamanya: warga memiliki rencana lokal yang
dapat disimpan sebelum koneksi terganggu; laporan dipisahkan dari informasi resmi;
koordinator meninjau informasi sebelum ringkasan komunitas dipublikasikan.
Informasi yang tidak tersedia tetap ditampilkan sebagai kekurangan informasi.

Masalah pada subtema merupakan hipotesis kebutuhan kompetisi. Data BNPB memberi
konteks nasional, bukan bukti keterlambatan informasi di satu RT tertentu.
Belum ditemukan wawancara warga, pengukuran waktu evakuasi, atau pilot lapangan
yang dapat diatribusikan kepada Tandara. Proposal tidak mengarang penelitian itu.

## Matriks implementasi dan bukti

| Area                | Bukti source utama                                                                   | Klaim yang dapat dipakai                                                                          | Batas                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Dua antarmuka       | `apps/resident-web`, `apps/coordinator-web`                                          | Warga tanpa akun; Posko dengan sesi dan cakupan wilayah                                           | Bukan aplikasi Android native                                                                               |
| Rencana lokal       | `packages/backend/src/modules/preparedness.ts`, `contracts/src/domain.ts`            | Versi, organisasi pemilik, peninjau, waktu tinjauan, kedaluwarsa; persetujuan orang berbeda       | Isi seed dan pemilik masih simulasi; bukan rute lapangan tervalidasi                                        |
| Laporan             | `modules/reports.ts`, `contracts/src/reports.ts`                                     | Teks, kategori, patokan/waktu/GPS opsional, persetujuan, tanda terima rahasia                     | Bukan kanal layanan darurat; tidak ada kepastian tindak lanjut                                              |
| Tinjauan            | `reports.ts::review`, `preparedness.ts::publicData`                                  | Laporan asli terpisah dari ringkasan publik; alasan dan revisi dicatat                            | Ditinjau bukan bukti kebenaran otomatis                                                                     |
| Privasi bantuan     | `follow_up_requested`, `report_private_details`, `assistance_requests`               | Permintaan tindak lanjut tidak masuk feed publik; akses berotorisasi                              | Teks bebas masih dapat mengandung data sensitif; review publikasi tetap perlu                               |
| Status dan duplikat | `transitions`, `duplicate()`, `jobs.ts`                                              | Klarifikasi, ditinjau, ditutup; kandidat duplikat dan tautan yang dapat dibatalkan                | Tidak ada aksi tunggal `restrict` atau `close_as_duplicate`; bukan seluruh menu PRD sudah identik dengan UI |
| Offline             | `offline/database.ts`, `offline/sync.ts`, `resident-workflows.tsx`, `vite.config.ts` | Simpan rencana eksplisit; checklist lokal; antrean teks; retry dengan kunci tetap                 | Harus pernah online; GPS/foto/kontak pribadi tidak diantrekan; 5 kegagalan jeda; pemeliharaan draf 7 hari   |
| Kegagalan API       | `resident-app.tsx`                                                                   | Rencana tersimpan dapat menjadi fallback saat API gagal, bukan hanya `navigator.onLine=false`     | Data terkini tidak disulap menjadi cache live                                                               |
| AI triase           | `adapters.ts`, `ai.ts`, `ai-policy.ts`, `reports-ui.tsx`                             | Mode aturan lokal dan adapter inferensi server; schema ketat, referensi/kutipan, tinjauan manusia | Schema/kutipan tidak membuktikan seluruh ringkasan benar; model live tidak dipanggil ulang dalam audit      |
| AI lebih luas       | `knowledge.ts`, `ai.ts`, `ai-ui.tsx`, migrations 004–008                             | Modul pencarian sumber, draf, penerjemahan, kontrol rilis ada                                     | Dikeluarkan dari fokus proposal agar AI tetap asisten triase; gate produksi belum tertutup                  |
| Sumber resmi        | `bmkg-nowcast.ts`, `adapters.ts`, migration 009                                      | Adapter CAP/prakiraan BMKG dan urun daya PetaBencana dengan provenance                            | Aktivasi default dimatikan; perlu izin/konfigurasi tepat; tidak ada bukti deployment live saat audit        |
| InaRISK             | `adapters.ts`                                                                        | Rujukan kajian risiko                                                                             | Bukan konektor operasional live                                                                             |
| Spasial             | PostGIS SQL di `preparedness.ts`, `jobs.ts`, `reports.ts`                            | Pemeriksaan wilayah, kandidat duplikat jarak/waktu, cakupan observasi                             | Empat kuadran per wilayah, bukan peta tingkat bahaya; tanpa laporan bukan aman                              |
| Peta                | `situation-map.tsx`, `basemap.ts`, `basemap.json`                                    | MapLibre dan tile OSM dengan atribusi; fallback teks/lapisan lokal                                | Bukan navigasi; tidak ada unduh tile offline                                                                |
| Keamanan            | `identity.ts`, `mfa.ts`, `security/model.md`                                         | scrypt; sesi opaque; CSRF; cakupan wilayah; TOTP; audit dan retensi                               | Tidak menyatakan sertifikasi, kepatuhan hukum penuh, atau pentest independen selesai                        |
| Media               | `reports.ts::upload`                                                                 | JPEG/PNG dibatasi dan diproses Sharp; metadata dibuang; bytes privat di DB                        | Bukan MinIO/S3 aktif untuk foto; tidak menjanjikan sensor data pribadi sempurna                             |
| Pekerjaan latar     | `jobs.ts`, worker entry point                                                        | PostgreSQL transactional outbox, lease, retry, heartbeat                                          | Redis/BullMQ bukan dependensi alur demo                                                                     |
| Deployment          | Compose, Caddy, Dockerfile, `.github/workflows`                                      | Jalur lokal lengkap; template Ubuntu VPS; jalur Vercel+Tencent disiapkan                          | Konfigurasi bukan bukti server publik sehat; status cloud tidak diinspeksi                                  |

## Alur yang dipertahankan

Warga: pilih wilayah → baca rencana dan metadata → simpan saat online → checklist
→ laporkan kondisi → simpan tanda terima → lihat status saat tersedia koneksi.
Navigasi HEAD memiliki Beranda, Rencana, Laporan, Checklist, Latihan; bantuan dan
pelacakan merupakan tautan tambahan. Usulan empat menu dari diskusi sebelumnya
tidak diklaim sebagai UI yang sudah diterapkan.

Posko: login → pilih wilayah berwenang → inbox → laporan asli dan saran terpisah
→ tinjauan beralasan → status/ringkasan publik yang sesuai atau tetap privat.
Duplikat ditautkan/dibatalkan oleh manusia. Menutup laporan adalah transisi
terpisah; AI tidak memindahkan status laporan atau menerbitkan informasi.

## Koreksi atas dokumen historis

- PRD/TDD/PLAN memuat desain awal: Argon2, BullMQ, Redis, S3/MinIO, beberapa route
  dan gate fondasi lama. Source saat ini memakai scrypt, SQL outbox, dan foto
  terproses dalam PostgreSQL. PostGIS bukan sekadar rencana.
- `Implementation-Plan.md` menyebut tiga developer. Identitas proposal mengikuti
  instruksi terbaru pengguna: Husni Abdillah dan tiga anggota, total empat orang.
- Laporan QA bertanggal 13 Oktober memuat hasil eksekusi historis dan beberapa
  pernyataan yang sudah tertinggal. Hasil tersebut tidak dipresentasikan sebagai
  pengujian cloud atau hasil pengujian ulang pada 15 Oktober.
- Laporan provider mencatat smoke test sintetis Vikey/Gemini. Ini bukan bukti
  akurasi model, persetujuan pemrosesan data warga, atau aktivasi di Tencent.
- Screenshot QA berasal dari versi repository terdahulu. Label simulasi
  dipertahankan; logo UI lama tidak diubah seolah screenshot baru. Cover,
  diagram, header/footer memakai asset brand ring yang tersedia.

## Pembelajaran dari tiga contoh proposal

| Contoh                              | Seluruh halaman diperiksa | Kekuatan yang diadaptasi                                                                   | Hal yang tidak ditiru                                                       |
| ----------------------------------- | ------------------------: | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| ORCA / AI Open Innovation Challenge |                        19 | Struktur masalah, bukti, solusi, teknis, dampak, kelayakan; branding konsisten dan penutup | Banyak halaman dan klaim target dampak tidak otomatis menjadi bukti Tandara |
| SIGAP                               |                        31 | Metode penelitian, perjalanan pengguna, diagram, roadmap, prototype dan pembiayaan         | Wawancara/hasil testing milik contoh tidak boleh diatribusikan ke Tandara   |
| SwarSware / FindIT 2025             |                         7 | Narasi ringkas, fokus penerima manfaat, stack dan antarmuka nyata                          | Tema/penyelenggara/tahun pada contoh bukan identitas lomba Tandara          |

Teks PDF diekstrak dan seluruh halaman dirender sebagai contact sheet untuk
memeriksa kepadatan teks, tabel, diagram, warna, cover, header/footer, dan penutup.
Tidak ada kalimat atau data produk contoh dipindahkan ke proposal Tandara.

## Kebijakan klaim

Klaim aman: membantu menstrukturkan informasi; menyediakan versi rencana dan
status; mempertahankan ketidakpastian; memungkinkan rencana tersimpan dibuka
offline; mendukung peninjauan manusia. Potensi penghematan waktu dan peningkatan
pemahaman harus diuji terhadap baseline.

Klaim yang dilarang: hasil penyelamatan, prediksi genangan, rute yang dijamin
aman, peringatan resmi buatan Tandara, alarm ke seluruh warga, bantuan pasti
dikirim, AI membuktikan kebenaran, kemitraan institusional yang belum ada.

## Rencana evaluasi yang diusulkan

Satu RT/RW dipilih bersama pengelola setempat setelah izin dan kepemilikan
rencana jelas. Uji kegunaan awal: 8–12 warga sukarela dan 2–3 koordinator;
ini sampel formatif, bukan estimasi populasi. Kondisi pembanding memakai paket
pesan simulasi yang sama, urutan tugas diimbangi. Ukur tugas selesai, waktu,
pemahaman sumber/status, kesalahan dan hambatan akses. Jangan melakukan uji
evakuasi berbahaya atau menunda peringatan sungguhan untuk eksperimen.

Untuk kualitas AI, proposal mengusulkan tahap awal 100 laporan sintetis berlabel,
dua penilai dan penyelesaian ketidaksepakatan, termasuk data ambigu dan serangan
instruksi. Ini bukan pengganti gate produksi repository yang menuntut sekurangnya
1.000 kasus, termasuk 200 adversarial, dua kandidat model dan review independen.

## Verifikasi dalam sesi ini

`pnpm --filter @tandara/backend exec vitest run src/modules/safety.test.ts
src/modules/ai-policy.test.ts src/modules/public-sources.test.ts`: **31 tes,
3 berkas, lulus**. Pengujian memakai aturan/fixture dan tidak menggunakan kunci
model live. Integration DB, browser, deployment, aksesibilitas pengguna dan
kemampuan lapangan tidak diuji ulang dalam pekerjaan dokumen ini.

## Keputusan editorial

PDF 10 halaman mengikuti struktur lampiran. Riset dan audit rinci dipisah ke
berkas pendamping agar tubuh proposal terbaca. Identitas kompetisi yang belum
diberikan tidak dikarang: cover memakai “Proposal Hackathon — Sustainability”
dan tahun penyusunan 2026. Semua angka target pilot diberi label usulan.
