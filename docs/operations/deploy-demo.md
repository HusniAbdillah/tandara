# Deployment otomatis demo Tandara: Vercel + Tencent

Target demo tiga minggu, domain `tandara.my.id`, VPS `43.129.33.176`.
Ini persiapan deployment; konfigurasi belum dipasang pada akun/server pengguna.
Tidak memerlukan Heroku, Redis, object-storage service, atau public container registry.

## Hasil akhir

| Alamat                      | Layanan                               |
| --------------------------- | ------------------------------------- |
| https://tandara.my.id       | Warga, project Vercel `tandara-warga` |
| https://posko.tandara.my.id | Posko, project Vercel `tandara-posko` |
| https://api.tandara.my.id   | Caddy/API di Tencent                  |

GitHub Actions membangun frontend dan backend. Sesudah CI berhasil pada commit
main yang sama, workflow menguji production image, mengirim image privat lewat
SSH, membackup database existing, menjalankan migration, melakukan seed hanya
pada bootstrap pertama, menunggu backend sehat, lalu menerbitkan dua frontend.
Frontend tidak dibangun di VPS atau melalui Git integration Vercel; workflow
memakai [Build Output API](https://vercel.com/docs/build-output-api/configuration)
dan [prebuilt deployment](https://vercel.com/docs/cli/deploy).

`DEPLOY_ENABLED` belum disetel berarti workflow deployment dilewati. CI tetap
berjalan. Tidak ada job yang membutuhkan password root atau Tencent API key.

## Jalur utama: persiapan dari console Tencent, tanpa SSH/SCP laptop

Untuk console yang masuk sebagai `ubuntu`, jalankan `sudo -i`. Periksa dahulu
`ss -lntp` dan, jika Docker tersedia, `docker ps`; jangan menghentikan layanan
existing. PostgreSQL demo tidak menerbitkan port host 5432.

```bash
install -d -m 700 /root/tandara-setup
ssh-keygen -t ed25519 -f /root/tandara-setup/tandara-ci -C tandara-github-actions -N ""
```

Jangan menimpa key existing. Buka `infrastructure/deployment/bootstrap-tencent.sh`
dari editor/repository, salin seluruh isinya ke file server menggunakan
`nano /root/tandara-setup/bootstrap-tencent.sh`, lalu jalankan:

```bash
bash /root/tandara-setup/bootstrap-tencent.sh /root/tandara-setup/tandara-ci.pub
nano /opt/tandara/.env
chown tandara-deploy:tandara-deploy /opt/tandara/.env
chmod 600 /opt/tandara/.env
```

Isi `.env` dengan lima variable dari `tencent.env.example`, password database
hex dari `openssl rand -hex 24` dan password demo unik. Konfigurasi domain,
firewall, secrets, aktivasi workflow dan verifikasi akhir dijelaskan di bawah.

Ambil host key langsung dari console dan uji akses key melalui loopback:

```bash
awk '{print "43.129.33.176", $1, $2}' /etc/ssh/ssh_host_ed25519_key.pub > /root/tandara-setup/tencent-known-hosts
ssh-keygen -lf /root/tandara-setup/tencent-known-hosts
ssh -i /root/tandara-setup/tandara-ci -o HostKeyAlias=43.129.33.176 -o UserKnownHostsFile=/root/tandara-setup/tencent-known-hosts -o StrictHostKeyChecking=yes -o BatchMode=yes tandara-deploy@127.0.0.1 'test -f /opt/tandara/.env && docker compose version'
```

Bandingkan fingerprint dengan `/etc/ssh/ssh_host_ed25519_key.pub`. Isi private
key masuk langsung ke `TENCENT_SSH_PRIVATE_KEY` melalui dashboard GitHub; isi
known-hosts masuk ke `TENCENT_SSH_KNOWN_HOSTS`. Jangan membagikan private key di
chat, repository, screen sharing atau rekaman. Setelah workflow remote berhasil,
hapus salinan private key setup yang tidak diperlukan dari server; authorized
public key tetap diperlukan untuk deployment berikutnya. Loopback tidak menguji
firewall publik; workflow menguji akses SSH dari runner GitHub.

Untuk menjalankan CLI Vercel dari Tencent tanpa memasang Node pada host:

```bash
install -d -m 700 /root/tandara-setup/vercel
docker run --rm -it -v /root/tandara-setup/vercel:/workspace -w /workspace node:24.20.0-alpine sh
```

Di dalam container, gunakan `npx --yes vercel@63.1.2` sebagai pengganti
`pnpm dlx vercel@63.1.2` pada langkah project/link di bawah. Login, buat kedua
project, lalu link ke folder `warga` dan `posko` untuk mengambil orgId/projectId.
Keluar dengan `exit`; container sementara dihapus dan data login/link berada
dalam folder privat setup. Setelah semua konfigurasi selesai, data login setup
yang tidak diperlukan dapat dibersihkan. Build aplikasi tetap di GitHub Actions.

File workflow harus di-commit/push ke main terlebih dahulu, CI harus berhasil,
dan `DEPLOY_ENABLED` baru diaktifkan setelah akses, DNS dan secrets siap.
Langkah laptop berikut adalah alternatif, bukan syarat deployment.

## 1. Persiapan laptop dan SSH key

Pakai Node 24.20.0 dari `.node-version` dan pnpm 10.26.2. Node 22.13.1 yang
sebelumnya aktif tidak cukup untuk React Router di lockfile; minimum alternatif
Node 22 sekarang 22.22.0. Install frozen lockfile terlebih dahulu.

Di PowerShell, buat key khusus GitHub Actions pada lokasi baru:

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE/.ssh/tandara-ci" -C "tandara-github-actions"
```

Jika file sudah ada, pilih nama baru; jangan overwrite key yang sedang dipakai.
Untuk key otomatisasi ini, kosongkan passphrase ketika diminta. Private key
nanti masuk GitHub Secrets; file `.pub` boleh dikirim ke server. Jangan kirim
private key/password ke chat atau commit keduanya.

## 2. Masuk Tencent sekali

Di console Tencent Lighthouse, pilih **Ubuntu-3udk → Login** untuk membuka
terminal server. Form **Create connection configuration** yang menanyakan
IP, protocol, username dan password adalah alternatif akses GUI, bukan syarat
otomatisasi. Jika menggunakannya, pilih SSH/22/root untuk akses awal sesuai akun
server; jangan menganggap nama koneksi itu memasang Docker atau menghubungkan CI.

Untuk akses pertama, gunakan kredensial server yang diatur di Tencent. Jika
belum mempunyai akses, atur password/key melalui console dan pastikan sesi
terminal dapat dibuka. Seluruh langkah awal berikut dijalankan di server sebagai
root; deployment berikutnya memakai `tandara-deploy`.

Jika terminal console masuk sebagai `ubuntu` (bukan root), gunakan
`sudo -i` sebelum menjalankan perintah administrasi di server. Untuk SCP dari
laptop, gunakan `ubuntu@43.129.33.176` sesuai akun SSH yang tersedia, bukan
mengasumsikan root login diizinkan.

Periksa server sebelum memasang layanan:

```bash
uname -m
free -h
df -h /
ss -lntp
docker ps # jika Docker sudah terpasang
```

Image pipeline ditargetkan linux/amd64; server harus x86_64. Port 80/443 harus
tersedia. Jika sudah ada aplikasi/proxy yang memakai port tersebut, integrasikan
ingress terlebih dahulu; jangan menghentikan aplikasi lain secara acak.

Kirim dua script/config dan public key dari laptop; ini bisa lewat fitur upload
console atau SCP setelah host key root connection diverifikasi:

```powershell
scp infrastructure/deployment/bootstrap-tencent.sh root@43.129.33.176:/tmp/tandara-bootstrap.sh
scp infrastructure/deployment/tencent.env.example root@43.129.33.176:/tmp/tandara.env.example
scp "$env:USERPROFILE/.ssh/tandara-ci.pub" root@43.129.33.176:/tmp/tandara-ci.pub
```

Pada terminal Tencent:

```bash
bash /tmp/tandara-bootstrap.sh /tmp/tandara-ci.pub
test -e /opt/tandara/.env || install -m 600 -o tandara-deploy -g tandara-deploy /tmp/tandara.env.example /opt/tandara/.env
nano /opt/tandara/.env
```

Bootstrap menggunakan repository Docker Ubuntu resmi, membuat user/key,
direktori privat, dan cron backup lokal. Docker yang sudah terpasang tidak
diinstall ulang; Compose plugin harus tersedia. [Instalasi resmi Docker](https://docs.docker.com/engine/install/ubuntu/).
User dalam group Docker memiliki akses yang setara root terhadap host: lindungi
key tersebut dan batasi siapa yang bisa mengubah main/secrets.

Isi `.env`:

```dotenv
API_DOMAIN=api.tandara.my.id
WEB_ORIGINS=https://tandara.my.id,https://posko.tandara.my.id
POSTGRES_PASSWORD=<hasil openssl rand -hex 24>
DEMO_PASSWORD=<password unik minimal 12 karakter>
SEED_DEMO_ON_FIRST_DEPLOY=true
```

Jalankan `openssl rand -hex 24` di server untuk menghasilkan password database.
Gunakan password demo berupa alfanumerik/hex atau kutip dengan benar; file ini
harus kompatibel dengan Bash dan Compose. Jangan memakai placeholder literal.
Jangan mengisi `APP_MODE=production`: aplikasi ini tetap simulasi; runtime
NODE_ENV=production sudah ditetapkan Compose.

Password/URL database hanya tersimpan di server. Jangan taruh di Vercel,
VITE variables, GitHub artifacts atau repository. Mengedit POSTGRES_PASSWORD
setelah volume pertama dibuat tidak mengubah password PostgreSQL otomatis.
Seed ulang juga tidak merotasi password akun existing.

## 3. SSH host key dan firewall

Bootstrap menampilkan fingerprint host. Bisa diperiksa ulang pada console:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Ambil public host key dari laptop ke file lokal lalu cocokkan fingerprint dengan
hasil console yang independen, bukan langsung mempercayai hasil keyscan:

```powershell
New-Item -ItemType Directory -Force .local | Out-Null
ssh-keyscan -t ed25519 43.129.33.176 | Set-Content -Encoding ascii .local/tencent-known-hosts
ssh-keygen -lf .local/tencent-known-hosts
ssh -i "$env:USERPROFILE/.ssh/tandara-ci" -o UserKnownHostsFile=.local/tencent-known-hosts -o StrictHostKeyChecking=yes tandara-deploy@43.129.33.176 "docker compose version"
```

Jika Windows `ssh-keyscan` gagal dengan `choose_kex: unsupported KEX method
sntrup761x25519-sha512@openssh.com`, ambil public host key langsung dari console
Tencent yang sudah terbuka; tidak perlu mengubah algoritma SSH server. Pada server:

```bash
awk '{print "43.129.33.176", $1, $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

Salin satu baris output tersebut, lalu di PowerShell:

```powershell
$tencentHostEntry = Read-Host 'Paste satu baris public host key dari console Tencent'
$tencentHostEntry | Set-Content -Encoding ascii .local/tencent-known-hosts
ssh-keygen -lf .local/tencent-known-hosts
```

Cocokkan fingerprint dengan hasil `ssh-keygen -lf` pada console. Ini adalah
public host key server, berbeda dari private key deployment.

Setelah fingerprint cocok, isi file tersebut menjadi secret
TENCENT_SSH_KNOWN_HOSTS. Port nonstandar membutuhkan known-hosts entry
`[host]:port`; target pipeline default port 22.

Pada firewall Lighthouse izinkan TCP 80/443. TCP 22 perlu bisa dijangkau laptop
dan GitHub hosted runner; runner memakai IP dinamis. Bila port 22 dibuka internet
untuk demo, gunakan SSH key dan matikan password authentication setelah key login
benar-benar berhasil. Pastikan SSH configuration dengan `sshd -t` dan cek hasil
effective `sshd -T` sebelum reload. Jangan mengunci akses awal sebelum key diuji.
Host firewall juga harus mengizinkan koneksi tersebut. Jika UFW digunakan,
izinkan SSH dahulu, baru 80/443, sebelum enable.

Tidak ada port host PostgreSQL, worker, maupun API 3000 yang dipublish. Docker
port publication memiliki interaksi khusus dengan UFW; jangan memakai UFW
sebagai alasan membuka database. Backend Compose hanya menerbitkan Caddy 80/443.

## 4. Dua project Vercel Hobby

Login sebagai pemilik akun yang akan melakukan deployment; gunakan Hobby untuk
demo nonkomersial dan jangan mulai Pro trial. Project dibuat tanpa Git integration,
agar frontend tidak dirilis lebih dahulu daripada CI/backend.

```powershell
pnpm dlx vercel@63.1.2 login
pnpm dlx vercel@63.1.2 project add tandara-warga
pnpm dlx vercel@63.1.2 project add tandara-posko
pnpm dlx vercel@63.1.2 project inspect tandara-warga
pnpm dlx vercel@63.1.2 project inspect tandara-posko
```

Gunakan scope akun yang sama untuk kedua project. Pilih framework **Other**,
Root Directory kosong/root, dan tidak perlu menambahkan environment database/AI.
Pipeline meng-upload hasil static build, bukan meminta Vercel menjalankan build.
[Project CLI](https://vercel.com/docs/cli/project).

Jika sudah meng-import Git repo ke Vercel, disconnect Git integration untuk
pipeline ini supaya tidak terjadi dua jalur deploy berbeda. Repository tetap
private di GitHub. Deployment dilakukan pemilik akun melalui token; tidak perlu
menambahkan paid team seats untuk teman yang membantu mengatur DNS.

Pada Settings → Domains masing-masing project:

- Warga: tambah `tandara.my.id`.
- Posko: tambah `posko.tandara.my.id`.

Pastikan production domain tidak memaksa juri login ke Vercel. Login aplikasi
Posko tetap berlaku. Uji akses dalam incognito sebelum membagikan link.

Ambil **Project ID** setiap project dari Settings → General. Untuk Org ID,
`vercel link` di dua folder `.local/vercel-link/warga` dan `.local/vercel-link/posko`
dapat menghasilkan `.vercel/project.json` berisi orgId/projectId, atau ambil
identifier scope dari dashboard. Gunakan folder khusus ini, bukan folder
packaging `.local/deploy`, karena packager menolak reuse folder lama.
[Project linking](https://vercel.com/docs/cli/link).

Buat Vercel access token untuk akun/scope tersebut, beri expiry setelah masa
demo, dan simpan langsung sebagai GitHub Secret. Jangan taruh token pada file
terversioning atau Vercel frontend environment.

## 5. DNS milik teman

Provider DNS belum diketahui. Teman cukup membuka panel DNS domain; nameservers
tidak wajib dipindah ke Vercel.

| Record        | Nilai                                                              |
| ------------- | ------------------------------------------------------------------ |
| A `api`       | `43.129.33.176`                                                    |
| Apex/root `@` | Ikuti record yang diminta dashboard project Warga                  |
| CNAME `posko` | Ikuti target project-specific yang diminta dashboard project Posko |

Hapus/ubah hanya record yang konflik dengan tiga hostname ini; pertahankan MX,
TXT atau record layanan lain yang dipakai teman. Jangan menggunakan wildcard
untuk semua subdomain. Jika ada AAAA lama untuk API yang menunjuk server lain,
perbaiki record itu agar HTTPS tidak berpindah ke endpoint yang salah.

Vercel menerbitkan sertifikat FE setelah DNS verified. Caddy meminta sertifikat
API pada deploy pertama, sehingga A record API dan 80/443 harus siap dahulu.
[DNS/domain Vercel](https://vercel.com/docs/domains/set-up-custom-domain).

## 6. GitHub Secrets dan Variables

Repository: HusniAbdillah/tandara → Settings → Secrets and variables → Actions.
Gunakan **repository secrets**, bukan environment berbayar/approval tambahan.

| Secret                        | Isi                                                               |
| ----------------------------- | ----------------------------------------------------------------- |
| TENCENT_SSH_PRIVATE_KEY       | Seluruh isi private key khusus deployment, termasuk header/footer |
| TENCENT_SSH_KNOWN_HOSTS       | Public host key entry yang sudah diverifikasi melalui console     |
| VERCEL_TOKEN                  | Token pemilik project                                             |
| VERCEL_ORG_ID                 | orgId/scope yang sama bagi dua project                            |
| VERCEL_RESIDENT_PROJECT_ID    | Project ID Warga                                                  |
| VERCEL_COORDINATOR_PROJECT_ID | Project ID Posko; berbeda dari Warga                              |

| Variable         | Isi                                               |
| ---------------- | ------------------------------------------------- |
| TENCENT_SSH_HOST | `43.129.33.176` (sudah menjadi default)           |
| TENCENT_SSH_PORT | `22` (sudah menjadi default)                      |
| DEPLOY_ENABLED   | `true` hanya setelah server, secrets dan DNS siap |

Tidak perlu Tencent API key, password root, Heroku token, atau registry token.
Nilai token/key tidak perlu dikirim ke chat. GitHub Actions memakai standard
Ubuntu runner dan kuota akun private repository; pastikan paid usage tidak
diaktifkan bila ingin biaya tunai nol dan pantau sisa minutes. Tidak ada image
yang diterbitkan ke registry atau disimpan sebagai artifact jangka panjang.

## 7. Aktivasi otomatis

Review dan commit file deployment, kemudian push/merge ke main. Jangan memasukkan
`.env`, private keys, atau perubahan unrelated ke commit. Setelah CI pada commit
itu berhasil, `Deploy demo` akan berjalan jika DEPLOY_ENABLED=true.
Untuk retry, buka Actions → Deploy demo → Run workflow pada **main**. Workflow
tetap menolak commit yang belum lolos CI atau main revision yang sudah tertinggal.

Urutan yang bisa dilihat di Actions:

```text
CI main sukses pada SHA yang sama
→ periksa secrets dan SSH
→ build/package Warga + Posko
→ build backend production tanpa dev dependencies
→ smoke image dalam database sintetis terisolasi
→ transfer SSH/checksum/image ID
→ backup DB existing, migration, seed sekali, backend healthy
→ deploy Warga lalu Posko ke Vercel
→ periksa halaman dan API melalui domain final
```

Pemindahan backend memakai [docker save/load](https://docs.docker.com/reference/cli/docker/image/save/)
melalui SSH; tag image memakai commit SHA dan digest konfigurasi image diverifikasi. Server
tidak melakukan git clone, pnpm install, atau build. DB/Caddy data persisten
pada Docker volumes bernama project `tandara-demo`.

Digest portable dihitung dari config yang dirujuk `manifest.json` dalam arsip
`docker save`, termasuk referensi layer rootfs. Setelah load, server mengekspor
ulang tag tersebut melalui pipe dan membandingkan digest config. Nilai `.Id`
dari `docker image inspect` tidak dibandingkan langsung antarhost karena store
containerd dan classic dapat menampilkan digest manifest/index versus config.
Checksum arsip transfer tetap diperiksa sebelum load. Verifikasi ulang memakai
stream agar tidak membuat salinan tar tambahan di disk VPS.

Tidak ada rollback database otomatis. Pada kegagalan release, script mencoba
menjalankan image/config aplikasi sebelumnya; itu hanya aman bila migration
kompatibel dengan versi sebelumnya. FE deployment belum menjadi transaksi
atomik: jika Posko gagal setelah Warga berhasil, retry workflow main yang sama
dan jaga kompatibilitas API antarversi.

## 8. Pemeriksaan pertama dan demo juri

Pada server sebagai tandara-deploy:

```bash
cd /opt/tandara
docker compose -p tandara-demo --env-file .env --env-file current/release.env -f current/backend.compose.yml ps
curl --fail https://api.tandara.my.id/ready
docker compose -p tandara-demo --env-file .env --env-file current/release.env -f current/backend.compose.yml logs --tail 50 api worker
docker stats --no-stream
```

Jalankan browser rehearsal pada domain final: login Posko, submit laporan Warga,
receipt, triage/review, private photo, peta, publikasi rencana, offline/reconnect
dan logout. Live DNS/TLS, Vercel cookie/proxy behavior, dan browser flows belum
dibuktikan hanya dari smoke lokal. API no-store dan CSP dipaketkan bersama FE;
headers Caddy tidak diasumsikan otomatis ikut file dist.

Saat ini Caddy tidak mempercayai arbitrary client forwarded headers. Request
melalui Vercel bisa terlihat sebagai IP proxy, sehingga batas laporan 20/jam
dapat terbagi antarjuri pada proxy yang sama. Untuk demo kecil, hindari spam
rehearsal pada database demo; bila terbentur, konfigurasi trusted proxy/IP secara
terverifikasi terlebih dahulu, jangan mempercayai semua header kiriman browser.

Cron membuat dump privat di `/opt/tandara/backups` setiap hari. Backup ini lokal,
belum encrypted offsite. Download ke laptop dan simpan terenkripsi sebelum
penjurian. Untuk membuat backup sekarang:

```bash
bash /opt/tandara/current/backup.sh
```

Jangan menjalankan `down -v` pada tandara-demo; itu menghapus database.
Restore ke database terpisah terlebih dahulu, bukan menimpa database demo.
Batasi media sintetis, pantau disk 40 GB, dan jangan memakai `docker system prune`
secara membabi buta karena image rollback dan proyek lain mungkin diperlukan.

Sesudah rehearsal final, set DEPLOY_ENABLED=false untuk membekukan demo;
container tetap berjalan. Setelah tiga minggu, backup lalu stop layanan jika
sudah tidak diperlukan. Menonaktifkan workflow saja tidak menghentikan VPS.
Heroku tidak digunakan oleh konfigurasi ini.

## Status verifikasi

Dieksekusi lokal pada 13 Oktober 2026 dengan Node 24.20.0, pnpm 10.26.2 dan
Docker Desktop Linux containers:

| Pemeriksaan                                        | Hasil                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Frozen install setelah regenerasi konfigurasi pnpm | Pass; lockfile stabil, versi dependency tidak diubah                                             |
| `pnpm check`                                       | Pass: lint/boundaries, typecheck, 24 unit/HTTP tests dan sembilan build                          |
| `pnpm format:check`                                | Pass                                                                                             |
| Routing/package tests deployment                   | 3 pass; API bypass SPA/no-store, asset fallback dan CSP/origin validation                        |
| Actionlint 1.7.7                                   | Pass untuk CI dan deployment workflow                                                            |
| Bash syntax dan ShellCheck 0.11.0                  | Pass untuk bootstrap/release/backup/smoke scripts                                                |
| Caddy 2.10.2 config validation                     | Pass; ini bukan bukti sertifikat domain sudah diterbitkan                                        |
| Build backend linux/amd64                          | Pass; runtime non-root, tanpa TypeScript development dependency, sekitar 303 MB uncompressed     |
| Production image smoke                             | Pass: tiga migration, seed, readiness API, worker heartbeat, cookie flags/CSRF/logout/revocation |
| Dump dan restore sintetis                          | Pass dalam database terpisah; dua seed regions dikembalikan                                      |
| Vercel static packaging                            | Pass lokal dengan dummy project identifiers; belum upload/deploy ke akun Vercel                  |

Smoke memakai project `tandara-smoke-*` terisolasi lalu membersihkan hanya
container/network/volume uji tersebut. Database aplikasi lain tidak digunakan.

Masalah yang ditemukan dan diselesaikan: minimum Node lama tidak memenuhi
engine React Router; Vitest paralel berbenturan pada cache Windows sehingga
test workspace diserialkan; pnpm portable deployment kini memakai lockfile
dengan injected workspace dependencies; migration/worker health menjalankan
module dari konteks backend; health probe menutup pool pg secara eksplisit.
Client frontend juga diperbaiki agar POST tanpa body (logout, refresh, mark-read,
retry) tidak mengirim JSON Content-Type kosong yang ditolak Fastify.

Pada pemeriksaan awal, setup VPS, secrets, remote workflow, Vercel dan domain
belum dilakukan. Pengguna kemudian menyiapkan akun/server dan menjalankan
workflow. Run `38373308615` berhasil menguji production image pada runner,
mengirim arsip dengan checksum valid, dan load image pada Tencent. Release
berhenti sebelum migration server karena perbandingan `.Id` antar Docker store.
Perbaikan memakai digest config portable dan menambahkan delapan regression
tests Python. Deployment Vercel, TLS/DNS publik dan rehearsal browser domain
final tetap perlu dibuktikan pada run sesudah perbaikan.
