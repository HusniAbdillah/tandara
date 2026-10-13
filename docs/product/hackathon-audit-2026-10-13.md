# Audit Tandara dan keputusan tiga hari menuju penjurian

Audit terhadap checkout `main` pada baseline `73ce6e0`, 13 Oktober 2026.
Seluruh 37 berkas Markdown yang ada saat audit dibaca dan dibandingkan dengan
kode, migration, kontrak, workflow, dan catatan pengujian. Daftar per berkas ada
di [indeks audit](../engineering/markdown-audit-2026-10-13.md).
Analisis ini membedakan perangkat lunak yang tersedia, verifikasi lokal,
aktivasi deployment, dan bukti lapangan. Keempatnya bukan status yang sama.

## Keputusan utama

Tandara sudah memiliki produk yang luas: PWA warga, kerja posko, laporan,
review manusia, bantuan, peta, rencana berversi, offline, latihan, dan sistem AI
yang jauh lebih lengkap daripada jadwal awal `PLAN.md`. Kelemahan terbesarnya
untuk subtema lomba adalah bukti hubungan **peringatan → persiapan → akses
evakuasi**, kualitas data lokal, serta demonstrasi dampak yang bisa diukur.

Dalam tiga hari, pilihan paling bernilai adalah satu wilayah fokus, data publik
asli beratribusi, sumber/waktu/cakupan yang jelas, dan satu alur persiapan yang
tetap berguna saat koneksi hilang. Pertahankan Vercel untuk frontend dan Tencent
untuk API/worker/PostGIS sesuai konfigurasi delivery. Tidak perlu menambah
Heroku, Redis, model lokal, layanan SMS berbayar, atau platform baru.

Data publik asli dapat digunakan sekarang. Namun laporan seed, organisasi,
kontak, titik pertemuan, dan batas berbentuk persegi dalam seed bukan bukti
operasi lapangan. Mengganti label simulasi tidak membuatnya asli. Untuk
menampilkan semuanya sebagai data nyata, tim perlu mengganti konten tersebut
dengan sumber lokal yang terverifikasi, lalu meninjau dan menerbitkannya melalui
workflow yang sudah tersedia. Bila bukti itu belum ada, tampilkan keadaan kosong.

## Yang sudah dan belum tersedia

| Area                            | Bukti kode/implementasi                                                                                                        | Kesenjangan yang masih material                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Warga                           | Pemilihan wilayah manual, sumber informasi, rencana, checklist, laporan, tracking, bantuan, latihan, ukuran teks               | Belum ada bukti usability dengan warga sasaran; perangkat lama/jaringan nyata perlu diuji                                                |
| Offline                         | App shell, rencana yang disimpan eksplisit, draft teks, idempotent sync, receipt lokal                                         | Peringatan live memerlukan koneksi; bukan aplikasi peringatan offline/push. Peta dasar offline tidak tersedia                            |
| Laporan                         | Persetujuan privasi, koordinat opsional, pemeriksaan batas PostGIS, foto JPEG diproses, receipt, penghapusan                   | Data seed bukan insiden nyata; observasi publik eksternal belum menjadi laporan warga yang terverifikasi                                 |
| Posko                           | Inbox, pencarian/paginasi, bukti asli, review/clarification, duplicate hints, assistance states, map/coverage                  | Tidak ada dispatch darurat, jaminan respons, atau konfirmasi tim telah tiba di lokasi                                                    |
| Rencana                         | Snapshot versi, penulis berbeda dari reviewer, approval/publication/expiry, titik dan catatan akses                            | Belum ada inventaris shelter nyata dengan kapasitas, status buka, audit akses kursi roda, dan pemilik lapangan                           |
| AI                              | Triage, duplicate context, briefing, drafting, translation, grounded knowledge; LangGraph, pgvector, kutipan, immutable review | Inference deployment demo masih heuristic secara default; evaluasi lapangan/model dan perjanjian pemrosesan data belum terbukti          |
| Governance                      | Scoped auth, CSRF/session, MFA, leases/fencing, budgets, release approvals, RLS/retrieval, erasure/restore tooling             | Adanya kode bukan bukti seluruh production gate sudah dijalankan atau audit keamanan independen selesai                                  |
| Integrasi sebelum audit         | Adapter prakiraan BMKG dan PetaBencana opt-in; InaRISK reference-only                                                          | Belum ada konektor peringatan resmi CAP; umur/cakupan laporan eksternal dan kesehatan sumber di Warga kurang jelas                       |
| Integrasi setelah perubahan ini | CAP BMKG, issuance/validity, pembatalan, spatial matching, source health, polling Warga, empty/outage handling                 | Tetap perlu deploy versi baru dan aktivasi sumber oleh admin; bukan bukti pengiriman ke semua warga                                      |
| Deployment/CI                   | Build/image smoke, checksum, migration/seed, Caddy TLS, dua Vercel project, successful-CI gate                                 | Tidak ada sesi SSH/akun hosting yang diverifikasi dalam audit ini; kondisi domain publik perlu rehearsal kembali                         |
| Dampak                          | Checklist/training dan timestamp bisa mendukung pengukuran                                                                     | Belum ada baseline, denominator warga, angka jangkauan peringatan, waktu evakuasi, pengurangan kerugian, atau manfaat lingkungan terukur |

Bukti utama: `apps/resident-web/src/features`, `apps/coordinator-web/src/features`,
`packages/backend/src/modules`, `packages/contracts/src/domain.ts`, migration
001–009, `tests/integration`, dan `.github/workflows`. Catatan QA lama adalah
rekaman eksekusi pada revision terdahulu; hasil terbaru dicatat terpisah.

## Membaca PLAN, PRD, dan TDD dengan benar

`PLAN.md` adalah jadwal awal yang berguna untuk memahami ide dan alur demo,
tetapi tidak akurat sebagai daftar pekerjaan yang tersisa. Ia mengasumsikan
empat anggota, Redis/BullMQ, beberapa route/nama akun lama, dan banyak fitur
yang sekarang sudah tersedia. `Implementation-Plan.md` memakai tiga developer;
repo tidak bisa memastikan jumlah anggota tim saat ini. Jangan menyelesaikan
ulang pekerjaan hanya karena checklist historis belum dicentang.

PRD/TDD memuat tujuan produk, batas otoritas, kebutuhan pilot dan desain lama.
Bagian akhir keduanya masih menyatakan bisnis/worker belum diimplementasikan.
Itu bertentangan dengan source sekarang. Pilihan SQL outbox, scrypt, dan bytea
foto yang telah diproses merupakan keputusan implementasi yang perlu dinilai
berdasarkan manfaat/risikonya, bukan otomatis dianggap salah karena dokumen
awal menyebut BullMQ, Argon2, atau S3. SQL outbox cocok untuk demo di VPS kecil;
foto di DB perlu pembatasan ukuran dan backup, sedangkan storage terpisah dapat
menunggu pilot dengan volume media yang nyata.

Dokumen AI terbaru menunjukkan software delivery yang luas, tetapi juga
menyebut gate eksternal: dataset yang ditinjau, kandidat model, persetujuan
pemrosesan, pengguna/MFA/roles, release approvals, load/recovery dan on-call.
Jangan menghabiskan tiga hari untuk mengklaim menutup semuanya. Untuk demo
tanpa biaya tambahan, heuristic dan review manusia tetap dapat ditunjukkan
jujur; sumber publik tidak memerlukan pemanggilan model berbayar.

## Strategi data asli

| Sumber                | Dipakai untuk                               | Cara penggunaan                                                                           | Batas klaim                                                                     |
| --------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| BMKG CAP nowcast      | Peringatan resmi cuaca                      | RSS provinsi → CAP detail → waktu berlaku dan polygon → irisan wilayah PostGIS            | Peringatan cuaca bukan prediksi genangan atau instruksi evakuasi dari Tandara   |
| BMKG prakiraan        | Konteks persiapan cuaca                     | Kode adm4 yang benar, nama kelurahan, waktu produksi dan slot prakiraan                   | Prakiraan tidak boleh dilabeli sebagai peringatan banjir                        |
| PetaBencana           | Sinyal banjir urun daya                     | API GeoJSON, publikasi asli, atribusi, titik di wilayah, jendela satu jam                 | Belum diverifikasi Tandara; feed kosong tidak membuktikan tidak ada banjir      |
| BPBD/pemerintah lokal | Rencana, kontak dan titik yang disepakati   | Dokumen resmi bertanggal + URL + peninjauan pengelola                                     | Lokasi bangunan di peta tidak membuktikan shelter buka atau jalur dapat dilalui |
| Media sosial          | Petunjuk untuk pemeriksaan manusia          | Tautan asli, waktu/lokasi belum pasti dijelaskan, jangan salin kontak/foto pribadi massal | Bukan ground truth, bukan izin memproses data warga dengan AI                   |
| Data historis asli    | Demonstrasi kondisi ketika live feed kosong | Arsip berprovenansi dan tanggal kejadian/pengambilan; tampilkan sebagai arsip             | Tidak boleh mengganti timestamp agar terlihat sebagai kejadian saat ini         |

Dokumentasi BMKG menyediakan CAP publik dan mewajibkan atribusi; prakiraan
menggunakan kode kelurahan/desa, bukan koordinat bebas. Kedua layanan menyebut
batas 60 permintaan/menit/IP. Desain polling dua menit untuk CAP di satu wilayah
dan tiga puluh menit untuk sumber lain berada jauh di bawah angka tersebut,
namun ekspansi banyak wilayah memerlukan penggabungan fetch dan pembatasan
global. [CAP BMKG](https://data.bmkg.go.id/peringatan-dini-cuaca/),
[prakiraan BMKG](https://data.bmkg.go.id/prakiraan-cuaca/).

PetaBencana menyediakan periode default satu jam dan mensyaratkan User-Agent.
Data dibagikan dengan CC BY 4.0 menurut repositori pengelolanya; tetap cantumkan
sumber dan jangan memperluasnya menjadi izin untuk menyalin identitas warga.
[API](https://docs.petabencana.id/routes/laporan-urun-daya),
[lisensi data](https://github.com/petabencana/petabencana-meta/blob/master/petabencana.id/LICENSING.md).

Probe read-only pada audit ini berhasil: 17 slot prakiraan Bidara Cina
(`31.75.03.1002`), satu CAP Jakarta, nol laporan banjir `ID-JK` dalam satu jam.
Ini snapshot sekitar 21:31 WIB, bukan janji keadaan saat penjurian. Feed awal
audit tidak menampilkan Jakarta; feed berikutnya menampilkannya. CAP Jakarta
diperiksa sebagai data asli, namun jumlah CAP provinsi belum sama dengan
jumlah peringatan yang lolos irisan wilayah. Probe berikutnya setelah 22:00 WIB
membaca nol CAP Jakarta; ini perubahan feed yang normal. Hasil probe terbaru
ada di `.local/public-source-evidence.json`; probe berikutnya juga menyimpan
salinan bertanggal. XML CAP/RSS yang diperiksa sebelumnya disimpan di
`.local/real-data/`, tidak dimasukkan sebagai fixture live.

Jangan melakukan scraping massal Instagram/X/TikTok dalam tiga hari. Hambatan
akses, konteks tanggal/lokasi, duplikasi, izin, dan PII akan mengurangi waktu
untuk hasil yang dapat dibuktikan. PetaBencana memberikan jalur publik yang
lebih terstruktur. Jika menemukan unggahan yang relevan, gunakan sebagai
tautan petunjuk untuk review; jangan otomatis mengubahnya menjadi peringatan.

## Inovasi yang paling masuk akal untuk lomba

Usulan posisi produk: **Tandara membantu komunitas menghubungkan peringatan
resmi dengan persiapan lokal yang bisa dibaca saat koneksi hilang, sambil
membuat hambatan akses dan kekurangan informasi terlihat bagi posko.**

Nilai inovasinya bukan sekadar agregator cuaca atau label “AI”. Nilainya adalah
gabungan pemisahan tingkat kepercayaan, batas geografis, waktu sumber,
rencana lokal yang ditinjau, ketahanan offline, dan review laporan akses.
Ini usulan diferensiasi berdasarkan audit, bukan klaim bahwa tidak ada produk
lain yang melakukan hal serupa.

| Prioritas     | Perbaikan                                                      | Alasan penilaian                                                                              | Status/syarat                                                                  |
| ------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P0            | CAP resmi + validitas + source health + spatial matching       | Inovasi 25%, teknis 30%, fungsi 20%; langsung menjawab keterlambatan/ketidakjelasan informasi | Diimplementasikan pada audit ini; aktivasi hosting terpisah                    |
| P0            | Peringatan → rencana offline → checklist → hambatan akses      | Mengubah data menjadi tindakan persiapan yang dapat didemokan                                 | Panel baru memakai workflow yang sudah ada                                     |
| P0            | Satu paket data lokal yang sah                                 | Menguatkan dampak/kelayakan 15% dan kepercayaan juri                                          | Tim harus meninjau sumber rencana/kontak/batas; tidak boleh mengarang          |
| P0            | Rehearsal domain, mobile, koneksi hilang, sumber gagal         | Fungsi 20% dan presentasi 10%; mencegah demo gagal                                            | Wajib hari kedua/ketiga                                                        |
| P1            | Uji kecil dengan 5–10 sukarelawan dan baseline                 | Bukti manfaat yang masuk akal tanpa menyatakan menyelamatkan nyawa                            | Belum dilakukan; bukan pengguna lapangan otomatis                              |
| P1            | Audit akses titik kumpul: lansia, disabilitas, pendamping      | Langsung memperkuat subtema keterbatasan akses                                                | Isi hanya dari pemeriksaan/pengelola; kolom accessibility sudah ada            |
| P1            | Drainase/sampah sebagai penyebab hambatan yang ditindaklanjuti | Penghubung sustainability dengan banjir; kategori debris/blocked_access sudah tersedia        | Perlu bukti lokasi dan penanganan; belum ada pengukuran sampah                 |
| Setelah lomba | Push/SMS/WhatsApp yang diverifikasi sampai penerima            | Menjawab warga yang tidak membuka aplikasi                                                    | Belum diimplementasikan; perlu izin, biaya/kuota, receipts dan pemilik operasi |
| Setelah lomba | Inventaris shelter/capacity dan audit mobilitas                | Mengukur akses evakuasi lebih nyata                                                           | Memerlukan kemitraan dan pemutakhiran lapangan                                 |
| Setelah lomba | Dispatch, sensor, risiko prediktif, routing                    | Kompleksitas dan konsekuensi tinggi                                                           | Tidak dipilih dalam tiga hari tanpa data/validasi                              |

Jangan menggabungkan thrift, energi desa, kebakaran gambut dan konservasi pesisir
sebagai empat modul tambahan. Gabungkan hanya hubungan yang jelas: hambatan
drainase/debris → akses saat banjir → perbaikan yang dicatat. Fokus bencana dan
adaptasi komunitas sudah sesuai subtema yang diberikan. Hubungan lingkungan
dapat dijelaskan sebagai hipotesis yang perlu diukur, bukan langsung diberi
angka emisi atau ton sampah yang tidak pernah ditimbang.

## Implementasi yang diterapkan

1. Provider `bmkg_nowcast` dengan RSS/CAP resmi, validasi XML, batas payload,
   timeout, penolakan redirect/URL asing/DTD/entity, bahasa Indonesia,
   `Actual`/`Public`, issuance/effective/expiry dan polygon.
2. CAP latitude,longitude diubah ke GeoJSON longitude,latitude. Worker memakai
   PostGIS untuk irisan batas wilayah. Invalid geometry gagal tanpa mengganti
   record lama; provinsi yang sama saja tidak cukup untuk memasukkan peringatan.
3. Referensi CAP Update/Cancel menghapus versi yang digantikan dari hasil
   snapshot. Snapshot sukses menonaktifkan peringatan lama yang hilang;
   kegagalan fetch tidak membuat data lama tampak baru dan tidak memperpanjang
   masa berlaku. Polling CAP dua menit, bukan tiga puluh menit.
4. `issuedAt` dipisah dari `observedAt` melalui migration 009 dan DTO/OpenAPI.
   Prakiraan memeriksa adm4 respons dan menyebut kelurahan. PetaBencana memakai
   waktu publikasi asli untuk expiry, membawa titik untuk pemeriksaan wilayah,
   dan tidak menyalin isi sosial/nomor pribadi ke public feed.
5. Public source health hanya memuat nama/provider/waktu/status gagal, bukan
   config atau informasi autentikasi. Panel Warga menunjukkan waktu sumber,
   cakupan, ketidakpastian sumber kosong/terlambat/gagal, serta tindakan
   persiapan. Data halaman dimuat tidak lagi dilabel sebagai update sumber.
6. Perubahan config sumber selama network fetch tidak boleh menerbitkan
   respons config lama. Perubahan lokasi/provider juga mengakhiri records
   terdahulu dan mereset successful-check stamp.
7. Compose Tencent memakai opt-in `ALLOW_LIVE_SOURCES` dari environment,
   bukan literal `false`. Ini tidak mengaktifkan sumber dengan sendirinya dan
   tidak mengubah mode demo maupun mengirim data ke AI.
8. Probe publik read-only, 14 test cases sumber, lima integration tests
   PostGIS, serta tiga browser cases untuk active/outage/empty feed ditambahkan.

Ini integrasi data publik dan perbaikan alur informasi. Belum ada bukti
peringatan terkirim ke setiap warga, lokasi shelter aman, atau respons relawan.
Jeda terbit→pengambilan terakhir merupakan umur pesan saat dibaca server;
bukan first-ingestion latency atau delivery receipt tiap perangkat.

## Dampak yang layak diukur dalam tiga hari

Pengukuran harus membedakan kemampuan teknis dan perubahan perilaku.
Checklist yang dicentang adalah deklarasi perangkat, bukan bukti keluarga
sudah siap di lapangan. Latihan bukan kejadian bencana. Timestamp fetch bukan
bukti keterlambatan pemerintah berkurang.

| Ukuran                    | Definisi                                                                                        | Cara mengumpulkan                                             | Batas interpretasi                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| Ketepatan sumber          | Peserta membedakan prakiraan, peringatan, urun daya dan latihan dengan benar / peserta menjawab | Tugas dengan pertanyaan yang sama untuk baseline dan aplikasi | Ukuran pemahaman kecil, bukan akurasi prakiraan BMKG      |
| Waktu menemukan langkah   | Detik dari tugas diberikan sampai peserta menemukan instruksi rencana yang tepat                | Stopwatch; catat median/rentang, urutan tugas diseimbangkan   | Tidak sama dengan waktu evakuasi                          |
| Offline success           | Peserta bisa membuka rencana yang disimpan setelah jaringan diputus / peserta yang menyimpan    | Perangkat nyata dan refresh halaman, bukan sekadar screenshot | Tidak membuktikan alert baru tersedia offline             |
| Kegagalan sumber dipahami | Peserta mengenali bahwa feed kosong/gagal tidak berarti aman                                    | Tugas outage/empty state                                      | Tidak sama dengan jangkauan peringatan                    |
| Kebutuhan akses terlihat  | Peserta dapat menemukan catatan akses dan kontak lokal yang tersedia                            | Tugas dengan rencana yang benar-benar ditinjau                | Jika data belum ada, ukur kemampuan menyadari kekosongan  |
| Sinyal lingkungan         | Hambatan drainase/debris yang ditinjau serta tindak lanjut tercatat                             | Bukti sebelum/sesudah dan pemilik tugas pada pilot            | Belum boleh mengklaim ton limbah/kerugian/emisi berkurang |

Pakai 5–10 sukarelawan dengan persetujuan; sebut jumlah, karakter peserta dan
keterbatasan representasi. Bandingkan cara sekarang (misalnya mencari informasi
di pesan/dokumen) dengan Tandara, gunakan tugas setara dan urutan bergantian
untuk mengurangi efek belajar. Jangan mengisi angka sebelum eksperimen.
Jika tidak sempat, tunjukkan definisi metrik dan hasil teknis, bukan angka
manfaat yang diasumsikan.

## Jadwal tiga hari dan pembagian kerja

| Hari | Data/produk                                                                                                  | Teknis                                                                               | Demo/bukti                                                                           | Gate selesai                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1    | Tetapkan satu wilayah; cari rencana dan sumber kontak resmi; beri provenance, masa berlaku dan status review | Merge perubahan yang sudah diuji, migration, deploy API/worker/FE, aktifkan konektor | Ambil evidence feed bertanggal; jelaskan demo/real boundary                          | Sumber asli tampil, status sehat terlihat, tidak ada lokasi/nomor palsu yang dilabel nyata |
| 2    | Reviewer kedua meninjau rencana; audit akses bila ada bukti lokal; lakukan 5–10 sesi tugas                   | Full CI browser/offline/auth, mobile, sumber gagal, backup; pantau RAM VPS           | Susun hasil eksperimen tanpa klaim berlebihan                                        | Semua alur inti direhearsal di domain final; offline reload berhasil                       |
| 3    | Bekukan data/fitur; periksa expiry dan kesesuaian sumber sekali lagi                                         | Jalankan smoke/readiness dan backup; hindari perubahan arsitektur/model              | Dua rehearsal berurutan; siapkan video/snapshot bertanggal jika internet venue gagal | Presentasi 4–5 menit stabil dan keterbatasan dapat dijelaskan                              |

Untuk tiga developer: A fokus frontend/offline/rehearsal, B source/API/DB/deploy,
C kurasi data/review/pengukuran/pitch. Setiap publikasi rencana tetap memerlukan
reviewer berbeda dari penulis. Bila anggota berbeda, alokasikan pekerjaan tanpa
meniadakan pemisahan review.

## Demo yang disarankan

Mulai dari satu tugas warga: “Saya perlu tahu kabar resmi untuk wilayah saya
dan langkah persiapan yang bisa dibaca ketika jaringan hilang.”

- 0:00–0:40: masalah dan wilayah fokus. Jelaskan mana sumber asli dan mana
  workflow latihan; jangan menyebut seed sebagai masyarakat yang sudah memakai.
- 0:40–1:30: buka peringatan BMKG dengan issuance/validity/cakupan dan URL asli.
  Jika kosong, tunjukkan empty state jujur dan prakiraan asli, bukan mengarang.
- 1:30–2:20: buka rencana yang ditinjau, sumber dan catatan akses; simpan;
  putus koneksi lalu refresh. Jika rencana belum diverifikasi, sebut rencana latihan.
- 2:20–3:20: buat laporan **latihan** hambatan akses saat offline, hubungkan
  kembali, lalu reviewer melihat bukti asli dan ketidakpastian di Posko.
- 3:20–4:10: tampilkan kegagalan sumber/coverage sebagai kurang informasi,
  keputusan manusia, dan AI sesuai mode yang benar-benar aktif.
- 4:10–5:00: hasil tugas sukarelawan jika tersedia, batas bukti, biaya memakai
  aset yang ada, serta rencana pilot dengan pengelola lokal.

Jika ingin demo tanpa data sintetis sama sekali, gunakan feed publik asli dan
rencana/dokumen nyata yang ditinjau; jangan membuat laporan insiden untuk
memamerkan workflow. Tunjukkan halaman inbox kosong atau gunakan rekaman
pengujian yang secara jelas dipisahkan sebagai test. Arsip kejadian asli harus
diberi tanggal/label arsip dan izin penggunaan, bukan dimasukkan ke feed live.

Materi untuk juri sebaiknya menampilkan satu diagram arsitektur, satu alur
pengguna, sumber data/atribusi, hasil uji yang benar-benar dijalankan, serta
perbandingan manfaat. Hindari memenuhi lima menit dengan seluruh menu AI.

## Gate yang belum tertutup

Belum diverifikasi di audit ini: deployment versi baru di Tencent/Vercel, TLS
publik/domain final, operator permissions, rencana/titik/kontak nyata, studi
warga sasaran, delivery peringatan di luar aplikasi, SLA sumber, kapasitas
deployment nyata, dan dampak lingkungan/evakuasi lapangan. Inovasi ini layak
sebagai prototipe adaptasi komunitas; klaim pilot operasional memerlukan bukti
dan tanggung jawab pengelola yang berbeda.

Aktivasi teknis dan data yang harus diisi dijelaskan di
[runbook sumber asli](../operations/public-sources.md). Hasil pengujian perubahan
ini dicatat di [QA sumber publik](../qa/public-sources-2026-10-13.md).
