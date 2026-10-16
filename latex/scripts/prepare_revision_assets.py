"""Prepare local previews and technology marks used in the proposal."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests
from PIL import Image
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/technology'
OUT.mkdir(exist_ok=True)

def fetch(name):
    url = f'https://raw.githubusercontent.com/devicons/devicon/master/icons/{name}/{name}-original.svg'
    result = requests.get(url, timeout=25)
    result.raise_for_status()
    path = OUT / f'{name}.svg'
    path.write_bytes(result.content)
    renderPDF.drawToFile(svg2rlg(str(path)), str(path.with_suffix('.pdf')))
    return name

if __name__ == '__main__':
    with ThreadPoolExecutor(6) as pool:
        print(list(pool.map(fetch, ['react', 'typescript', 'nestjs', 'postgresql', 'docker', 'fastify'])))
    license_response = requests.get('https://raw.githubusercontent.com/devicons/devicon/master/LICENSE', timeout=25)
    license_response.raise_for_status()
    (OUT / 'LICENSE-devicon.txt').write_bytes(license_response.content)
    overlay = Image.open(ROOT / 'assets/Header Footer New.png')
    preview = Image.new('RGBA', overlay.size, '#F8F8F6')
    preview.alpha_composite(overlay)
    preview.convert('RGB').resize((595,842)).save(ROOT / 'build/header-preview.jpg')
