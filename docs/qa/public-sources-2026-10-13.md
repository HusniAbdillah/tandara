# Verifikasi audit hackathon dan sumber publik

Baseline `main@73ce6e0`, Windows, Node 24.20.0, pnpm 10.26.2, Docker Desktop.
Perubahan disiapkan untuk deployment demo, bukan aktivasi cloud yang sudah
dibuktikan. Lihat [audit produk](../product/hackathon-audit-2026-10-13.md).

## Bukti yang sudah dieksekusi

| Check                                             | Hasil dan batas                                                                                                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen dependency install                         | Pass; XML parser 5.11.2 pinned, workspace injection diselaraskan dalam lockfile                                                                                 |
| `pnpm check` setelah perbaikan polygon collection | Pass: boundaries/lint, typecheck, 108 unit/HTTP tests, sembilan build, tiga AI/privacy tooling tests                                                            |
| Integration regressions                           | 50 pass pada PostGIS/pgvector terisolasi setelah perbaikan final, termasuk kelima source tests; DB fresh berbeda dari dev stack                                 |
| Migration repeatability                           | 001–009 applied; second migration run no-op                                                                                                                     |
| Browser sumber                                    | Tiga pass: active warning/provenance/actions, failed source with retained warning, honest empty feed; axe WCAG A/AA, 390px overflow check dan screenshot        |
| Visual inspection                                 | Screenshot Warga 390px diperiksa; time/source/action hierarchy terlihat dan tidak ada horizontal overflow                                                       |
| Isolated restore                                  | Pass: dump/restore plus subsequent erasure/withdrawal replay; local-only copy of existing restore test adjusted to port 35432/container audit name              |
| Direct public probe                               | 17 Bidara Cina forecasts, satu CAP Jakarta, nol Jakarta crowd flood reports in one-hour window at approximately 21:31 WIB                                       |
| Actual CAP geography                              | Kelima polygon individu valid; sebagai MultiPolygon overlap menghasilkan invalid geometry; GeometryCollection valid, tidak beririsan dengan batas Ciliwung seed |
| Markdown inventory                                | 37 berkas awal, 37 baris audit; link artifact diperiksa                                                                                                         |

Counts di atas merujuk eksekusi tertentu, bukan semua tests berasal dari
timestamp yang sama. Test formatting mengecualikan file PLAN pengguna yang
belum dilacak Git; file versioned dan perubahan baru diperiksa.

## Koreksi yang ditemukan saat verifikasi

- Cold PostGIS extension creation saat Docker build sibuk melampaui batas query
  API lima detik. Migration sekarang memakai timeout DDL 120 detik pada pool
  terpisah; pool query aplikasi tetap lima detik. `SHOW statement_timeout` memverifikasi
  default API `5s` dan migration `2min`. Source polling dan public API
  tidak mendapat timeout yang lebih panjang dari perubahan ini.

- Production-image smoke menangkap parser XML yang hilang dari runtime pruned,
  meskipun local build/tests lulus. Importer backend memiliki dependency baru,
  tetapi snapshot injected backend di lockfile masih tertinggal. Lockfile
  diregenerasi dengan `pnpm install --lockfile-only --fix-lockfile --resolution-only`;
  perubahan hasil regenerasi hanya menambahkan parser pada snapshot tersebut,
  tanpa upgrade versi package lain. Dockerfile sekarang juga mengimpor backend
  dari kedua hasil portable deploy agar graph dependency diperiksa saat build.
  Smoke menampilkan log API/worker sebelum cleanup bila gagal.

- pnpm injected workspace dependencies menghasilkan instance class backend
  berbeda antara import langsung tests dan dependency API. `app.get(JobsService)`
  lalu gagal meskipun API dapat startup. Bootstrap sekarang mengekspor DI tokens
  dari graph API yang sama; integration tests memakai tokens tersebut. 49 tests
  kemudian lulus. Ini tidak mengubah akses/permission endpoint aplikasi.
- CAP memiliki beberapa polygon yang dapat saling tumpang tindih. Masing-masing
  tetap valid; menumpuknya sebagai MultiPolygon keliru. Collection menjaga
  polygon asli, mendukung intersection dan tetap menolak self-intersecting ring.
- Request RSS dengan Python urllib default mendapat 403; User-Agent Tandara
  berhasil. Adapter dan probe menggunakan User-Agent yang mengidentifikasi aplikasi.
- `pnpm format:check` atas seluruh folder melaporkan untracked `docs/PLAN.md`.
  File pengguna tidak diubah. Check atas perubahan/versioned files mengecualikan
  file itu; CI checkout tidak memiliki file untracked tersebut.

## Source-test acceptance

Parser tests memeriksa CAP issuance/validity/axis order, status Test/Exercise,
restricted scope, XML/DTD/entity rejection, hostile link rejection, mismatched
province, missing polygon, invalid windows, Cancel references, empty RSS,
forecast adm4/timezone dan crowd publication expiry/privacy.

PostGIS tests memeriksa warning di dalam/di luar region, overlapping valid
polygon, invalid geometry tanpa menimpa hasil sebelumnya, snapshot kosong,
outage dengan timestamp tetap, minimal public health tanpa config, serta
perubahan konfigurasi selama fetch tanpa publikasi respons lama.

Browser tests memakai fixture berlabel test untuk hasil yang repeatable;
live probe memakai data publik asli dan tidak menulis DB atau menghubungi AI.
Keduanya menguji hal yang berbeda. Test fixtures tidak dimasukkan sebagai
warning live. Isolated database `tandara-audit-db` memakai port 35432 agar tidak
mengubah database/containers development yang sudah berjalan.

## Batas verifikasi

Probe berikutnya setelah 22:00 WIB: 17 forecasts, nol Jakarta CAP dan nol crowd
reports. Ini menegaskan counts snapshot bukan kondisi yang boleh dipaksakan
tetap sama saat demo. Raw CAP/RSS awal disimpan lokal; probe sekarang juga
menyimpan salinan hasil dengan timestamp selain pointer hasil terbaru.

Tidak ada payload warga dikirim ke provider/model berbayar. Tidak ada pengujian
delivery SMS/push, perubahan DNS, akses SSH Tencent, release cloud, penelitian
pengguna sasaran, atau validasi shelter/rute lapangan. Full existing browser
suite pada full Compose belum dijalankan ulang dalam audit ini; tiga browser
cases tambahan dijalankan terhadap UI terbaru dengan intercepted public API.
Perlu full browser workflow dan rehearsal domain final sebelum penjurian.

Data probe berubah sewaktu-waktu. CAP Jakarta pada snapshot tidak cocok dengan
batas Ciliwung contoh, sehingga empty local alert merupakan hasil yang benar.
Jangan mengganti batas/waktu agar warning tampil untuk kebutuhan demo.

## Final verification

- Final `pnpm check`: pass (lint/boundaries, all typechecks, 108 unit/HTTP tests,
  nine production builds, three AI/privacy tooling tests).
- Final PostGIS/pgvector API integration: 50 pass, including five source cases.
- Three added browser cases: pass; axe checks and mobile screenshot inspected.
- Frozen install, OpenAPI generation, formatting excluding unchanged untracked
  PLAN, `git diff --check`: pass.
- Deployment routing/package tests: three pass. Portable image identity tests:
  eight pass. Updated smoke script Bash syntax and ShellCheck: pass.
- Final deployment image `tandara-backend:audit`: portable API/worker dependency
  import checks pass; image smoke passes all nine migrations, seed, API readiness,
  cookie/CSRF checks, worker heartbeat, dump and restored seed-region checks.
- Demo cloud release/TLS and full existing Compose browser suite remain outside
  this verification. No source connector was activated on Tencent by this audit.
