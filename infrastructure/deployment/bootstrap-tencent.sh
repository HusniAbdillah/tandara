#!/usr/bin/env bash
set -Eeuo pipefail
# Run once from the Tencent console as root. Argument is a PUBLIC SSH key file.
[[ $EUID -eq 0 ]] || { echo 'Run as root in the Tencent console.' >&2; exit 1; }
key_file=${1:?Usage: bash bootstrap-tencent.sh /path/to/deploy-key.pub}
ssh-keygen -lf "$key_file" >/dev/null
# shellcheck source=/dev/null
source /etc/os-release
[[ "$ID" == ubuntu ]] || { echo 'This bootstrap supports Ubuntu only.' >&2; exit 1; }
apt-get update
apt-get install -y ca-certificates curl openssl python3 cron
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' \
    "$(dpkg --print-architecture)" "${UBUNTU_CODENAME:-$VERSION_CODENAME}" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
docker compose version
systemctl enable --now docker cron
id tandara-deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash tandara-deploy
usermod -aG docker tandara-deploy
install -d -m 0700 -o tandara-deploy -g tandara-deploy /home/tandara-deploy/.ssh
authorized=/home/tandara-deploy/.ssh/authorized_keys
touch "$authorized"
public_key=$(cat "$key_file")
grep -Fqx "restrict $public_key" "$authorized" || printf 'restrict %s\n' "$public_key" >> "$authorized"
chown tandara-deploy:tandara-deploy "$authorized"
chmod 0600 "$authorized"
install -d -m 0700 -o tandara-deploy -g tandara-deploy \
  /opt/tandara /opt/tandara/incoming /opt/tandara/releases /opt/tandara/backups
# Local-only backup; download an additional copy to the laptop before judging.
printf '17 2 * * * tandara-deploy test ! -f /opt/tandara/current/backup.sh || /opt/tandara/current/backup.sh >> /opt/tandara/backup.log 2>&1\n' \
  > /etc/cron.d/tandara-demo-backup
chmod 0644 /etc/cron.d/tandara-demo-backup
echo 'Docker and deployment user ready. Verify this host fingerprint independently:'
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
echo 'Next: install /opt/tandara/.env (mode 600), configure firewall/DNS, and test SSH as tandara-deploy.'
