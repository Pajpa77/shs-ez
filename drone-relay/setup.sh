#!/usr/bin/env bash
# =============================================================================
# SHS-EZ Drohnen-Relay – Ein-Skript-Installation (Ubuntu 22.04/24.04, x86 oder ARM)
#
#   DJI Fly (RTMP, signiert)  ->  :1935  Node-Media-Server  ->  :8000 (nur lokal)
#                                                    Caddy (HTTPS/WSS, Let's Encrypt) :443  ->  SHS-EZ App
#
# Aufruf (als root):
#   sudo bash setup.sh                       # Domain automatisch: <ip>.sslip.io (kein Konto nötig)
#   sudo DOMAIN=meinname.duckdns.org bash setup.sh
#   sudo bash setup.sh --rotate              # neue Schlüssel erzeugen (alte Adressen werden ungültig)
#   sudo bash setup.sh --show                # Adressen erneut anzeigen
# =============================================================================
set -euo pipefail

APP_DIR=/opt/shs-drone-relay
ENV_FILE="$APP_DIR/.env"
SVC_USER=shsrelay
NMS_VERSION=4.4.3

if [[ $EUID -ne 0 ]]; then echo "Bitte mit sudo ausführen."; exit 1; fi

MODE="${1:-install}"

show_urls() {
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  local exp hash
  exp=$(( $(date +%s) + 10*365*24*3600 ))
  hash=$(printf '%s' "/live/${PLAY_ID}-${exp}-${PUBLISH_SECRET}" | md5sum | cut -d' ' -f1)
  echo
  echo "=================================================================="
  echo " SHS-EZ Drohnen-Relay bereit"
  echo "=================================================================="
  echo
  echo " 1) DJI Fly  ->  Übertragung -> Livestream-Plattformen -> RTMP:"
  echo
  echo "    rtmp://${DOMAIN}:1935/live/${PLAY_ID}?sign=${exp}-${hash}"
  echo
  echo "    (GEHEIM halten – wer diese Adresse kennt, kann Bilder einspeisen)"
  echo
  echo " 2) SHS-EZ App  ->  Drohnen-Feed -> Zahnrad -> Stream-Adresse:"
  echo
  echo "    https://${DOMAIN}/live/${PLAY_ID}.flv"
  echo
  echo " Test im Browser:  https://${DOMAIN}/health   (muss 'ok' zeigen)"
  echo "=================================================================="
}

if [[ "$MODE" == "--show" ]]; then show_urls; exit 0; fi

echo ">> Pakete installieren ..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg openssl debian-keyring debian-archive-keyring apt-transport-https iptables-persistent unattended-upgrades

# --- Node.js 20 ---------------------------------------------------------------
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  echo ">> Node.js 20 installieren ..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# --- Caddy (automatisches HTTPS) ---------------------------------------------
if ! command -v caddy >/dev/null; then
  echo ">> Caddy installieren ..."
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

# --- Benutzer & Verzeichnis --------------------------------------------------
id "$SVC_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SVC_USER"
mkdir -p "$APP_DIR/data"

# --- Schlüssel / Domain ------------------------------------------------------
if [[ ! -f "$ENV_FILE" || "$MODE" == "--rotate" ]]; then
  PUBLIC_IP=$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me)
  OLD_DOMAIN=""
  [[ -f "$ENV_FILE" ]] && OLD_DOMAIN=$(grep '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)
  DOMAIN="${DOMAIN:-${OLD_DOMAIN:-${PUBLIC_IP//./-}.sslip.io}}"
  cat > "$ENV_FILE" <<EOF
DOMAIN=${DOMAIN}
PLAY_ID=$(openssl rand -hex 12)
PUBLISH_SECRET=$(openssl rand -hex 24)
EOF
  echo ">> Neue Schlüssel erzeugt."
elif [[ -n "${DOMAIN:-}" ]]; then
  sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"
# shellcheck disable=SC1090
source "$ENV_FILE"

# --- Relay-Anwendung ---------------------------------------------------------
cat > "$APP_DIR/package.json" <<EOF
{ "name": "shs-drone-relay", "private": true, "dependencies": { "node-media-server": "${NMS_VERSION}" } }
EOF

cat > "$APP_DIR/relay.js" <<'EOF'
// SHS-EZ Drohnen-Relay: RTMP-Ingest (nur signiert) -> WS/HTTP-FLV (nur via Caddy erreichbar)
const NodeMediaServer = require('node-media-server');

const secret = process.env.PUBLISH_SECRET;
if (!secret || secret.length < 32) {
  console.error('PUBLISH_SECRET fehlt oder ist zu kurz – Abbruch.');
  process.exit(1);
}

const nms = new NodeMediaServer({
  bind: '0.0.0.0',               // Port 8000 wird per Firewall NICHT freigegeben, nur Caddy greift lokal zu
  rtmp: { port: 1935, chunk_size: 60000, gop_cache: true, ping: 30, ping_timeout: 60 },
  http: { port: 8000, allow_origin: '*' },
  webadmin: { enable: false },   // keine Admin-Konsole
  auth: { publish: true, play: false, secret }, // nur signierte Einspeisung (DJI Fly-Adresse)
  store: { path: __dirname + '/data' },
});

nms.on('postPublish', (s) => console.log(`[DRONE] Stream gestartet ${s.streamPath} von ${s.ip}`));
nms.on('donePublish', (s) => console.log(`[DRONE] Stream beendet ${s.streamPath}`));
nms.on('postPlay', (s) => console.log(`[VIEW] Zuschauer verbunden ${s.streamPath} (${s.ip})`));
nms.run();

const stop = () => nms.stop().finally(() => process.exit(0));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
EOF

echo ">> node-media-server installieren ..."
(cd "$APP_DIR" && npm install --omit=dev --no-audit --no-fund)
chown -R "$SVC_USER":"$SVC_USER" "$APP_DIR"

cat > /etc/systemd/system/shs-drone-relay.service <<EOF
[Unit]
Description=SHS-EZ Drohnen-Relay (Node-Media-Server)
After=network-online.target
Wants=network-online.target

[Service]
User=${SVC_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${APP_DIR}/relay.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}/data
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# --- Caddy: nur Stream-Pfade durchlassen -------------------------------------
cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
	@stream path_regexp stream ^/live/[A-Za-z0-9_-]+\.flv$
	handle @stream {
		reverse_proxy 127.0.0.1:8000 {
			flush_interval -1
		}
	}
	handle /health {
		respond "ok" 200
	}
	handle {
		respond 404
	}
	header {
		-Server
		X-Content-Type-Options nosniff
	}
}
EOF

# --- Firewall (Oracle-Ubuntu-Images blocken standardmäßig per iptables) -------
echo ">> Firewall öffnen (80, 443, 1935) ..."
for p in 80 443 1935; do
  iptables -C INPUT -p tcp --dport "$p" -m state --state NEW -j ACCEPT 2>/dev/null \
    || iptables -I INPUT -p tcp --dport "$p" -m state --state NEW -j ACCEPT
done
# Port 8000 explizit nur lokal
iptables -C INPUT -p tcp --dport 8000 ! -i lo -j DROP 2>/dev/null \
  || iptables -I INPUT -p tcp --dport 8000 ! -i lo -j DROP
netfilter-persistent save >/dev/null 2>&1 || true
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp; ufw allow 443/tcp; ufw allow 1935/tcp
fi

# --- Dienste starten ---------------------------------------------------------
systemctl daemon-reload
systemctl enable --now shs-drone-relay
systemctl restart shs-drone-relay
systemctl enable caddy
systemctl restart caddy

sleep 3
systemctl is-active --quiet shs-drone-relay && echo ">> Relay läuft." || { echo "!! Relay-Start fehlgeschlagen:"; journalctl -u shs-drone-relay -n 30 --no-pager; }

show_urls
echo
echo " Logs:  journalctl -u shs-drone-relay -f     |     journalctl -u caddy -f"
echo " Hinweis: In der Oracle-Konsole (VCN -> Security List) müssen TCP 80, 443, 1935 eingehend erlaubt sein."
