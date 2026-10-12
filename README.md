# Tandara

Fondasi monorepo untuk **3 developer, 3 hari**: Warga PWA, Posko dashboard,
NestJS/Fastify API, dan worker standalone. Tahap ini menyediakan setup dan batas
arsitektur; autentikasi, laporan, rencana lokal, triage AI, dan sinkronisasi belum diimplementasikan.

## Mulai di Windows / PowerShell

Prasyarat: Node.js **22.23.3 disarankan** (minimum 22.13.1), pnpm **10.26.2**,
dan Docker Desktop dengan Linux containers untuk database lokal.

```powershell
Copy-Item .env.example .env
pnpm install --frozen-lockfile
pnpm infra:up
pnpm build:packages
pnpm db:migrate
pnpm dev
```

Jangan timpa `.env` yang sudah dikonfigurasi. Perintah yang sama dapat dipakai pada
Linux/macOS dengan `cp .env.example .env`.

| Layanan          | Alamat                                           |
| ---------------- | ------------------------------------------------ |
| Warga            | http://127.0.0.1:5173                            |
| Posko            | http://127.0.0.1:5174                            |
| API liveness     | http://127.0.0.1:3000/health                     |
| API readiness    | http://127.0.0.1:3000/ready                      |
| OpenAPI          | http://127.0.0.1:3000/api/v1/system/openapi.json |
| PostgreSQL lokal | 127.0.0.1:55432                                  |
| Redis lokal      | 127.0.0.1:56379                                  |

API bisa boot tanpa database, tetapi `/ready` mengembalikan 503 sampai database
tersedia. Worker hidup tanpa HTTP listener, dalam mode idle; `WORKER_ENABLED=true`
ditolak sampai consumer benar-benar dibuat. Frontend memakai proxy `/api` agar
request tetap satu origin. `.env` root hanya untuk proses server dan Compose;
environment frontend menggunakan `apps/<app>/.env.local` dengan `VITE_API_BASE_URL`
jika perlu (default `/api/v1`). Jangan beri prefix `VITE_` pada secret.

## Struktur dan pembagian kerja

```text
apps/
  resident-web/       # Developer 1: Warga, offline, UX/copy
  api/               # Developer 2: HTTP, auth, API/core integration
  coordinator-web/   # Developer 3: Posko, review UI
  worker/            # Developer 3: background jobs
packages/
  contracts/         # Kontrak browser-safe; perubahan direview kedua konsumen
  api-client/        # Fetch transport + validasi respons
  backend/           # Modul bisnis server bersama API/worker
  database/          # Koneksi, tipe, migrations; Developer 2 pemilik schema
  ui/                # Komponen presentasi + CSS tokens
tooling/             # TS/ESLint/build dan pemeriksaan dependency boundaries
infrastructure/      # Compose lokal dan template routing Caddy
tests/integration/   # Pengujian PostgreSQL nyata
docs/                # PRD, TDD, architecture, ADR, rencana 3 hari
```

Aturan import dipastikan oleh `pnpm lint`. Aplikasi tidak mengimpor aplikasi lain,
frontend tidak mengimpor package server, dan relative import tidak boleh keluar
dari package. Package dibuild menjadi ESM `dist/` dengan ekspor publik. API dan
worker menggunakan TypeScript legacy decorators + metadata untuk Nest; TypeScript
5.9 dipilih karena kompatibel dengan tooling lint yang dipakai.

## Validasi

```powershell
pnpm format:check
pnpm check
pnpm db:migrate
pnpm db:migrate
pnpm test:integration
pnpm api:openapi
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm check` menjalankan lint + boundaries, typecheck, pengujian kontrak/config/
HTTP/client, lalu build. Test HTTP memakai database adapter terkontrol; test
integration memerlukan PostGIS lokal dan migrations. CI menjalankan keduanya.
Unit test tidak memerlukan layanan AI atau Redis.

PWA/service worker hanya dibuat oleh production build. Untuk memeriksa app shell
offline, jalankan `pnpm build`, kemudian `pnpm --filter @tandara/resident-web preview`,
kunjungi satu kali online, dan uji reload offline. Pengujian ini belum membuktikan
offline plan atau report sync. Dashboard tidak memiliki service worker.

## Dokumen acuan

- [Architecture](docs/ARCHITECTURE.md): struktur aktual dan dependency rules.
- [ADR foundation](docs/adr/0001-foundation.md): keputusan dan batas implementasi.
- [Validation](docs/VALIDATION.md): hasil pemeriksaan aktual dan batas pengujian.
- [Implementation Plan](docs/Implementation-Plan.md): pembagian 3 developer dan gates 3 hari.
- [PRD](docs/PRD.md): kebutuhan produk dan fase.
- [TDD](docs/TDD.md): desain teknis; fitur yang direncanakan bukan bukti implementasi.

Media/storage, deployment produksi, login, RBAC, outbox, consumer BullMQ, live AI,
seed laporan, dan business tables adalah pekerjaan berikutnya. Jangan memakai
Compose/credential lokal sebagai konfigurasi produksi.
