"""Read-only link check. HTTP failure requires review, not invented evidence."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import re
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
text = (ROOT / "references.bib").read_text(encoding="utf-8")
sources = []
for entry in re.split(r"(?=@\w+\{)", text):
    key = re.search(r"@\w+\{([^,]+),", entry)
    url = re.search(r"\burl=\{([^}]+)\}", entry)
    doi = re.search(r"\bdoi=\{([^}]+)\}", entry)
    if key and (url or doi):
        sources.append((key.group(1), url.group(1) if url else "https://doi.org/" + doi.group(1)))

def verify(source):
    key, url = source
    row = {"key": key, "url": url, "access_date": datetime.now(ZoneInfo("Asia/Bangkok")).date().isoformat()}
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Tandara-Proposal-Reference-Check/1.0"})
        with urllib.request.urlopen(request, timeout=25) as response:
            response.read(512)
            row.update(status=response.status, final_url=response.url,
                       content_type=response.headers.get("Content-Type"), reachable=True)
    except HTTPError as error:
        row.update(status=error.code, reachable=False, error="HTTP response requires manual/browser review")
    except Exception as error:
        row.update(reachable=False, error=type(error).__name__)
    return row

with ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(verify, sources))
(ROOT / "research/url-checks.json").write_text(json.dumps(results, indent=2,ensure_ascii=False), encoding="utf-8")
for row in results:
    print(row["key"], row.get("status", row.get("error")), "OK" if row["reachable"] else "REVIEW")
print("HTTP link check:",sum(r["reachable"] for r in results),"/",len(results),"reachable")
