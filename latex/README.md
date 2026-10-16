# Proposal Tandara — Sustainability

PDF hasil revisi berada di `build/Tandara_Proposal_Sustainability.pdf`.
A4 portrait, 10 halaman termasuk cover dan daftar pustaka. Revisi editorial
16 Oktober 2026 menggunakan bahasa Indonesia, latar #F8F8F6, dan pustaka IEEE.

## Berkas utama

| Berkas                           | Kegunaan                                                      |
| -------------------------------- | ------------------------------------------------------------- |
| `main.tex`                       | Naskah proposal dengan pembagian halaman                      |
| `styles/tandara.sty`             | Warna, font, grid, overlay, penomoran, dan bibliografi        |
| `references.bib`                 | 19 referensi eksternal tersitasi, termasuk dua artikel jurnal |
| `figures/*.tex`                  | Diagram dan matriks yang dapat diedit                         |
| `assets/Proposal · Cover.jpg`    | Cover satu halaman penuh dari pengguna                        |
| `assets/Header Footer New.png`   | Overlay transparan untuk halaman isi                          |
| `assets/technology/`             | Logo teknologi vektor dan lisensi Devicon                     |
| `assets/screenshots/`            | Gambar aplikasi asli yang dapat diganti                       |
| `assets/fonts/`                  | Plus Jakarta Sans, IBM Plex Mono, dan lisensi                 |
| `research/REVISI-16-OKTOBER.md`  | Catatan revisi, akses Figma, dan sumber gempa                 |
| `ANALISIS.md`                    | Audit implementasi dan kajian contoh proposal 15 Oktober      |
| `research/SUMBER.md`             | Register klaim serta sumber riset                             |
| `research/VERIFIKASI-JURNAL.md`  | Pemetaan klaim ke bagian dan halaman artikel                  |
| `research/journal-metadata.json` | Identitas kedua jurnal dari Crossref                          |
| `build/validation.json`          | Hasil pemeriksaan otomatis                                    |
| `build/QUALITY.md`               | Catatan pemeriksaan visual hasil akhir                        |

## Compile

Gunakan XeLaTeX dan Biber dari MiKTeX atau TeX Live. Paket tambahan yang dipakai
mencakup biblatex-ieee, eso-pic, xurl, fontspec, geometry, microtype, TikZ,
graphicx, booktabs, tabularx, enumitem, tcolorbox, fancyhdr, lastpage, titlesec,
multicol, parskip, caption, csquotes, hyperref, dan bookmark.

Font disertakan sehingga tidak memerlukan pemasangan global. Tidak digunakan
fallback font. Nama font dan aset dibaca relatif terhadap direktori `latex/`.

```powershell
python -m pip install pymupdf pypdf pillow
python -X utf8 latex/scripts/build.py
python -X utf8 latex/scripts/render.py
```

Jalankan dari root repository. `build.py` memanggil XeLaTeX, Biber, lalu dua
putaran XeLaTeX untuk menstabilkan sitasi dan penomoran. Log disimpan di
`build/compile-*.txt`. Untuk pemeriksaan terpisah gunakan
`python -X utf8 latex/scripts/validate.py`.

`render.py` merender seluruh halaman dengan PyMuPDF dan membuat contact sheet.
Bila Poppler tersedia, hasil pembanding juga dibuat. Periksa setiap halaman
setelah mengganti naskah atau gambar. Jangan hanya memeriksa jumlah halaman.

## Cover, header/footer, dan gambar

Cover berukuran 2380 × 3368 piksel dan overlay baru 2388 × 3368 piksel. Keduanya dipasang
pada ukuran A4 penuh. Proporsi aset sangat dekat dengan A4. PNG header/footer
mempertahankan transparansi. Latar isi berasal dari warna LaTeX #F8F8F6.
Nomor halaman merupakan teks otomatis dan ditempatkan di kanan bawah.

Cover tidak memakai header/footer halaman isi atau nomor halaman tambahan. Identitas dan foto
tim menyatu dalam gambar pengguna. Nama lengkap anggota tetap tersedia di
metadata PDF. Teks cover raster tidak dapat dipilih seperti teks halaman isi.

Koreksi spasi pada kalimat terakhir cover berada di `cover-caption.tex`:
"bahkan ketika konektivitas terbatas." Teks ini ditata di atas baris raster
yang salah, dengan warna dan posisi yang sama, tanpa mengubah aset asli.

Untuk mengganti kedua aset, pertahankan ukuran dan nama berkas. Untuk mengubah
posisi isi atau nomor halaman, edit geometry dan fancyfoot pada style.

Screenshot saat ini berasal dari `docs/qa/screenshots/warga-plan.png` dan
`posko-report-detail.png`, arsip QA simulasi 13 Oktober. Crop hanya diterapkan
melalui parameter trim di main.tex, bukan dengan mengubah gambar asli.
Caption menjelaskan isi layar secara singkat. Jika diganti dengan capture baru,
sesuaikan path, trim, dan catatan asal gambar ini. Tidak ada gambar UI rekaan.

Logo teknologi diambil dari proyek Devicon, kemudian dikonversi dari SVG
menjadi PDF vektor. Lisensi MIT disertakan. Untuk menyiapkan ulang aset tersebut
pasang `requests svglib reportlab`, kemudian jalankan
`python -X utf8 latex/scripts/prepare_revision_assets.py`.

## Status akses Figma

Tautan pengguna menunjuk file `64n9YH2tieTKiDBHbYJoXZ`, node `177:5155`, dengan
judul “Tandara Warga — A clearer everyday flow”. Metadata dan thumbnail publik
dapat dibaca. Alat pembaca layer/screenshot Figma tidak tersedia pada sesi
revisi ini. Halaman desain tidak berhasil dibuka melalui akses alternatif.

Karena itu, proposal ini belum dinyatakan telah dicocokkan dengan seluruh layar
Figma terbaru. Naskah memakai alur inti yang terverifikasi di repository dan
koreksi pengguna mengenai cakupan gempa. Rincian navigasi yang belum terlihat
tidak ditebak. Capture Figma dapat dipakai untuk pemeriksaan tahap berikutnya.

## Tautan produk

Halaman 10 memuat kotak **Akses produk** sebelum daftar pustaka. Urutan pertama
adalah aplikasi Warga dan Posko, lalu repository dan desain Figma. Alamat
tercetak dapat dibaca, sedangkan target hyperlink menyimpan URL HTTPS lengkap.

- Tandara Warga: https://tandara.my.id/
- Tandara Posko: https://posko.tandara.my.id/
- Repository: https://github.com/HusniAbdillah/tandara
- Desain Figma: https://ipb.link/product-design-tandara

Pemeriksaan tautan pada 16 Oktober menghasilkan HTTP 200 untuk keempat URL.
Tautan pendek desain mengarah ke file Figma Tandara Warga. Pemeriksaan ini
memastikan respons alamat, bukan pengujian alur aplikasi atau pembacaan layer.

## Data dan bibliografi

Bibliografi memakai `biblatex` dengan `style=ieee`, nomor sesuai urutan sitasi,
judul publikasi asli, URL lengkap untuk sumber web, dan DOI untuk jurnal.
Judul laporan menaut langsung ke dokumen resmi. Entri yang tidak digunakan
telah dihapus. Format ini menjaga ukuran pustaka tanpa mengecilkan font.

- Statistik nasional mengacu pada data BNPB tahun 2024, terbit 2025.
- Survei disabilitas UNDRR adalah survei global 2023.
- Dokumentasi BMKG mencakup CAP cuaca, prakiraan, dan informasi gempa bumi.
- Data gempa menjelaskan magnitudo, kedalaman, lokasi, dan waktu kejadian.
  Tersedianya data BMKG tidak dipakai sebagai bukti konektor gempa sudah aktif.
- Tanggal akses awal CAP, prakiraan, dan PetaBencana adalah 13 Oktober,
  sesuai probe publik yang terdokumentasi dalam repository.
- Referensi riset lain mempertahankan tanggal 15 Oktober. Sumber gempa yang
  baru dibaca pada revisi ini bertanggal 16 Oktober. Tidak dibuat tanggal
  akses 14 Oktober yang tidak tercatat.

Untuk memperbarui referensi, baca sumber primer, edit references.bib,
tambahkan sitasi pada naskah, dan perbarui register sumber. Simpan tanggal akses
sebenarnya per entri. Pemeriksaan ulang URL tidak mengubah akses awal otomatis.

```powershell
python -X utf8 latex/scripts/verify_sources.py
```

Pada pemeriksaan terbaru 16 Oktober, 18/19 URL atau DOI merespons HTTP 200.
DOI Wiley memberi 403 pada permintaan otomatis; identitas dan isi artikelnya
telah diperiksa melalui penerbit, Crossref, dan teks lengkap NOAA. Catatan
terdapat di research/url-checks.json dan research/VERIFIKASI-JURNAL.md.
Status HTTP melengkapi pembacaan isi sumber.

## Penambahan landasan jurnal

Dua artikel terverifikasi ditambahkan pada halaman 2 dan 7. Lindell dan Perry
(Risk Analysis, 2012) mendukung uraian proses penerimaan, perhatian, dan
pemahaman informasi. Sufri dkk. (Progress in Disaster Science, 2020) mendukung
pembahasan keterlibatan komunitas yang berkelanjutan. Tahun mengikuti edisi
jurnal, bukan tanggal terbit daring awal atau tahun dalam akhiran DOI.

research/VERIFIKASI-JURNAL.md mencatat lokasi bukti, metadata, akses teks
lengkap, dan penilaian ruang lingkup klaim. Salinan sumber dan respons
Crossref lengkap berada pada build/journal-source yang diabaikan Git.

## Status prototipe dan roadmap

Rencana lokal, checklist, laporan, tanda terima, tinjauan, penyimpanan offline,
SQL outbox, PostGIS, serta adapter sumber dan model tersedia dalam repository.
Mode triase default memakai aturan lokal. Tidak dilakukan aktivasi provider,
deploy, atau perubahan kode aplikasi untuk revisi dokumen ini.

Pilot komunitas, rencana operasional nyata, target evaluasi, pengembangan
integrasi gempa, dan perluasan wilayah disajikan sebagai rencana pengembangan.
Tidak ada hasil penelitian pengguna atau dampak evakuasi yang dibuat-buat.
Rincian audit implementasi tersedia di ANALISIS.md, terpisah dari naskah publik.
