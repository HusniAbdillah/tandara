"""Render with Poppler and PyMuPDF; retain both for independent visual QA."""
from pathlib import Path
import shutil
import subprocess
import fitz
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "build/Tandara_Proposal_Sustainability.pdf"
OUT = ROOT / "build/render"
OUT.mkdir(exist_ok=True)
for old in OUT.glob("page-*.png"):
    if old.resolve().parent == OUT.resolve():
        old.unlink()
poppler = shutil.which("pdftoppm")
if poppler:
    comparison = ROOT / "build/poppler"
    comparison.mkdir(exist_ok=True)
    for old in comparison.glob("page-*.png"):
        if old.resolve().parent == comparison.resolve():
            old.unlink()
    subprocess.run([poppler, "-r", "120", "-png", str(PDF), str(comparison / "page")], check=True)
for i, page in enumerate(fitz.open(PDF), 1):
    page.get_pixmap(matrix=fitz.Matrix(120/72,120/72), alpha=False).save(OUT / f"page-{i:02}.png")
pages = sorted(OUT.glob("page-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
sheet = Image.new("RGB", (5*310, 2*455), "#e3dfd6")
for i, p in enumerate(pages):
    im = Image.open(p).convert("RGB")
    im.thumbnail((290,420))
    x,y = (i % 5)*310+10,(i//5)*455+8
    sheet.paste(im, (x,y))
    ImageDraw.Draw(sheet).text((x,y+425), f"Halaman {i+1}",fill="#10303d")
sheet.save(ROOT / "build/contact-sheet.jpg", quality=92)
print(f"Rendered {len(pages)} pages with PyMuPDF" + (" and Poppler comparison" if poppler else " (Poppler unavailable)"))
