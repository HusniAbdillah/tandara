# Frontend Tandara: Vercel atau Tencent?

Konteks: demo juri selama tiga minggu, tanpa pengguna operasional, tidak ingin
biaya tambahan. VPS Tencent 2 vCPU/2 GB/40 GB sudah tersedia. Teman pengguna
sudah membeli domain `.my.id`; hostname sebenarnya dan akses DNS belum diberikan.

## Keputusan

**Vercel untuk Warga dan Posko, Tencent untuk API/worker/PostgreSQL/PostGIS adalah
pilihan yang baik untuk memisahkan deployment frontend dari backend. All-Tencent
tetap pilihan dengan perubahan awal paling sedikit.**

Rekomendasi sebelumnya all-Tencent didasarkan pada meminimalkan konfigurasi
deployment pertama; bukan larangan atau ketidakcocokan frontend dengan Vercel.
Dengan dua frontend Vite statis, Vercel cocok. Domain yang sudah dibeli dapat
dipakai pada kedua topologi dan tidak memaksa seluruh aplikasi ke satu provider.

Saya memilih hybrid bila masih ada iterasi UI selama tiga minggu dan integrasi
proxy dapat diuji sebelum penjurian. Bila aplikasi sudah dibekukan dan targetnya
hanya sekali deploy dengan sedikit pengaturan, keuntungan preview Vercel mengecil
dan all-Tencent lebih sederhana. Untuk dua opsi tersebut, backend tetap Tencent;
Vercel saja untuk seluruh produk memerlukan desain ulang worker/data services.

## Perbandingan yang relevan untuk demo

| Kriteria          | Semua Tencent                                        | FE Vercel + backend Tencent                                               |
| ----------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| Kode frontend     | Static dist melalui Caddy                            | Static dist melalui Vercel                                                |
| Perubahan pertama | Konfigurasi domain/TLS dan Compose                   | Dua project/build, DNS, headers dan API rewrites; backend tetap perlu TLS |
| Revisi frontend   | Rilis static assets/image ke server                  | Deploy FE tanpa restart backend; preview sesuai Git/access settings       |
| Build di RAM 2 GB | Hindari dengan build laptop/CI                       | FE dibangun di Vercel, jika build backend juga dipisah                    |
| Distribusi asset  | Dari region VPS                                      | CDN Vercel; keuntungan latency perlu diukur                               |
| RAM runtime       | Caddy static serving ringan                          | Penghematan static serving relatif kecil; DB/Sharp tetap beban utama      |
| API latency       | Browser langsung ke ingress Tencent                  | Ada hop Vercel rewrite ke Tencent; CDN tidak mempercepat SQL              |
| Login/CSRF        | Same-origin lewat Caddy                              | Same-origin lewat rewrite jika cookie/header diteruskan benar             |
| Availability      | FE dan backend mengikuti VPS                         | Asset FE terpisah; transaksi produk masih bergantung VPS                  |
| Domain            | Domain/subdomain ke satu IP                          | DNS root/Posko ke Vercel, API ke VPS                                      |
| Biaya tambahan    | Nol compute selama aset aktif dan trafik dalam paket | Nol FE jika Hobby eligible/dalam limit; Tencent tetap sama                |

Vercel tidak selalu lebih cepat untuk request API; keuntungan paling jelas ada
pada distribusi asset dan workflow deployment FE. Peta juga memakai tile provider
eksternal, sehingga peta lambat belum tentu masalah hosting JavaScript.
All-Tencent juga bisa menyediakan preview/rollback melalui pipeline buatan tim;
bedanya fungsi tersebut harus diatur sendiri.

## Temuan kode dan pengujian baru

`apps/resident-web` menggunakan Vite/React dan vite-plugin-pwa; Posko menggunakan
Vite/React tanpa service worker. Backend tidak di-import oleh kedua browser apps.
Keduanya cocok di-host sebagai file statis, tanpa Node frontend runtime.

Build terfilter diuji pada mesin lokal:

```text
pnpm exec turbo run build --filter=@tandara/resident-web... --filter=@tandara/coordinator-web...
```

Pada percobaan ini Node aktif adalah 22.13.1. Contracts dan UI selesai dibangun,
tetapi build api-client berhenti dengan TS2307: module `zod` tidak ditemukan.
Manifest api-client dan lockfile sudah mencantumkan zod 4.6.7, sedangkan
`packages/api-client/node_modules/zod` tidak tersedia. Ini menunjukkan instalasi
dependency lokal tidak lengkap, bukan bukti bahwa frontend tidak kompatibel
dengan Vercel. Frozen install dan build pada Node 24 yang dipin repo harus
berhasil sebelum deployment. Tidak ada instalasi ulang atau perubahan kode
aplikasi dalam review ini; belum ada hasil build penuh atau deploy Vercel yang
berhasil pada turn ini.

## Domain dan DNS

Gunakan pola berikut, dengan `nama.my.id` sebagai placeholder:

| Hostname           | Tujuan                                 | Kegunaan                    |
| ------------------ | -------------------------------------- | --------------------------- |
| `nama.my.id`       | Project resident-web Vercel            | Link utama yang dibuka juri |
| `posko.nama.my.id` | Project coordinator-web Vercel         | Login koordinator/admin     |
| `api.nama.my.id`   | IP Tencent 43.129.33.176 melalui Caddy | Backend HTTPS untuk rewrite |

Domain tidak perlu ditransfer ke Vercel. DNS tetap dapat dikelola pada provider
sekarang. Gunakan record apex/subdomain yang diminta dashboard Vercel, termasuk
project-specific target; jangan menyalin IP/CNAME lama tanpa verifikasi. Record
API dapat berupa A menuju IP Tencent. Tidak perlu wildcard DNS untuk tiga host.
Setiap provider melakukan terminasi TLS untuk host masing-masing.
[Custom domain](https://vercel.com/docs/domains/set-up-custom-domain).

Pada all-Tencent, root dan Posko diarahkan ke VPS lalu Caddy memilih asset sesuai
hostname. Keduanya tetap bisa mempunyai alamat dan sertifikat yang profesional.
Yang perlu tersedia dari pemilik domain adalah akses atau pengaturan DNS.

## Detail terpenting: API proxy dan cookie

Request produk di api-client memakai `fetch('/api/v1' + path)`, credentials include,
dan CSRF dari cookie JavaScript pada host frontend. Session cookie host-only,
HttpOnly, SameSite Strict. Link private attachment juga relatif `/api/v1/...`.

Maka topologi yang direkomendasikan:

```text
Browser -> https://posko.nama.my.id/api/v1/...
        -> Vercel external rewrite
        -> https://api.nama.my.id/api/v1/...
        -> Caddy -> API -> PostgreSQL privat
```

Contoh aturan routing konseptual untuk masing-masing FE:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.nama.my.id/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

API rewrite harus sebelum fallback. Buktikan asset/manifest/service worker tetap
dilayani sebagai file yang benar. Konfigurasi ini contoh untuk direview; tidak
ditambahkan sebagai konfigurasi aktif dan hostname bukan domain pengguna.
[Rewrites](https://vercel.com/docs/routing/rewrites),
[Vite SPA](https://vercel.com/docs/frameworks/frontend/vite).

Browser tidak perlu memanggil api.nama.my.id secara cross-origin. Memiliki
subdomain dengan root yang sama tidak menghilangkan sifat host-only cookie:
cookie di API host tidak otomatis terbaca JavaScript Posko untuk header CSRF.
`VITE_API_BASE_URL` tercatat dalam Turbo tetapi tidak digunakan fetch produk;
mengisi variable itu saja bukan integrasi backend.

Set WEB_ORIGINS ke root dan Posko yang persis, SESSION_SECURE=true, dan jangan
membuka port aplikasi/DB langsung. Verifikasi forwarded IP melalui Vercel/Caddy
sebelum memilih trustProxy; boolean true sekarang memerlukan jalur ingress
terkendali. Bila mapping IP salah, rate limit beberapa juri bisa berbagi key IP.

## Headers, PWA, dan map

Security headers Caddy saat ini tidak ikut berpindah bersama dist. Tambahkan
CSP, Permissions-Policy, Referrer-Policy dan headers lain pada project FE.
Posko mengizinkan tile host OSM serta worker MapLibre; Warga mempunyai policy
lebih ketat. Jangan menghilangkan perbedaan tersebut ketika menyalin headers.

API saat ini memberi Cache-Control no-store. Pastikan edge tidak menimpanya:
session, report detail, tracking, admin dan private photo tidak boleh masuk CDN
cache. Static asset caching bukan kebijakan API caching.
[Cache headers](https://vercel.com/docs/caching/cache-control-headers).

PWA offline bisa berjalan pada Vercel dan Tencent dengan HTTPS. Vercel tidak
otomatis memperbaiki offline behavior; kode Workbox/IndexedDB menentukan data
yang tersedia. Pakai root domain final sejak latihan: storage browser dan
service worker di vercel.app tidak otomatis pindah ke domain custom. Uji update
prompt dengan draft yang belum terkirim, offline reload dan reconnect.

basemap.json di Vercel menjadi static deployment asset, berbeda dari file bind
mount Caddy lokal. Mengubah provider biasanya perlu deploy file baru serta CSP
host yang sesuai. Kecepatan/availability tile tetap mengikuti provider tile,
bukan provider frontend. Secret API/AI tidak boleh dimasukkan ke VITE variables.

## Anggaran nol dan kerja tim

Hobby gratis untuk penggunaan personal nonkomersial dengan quota. Demo akademik
ini adalah kandidat penggunaan yang sesuai, tetapi account/repo context tetap
perlu diverifikasi. Jangan memulai Pro trial sebagai bagian deployment karena
tujuannya tidak memerlukan fitur berbayar.
[Hobby](https://vercel.com/docs/plans/hobby).

Hobby bukan paket semua fitur kolaborasi tim. Public/private repository dan
commit-author rules memengaruhi deploy. Dokumentasi menyatakan private repo
dalam organisasi tidak dapat dideploy ke Hobby dan private collaboration
dibatasi. Pilih workflow deployment yang sesuai repo dan pemilik akun; jangan
membeli Pro atau memalsukan author hanya untuk melewati batas. Pemilik domain
boleh berbeda dari pemilik project, selama ownership/DNS diverifikasi.
[Git deployments](https://vercel.com/docs/git),
[collaboration](https://vercel.com/docs/deployments/troubleshoot-project-collaboration).

## Mengapa bukan seluruh produk di Vercel?

Vercel mendukung NestJS sebagai Function; bukan berarti seluruh backend Tandara
berjalan dengan model sekarang. Worker memiliki loop terus-menerus untuk
schedule/tick, PostgreSQL/PostGIS membutuhkan layanan durable, dan pool koneksi
serta concurrency perlu dirancang untuk Function. Memindahkan semuanya berarti
mengganti worker runtime dan menyiapkan data services. Untuk demo tiga minggu,
usaha tersebut tidak sebanding dengan memanfaatkan VPS yang sudah tersedia.
[NestJS Vercel](https://vercel.com/docs/frameworks/backend/nestjs).

## Kriteria sebelum link dikirim ke juri

1. Frozen install dan build dua FE beserta dependency berhasil pada runtime pin.
2. Domain root/Posko/API verified dan HTTPS aktif; link juri tidak terhalang
   Vercel deployment protection yang tidak dimaksudkan.
3. Login/me/mutation/logout, CSRF dan upload bekerja melalui proxy sebenarnya.
4. Foto/private data tetap scoped dan no-store; API bukan fallback HTML.
5. Deep-link reload, PWA install/offline/reconnect dan map workers berjalan.
6. Worker terus berjalan di VPS, queue diproses, backup sintetis tersedia.
7. FE release dan backend contract kompatibel; deploy dihentikan setelah
   rehearsal akhir. Preview tidak dipakai juri sebagai link final.

**Rekomendasi untuk pembagian komponen: FE Vercel + backend Tencent.**
**Rekomendasi untuk paling sedikit konfigurasi awal: all-Tencent.**
Domain .my.id dapat dipakai keduanya; pilihan sebaiknya ditentukan oleh manfaat
iterasi FE dan hasil pengujian integrasi, bukan asumsi bahwa Vercel diperlukan
agar link demo terlihat profesional atau bahwa VPS diperlukan untuk SPA.
