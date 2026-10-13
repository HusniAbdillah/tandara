# Aktivasi sumber publik asli untuk demo Tandara

Tujuan: memakai data publik BMKG/PetaBencana di deployment Vercel + Tencent
yang ada, tanpa pemanggilan AI atau pembelian layanan baru. Ini tidak
mengubah laporan/rencana contoh menjadi kejadian nyata. Baca
[audit tiga hari](../product/hackathon-audit-2026-10-13.md) sebelum kurasi.

## 1. Deploy source dan migration terlebih dahulu

Perubahan mencakup dependency XML, migration `009_public_warnings`, kontrak
API/OpenAPI, worker, UI Warga/Posko dan Compose. Deploy commit lengkap melalui
workflow **Deploy demo** setelah CI untuk SHA yang sama berhasil. Jalankan
backend dan kedua frontend pada versi yang sama. Database tidak perlu di-seed
ulang dan jangan menjalankan `down -v`.

Commit berada di lokal sampai dikirim ke remote; dokumen ini tidak merupakan
bukti bahwa workflow sudah berjalan atau domain sudah memakai source baru.
Lihat [deploy-demo](deploy-demo.md) untuk variable/secrets dan gate CI.

## 2. Opt-in di Tencent

Set di `/opt/tandara/.env`:

```dotenv
ALLOW_LIVE_SOURCES=true
```

Compose deployment sekarang membaca variable ini dengan default `false`.
Setelah memakai release baru, jalankan pada terminal Tencent:

```bash
cd /opt/tandara
sudo docker compose --project-name tandara-demo --env-file /opt/tandara/.env \
  --env-file /opt/tandara/current/release.env \
  -f /opt/tandara/current/backend.compose.yml up -d --force-recreate \
  --wait --wait-timeout 180 api worker
```

Ini membuat ulang API/worker agar environment baru berlaku; tidak memerlukan
build ulang untuk perubahan flag saja. Menambahkan konektor/migration/kontrak
baru tetap memerlukan deployment image baru. Tidak ada GitHub Secret baru,
token BMKG atau API key PetaBencana yang ditambahkan oleh implementasi ini.
Jangan mengubah `AI_MODE` untuk mengaktifkan sumber publik.

Pastikan release dipasang di `current/backend.compose.yml` sesuai script
release yang ada. Jika layout operator berbeda, gunakan path release yang
benar. Verifikasi tanpa menampilkan seluruh environment/container secrets:

```bash
sudo docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' \
  tandara-demo-api-1 | grep '^ALLOW_LIVE_SOURCES='
sudo docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' \
  tandara-demo-worker-1 | grep '^ALLOW_LIVE_SOURCES='
```

## 3. Konfigurasi sumber di Posko sebagai admin

Pilih wilayah fokus → **Sumber informasi** → konfigurasi sumber baru. Gunakan
mode `live`, izin penggunaan ditinjau, enabled. Jangan mengubah fixture menjadi
live: buat sumber terpisah agar provenance tidak bercampur.

| Field           | BMKG peringatan                                                         | BMKG prakiraan                                                | PetaBencana                                                            |
| --------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Nama            | BMKG — peringatan dini Jakarta                                          | BMKG — Bidara Cina                                            | PetaBencana — laporan banjir Jakarta                                   |
| Provider        | `bmkg_nowcast`                                                          | `bmkg`                                                        | `petabencana`                                                          |
| URL dokumentasi | `https://data.bmkg.go.id/peringatan-dini-cuaca/`                        | `https://data.bmkg.go.id/prakiraan-cuaca/`                    | `https://docs.petabencana.id/routes/laporan-urun-daya`                 |
| Lokasi/config   | Provinsi `DKI Jakarta` (alias `Jakarta` diterima)                       | adm4 `31.75.03.1002` hanya untuk Bidara Cina                  | admin `ID-JK`                                                          |
| Catatan lisensi | Data publik BMKG; wajib atribusi BMKG; cakupan/waktu asli dipertahankan | Data publik BMKG; atribusi; prakiraan bukan peringatan banjir | Data PetaBencana CC BY 4.0; atribusi; urun daya belum ditinjau Tandara |

Nilai di atas adalah contoh fokus Jakarta, bukan default untuk setiap wilayah.
Nama provinsi harus sesuai CAP/feed BMKG; selain alias Jakarta dan Kepulauan
Riau, pencocokan mengabaikan kapitalisasi/spasi/tanda baca, bukan menebak.
Kode adm4 diperiksa terhadap lokasi respons. Seed Ciliwung memiliki batas
ilustratif, bukan polygon administrasi resmi; jangan mempresentasikannya
sebagai batas resmi. Peringatan hanya diimpor jika polygon beririsan dengan
batas yang diatur pengelola. Laporan PetaBencana hanya diimpor jika titiknya
beririsan dengan batas itu.

Klik refresh lalu tunggu worker. Enqueue sukses belum berarti source sync
sukses. Periksa health/last-success di Posko dan Warga. CAP dijadwalkan dua
menit; prakiraan/crowd tiga puluh menit. Warga memeriksa API setiap satu menit
saat online; scheduling/retry/network dapat menambah jeda. Tidak ada janji
pengiriman dalam dua menit atau background push ke perangkat tertutup.

## 4. Periksa ketepatan data

- Buka URL asli, terbit/berlaku/berakhir, dan nama sumber. `observedAt` kosong
  berarti waktu pengamatan tidak diketahui; waktu produksi/publikasi berada
  di `issuedAt`.
- Bandingkan peringatan dengan wilayah, bukan hanya nama provinsi. Jika tidak
  ada irisan/masa berlaku sudah habis/feed kosong, tidak ada active warning
  yang ditampilkan. Itu tidak berarti wilayah aman.
- Setelah kegagalan, timestamp lama tidak berubah; record berakhir sesuai
  masa berlaku. Public source health tidak membocorkan config/credentials.
- PetaBencana tidak menyalin raw text/contact; tanggal publikasi dan atribusi
  tetap tersedia. `created_at` bukan jaminan waktu observasi kejadian.
- Jangan mengaktifkan loopback/model live untuk membaca feed ini. API sumber
  tidak dipanggil langsung dari browser, sehingga tidak terkena CORS source.

Probe lokal, setelah build backend, bersifat read-only:

```powershell
pnpm build:packages
node tooling/probe-public-sources.mjs
```

Probe tidak memuat `.env`, mengirim data ke AI, mengubah DB atau mengaktifkan
sumber. Hasil bertanggal/hashes ada di `.local/public-source-evidence.json`.
Setiap probe juga menyimpan `.local/public-source-evidence-<timestamp>.json`
agar pengambilan berikutnya tidak menghilangkan salinan audit sebelumnya.
File itu untuk bukti audit, bukan data yang boleh dibuat tampak selalu baru.

## 5. Ganti konten lokal secara sah

Kurasi satu wilayah nyata dengan batas bersumber, organisasi/pemilik pengelola,
kontak resmi bertanggal dan rencana yang dapat ditinjau. Editor yang ada sudah
menyediakan catatan accessibility dan sumber kontak; gunakan itu. Boleh
menerbitkan rencana tanpa titik jika titik sah belum tersedia; jangan mengambil
bangunan dari peta lalu mengklaimnya sebagai shelter.

Sumber rencana yang belum tersedia → empty state. Reviewer belum berbeda dari
penulis → belum publish. Titik belum diperiksa → jangan berlabel aman/siap.
Region simulation flag dan report APP_MODE berbeda: mengubah flag wilayah
tidak otomatis membuat laporan baru menjadi production incident. Pertahankan
mode demo untuk pengujian; gunakan konteks terpisah untuk pilot resmi.

## 6. Rehearsal akhir

Periksa HTTPS/API, refresh sumber dan tanggal expiry di domain Warga/Posko,
login, human review, rencana offline setelah refresh, queued draft setelah
koneksi kembali, dan kegagalan sumber. Uji satu perangkat seluler. Simpan
backup sebelum freeze. Jangan memaksa feed nonempty saat penjurian: jelaskan
empty state atau tampilkan arsip asli bertanggal secara terpisah.

Konektor ini melengkapi kanal BMKG dan koordinasi komunitas; belum ada
pengiriman SMS/push/WhatsApp, dispatch, atau bukti peringatan diterima seluruh
warga. Bukti readiness/impact harus berasal dari pengujian nyata, bukan
menghitung jumlah feed sebagai jumlah orang yang terlindungi.
