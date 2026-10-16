"""Reproducible file/document coverage without reading private env or vendor files."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "latex/research"
tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=REPO).decode("utf-8").split("\0")
text_types = {".ts", ".tsx", ".js", ".mjs", ".json", ".yaml", ".yml", ".css", ".md", ".tf", ".sh", ".ps1", ".py", ".html", ".svg", ".toml"}
rows = []
documents = []
for relative in sorted(p for p in tracked if p and not p.startswith("latex/")):
    p = REPO / relative
    if not p.is_file() or (p.name.startswith(".env") and p.name not in {".env.example", ".env.production.example"}):
        continue
    data = p.read_bytes()
    row = {"path": relative, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    if p.suffix in text_types or p.name.startswith(("Dockerfile", "Caddyfile")):
        text = data.decode("utf-8", errors="replace")
        row["lines"] = len(text.splitlines())
        if p.suffix == ".md":
            row["headings"] = re.findall(r"^#{1,6} .+", text, re.M)
            documents.append(row)
        if "migrations/" in relative:
            row["tables"] = re.findall(r"CREATE TABLE(?: IF NOT EXISTS)?\s+([a-z_]+)", text, re.I)
        if "controller.ts" in relative:
            row["routes"] = re.findall(r"@(Get|Post|Patch|Delete|Put)\('([^']*)'\)", text)
    rows.append(row)
result = {"revision": subprocess.check_output(["git", "rev-parse", "HEAD"],cwd=REPO,text=True).strip(),
          "files": rows, "markdown_count": len(documents),
          "example_pdfs": [p.name for p in (REPO / "docs/proposal/example").glob("*.pdf")]}
(OUT / "repository-inventory.json").write_text(json.dumps(result, indent=2,ensure_ascii=False), encoding="utf-8")
lines = ["# Inventaris dokumentasi repository", "", "Peta isi untuk audit; bukan pernyataan semua baris kode telah direview.", "", f"HEAD: `{result['revision']}`; {len(rows)} berkas tracked; {len(documents)} Markdown.", ""]
for doc in documents:
    lines += [f"## {doc['path']}", f"{doc['lines']} baris; SHA-256 `{doc['sha256']}`", "", *[f"- {h.lstrip('# ')}" for h in doc["headings"]], ""]
(OUT / "PETA-DOKUMEN.md").write_text("\n".join(lines),encoding="utf-8")
print(f"Inventoried {len(rows)} tracked files and {len(documents)} Markdown documents")
