"""Build from any working directory; no shell interpolation or shell-escape."""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
NAME = "Tandara_Proposal_Sustainability"
BUILD.mkdir(exist_ok=True)
for tool in ("xelatex", "biber"):
    if not shutil.which(tool):
        raise SystemExit(f"Dependency missing: {tool}. See latex/README.md")

tex = ["xelatex", "-interaction=nonstopmode", "-halt-on-error",
       "-no-shell-escape", "-output-directory=build", f"-jobname={NAME}", "main.tex"]
commands = [tex, ["biber", f"build/{NAME}"], tex, tex]
for i, command in enumerate(commands, 1):
    print(f"Build {i}/4: {command[0]}", flush=True)
    run = subprocess.run(command, cwd=ROOT, capture_output=True)
    output = (run.stdout + run.stderr).decode("utf-8", errors="replace")
    (BUILD / f"compile-{i}.txt").write_text(output, encoding="utf-8")
    if run.returncode:
        print(output[-7000:])
        raise SystemExit(run.returncode)
pdf = BUILD / f"{NAME}.pdf"
if not pdf.is_file():
    raise SystemExit("Compiler did not create a PDF")
print(f"PDF: {pdf}")
subprocess.run([sys.executable, "-X", "utf8", str(ROOT / "scripts/validate.py")],
               cwd=ROOT, check=True)
