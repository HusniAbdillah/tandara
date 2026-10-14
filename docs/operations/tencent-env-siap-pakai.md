# Tencent Tandara â€” env lengkap dan password berbentuk kalimat

Disesuaikan dengan `infrastructure/deployment/backend.compose.yml` dan
`deploy.sh`, diperiksa 13 Oktober 2026. Jalankan perintah di terminal Ubuntu
Tencent `43.129.33.176`, bukan terminal PowerShell laptop. Panduan ini tidak
membuktikan konfigurasi tersebut sudah dipasang pada server.

## 1. File yang digunakan

Workflow **Deploy demo** membaca **`/opt/tandara/.env`**. File
`.env.production.example` di repository adalah konfigurasi untuk jalur produksi
yang berbeda dan tidak dapat ditempel begitu saja ke deployment demo ini.

Deployment ini menetapkan `NODE_ENV=production`, tetapi `APP_MODE=simulation`
untuk akun/data latihan. Compose yang diperbaiki pada pekerjaan ini meneruskan
konfigurasi chat, embedding, budget, MFA dan telemetry dari env. Default tetap
`AI_MODE=heuristic` dan embedding `disabled`, tanpa pemanggilan model berbayar.
`APP_MODE` tetap ditetapkan Compose, sehingga jalur demo tidak berubah menjadi
onboarding produksi penuh hanya dengan menambahkan variable. Mode produksi penuh memiliki persyaratan lain,
termasuk onboarding akun, MFA dan database TLS; panduan ini mempertahankan
deployment demo penjurian yang sudah dipilih.

Isi lengkap env operator berikut berdasarkan `.env.example`,
`.env.production.example` dan schema runtime. Default model dimatikan sampai
operator memasukkan key serta budget/kuota yang tersedia:

```dotenv
# Install as /opt/tandara/.env, chmod 600. Never commit the filled file.
# Read by both Bash and Compose: quote passphrases with single quotes.
# Do not use apostrophes or backslashes inside the passphrase in this shared format.
# Generate the DB password only for a fresh database: openssl rand -hex 24
# Preserve the original DB password when the Postgres volume already exists.
API_DOMAIN=api.tandara.my.id
WEB_ORIGINS='https://tandara.my.id,https://www.tandara.my.id,https://posko.tandara.my.id,https://tandara-warga.vercel.app,https://tandara-posko.vercel.app'
POSTGRES_PASSWORD=REPLACE_WITH_RANDOM_HEX
# Unique password, >=12 characters. Seed does not reset existing passwords.
DEMO_PASSWORD='REPLACE_WITH_UNIQUE_DEMO_PASSWORD'
# Explicitly enable the synthetic seed for the FIRST release only.
SEED_DEMO_ON_FIRST_DEPLOY=true
# Opt in to reviewed public-data connectors; reports and seed plans remain demo data.
ALLOW_LIVE_SOURCES=false

# Runtime is NODE_ENV=production / APP_MODE=simulation in backend.compose.yml.
# Database URL, SQL worker, proxy and secure cookies are configured by Compose.
# Keep an existing MFA key unchanged. For a new key: openssl rand -hex 32
MFA_ENCRYPTION_KEY=''
LOG_LEVEL=info

# Model services are opt-in. These defaults do not call paid chat/embedding APIs.
# To reuse existing provider quota: compatible modes, real keys/models and funded budgets.
AI_MODE=heuristic
AI_PROVIDER=vikey
AI_BASE_URL=''
AI_MODEL=''
AI_API_KEY=''
AI_TIMEOUT_MS=30000
AI_MAX_OUTPUT_TOKENS=2048
AI_EMBEDDING_MODE=disabled
AI_EMBEDDING_PROVIDER=gemini
AI_EMBEDDING_BASE_URL=''
AI_EMBEDDING_MODEL=gemini-embedding-001
AI_EMBEDDING_API_KEY=''
AI_EMBEDDING_DIMENSIONS=1536

# Estimates below are illustrative, not current provider price quotes.
# Zero budgets block paid runs until an operator sets funded caps (micro USD).
AI_INPUT_MICRO_USD_PER_MILLION_TOKENS=1000000
AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS=3000000
AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS=10000000
AI_DAILY_BUDGET_MICRO_USD=0
AI_ORG_DAILY_BUDGET_MICRO_USD=0
AI_MONTHLY_BUDGET_MICRO_USD=0
AI_RUN_MAX_MICRO_USD=1500000
AI_MAX_PENDING_PER_REGION=100
AI_MAX_CONCURRENT=1
AI_DATA_PROCESSING_APPROVED=false

# Optional private telemetry collector; no external model-content tracing.
OTEL_EXPORTER_OTLP_ENDPOINT=''
OTEL_SERVICE_NAME=tandara
LANGSMITH_TRACING=false
LANGCHAIN_TRACING_V2=false
```

**Dua nilai password di atas adalah penjelas, bukan nilai untuk dipakai.**
Blok otomatis pada bagian 2 mempertahankan password database yang ada dan
meminta password login secara privat, sehingga tidak perlu menebak nilainya.

| Variable                  | Isi dan alasan                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| API_DOMAIN                | Nama host saja, tanpa `https://` atau slash; Caddy menerbitkan HTTPS untuk domain ini                                             |
| WEB_ORIGINS               | Lima origin HTTPS persis; mendukung domain utama, www, Posko dan dua alias Vercel yang diberikan tim                              |
| POSTGRES_PASSWORD         | Hex minimal 32 karakter; pertahankan nilai lama untuk database yang sudah terbentuk                                               |
| DEMO_PASSWORD             | Password akun seed awal, minimal 12 dan maksimal 200 karakter agar dapat dipakai login; gunakan kalimat unik dengan kutip tunggal |
| SEED_DEMO_ON_FIRST_DEPLOY | Izin seed pada deployment pertama saja; `deploy.sh` tidak menjalankan seed pada release berikutnya jika `current` ada             |
| ALLOW_LIVE_SOURCES        | Opt-in konektor BMKG/PetaBencana; tetap perlu membuat dan mengaktifkan sumber per wilayah di Posko                                |

`APP_IMAGE` dan `POSTGRES_IMAGE` dibuat workflow di `current/release.env`.
`DATABASE_URL`, port API, secure cookies, worker dan mode aplikasi
ditetapkan Compose. Jangan menambahkan Redis server: deployment ini memakai
pekerjaan SQL dan placeholder Redis yang sudah ditetapkan. `POSTGRES_PORT`,
`REDIS_PORT`, database localhost dan credential local-only dari `.env.example`
adalah konfigurasi laptop, bukan tambahan yang diperlukan server. GitHub/Vercel token
tidak disimpan pada file Tencent ini.

### Konfigurasi AI lokal yang ditemukan

Pemeriksaan lokal menunjukkan `AI_MODE=compatible`, provider `vikey`, model
`deepseek/deepseek-v4-flash`, serta embedding `compatible` dengan provider
`gemini` dan model `gemini-embedding-001`. Kedua key dan kunci MFA terisi;
nilainya tidak dicetak atau dimasukkan ke dokumen. Nama model ini berasal
konfigurasi lokal, bukan pemeriksaan baru ketersediaan model pada provider.

Jika tetap memakai kuota model yang sudah tersedia, isi **sekali**:

```dotenv
AI_MODE=compatible
AI_PROVIDER=vikey
AI_BASE_URL=''
AI_MODEL='deepseek/deepseek-v4-flash'
AI_API_KEY='SALIN_KEY_VIKEY_SECARA_PRIVAT'
AI_EMBEDDING_MODE=compatible
AI_EMBEDDING_PROVIDER=gemini
AI_EMBEDDING_BASE_URL=''
AI_EMBEDDING_MODEL=gemini-embedding-001
AI_EMBEDDING_API_KEY='SALIN_KEY_GEMINI_SECARA_PRIVAT'
```

Blok tersebut adalah override pada template lengkap, bukan pengganti seluruh
file. Ganti dua placeholder key dengan key milik Anda. Pertahankan kunci MFA
server yang sudah dipakai. Budget harian/global/organisasi/bulanan perlu diisi
sesuai kuota yang benar-benar tersedia; nilai nol menolak pekerjaan model
berbayar. Satu USD = 1.000.000 micro USD untuk satuan konfigurasi, bukan tagihan
otomatis. Angka estimasi harga pada template belum merupakan harga provider
terverifikasi. Batas aplikasi tidak menggantikan limit billing provider.

Mode `heuristic` dan embedding `disabled` tetap tersedia tanpa pemanggilan
model. Mengaktifkan dua mode `compatible` adalah pilihan penggunaan kuota
layanan, terpisah dari hosting Tencent dan data publik BMKG.

## 2. Salin sekali: buat atau perbaiki env secara aman

**Penting:** deploy Compose yang diperbaiki terlebih dahulu sebelum mengandalkan
AI/embedding dari env. Compose lama mengunci `AI_MODE=heuristic` dan tidak
meneruskan key. Menulis env saja tidak memperbaiki Compose lama.

Blok ini:

- Mempertahankan password database hex yang sudah tersimpan.
- Menghasilkan password database hanya jika belum ada env/database deployment.
- Membuat cadangan env lama sebelum menggantinya.
- Mempertahankan konfigurasi AI/MFA yang sudah ada dan mengisi variable yang belum ada dengan default template.
- Meminta password login melalui terminal, bukan menyimpannya pada history.
- Tidak menjalankan isi env lama, sehingga baris password tanpa kutip yang
  rusak tidak dieksekusi sebagai perintah Bash.

Gunakan password kalimat unik **tanpa apostrof `'` atau backslash `\`**, supaya
format yang sama dibaca konsisten oleh Bash dan Compose. Spasi, `!`, `#` dan
`$` dapat dipakai di dalam kutip tunggal. Jangan memakai contoh password yang
dipublikasikan dalam dokumentasi.

```bash
sudo python3 - <<'PY'
import datetime
import getpass
import os
from pathlib import Path
import pwd
import re
import secrets
import subprocess
import tempfile

root = Path('/opt/tandara')
env_path = root / '.env'
owner = pwd.getpwnam('tandara-deploy')
subprocess.run(['docker', 'info'], check=True, stdout=subprocess.DEVNULL)
old = env_path.read_text() if env_path.exists() else ''
matches = re.findall(r'^\s*POSTGRES_PASSWORD\s*=\s*(.*?)\s*$', old, re.M)
db_password = matches[0].strip().strip("'\"") if len(matches) == 1 else ''
if old and not re.fullmatch(r'[a-fA-F0-9]{32,}', db_password):
    raise SystemExit('STOP: password DB lama tidak valid/ambigu. Pulihkan nilai hex aslinya; jangan buat password DB baru.')
if not db_password:
    volume = subprocess.run(
        ['docker', 'volume', 'inspect', 'tandara-demo_postgres-data'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    current = root / 'current'
    if volume.returncode == 0 or current.exists() or current.is_symlink():
        raise SystemExit('STOP: deployment/database sudah ada, tetapi password DB asli tidak ditemukan di env.')
    db_password = secrets.token_hex(24)

while True:
    password = getpass.getpass('Password login demo baru (12â€“200 karakter): ')
    if not 12 <= len(password) <= 200:
        print('Panjang harus 12â€“200 karakter.')
        continue
    if any(c in password for c in "'\\") or any(ord(c) < 32 or ord(c) == 127 for c in password):
        print('Gunakan kalimat tanpa apostrof, backslash atau karakter kontrol.')
        continue
    if password.startswith('REPLACE_'):
        print('Masukkan password milik Anda, bukan placeholder.')
        continue
    if password != getpass.getpass('Ulangi password login: '):
        print('Password tidak sama; coba lagi.')
        continue
    break

defaults = {'MFA_ENCRYPTION_KEY': '',
 'LOG_LEVEL': 'info',
 'AI_MODE': 'heuristic',
 'AI_PROVIDER': 'vikey',
 'AI_BASE_URL': '',
 'AI_MODEL': '',
 'AI_API_KEY': '',
 'AI_TIMEOUT_MS': '30000',
 'AI_MAX_OUTPUT_TOKENS': '2048',
 'AI_EMBEDDING_MODE': 'disabled',
 'AI_EMBEDDING_PROVIDER': 'gemini',
 'AI_EMBEDDING_BASE_URL': '',
 'AI_EMBEDDING_MODEL': 'gemini-embedding-001',
 'AI_EMBEDDING_API_KEY': '',
 'AI_EMBEDDING_DIMENSIONS': '1536',
 'AI_INPUT_MICRO_USD_PER_MILLION_TOKENS': '1000000',
 'AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS': '3000000',
 'AI_EMBEDDING_MICRO_USD_PER_MILLION_TOKENS': '10000000',
 'AI_DAILY_BUDGET_MICRO_USD': '0',
 'AI_ORG_DAILY_BUDGET_MICRO_USD': '0',
 'AI_MONTHLY_BUDGET_MICRO_USD': '0',
 'AI_RUN_MAX_MICRO_USD': '1500000',
 'AI_MAX_PENDING_PER_REGION': '100',
 'AI_MAX_CONCURRENT': '1',
 'AI_DATA_PROCESSING_APPROVED': 'false',
 'OTEL_EXPORTER_OTLP_ENDPOINT': '',
 'OTEL_SERVICE_NAME': 'tandara',
 'LANGSMITH_TRACING': 'false',
 'LANGCHAIN_TRACING_V2': 'false'}
values = dict(defaults)
seen = set()
for line in old.splitlines():
    match = re.match(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$', line)
    if not match:
        continue
    key, value = match.groups()
    if key in {'POSTGRES_PASSWORD', 'DEMO_PASSWORD'}:
        continue
    if key in seen:
        raise SystemExit('STOP: variable duplikat: ' + key)
    seen.add(key)
    value = value.strip()
    if value.startswith(('\"', "'")):
        if len(value) < 2 or value[-1] != value[0]:
            raise SystemExit('STOP: periksa kutip pada ' + key)
        value = value[1:-1]
    else:
        value = re.split(r'\s+#', value, maxsplit=1)[0].rstrip()
    if any(c in value for c in "'\\") or any(ord(c) < 32 for c in value):
        raise SystemExit('STOP: periksa format literal pada ' + key)
    values[key] = value
if not values.get('MFA_ENCRYPTION_KEY'):
    values['MFA_ENCRYPTION_KEY'] = secrets.token_hex(32)
values.update({
    'API_DOMAIN': 'api.tandara.my.id',
    'WEB_ORIGINS': 'https://tandara.my.id,https://www.tandara.my.id,https://posko.tandara.my.id,https://tandara-warga.vercel.app,https://tandara-posko.vercel.app',
    'POSTGRES_PASSWORD': db_password,
    'DEMO_PASSWORD': password,
    'SEED_DEMO_ON_FIRST_DEPLOY': 'true',
    'ALLOW_LIVE_SOURCES': 'true',
})
root.mkdir(mode=0o700, parents=True, exist_ok=True)
def write_private(target, content):
    with target.open('x', encoding='utf-8') as handle:
        os.chmod(target, 0o600)
        os.chown(target, owner.pw_uid, owner.pw_gid)
        handle.write(content)

if env_path.exists():
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = root / ('.env.backup-' + stamp + '-' + secrets.token_hex(3))
    write_private(backup, old)
content = ''.join(f"{key}='{value}'\n" for key, value in values.items())
fd, name = tempfile.mkstemp(prefix='.env.new-', dir=root)
try:
    os.fchmod(fd, 0o600)
    os.fchown(fd, owner.pw_uid, owner.pw_gid)
    with os.fdopen(fd, 'w', encoding='utf-8') as handle:
        handle.write(content)
    os.replace(name, env_path)
finally:
    if os.path.exists(name):
        os.unlink(name)
print('Env tersimpan: /opt/tandara/.env, mode 600. Password tidak ditampilkan.')
PY
```

Jika `tandara-deploy` belum ada, bootstrap server belum selesai; ikuti
[deploy-demo](deploy-demo.md) terlebih dahulu. Jika script berhenti karena
password database lama tidak valid, pulihkan dari cadangan privat operator.
Mengubah env tidak merotasi password PostgreSQL pada volume existing.
[Dokumentasi image PostgreSQL](https://hub.docker.com/_/postgres).

## 3. Terapkan setelah Compose baru terdeploy, tanpa build ulang untuk perubahan env

Untuk server yang sudah memiliki `/opt/tandara/current/release.env` dan Compose
baru yang meneruskan seluruh variable AI:

```bash
sudo bash <<'SH'
set -Eeuo pipefail
cd /opt/tandara
test -f current/release.env
test -f current/backend.compose.yml
bash -n .env
dc=(docker compose --project-name tandara-demo --env-file /opt/tandara/.env --env-file /opt/tandara/current/release.env -f /opt/tandara/current/backend.compose.yml)
"${dc[@]}" config --quiet
"${dc[@]}" up -d --force-recreate --wait --wait-timeout 180 api worker caddy
"${dc[@]}" ps
curl --fail --silent --show-error https://api.tandara.my.id/ready
SH
```

Ini membuat ulang API, worker dan Caddy agar domain/flag terbaru digunakan.
`docker compose restart` saja tidak memperbarui environment container.
Password login akun existing belum berubah pada langkah ini. Jangan menjalankan
`down -v`, mengganti image PostgreSQL, atau menghapus volume untuk mengganti env.

Jika `current` belum ada, lakukan deployment pertama melalui **Deploy demo**
di GitHub Actions setelah CI untuk commit `main` yang sama berhasil. Images dan
migration tetap dibuat workflow; tidak perlu build aplikasi di VPS.

Untuk `ALLOW_LIVE_SOURCES`, release harus memakai Compose yang meneruskan
variable tersebut. Jangan menulisnya lagi pada `release.env` karena file kedua
memiliki prioritas lebih tinggi dan dibuat ulang setiap deployment. Aktivasi
per wilayah: [runbook sumber publik](public-sources.md).

## 4. Ganti password akun yang sudah terbentuk

`DEMO_PASSWORD` hanya dipakai seed untuk **akun baru**. Seed menggunakan
`ON CONFLICT DO NOTHING`; mengedit env atau menjalankan seed ulang tidak
mereset password akun existing. Tidak diperlukan rebuild untuk mengganti
password akun.

Jika masih bisa login admin, buka **Administrasi** dan ubah password akun
yang diperlukan melalui form pengguna. Lihat label menu aktual di versi
deployment; jangan mengubah wilayah/role yang sudah benar.

Alternatif console berikut menyamakan password akun seed existing dengan
`DEMO_PASSWORD` terbaru. Hanya pasangan ID/email tiga akun demo bawaan yang
diubah. Sesi ketiga akun tersebut dicabut sehingga perlu login ulang; password
dan hash tidak dicetak. Akun yang dibuat sendiri tidak diubah.

```bash
sudo bash <<'SH'
set -Eeuo pipefail
cd /opt/tandara
dc=(docker compose --project-name tandara-demo --env-file /opt/tandara/.env --env-file /opt/tandara/current/release.env -f /opt/tandara/current/backend.compose.yml)
"${dc[@]}" config --quiet
"${dc[@]}" run --rm --no-deps -T seed node --input-type=module <<'JS'
import { randomBytes, scryptSync } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire('/app/api/node_modules/@tandara/database/package.json');
const { Client } = require('pg');
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12 || password.length > 200) throw new Error('Invalid demo password length.');
const accounts = [
  ['30000000-0000-4000-8000-000000000001', 'ciliwung@demo.tandara.test'],
  ['30000000-0000-4000-8000-000000000002', 'semarang@demo.tandara.test'],
  ['30000000-0000-4000-8000-000000000003', 'admin@demo.tandara.test'],
];
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
let updated = 0;
try {
  await db.query('BEGIN');
  for (const [id, email] of accounts) {
    const salt = randomBytes(16).toString('hex');
    const encoded = salt + ':' + scryptSync(password, salt, 64).toString('hex');
    const result = await db.query(
      'UPDATE users SET password_hash=$1 WHERE id=$2::uuid AND email=$3 RETURNING id',
      [encoded, id, email],
    );
    if (!result.rowCount) continue;
    await db.query('DELETE FROM sessions WHERE user_id=$1::uuid', [id]);
    await db.query(
      "INSERT INTO audit_events(actor_id,action,entity_id) VALUES(NULL,'demo.password_rotated',$1)",
      [id],
    );
    updated += result.rowCount;
  }
  if (!updated) throw new Error('No matching seeded accounts; use account administration.');
  await db.query('COMMIT');
  console.log('Password updated for ' + updated + ' seeded accounts; their sessions were revoked.');
} catch {
  await db.query('ROLLBACK');
  console.error('Password rotation failed and was rolled back. No credentials printed.');
  process.exitCode = 1;
} finally {
  await db.end();
}
JS
SH
```

Login memakai password yang diketik pada bagian 2, **tanpa kutip pembungkus**.
Contoh akun admin: `admin@demo.tandara.test`; koordinator:
`ciliwung@demo.tandara.test` dan `semarang@demo.tandara.test`.

## 5. Mengapa password kalimat dapat menyebabkan gagal?

`deploy.sh` menjalankan `source /opt/tandara/.env`. Contoh berikut tidak valid
untuk tujuan assignment password lengkap:

```dotenv
# Salah: kata setelah spasi dibaca sebagai perintah Bash.
DEMO_PASSWORD=ini contoh kalimat panjang

# Benar secara format; ini hanya ilustrasi, jangan dipakai sebagai password.
DEMO_PASSWORD='ini contoh kalimat panjang'
```

Kutip tunggal juga membuat `$` dan `#` di dalam password dibaca literal oleh
Compose. [Aturan env dan interpolation Docker Compose](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/).
Kutip ganda dapat menyebabkan ekspansi `$VAR` dan menjalankan substitusi Bash;
gunakan pola yang disiapkan di atas.

Tanpa log kegagalan terbaru, belum bisa dipastikan bahwa ini penyebab error
Anda. Jika gagal pada `source`, `command not found` atau validasi password,
format env ini relevan. Jika gagal pada langkah **Build portable production
backend**, env server tidak dipakai langkah build tersebut; kirim nama langkah
dan pesan errornya tanpa password untuk diagnosis yang sesuai.

## 6. Pemeriksaan akhir tanpa mencetak secrets

```bash
sudo stat -c '%a %U:%G' /opt/tandara/.env
sudo docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' tandara-demo-caddy-1 | grep '^API_DOMAIN='
sudo docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' tandara-demo-api-1 | grep '^ALLOW_LIVE_SOURCES='
curl -fsS https://api.tandara.my.id/ready
```

Hasil yang diharapkan: permission `600 tandara-deploy:tandara-deploy`, domain
`api.tandara.my.id`, flag live `true` pada release yang mendukungnya, dan HTTP
sukses dari `/ready`. Root API `/` memang dapat memberikan 404; gunakan
`/ready` sebagai pemeriksaan kesehatan. Login tetap perlu dicoba terpisah.

DNS A `api.tandara.my.id` harus menunjuk `43.129.33.176`, dan firewall TCP
80/443 harus terbuka untuk HTTPS. Penambahan origin www tidak membuat domain
Vercel aktif dengan sendirinya; domain/DNS Vercel harus sudah dikonfigurasi.

**Setelah Compose terbaru, env dan akun ini benar, deployment berikutnya memakai file yang sama.**
Password database dipertahankan, password akun tidak direset seed, dan image
release diperbarui workflow. Perubahan data sumber per wilayah dikelola di
Posko. Jangan mengirim `.env`, password atau private key ke chat/repository.

## 7. Profil Vikey + Gemini yang dipilih tim — 14 Oktober 2026

Tim memilih menggunakan kedua layanan dengan key/kuota yang sudah ada.
Profil privat sudah disiapkan di `.local/tencent-ai.env`, diabaikan Git.
File ini berisi key dari env lokal, model, mode `compatible` untuk kedua
layanan dan batas budget aplikasi yang sudah dikonfigurasi lokal. Konkurensi
ditetapkan satu pekerjaan untuk VPS 2 GB. Key tidak dicetak ke chat atau
disimpan dalam contoh/dokumen ini.

Profil adalah **overlay**, bukan pengganti seluruh `/opt/tandara/.env`.
Password PostgreSQL, password demo, domain dan kunci MFA server dipertahankan.
Budget aplikasi bukan pemeriksaan saldo provider; profil tidak membeli atau
menambah kuota. Validasi lokal belum membuktikan kedua API provider berhasil
dipanggil dari server Tencent.

### Kirim profil sekali dari PowerShell laptop

Gunakan akses SSH `ubuntu` yang sudah tersedia. Perintah meminta autentikasi
jika belum ada key/agent; jangan mematikan pemeriksaan host key.

```powershell
ssh ubuntu@43.129.33.176 'umask 077; mkdir -p ~/.tandara-private; chmod 700 ~/.tandara-private'
scp .local/tencent-ai.env ubuntu@43.129.33.176:/home/ubuntu/.tandara-private/tencent-ai.env
ssh ubuntu@43.129.33.176 'chmod 600 ~/.tandara-private/tencent-ai.env'
```

### Gabungkan dan terapkan di terminal Tencent

**Syarat:** Compose terbaru yang meneruskan `AI_*` sudah terdeploy dan env
dasar sudah benar. Script berhenti jika Compose masih mengunci heuristic.
Jalankan setelah workflow deploy selesai; jangan berbarengan dengan deployment.

```bash
sudo bash <<'SH'
set -Eeuo pipefail
cd /opt/tandara
exec 9>/opt/tandara/deploy.lock
flock -n 9 || { echo 'Deployment sedang berjalan; coba setelah selesai.'; exit 1; }
python3 - <<'PY'
from pathlib import Path
import datetime
import os
import re
import secrets
import subprocess
import tempfile

root = Path('/opt/tandara')
target = root / '.env'
profile = Path('/home/ubuntu/.tandara-private/tencent-ai.env')
compose = root / 'current/backend.compose.yml'
if not target.is_file() or not profile.is_file():
    raise SystemExit('Env dasar/profil belum tersedia.')
config = compose.read_text()
if 'AI_MODE: ${AI_MODE' not in config or 'AI_EMBEDDING_API_KEY: ${AI_EMBEDDING_API_KEY' not in config:
    raise SystemExit('STOP: deploy Compose terbaru dahulu; Compose lama tidak meneruskan profil AI.')
override = profile.read_text()
keys = set()
parsed = {}
for line in override.splitlines():
    if not line.strip() or line.lstrip().startswith('#'):
        continue
    match = re.fullmatch(r"(AI_[A-Z0-9_]+)='([^'\r\n]*)'", line)
    if not match or '\\' in match.group(2):
        raise SystemExit('Format profil tidak valid; tidak ada perubahan env.')
    key, value = match.groups()
    if key in keys:
        raise SystemExit('Variable profil duplikat; tidak ada perubahan env.')
    keys.add(key)
    parsed[key] = value
if parsed.get('AI_MODE') != 'compatible' or parsed.get('AI_EMBEDDING_MODE') != 'compatible':
    raise SystemExit('Profil belum mengaktifkan kedua layanan.')
if not parsed.get('AI_API_KEY') or not parsed.get('AI_EMBEDDING_API_KEY'):
    raise SystemExit('Key belum terisi.')
for key in ['AI_DAILY_BUDGET_MICRO_USD', 'AI_ORG_DAILY_BUDGET_MICRO_USD', 'AI_MONTHLY_BUDGET_MICRO_USD']:
    if int(parsed.get(key, '0')) <= 0:
        raise SystemExit('Budget aplikasi masih nol; tidak ada perubahan env.')
old = target.read_text()
retained = []
for line in old.splitlines():
    match = re.match(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=', line)
    if not match or match.group(1) not in keys:
        retained.append(line)
merged = '\n'.join(retained) + '\n' + override
metadata = target.stat()
fd, temporary = tempfile.mkstemp(prefix='.env.ai-', dir=root)
try:
    os.fchmod(fd, 0o600)
    os.fchown(fd, metadata.st_uid, metadata.st_gid)
    with os.fdopen(fd, 'w') as handle:
        handle.write(merged)
    subprocess.run(['bash', '-n', temporary], check=True)
    subprocess.run([
        'docker', 'compose', '--project-name', 'tandara-demo',
        '--env-file', temporary, '--env-file', str(root / 'current/release.env'),
        '-f', str(compose), 'config', '--quiet',
    ], check=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = root / ('.env.before-ai-' + stamp + '-' + secrets.token_hex(3))
    with backup.open('x') as handle:
        os.chmod(backup, 0o600)
        os.chown(backup, metadata.st_uid, metadata.st_gid)
        handle.write(old)
    os.replace(temporary, target)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
print('Profil AI digabung; DB/password akun/MFA tetap. Tidak ada key dicetak.')
PY
dc=(docker compose --project-name tandara-demo --env-file /opt/tandara/.env --env-file /opt/tandara/current/release.env -f /opt/tandara/current/backend.compose.yml)
"${dc[@]}" up -d --force-recreate --wait --wait-timeout 180 api worker
curl --fail --silent --show-error https://api.tandara.my.id/ready
for service in tandara-demo-api-1 tandara-demo-worker-1; do
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$service" | grep -E '^(AI_MODE|AI_PROVIDER|AI_EMBEDDING_MODE|AI_EMBEDDING_PROVIDER|AI_MAX_CONCURRENT)='
done
SH
```

Setelah sehat, uji satu pertanyaan dengan sumber disetujui di **Asisten Posko**.
Periksa hasil/kutipan/provenance untuk membuktikan provider benar-benar berhasil.
Embedding juga memerlukan sumber pengetahuan yang diindeks; flag aktif saja
belum membuktikan indeks sudah selesai. Deployment berikutnya memakai env
server ini; tidak perlu mengirim key ulang setiap push.
