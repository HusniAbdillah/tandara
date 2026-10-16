"""Validate proposal structure/citations and flag layout/claim issues for review."""
from pathlib import Path
import hashlib
import json
import re
import sys
import fitz
from pypdf import PdfReader
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
NAME = "Tandara_Proposal_Sustainability"
PDF = BUILD / f"{NAME}.pdf"
checks = []

def check(name, condition, details=""):
    checks.append({"check": name, "pass": bool(condition), "details": details})

check("PDF tersedia", PDF.is_file())
if not PDF.is_file():
    raise SystemExit("PDF belum tersedia")
reader = PdfReader(PDF)
doc = fitz.open(PDF)
texts = [p.get_text() for p in doc]
flat = " ".join(" ".join(texts).split())
check("PDF dapat dibuka oleh dua parser", len(reader.pages) == len(doc))
check("Maksimal 10 halaman", 1 <= len(doc) <= 10, f"{len(doc)} halaman")
check("Struktur tepat 10 halaman", len(doc) == 10)
cover_images = doc[0].get_image_info()
check("Cover gambar satu halaman penuh", any(
    abs(img['bbox'][0]) < 1 and abs(img['bbox'][1]) < 1 and
    abs(img['bbox'][2] - doc[0].rect.width) < 1 and
    abs(img['bbox'][3] - doc[0].rect.height) < 1 for img in cover_images))
check("Daftar pustaka pada halaman terakhir", "Daftar pustaka" in texts[-1])
check("Tidak ada halaman isi kosong", all(len(t.strip()) > 200 for t in texts[1:]))
check("Nomor halaman otomatis", all(re.search(rf"0?{i}\s*/\s*10", t)
      for i, t in enumerate(texts, 1) if i > 1))
overlay_size = Image.open(ROOT / "assets/Header Footer New.png").size
check("Header/footer baru pada setiap halaman isi", all(any(
    (img['width'], img['height']) == overlay_size for img in p.get_image_info()) for p in doc[1:]))

source = "\n".join(p.read_text(encoding="utf-8") for p in [ROOT / "main.tex", *sorted((ROOT / "figures").glob("*.tex"))])
bib = (ROOT / "references.bib").read_text(encoding="utf-8")
entries = set(re.findall(r"@\w+\{([^,]+),", bib))
cited = {key.strip() for group in re.findall(r"\\(?:cite|parencite|textcite)\{([^}]+)\}", source) for key in group.split(",")}
check("Semua sitasi mempunyai entri", cited <= entries, str(sorted(cited - entries)))
check("Tidak ada entri bibliografi tak terpakai", entries <= cited, str(sorted(entries - cited)))
check("Referensi eksternal tersitasi", len(cited) >= 10, str(len(cited)))
check("Tidak ada placeholder gambar", not re.search(r"(?i)\bplaceholder\b", source))
for phrase in ["pasti aman", "prediksi banjir", "peringatan resmi dari Tandara", "evakuasi otomatis", "menyelamatkan nyawa", "jaminan"]:
    check("Tanpa frasa klaim: " + phrase, phrase.casefold() not in flat.casefold())
check("Tidak ada glyph pengganti", "\ufffd" not in flat)
log = (BUILD / f"{NAME}.log").read_text(encoding="utf-8", errors="replace")
check("Referensi stabil", not re.search(r"undefined|Please \(re\)run Biber|Rerun to get cross-references right", log, re.I))
check("Tidak ada missing character", "Missing character:" not in log)
overfull = re.findall(r"Overfull[^\n]+", log)
check("Tidak ada overfull box", not overfull, "; ".join(overfull))
outside = []
outside_body = []
body_sizes = []
for i, page in enumerate(doc, 1):
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                if not span["text"].strip():
                    continue
                x0, y0, x1, y1 = span["bbox"]
                if x0 < -1 or y0 < -1 or x1 > page.rect.width + 1 or y1 > page.rect.height + 1:
                    outside.append({"page": i, "text": span["text"][:100], "bbox": span["bbox"]})
                if i > 1 and y0 < 795 and (x0 < 44 or x1 > page.rect.width - 44 or y0 < 75 or y1 > 791):
                    outside_body.append({"page": i, "text": span["text"][:100], "bbox": span["bbox"]})
                if i in range(2,10):
                    body_sizes.append(span["size"])
check("Teks berada dalam halaman", not outside, json.dumps(outside, ensure_ascii=False))
check("Teks isi terpisah dari area header/footer", not outside_body, json.dumps(outside_body, ensure_ascii=False))
check("Latar halaman isi F8F8F6", all(p.get_pixmap(alpha=False).pixel(10,400)[:3] == (248,248,246) for p in doc[1:]))
links = [link.get("uri") for page in doc for link in page.get_links() if link.get("uri")]
check("Tautan referensi tertanam", len(set(links)) >= len(cited), f"{len(set(links))} URL unik")
check("Informasi gempa bumi tercakup", "gempa bumi" in flat.lower())
check("Catatan audit dikeluarkan dari proposal", not any(s in flat.lower() for s in ["checkout", "source saat ini", "1c427ab", "sumber membuktikan"]))
report = {"pdf": str(PDF), "pages": len(doc), "sha256": hashlib.sha256(PDF.read_bytes()).hexdigest(),
          "citation_keys": sorted(cited), "unique_urls": sorted(set(links)), "checks": checks,
          "manual_checks_required": ["Bahasa Indonesia dan ketepatan klaim", "Keterbacaan screenshot/diagram", "Tidak ada overlap dan pemotongan visual"]}
(BUILD / "validation.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
for row in checks:
    print(f"[{'PASS' if row['pass'] else 'FAIL'}] {row['check']} {row['details']}")
if not all(row["pass"] for row in checks):
    sys.exit(1)
