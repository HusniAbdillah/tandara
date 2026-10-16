# Akun demo Posko dan Warga

Pada mode simulasi, halaman masuk dapat menampilkan pilihan akun yang mengisi
formulir. Pengguna tetap menekan **Masuk**. Pilihan ini menggunakan katalog akun
seed dari API, sehingga frontend tidak menyimpan kata sandi di source atau build.
`DEMO_LOGIN_ENABLED=true` berarti kata sandi demo memang dibagikan kepada pengunjung
melalui `/api/v1/deployment`. Jangan gunakan kata sandi pribadi untuk konfigurasi ini.
Mode `APP_MODE=production` menolak konfigurasi demo.

## Akun

| Nama                 | Email atau nomor           | Peran / wilayah |
| -------------------- | -------------------------- | --------------- |
| Koordinator Ciliwung | ciliwung@demo.tandara.test | coordinator     |
| Koordinator Semarang | semarang@demo.tandara.test | coordinator     |
| Administrator Demo   | admin@demo.tandara.test    | admin           |
| Rani Ciliwung        | 081200000001               | Warga Ciliwung  |
| Budi Semarang        | 081200000002               | Warga Semarang  |

Nomor Warga adalah identitas fixture simulasi; tidak ada SMS/OTP yang dikirim.
Kata sandi bersama dikonfigurasi melalui variabel lingkungan `DEMO_PASSWORD` pada lingkungan simulasi.
Nama akun Warga juga tampil pada profil. Pendaftaran Warga baru wajib mengisi nama.
Setelah masuk memakai pilihan Warga, wilayah aktif mengikuti akun demo yang dipilih.

## Lokal

Isi `.env` di root repository:

```dotenv
APP_MODE=simulation
DEMO_LOGIN_ENABLED=true
DEMO_PASSWORD=replace-with-demo-password
```

Dengan database lokal yang sudah berjalan:

```powershell
pnpm db:migrate
pnpm db:seed
# Untuk sinkronisasi akun demo saja pada database yang sudah pernah di-seed:
pnpm db:seed:demo
```

`pnpm db:seed` menambahkan delapan contoh antrean Posko dan 13 laporan Warga yang
terhubung ke akun Rani dan Budi. Contohnya mencakup dua wilayah, permintaan
informasi, penugasan, penanganan, persetujuan, penolakan, penyelesaian, dan umpan
balik. Kontak laporan Warga mengikuti masa retensi wilayah. ID fixture stabil,
jadi seed ulang tidak menggandakan laporan atau menimpa perubahan pada laporan
yang sudah ada. Laporan Warga hanya ditambahkan ke Kampung Ciliwung dan Pesisir
Semarang yang sudah tersedia; seeder laporan tidak membuat wilayah atau organisasi.
`pnpm db:seed:demo` hanya menyinkronkan akun demo.

Jalankan API dan kedua frontend seperti biasa. Restart API setelah mengubah `.env`;
frontend mengambil konfigurasi saat halaman masuk dibuka, tanpa rebuild untuk
perubahan kata sandi. Akun demo menggunakan hash kata sandi yang sama mekanismenya
dengan akun biasa. Sinkronisasi hanya menyentuh lima ID fixture yang dicadangkan;
kata sandi akun lain, peran, dan status suspensi tidak diubah. Sesi fixture dicabut
jika kata sandinya berubah; seed dengan kata sandi sama mempertahankan sesi.

### Jika membuka localhost:8080 / localhost:8081 melalui Docker

Stack `compose.yaml` menyajikan frontend dari image Docker. Build `pnpm build` di
host tidak memperbarui image tersebut. Setelah perubahan source atau env, jalankan:

```powershell
docker compose up -d --build --wait --wait-timeout 180
```

Perintah ini membangun image, menjalankan migrasi/seed pada database stack Docker,
dan membuat ulang container yang berubah. Buka Warga di `http://localhost:8080`
dan Posko di `http://localhost:8081`. Muat ulang browser; bila aplikasi menawarkan
pembaruan, simpan draft lalu muat pembaruan tersebut.

Database stack ini berbeda dari database development yang diekspos pada port
`55432` oleh `pnpm infra:up`. Karena itu seed dari host saja tidak memperbarui akun
di stack `compose.yaml`.

## Deployment Tencent + Vercel

Gunakan tiga nilai yang sama di `/opt/tandara/.env`. Workflow menjalankan migrasi
dan baseline seed saat bootstrap. Pada setiap release ketika demo diaktifkan, Docker
juga menjalankan `demo-seed` untuk akun dan `seed-resident` untuk menambahkan 25
laporan Warga (13 Kampung Ciliwung dan 12 Pesisir Semarang) yang terhubung ke akun
Rani dan Budi. Seeder incremental ini idempoten:
laporan baru masuk ke database demo yang sudah ada tanpa menjalankan ulang seluruh
baseline seed atau menimpa laporan yang sudah tersimpan. Vercel membaca konfigurasi
dari API melalui rewrite `/api`; tidak perlu menambahkan kata sandi ke environment Vercel.

Set `DEMO_LOGIN_ENABLED=false` dan restart API untuk menyembunyikan pilihan serta
menghentikan publikasi kata sandi. Penonaktifan ini tidak menghapus akun.
