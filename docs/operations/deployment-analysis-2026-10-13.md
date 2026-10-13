# Analisis deployment Tandara: Vercel, Heroku, dan Tencent

Tanggal analisis: 13 Oktober 2026, Asia/Bangkok. Checkout: `main`,
`11bd325028b9922991750db422d61fd4739951cd` (`Bulk/everything (#3)`).

## 1. Keputusan yang disarankan

Review khusus setelah domain `.my.id` dikonfirmasi tersedia ada di
[frontend-hosting-decision-2026-10-13.md](frontend-hosting-decision-2026-10-13.md).
Review itu membedakan hybrid untuk workflow frontend dari all-Tencent untuk
perubahan deployment pertama paling sedikit; domain dapat dipakai keduanya.

**Kebutuhan pengguna: hidup tiga minggu, hanya untuk juri, tanpa pengguna
operasional dan tanpa pembayaran tambahan. Pilihan dengan konfigurasi awal
paling sedikit adalah seluruh stack di Tencent yang sudah dibayar; pilihan
hybrid untuk workflow frontend dibahas dalam review khusus di atas.**

Jalankan dua frontend static, Caddy, API, worker dan PostgreSQL/PostGIS bersama.
Tidak perlu Redis, storage server, inference berbayar, atau pemisahan provider.
Gunakan domain yang sudah tersedia atau subdomain gratis untuk HTTPS, tanpa
menambah langganan. Pastikan paket traffic masih tersedia; biaya tambahan nol
bergantung tetap berada dalam allowance dan tidak memesan resource lain.

Untuk beberapa orang yang menjalankan demo, 2 vCPU / 2 GB / 40 GB merupakan
starting point yang wajar diuji. Fokus validasi adalah rehearsal alur juri,
upload foto kecil, memori/health, worker dan offline sync, bukan kapasitas ratusan
pengguna. Build image di laptop/CI lalu kirim ke server agar build tidak
mengganggu demo pada RAM 2 GB. Simpan backup demo di laptop, gunakan data
sintetis, dan hindari perubahan menjelang penjurian. Kapasitas belum diukur
pada server itu dan aplikasi lain pada server belum diperiksa.

Heroku tetap bisa memenuhi biaya nol dengan FE Vercel dan Eco API/worker +
Essential-0 ($10/bulan sebelum kredit). Kekurangannya adalah cold start serta
worker ikut tidur ketika web tidak aktif, sehingga alur pertama yang dibuka juri
perlu dibangunkan dan dicek sebelumnya. Pool Eco 1.000 jam dibagi per bulan:
dua dyno selama 21 hari membutuhkan 1.008 jam jika seluruh periode berada
dalam satu pool; penggunaan demo intermiten jauh lebih rendah, dan periode
melintasi awal bulan memperoleh reset pool. [Eco](https://devcenter.heroku.com/articles/eco-dyno-hours).

Ada opsi tambahan karena Basic dan data add-on ditagih prorata, berbeda dengan
subscription Eco. Jika periode kira-kira 13 Oktober–3 November 2026, backend
Basic API $7 + Basic worker $7 + Essential-0 $5 berpotensi tetap tercakup kredit
student: sekitar $12 pada Oktober dan $1–2 pada November, dengan asumsi tidak
ada penggunaan lain dan resource dihentikan tepat setelah demo. Ini estimasi,
bukan jaminan invoice; satu periode 21 hari dalam bulan 30 hari mendekati
$13,30 sehingga tidak otomatis memenuhi batas $13. Perhatikan waktu UTC billing,
biaya release/one-off, dan penggunaan lain. Database tetap ditagih meskipun
dyno dihentikan; backup dulu lalu hapus add-on hanya setelah data tidak lagi
dibutuhkan. [Prorata billing](https://devcenter.heroku.com/articles/usage-and-billing).

Walaupun Heroku bisa masuk kredit, Tencent dipilih karena lebih dekat dengan
Docker yang tersedia, tidak tidur berdasarkan kunjungan, dan tidak memerlukan
pengaturan runtime Heroku maupun pemantauan kredit. Vercel FE menjadi opsi
tambahan bila preview frontend diinginkan, bukan kebutuhan demo tiga minggu.
Analisis pilot, skalabilitas, dan variasi provider di bagian berikut tetap
menjadi referensi untuk kebutuhan masa depan, bukan prasyarat demo ini.

## 2. Dasar dan batas verifikasi

Dokumen yang ditelaah: README, PRD, TDD, Implementation-Plan, ARCHITECTURE,
DELIVERY, requirements-matrix, security/model, operations/runbook,
features/map, QA validation, rebase-validation, dan performance.json.
Kode yang diperiksa mencakup entry point API/worker, Fastify bootstrap, client,
cookie/session, konfigurasi environment, database pool/migrations, laporan/foto,
SQL jobs, Vite/PWA, Dockerfile, Compose, Caddy, dan workflow CI.

Catatan sebelumnya dipakai untuk orientasi lalu diperiksa terhadap checkout.
Kode sekarang jauh melampaui fondasi sebelumnya. Metadata branch pada DELIVERY
dan requirements-matrix masih mencatat keadaan pengiriman lama; HEAD sekarang
sudah berada di main. Untuk keputusan deployment, gunakan kode dan arsitektur
implementasi terbaru, bukan seluruh rencana historis dalam PRD/TDD.

QA yang tersimpan melaporkan 23 unit/HTTP, 23 integration, dan 11 browser tests,
serta restore backup. Itu bukti pengujian terdahulu yang tersedia dalam repo;
suite tersebut tidak dijalankan ulang dalam analisis ini. performance.json
mencatat p95 sekitar 17–29 ms pada data sintetis lokal, 100 sampel per endpoint
dan concurrency 5. Angka ini bukan kapasitas server Tencent maupun latency Indonesia.

Pemeriksaan runtime lokal terhambat: Docker Desktop Linux engine tidak aktif,
dan interpolasi Compose menunjukkan DEMO_PASSWORD belum tersedia. Tidak ada
pengukuran RAM/container yang berhasil diperoleh. Tidak ada akses SSH ke Tencent,
pemeriksaan live akun billing, provisioning, atau deployment dalam pekerjaan ini.

Aset Tencent 2 vCPU / 2 GB / disk 40 GB, expiry 25 Mei 2027, serta kredit Heroku
$312 mengikuti informasi pengguna. Region, bandwidth, traffic allowance, disk
terpakai, aplikasi lain, dan ketentuan kredit belum diketahui. Nama instance
dan alamat IP tidak cukup untuk mengonfirmasi region.

## 3. Kebutuhan nyata aplikasi sekarang

| Komponen    | Implementasi                                              | Implikasi hosting                                                                          |
| ----------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Warga       | React/Vite static SPA dan PWA, Dexie/IndexedDB            | Cocok untuk Vercel atau static Caddy; HTTPS untuk penggunaan publik                        |
| Posko/admin | React/Vite static SPA, MapLibre, React Query              | Cocok untuk Vercel; admin bagian dari Posko, tidak membutuhkan app hosting ketiga          |
| API         | NestJS/Fastify, SQL transactions, cookie auth, Sharp      | Proses Node persisten cocok di VPS/dyno; upload foto perlu pengujian memori                |
| Worker      | Nest application context, loop polling SQL                | Proses terpisah yang berjalan terus; harus tetap hidup tanpa kunjungan frontend            |
| Database    | PostgreSQL 16/PostGIS; citext dan pg_trgm                 | Ketiga extension harus tersedia; colocate dengan API/worker                                |
| Queue       | Outbox PostgreSQL, SKIP LOCKED, lease dan retry           | Redis tidak dibutuhkan oleh consumer saat ini                                              |
| Foto        | Re-encode JPEG, EXIF dihapus, private bytea di PostgreSQL | Media menambah ukuran DB, WAL, backup dan waktu restore                                    |
| AI          | Heuristic default; adapter compatible server-side         | Tidak perlu menjalankan model lokal pada VPS 2 GB; inference eksternal punya biaya sendiri |
| Integrasi   | BMKG/PetaBencana opt-in; InaRISK reference-only           | Deployment tidak otomatis mengaktifkan source live                                         |
| Peta dasar  | Tile provider eksternal, fallback local layers            | Hosting frontend tidak menyediakan tile service atau SLA peta                              |

Kekuatan proyek: struktur sembilan package dan batas import jelas; API dan worker
memakai backend bersama; penerimaan laporan dan pekerjaan triage disimpan dalam
transaksi yang sama; idempotency dan revision guards mengurangi duplikasi;
cookie/session disimpan melalui hash; review dan approval tetap manusia;
private attachments memiliki otorisasi; offline cache tidak menyimpan API
privat. Ini memberi dasar deployment yang cukup jelas tanpa memerlukan microservices.

Perbedaan penting dari desain historis:

- PRD/TDD menyebut Redis/BullMQ dan S3; implementasi sekarang memakai SQL outbox
  dan bytea. Dependency BullMQ serta REDIS_URL masih ada, tetapi consumer saat
  ini tidak menghubungi Redis. REDIS_URL tetap wajib lolos parser environment.
- TDD melarang gambar binary dalam DB; implementasi sengaja memakai pendekatan
  tersebut untuk simulasi. Ini perlu keputusan arsitektur terdokumentasi sebelum
  volume foto besar, bukan alasan membeli object storage sebelum adapter tersedia.
- APP_MODE hanya menerima `simulation`. Mengisi `production` pada APP_MODE akan
  gagal; NODE_ENV=production tetap dapat dipakai untuk hosting simulasi.
- Notifikasi sekarang in-app dan beberapa layar melakukan polling. Belum ada
  kebutuhan deployment WebSocket atau layanan pengiriman pesan eksternal.

## 4. Kapasitas Tencent yang dimiliki

PRD §16.4 merencanakan minimum demo 2 vCPU, RAM 4 GB, disk 80 GB. Tencent yang
dimiliki memenuhi CPU tetapi setengah RAM/disk minimum rencana tersebut.
Angka PRD adalah asumsi desain, bukan hasil benchmark. Stack aktual lebih
ringkas karena tanpa Redis dan object-storage server, sehingga demo ringan
pada 2 GB layak dicoba setelah pengukuran. Belum layak dinyatakan mampu
menangani 500 warga bersamaan dari asumsi TDD.

Yang berpotensi membatasi:

1. Sharp menerima hingga 16 juta pixel. Decode empat channel saja dapat
   mendekati 64 MB untuk satu gambar, sebelum buffer lain, overhead native,
   dan request bersamaan. File JPEG 2 MB tidak berarti penggunaan RAM 2 MB.
2. PostgreSQL berbagi RAM/CPU dengan dua proses Node. Spatial query, sorting,
   koneksi aktif dan cache disk membutuhkan ruang tambahan.
3. Dockerfile melakukan install dan seluruh build; runtime app masih menyalin
   node_modules hasil build yang mencakup tooling development. Runtime image
   belum menggunakan hasil dependency pruning khusus production.
4. Disk 40 GB dibagi untuk OS, image/container, DB/WAL, logs, dan backup.
   Penghapusan foto tidak selalu langsung mengecilkan file fisik DB.
5. Worker memproses satu job per tick, sedangkan source dan triage berbagi
   consumer. Pantau umur antrean, bukan hanya proses hidup.

Saran awal: build image di CI, push ke registry, lalu Tencent hanya pull dan
menjalankan image. Batasi upload concurrency dan gunakan resource limits
berdasarkan pengukuran. Sisakan sekitar 20–30% memori sebagai sasaran operasional;
ini target pengujian, bukan hasil yang sudah dicapai. Swap kecil bisa menjadi
buffer terhadap lonjakan, tetapi tidak menggantikan RAM dan dapat memperburuk latency.
Jangan menambah Redis, MinIO, atau monitoring stack berat pada mesin ini tanpa kebutuhan.

Memindahkan frontend ke Vercel mengurangi transfer asset dan beban build jika
pipeline juga diubah, tetapi penghematan RAM runtime static Caddy biasanya
lebih kecil daripada PostgreSQL/Sharp. Vercel tidak otomatis menyelesaikan
masalah memori backend.

Contoh pertumbuhan foto, asumsi eksplisit rata-rata JPEG tersimpan 300 KB:

| Skenario          | Perhitungan                                           | Pertumbuhan foto selama 30 hari |
| ----------------- | ----------------------------------------------------- | ------------------------------- |
| Demo aktif        | 100 laporan/hari × 50% memakai foto × 1 foto × 300 KB | Sekitar 450 MB                  |
| Pilot lebih ramai | 500 laporan/hari × 50% × 2 foto × 300 KB              | Sekitar 4,5 GB                  |

Ini hanya byte foto, belum tabel/index/WAL/backups. Kode membolehkan tiga foto
per laporan dan batas DB 2 MB per foto; rata-rata 300 KB bukan batas yang dijamin.
Retensi saat ini menjadwalkan satu job harian yang menghapus maksimal 200 laporan
expired. Jika laporan expired masuk lebih cepat, backlog akan tumbuh walaupun
disk ditambah. Perlu drain bertahap dengan batas kerja dan monitoring backlog.
Completed jobs dan audit juga perlu kebijakan retensi yang disepakati.

## 5. Perbandingan opsi dan biaya

Estimasi tarif USD/bulan, berdasarkan dokumentasi resmi yang dibaca pada tanggal
analisis. Belum termasuk pajak, domain, object storage/backup, inference, tile
provider, transfer tambahan, dan kenaikan resource setelah load test.
Tencent dihitung sebagai **tambahan biaya compute terhadap langganan yang
sudah dibayar**, bukan biaya kepemilikan nol selamanya.

| Opsi | Penempatan                                    | Estimasi biaya dasar tambahan                             | Penilaian                                                                          |
| ---- | --------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A    | Dua FE Vercel; API/worker/DB Tencent          | $0 bila Hobby eligible, atau Vercel Pro mulai $20         | Pilihan utama untuk pengembangan frontend dan pemanfaatan VPS                      |
| B    | Semua di Tencent                              | $0 tambahan compute sebelum expiry, tanpa upgrade         | Perubahan paling dekat dengan stack Docker sekarang                                |
| C    | Dua FE Vercel; API/worker/DB Heroku           | $23 dengan Essential-1; tambah Vercel Pro bila diperlukan | Alternatif managed dengan latensi region perlu diuji                               |
| D    | Semua Heroku; dua FE app terpisah             | $37 dengan Essential-1                                    | Mudah dipisah per app, tetapi dyno FE menambah biaya                               |
| E    | Semua Heroku; FE digabung dengan satu web/API | $23 dengan Essential-1                                    | Lebih murah, membutuhkan static serving/domain routing baru                        |
| F    | Vercel + API/worker Heroku + DB Tencent       | $14 untuk dua Basic dyno                                  | Tidak disarankan: SQL melewati jaringan antarprovider                              |
| G    | Vercel + API/worker Tencent + DB Heroku       | $9 dengan Essential-1                                     | Mengurangi operasi DB, tetapi koneksi lintas region/provider buruk untuk stack ini |
| H    | FE/API Vercel; worker dan DB di tempat lain   | Tergantung usage dan data services                        | Memerlukan adaptasi serverless; manfaat saat ini kecil                             |

Rincian C/E: API Basic $7 + worker Basic $7 + Postgres Essential-1 $9 = $23.
Rincian D: dua FE Basic $14 + API Basic $7 + worker Basic $7 + DB $9 = $37.
Essential-0 $5 memberi total C/E $19, tetapi disk DB 1 GB sempit dengan foto.
Essential-1 memberi 10 GB dengan 20 koneksi; Essential-2 $20 memberi 32 GB/40
koneksi, sehingga API/worker Basic + Essential-2 menjadi $34.
Basic 512 MB per proses adalah starting point, bukan jaminan cukup saat upload.
[Harga Heroku](https://www.heroku.com/pricing/),
[batas database](https://devcenter.heroku.com/articles/heroku-postgres-plans).

Vercel Hobby ditujukan untuk penggunaan personal nonkomersial. Kelayakan demo
hackathon perlu mengikuti konteks penggunaannya; jangan menganggap seluruh
platform komunitas otomatis memenuhi syarat. Pro memiliki platform fee $20,
satu deploying seat termasuk; seat deploy tambahan dan usage dapat menambah
tagihan. Dua proyek FE tidak otomatis berarti membayar dua platform fee.
[Hobby](https://vercel.com/docs/plans/hobby),
[Pro](https://vercel.com/docs/plans/pro-plan).

Lighthouse menghitung outbound traffic dalam allowance paket dan excess traffic
dapat ditagih. Paket tertentu punya aturan berbeda. Verifikasi bundle pengguna
langsung sebelum menganggap trafik unlimited. Masa berlaku 25 Mei 2027 adalah
batas aset yang ada, bukan jaminan biaya renewal.
[Billing Lighthouse](https://www.tencentcloud.com/document/product/1103/41403).

### Koreksi setelah konfirmasi kredit student $13/bulan

Pengguna mengonfirmasi kredit GitHub Student. Saldo $312 adalah alokasi program
24 bulan dengan pemakaian maksimal $13 setiap bulan. Sisa kredit bulanan tidak
roll over; $312 tidak bisa dipakai sekaligus atau dianggap saldo fleksibel untuk
menutup paket $23 selama 13,6 bulan. Perhitungan lama tersebut tidak berlaku.
Kredit mencakup produk Heroku, bukan add-on pihak ketiga atau Vercel.
[Ketentuan student](https://help.heroku.com/Z3RHNRHD/how-does-the-heroku-for-github-students-program-work).

Dengan FE di Vercel dan tanpa Redis, berikut opsi tambahan:

| Backend Heroku                                | Total per bulan | Tambahan setelah kredit maksimal $13 | Trade-off                                                                   |
| --------------------------------------------- | --------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| Eco web + Eco worker + Essential-0            | $10             | $0                                   | Dua dyno berbagi 1.000 jam; app dan worker tidur saat tidak ada web traffic |
| Eco web + Eco worker + Essential-1            | $14             | $1                                   | Disk 10 GB; batas tidur/jam tetap sama                                      |
| Basic API + Basic worker + Essential-0        | $19             | $6                                   | Dua proses selalu aktif; disk DB 1 GB                                       |
| Basic API + Basic worker + Essential-1        | $23             | $10                                  | Lebih sesuai struktur sekarang; disk 10 GB                                  |
| Satu Basic untuk API dan worker + Essential-0 | $12             | $0                                   | Memerlukan integrasi runtime dan berbagi 512 MB; belum dibuktikan cukup     |

Biaya tambahan mengasumsikan seluruh kredit masih tersedia untuk Tandara pada
bulan tersebut. Release/one-off dyno dan produk akun lain dapat menambah biaya;
angka tabel adalah baseline, bukan hard cap billing.

Eco adalah alternatif valid untuk demo yang menerima cold start dan jeda
background processing. Di app yang sama, web tidak menerima traffic selama
30 menit menyebabkan web dan Eco worker tidur. Dua dyno penuh selama 30 hari
memerlukan 1.440 dyno-hours, melebihi pool 1.000. Pool dapat mencukupi demo
intermiten, tetapi perlu dipantau. Worker-only app tidak tidur otomatis, namun
tetap menghabiskan pool bersama. Health monitoring berkala dapat mencegah tidur.
[Eco hours](https://devcenter.heroku.com/articles/eco-dyno-hours).

Opsi Basic tunggal $12 tidak tersedia hanya dengan mengecilkan jumlah dyno:
entry point API sekarang tidak menjalankan JobsService loop. Perlu worker loop
terintegrasi dengan lifecycle API atau dua proses dengan supervision yang
benar dalam satu dyno. Restart menghentikan keduanya; workload upload, SQL dan
worker berbagi batas memori. Uji shutdown/restart, lease recovery, pool koneksi,
upload concurrency dan antrean sebelum memakai opsi ini untuk demo.

Untuk kredit student tanpa tambahan biaya, rekomendasi Heroku adalah **Eco web
dan worker + Essential-0 untuk demo ringan**, dengan FE di Vercel bila paketnya
eligible. Jika harus selalu aktif dengan entry point terpisah sekarang, tambahan
$6/bulan adalah baseline termurah; $10/bulan memberi DB lebih longgar. Jika
budget tunai benar-benar nol dan layanan harus selalu aktif, Tencent yang sudah
dibayar tetap lebih sesuai tanpa memaksa runtime masuk satu dyno 512 MB.

## 6. Latency dan pemisahan layanan

API melakukan beberapa SQL round trip untuk session, scope, validasi, transaksi,
rate limits dan audit. Worker idle juga menulis heartbeat dan memeriksa jobs
berulang. Karena itu API–worker–DB sebaiknya satu region dan jaringan privat.
Koneksi antarprovider menambah latency berulang, kompleksitas TLS/firewall,
transfer biaya, dan ketergantungan terhadap dua jaringan.

Heroku Common Runtime menyediakan US dan Eropa; Singapore berada pada Private
Spaces. Maka paket Basic ekonomis tidak memberi penempatan Singapore yang sama.
Vercel mempercepat distribusi asset; request API tetap bergantung lokasi backend.
Pilih region Heroku setelah benchmark dari Indonesia, bukan asumsi US atau EU
pasti paling cepat. [Region Heroku](https://devcenter.heroku.com/articles/regions).

Region Tencent belum diketahui. Bila Singapore atau region dekat dengan routing
baik ke Indonesia, Tencent berpotensi lebih cocok untuk API. Itu inferensi
geografis yang tetap membutuhkan pengukuran. Jika mesin berada jauh atau
bandwidth kecil, keunggulan tersebut dapat hilang.

Memecah API di Heroku dan worker di Tencent dengan DB yang sama juga tidak
memberi redundansi DB. FE tetap terbuka ketika Tencent mati bukan berarti
laporan baru dapat diterima: hanya asset dan data offline tersimpan yang mungkin
tersedia. Hybrid FE tidak menjadikan backend highly available.

## 7. Deployment Vercel yang sesuai kode

Buat dua project dari monorepo, untuk resident-web dan coordinator-web.
Dependency workspace harus ikut tersedia; install frozen lockfile dan build
dependency graph Turbo, bukan menyalin app folder sendiri.
Contoh command dari root repository:

```text
pnpm exec turbo run build --filter=@tandara/resident-web...
pnpm exec turbo run build --filter=@tandara/coordinator-web...
```

Output masing-masing `apps/resident-web/dist` dan `apps/coordinator-web/dist`.
Jika Root Directory dipilih per app, output relatifnya `dist` dan command harus
disesuaikan agar tetap menggunakan root workspace. Pin Node 24/pnpm 10.26.2
yang sesuai repository dan uji hasil install/build pada provider.
[Monorepo Vercel](https://vercel.com/docs/monorepos).

Client produk memakai fetch relatif `/api/v1`; attachment juga menggunakan URL
relatif. `VITE_API_BASE_URL` tercatat dalam Turbo, tetapi tidak dipakai request
produk sekarang. Mengisi variable itu saja tidak menghubungkan frontend ke backend.

Pertahankan browser same-origin dengan external rewrite:

```text
warga.<domain>/api/* -> https://api.<domain>/api/*
posko.<domain>/api/* -> https://api.<domain>/api/*
```

Rewrite API harus mendahului fallback SPA; jangan menghilangkan prefix `/api`.
Vite dev proxy bukan konfigurasi deployment. Atur fallback untuk deep-link
frontend, tetapi file asset/PWA harus tetap dilayani sebagai file, bukan HTML.
[Vite SPA](https://vercel.com/docs/frameworks/frontend/vite),
[external rewrites](https://vercel.com/docs/routing/rewrites).

Cookie sekarang host-only, HttpOnly untuk session, SameSite Strict, dan CSRF
dibaca dari document.cookie. Direct cross-origin API akan memerlukan perubahan
CORS dan transport CSRF; sibling subdomain pun tidak membuat cookie host-only
di api.<domain> terbaca oleh JavaScript di posko.<domain>. Proxy same-origin lebih
sesuai implementasi. Buktikan Set-Cookie, login/me/logout, CSRF dan upload melalui
proxy provider sebelum menyatakan deployment berhasil.

Salin kebijakan CSP/security headers yang saat ini disediakan Caddy ke Vercel,
dengan kebijakan Warga dan Posko yang berbeda. Gunakan WEB_ORIGINS exact,
SESSION_SECURE=true. Jangan cache `/api/*` atau foto privat di CDN. External
rewrite dapat mengikuti header cache upstream; API saat ini memberi no-store,
tetapi periksa bahwa konfigurasi edge tidak mengubahnya.

Preview FE harus mengarah ke backend/DB staging, bukan DB publik utama.
Domain preview perlu allowance yang terkendali; jangan membuka wildcard untuk
semua vercel.app agar write request lolos. Uji IP klien pada rantai
Vercel → Caddy/Heroku → Fastify: salah trustProxy dapat menyatukan limit seluruh
pengguna pada IP proxy atau menerima forwarded-IP yang dapat dipalsukan.

## 8. Perubahan sebelum Tencent dapat melayani domain publik

Compose sekarang bind web ke 127.0.0.1:8080/8081, Caddy menonaktifkan HTTPS,
dan SESSION_SECURE default false. Jadi upload file lalu menjalankan Compose
belum menghasilkan deployment publik yang benar.

Perlu konfigurasi khusus deployment:

- Caddy domain/TLS dengan port publik 80/443, volume persisten untuk sertifikat,
  dan API/database di network privat. SSH dibatasi; PostgreSQL tidak dipublish.
- Untuk all-Tencent, serve kedua dist melalui hostname berbeda dan API lewat
  masing-masing origin. Template Caddy produksi masih memakai /srv/resident dan
  /srv/coordinator, sedangkan Dockerfile menyalin ke /srv/warga dan /srv/posko:
  samakan path. Template juga belum membawa semua headers/health routes lokal.
- Untuk Vercel hybrid, Tencent Caddy hanya perlu endpoint HTTPS API; tidak
  membutuhkan Vite server atau dua Node frontend proses.
- Secrets unik, password DB dan akun demo diganti/dibatasi. Seed otomatis pada
  migrate jangan dijadikan proses bootstrap akun publik tanpa review; seed ulang
  tidak merotasi password akun yang sudah ada. Demo Posko sebaiknya akses terbatas.
- Build/push image melalui CI setelah checks, deploy image immutable dengan
  release SHA, jalankan migration sekali per release dan simpan versi sebelumnya.
  Workflow saat ini hanya checks; GHCR publish/deploy belum diimplementasikan.
- Resource/log limits, monitoring disk/RAM, `/ready`, worker heartbeat/queue age,
  backups terenkripsi di luar VPS dan uji restore. Skrip backup sekarang PowerShell
  dan Docker lokal; otomatisasi Ubuntu masih perlu dibuat.

Pin image/runtime yang diuji, minimalkan runtime dependencies, dan hindari build
besar berbarengan dengan layanan aktif pada server 2 GB. Snapshot host berguna,
tetapi bukan pengganti database backup offsite yang sudah diuji restore.

## 9. Perubahan khusus alternatif Heroku

Heroku mendukung pnpm dan PostGIS di seluruh paket PostgreSQL menurut dokumentasi
terbaru. Migrasi tetap harus dibuktikan berjalan dengan postgis, citext, pg_trgm
dan izin trigger/index yang dipakai aplikasi.
[pnpm](https://devcenter.heroku.com/articles/nodejs-support),
[PostGIS](https://devcenter.heroku.com/articles/postgis),
[extensions](https://devcenter.heroku.com/articles/heroku-postgres-extensions-postgis-full-text-search).

Belum ada Procfile, heroku.yml atau root start script. API membaca API_PORT,
sedangkan Heroku menyediakan PORT. Diperlukan fallback PORT atau mapping pada
startup command, dan API_HOST=0.0.0.0. Jalankan web dan worker sebagai process
terpisah serta migration sebagai release command. Jangan memakai pnpm dev untuk
deployment. [Node deployment](https://devcenter.heroku.com/articles/deploying-nodejs).

DB pool sekarang max 10 per proses: API + worker dapat memakai hingga 20,
tepat limit Essential-0/1, sebelum release dyno, console, backup dan overlap
deployment. Buat max pool dapat dikonfigurasi; awal 5 API + 3 worker dapat
menyisakan ruang, lalu sesuaikan dengan pengukuran. Terapkan TLS sesuai layanan
dan driver pg; jangan mengandalkan konfigurasi koneksi lokal atau mematikan
validasi sertifikat secara global.

Basic always-on lebih sesuai worker sekarang. Eco pool 1.000 dyno-hours per akun
tidak cukup untuk dua proses yang hidup penuh sekitar 1.440–1.488 jam per bulan;
web juga tidur setelah tidak aktif. [Usage](https://devcenter.heroku.com/articles/usage-and-billing).

Filesystem dyno bersifat sementara. PostgreSQL dalam container/dyno dan volume
Compose lokal tidak bisa dipakai sebagai persistence Heroku. Foto bytea sekarang
bertahan bila berada pada managed DB; bila dipindahkan ke object storage nanti,
gunakan storage privat durable, bukan disk dyno.
[Dyno filesystem](https://devcenter.heroku.com/articles/dynos).

All-Heroku tidak dapat menjalankan Compose sekarang tanpa adaptasi. Dua app FE
terpisah perlu static server dan API proxy; satu web/API gabungan perlu static
serving yang memilih FE dengan hostname tervalidasi atau strategi base path baru.
Vercel FE menghindari tambahan dyno static server tersebut.

## 10. Rencana bertahap dan kriteria keputusan

**Tahap pertama: stabilkan demo hosting.** Konfirmasi region/traffic Tencent,
domain, dan batas kredit. Jika tim bisa mengoperasikan VPS, buat konfigurasi
all-Tencent sebagai jalur terdekat atau Vercel FE + Tencent backend untuk preview
frontend. APP_MODE tetap simulation; akun koordinator dibatasi; tidak memasukkan
data pribadi nyata pada demo.

**Tahap kedua: ukur deployment terpilih.** Dari jaringan Indonesia, ukur cold
dan warm asset load, API latency end-to-end, concurrent text submissions,
concurrent uploads, query peta dan polling Posko, queue age, serta RAM/CPU/disk.
Gunakan data sintetis yang lebih besar daripada seed. Jangan menjalankan tests
yang menghapus/mengubah data pada database operasional.

Kriteria awal yang diusulkan: API standar p95 <500 ms, laporan teks acknowledged
<2 s di luar upload, tidak ada OOM/restart saat burst, antrean pulih setelah
lonjakan dan restart worker, serta ruang disk/memori cadangan yang stabil.
Ini target untuk disepakati dan diuji, bukan SLO yang sudah terpenuhi.

Uji pula deep links, PWA offline/reconnect tanpa duplicate report, login/session
logout/CSRF, private-media isolation dan no-store pada edge, origin denial,
TLS/proxy IP behavior, migration/rollback kompatibel, backup offsite dan restore
database terpisah. FE deploy dan API release harus mempertahankan kompatibilitas
kontrak karena tidak selalu berlangsung serentak.

**Tahap ketiga: persiapan pilot.** Bila 2 GB tidak menyisakan headroom, upgrade
Tencent RAM terlebih dahulu atau pindahkan backend lengkap ke managed platform;
bandingkan harga renewal aktual dan beban operasi tim. Bila foto/backup dominan,
buat private object-storage adapter sebelum hanya menambah ukuran database.
Perbaiki drain retensi, retention jobs/audit dan monitoring antrean. Pilih tile
provider sesuai kapasitas; default OSM publik tidak memberi SLA dan bukan
infrastruktur tile pilot yang dijamin.
[Map deployment](../features/map.md),
[OSM policy](https://operations.osmfoundation.org/policies/tiles/).

Saat masuk data nyata, APP_MODE, bootstrap identitas, kepemilikan organisasi,
rencana/kontak, persetujuan sumber/model, privasi/retensi, dan prosedur incident
perlu diselesaikan bersama pemilik produk. Infrastruktur kecil baik untuk
simulasi tidak boleh dianggap memberikan jaminan layanan kedaruratan.

**Pilihan akhir berdasarkan kondisi:** gunakan Vercel + Tencent ketika ingin
preview FE, biaya compute tambahan rendah dan tim mampu operasi VPS; gunakan
all-Tencent ketika ingin jalur deploy paling dekat dengan kode; gunakan Vercel +
Heroku backend lengkap ketika managed operations lebih penting dan latency
terukur diterima. Untuk saat ini, tiga provider sekaligus tidak memberi manfaat
yang sebanding dengan koneksi data dan biaya operasional tambahannya.
