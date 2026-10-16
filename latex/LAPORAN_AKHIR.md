# Hasil revisi proposal Tandara

Revisi 16 Oktober 2026. PDF berisi 10 halaman termasuk cover dan pustaka.
Compiler XeLaTeX, bibliografi Biber dengan gaya biblatex-ieee.

## Berkas utama

- `build/Tandara_Proposal_Sustainability.pdf` — hasil proposal revisi.
- `main.tex` — naskah lengkap.
- `styles/tandara.sty` — layout, overlay, warna, dan penomoran.
- `references.bib` — 19 referensi tersitasi.
- `figures/*.tex` — tujuh diagram/matriks yang dapat diedit.
- `assets/Proposal · Cover.jpg` dan `assets/Header Footer New.png` — aset pengguna.
- `assets/technology/` — logo teknologi vektor dan lisensi Devicon.
- `README.md` — cara compile dan mengganti aset.
- `research/REVISI-16-OKTOBER.md` — catatan revisi dan status akses desain.
- `build/validation.json` — pemeriksaan otomatis PDF.

## Perubahan

Naskah ditulis ulang agar lebih langsung, baku, dan terfokus pada manfaat serta
roadmap. Komentar checkout, klaim pembuktian source, penyangkalan screenshot,
catatan mode deterministik, dan status pendanaan dikeluarkan dari naskah publik.
Caption menjelaskan gambar secara ringkas. Naskah utama halaman 2–9 tidak
menggunakan titik dua atau titik koma. Sitasi mengikuti urutan angka IEEE.

Cover menggunakan gambar penuh. Halaman isi memakai overlay transparan,
latar #F8F8F6, dan nomor halaman otomatis. Diagram digambar ulang, termasuk
arsitektur dengan logo React, NestJS, TypeScript, PostgreSQL, dan Docker.

Informasi gempa tercakup bersama cuaca serta banjir. Rujukan gempa diverifikasi
pada dokumentasi BMKG. Statistik bencana tetap menggunakan tahun data 2024,
dan survei UNDRR dinyatakan sebagai survei global 2023.

## Sumber utama

| Sumber                            | Dukungan isi                                          |
| --------------------------------- | ----------------------------------------------------- |
| BNPB, Data Bencana Indonesia 2024 | 3.472 kejadian bencana dan 1.420 banjir pada 2024     |
| BNPB, pedoman rencana evakuasi    | Perencanaan partisipatif dan pembagian peran          |
| BMKG, dokumentasi cuaca dan gempa | Jenis informasi, format data, dan atribusi            |
| WMO, Early Warnings for All       | Hubungan risiko, komunikasi, serta kesiapsiagaan      |
| UNDRR, survei disabilitas 2023    | Pelibatan kebutuhan akses dalam perencanaan           |
| NIST, WCAG 2.2, UU PDP            | Tinjauan manusia, aksesibilitas, dan tata kelola data |
| UN DESA, SDG 11 dan 13            | Ketangguhan permukiman serta adaptasi iklim           |

18/19 URL atau DOI merespons HTTP 200 pada pemeriksaan terakhir 16 Oktober.
Permintaan otomatis ke DOI Wiley mendapat 403. Metadata dan teks lengkap
artikel Wiley telah diverifikasi melalui penerbit, Crossref, dan NOAA. Tanggal akses awal
mengikuti catatan riset, termasuk 13 Oktober untuk CAP/prakiraan/PetaBencana
serta 15 Oktober untuk riset proposal awal. Gempa baru diakses 16 Oktober.

## Implementasi dan roadmap

Implementasi repository mencakup rencana lokal, checklist, laporan, tanda
terima, tinjauan, penyimpanan offline, pekerjaan PostgreSQL, dan PostGIS.
Aktivasi provider serta konektor tidak dilakukan dalam revisi dokumen ini.
Informasi gempa mengikuti arah produk yang diberikan pengguna. Tidak
disimpulkan bahwa konektor gempa sudah diimplementasikan pada checkout lama.

Pilot, pelatihan pengelola, penguatan alur mobile, dan perluasan multiwilayah
ditulis sebagai rencana pengembangan. Tidak dibuat hasil penelitian lapangan.

## Pemeriksaan desain yang masih memerlukan materi

Metadata publik mengonfirmasi judul Figma “Tandara Warga — A clearer everyday
flow”, file 64n9YH2tieTKiDBHbYJoXZ. Detail node 177:5155 belum dapat dibaca.
Plugin terpasang, tetapi alat pembaca layer dan screenshot tidak tersedia
pada sesi ini. Ekspor frame utama diperlukan untuk mencocokkan alur secara rinci.

Dua screenshot proposal masih memakai gambar asli repository, bukan capture
Figma terbaru. Tidak ada placeholder dan tidak ada gambar aplikasi rekaan.

## Validasi

- PDF dibuka melalui PyMuPDF dan pypdf.
- Tepat 10 halaman, tanpa halaman isi kosong.
- Cover gambar penuh dan overlay pada semua halaman isi.
- Penomoran 02/10 hingga 10/10 otomatis.
- Warna latar isi terukur RGB 248, 248, 246.
- 19 sitasi mempunyai entri, seluruh entri digunakan, dan 19 URL referensi dan 4 tautan produk tertanam.
- Tidak ada missing character, referensi belum stabil, atau overfull box.
- Teks isi berada di area halaman dan terpisah dari header/footer.
- Semua halaman dirender menggunakan PyMuPDF dan Poppler untuk pemeriksaan.

Kode aplikasi tidak diubah dan tes aplikasi tidak dijalankan ulang untuk
revisi dokumen. Perubahan pengguna yang sudah ada tetap dipertahankan.

## Tautan akses produk

Halaman 10 kini memuat Tandara Warga, Tandara Posko, repository GitHub,
dan desain Figma dalam kotak Akses produk sebelum daftar pustaka. Keempat
alamat dicetak dan memiliki target hyperlink HTTPS yang telah diperiksa.

## Landasan jurnal

Dua artikel ditambahkan pada halaman 2 dan 7. Pemetaan klaim ke bagian
serta halaman artikel dicatat dalam research/VERIFIKASI-JURNAL.md.
Identitas jurnal telah dibandingkan dengan Crossref dan PDF teks lengkap.
Pustaka memakai 19 referensi dan tetap menggunakan gaya IEEE. Judul laporan
menaut ke sumber resmi, sedangkan artikel jurnal menampilkan DOI.
