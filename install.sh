#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="bluereferral"
DEFAULT_REPO_URL="https://github.com/paliparsa/BlueReferral.git"
APP_DIR_DEFAULT="/var/www/${APP_NAME}"

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root: sudo bash install.sh"
  exit 1
fi

ask() {
  local prompt="$1" default="${2:-}" value
  if [[ -n "$default" ]]; then
    read -rp "$prompt [$default]: " value
    echo "${value:-$default}"
  else
    read -rp "$prompt: " value
    echo "$value"
  fi
}
rand() { openssl rand -hex "${1:-16}"; }

DOMAIN="${DOMAIN:-$(ask 'Domain without https, example ref.yourdomain.com')}"
BOT_TOKEN="${BOT_TOKEN:-$(ask 'Telegram bot token')}"
BOT_USERNAME="${BOT_USERNAME:-$(ask 'Bot username without @')}"
ADMIN_IDS="${ADMIN_IDS:-$(ask 'Admin Telegram numeric IDs, comma separated')}"
SUPPORT_USERNAME="${SUPPORT_USERNAME:-$(ask 'Support username without @' 'BlueGateSupport')}"
REPO_URL="${REPO_URL:-$(ask 'GitHub repository URL' "$DEFAULT_REPO_URL")}"
APP_DIR="${APP_DIR:-$(ask 'Install directory' "$APP_DIR_DEFAULT")}"
DB_NAME="${DB_NAME:-bluegate_referral}"
DB_USER="${DB_USER:-bluegate_user}"
DB_PASS="${DB_PASS:-$(rand 16)}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-$(rand 20)}"
THEME_COLOR="${THEME_COLOR:-#1d9bf0}"
BRAND_NAME="${BRAND_NAME:-BlueGate}"
FORCE_JOIN_CHANNEL="${FORCE_JOIN_CHANNEL:-}"

echo "==> Installing packages"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx mariadb-server git curl unzip openssl ca-certificates php-fpm php-cli php-mysql php-curl php-mbstring certbot python3-certbot-nginx
systemctl enable --now nginx mariadb

if [[ -d "$APP_DIR/.git" ]]; then
  echo "==> Updating existing repository"
  git -C "$APP_DIR" pull --ff-only
else
  echo "==> Cloning repository"
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

ADMIN_ARRAY="[$(echo "$ADMIN_IDS" | awk -F, '{for(i=1;i<=NF;i++){gsub(/ /,"",$i); if($i!="") printf "%s%s", (c++?",":""), $i}}')]"
PUBLIC_BASE_URL="https://${DOMAIN}"
MINIAPP_URL="https://${DOMAIN}/miniapp/"

cat > "$APP_DIR/config.php" <<PHP
<?php
\$BOT_TOKEN = '${BOT_TOKEN}';
\$BOT_USERNAME = '${BOT_USERNAME}';
\$ADMIN_IDS = ${ADMIN_ARRAY};
\$SUPPORT_USERNAME = '${SUPPORT_USERNAME}';
\$TIMEZONE = 'Europe/Istanbul';
\$PUBLIC_BASE_URL = '${PUBLIC_BASE_URL}';
\$WEBHOOK_SECRET = '${WEBHOOK_SECRET}';
\$MINIAPP_URL = '${MINIAPP_URL}';
\$DB_HOST = 'localhost';
\$DB_NAME = '${DB_NAME}';
\$DB_USER = '${DB_USER}';
\$DB_PASS = '${DB_PASS}';
\$START_REWARD = 2000;
\$MIN_WITHDRAW = 50000;
\$PURCHASE_REWARD = 10000;
\$MISSION_1_TARGET = 1;
\$MISSION_1_REWARD = 3000;
\$MISSION_2_TARGET = 3;
\$MISSION_2_REWARD = 10000;
\$MISSION_3_TARGET = 5;
\$MISSION_3_REWARD = 25000;
\$SPIN_REFERRALS_PER_CHANCE = 5;
\$SPIN_REWARDS = [
    ['title' => '💰 ۳,۰۰۰ تومان اعتبار کیف پول',  'amount' => 3000,  'weight' => 35],
    ['title' => '💰 ۵,۰۰۰ تومان اعتبار کیف پول',  'amount' => 5000,  'weight' => 30],
    ['title' => '💰 ۱۰,۰۰۰ تومان اعتبار کیف پول', 'amount' => 10000, 'weight' => 18],
    ['title' => '💰 ۲۰,۰۰۰ تومان اعتبار کیف پول', 'amount' => 20000, 'weight' => 7],
    ['title' => '🎁 سرویس تست هدیه',              'amount' => 0,     'weight' => 10, 'notify_admin' => true],
];
\$CUSTOM_CODE_MIN_REFERRALS = 3;
\$FORCE_JOIN_CHANNEL = '${FORCE_JOIN_CHANNEL}';
\$DEFAULT_THEME_COLOR = '${THEME_COLOR}';
\$BRAND_NAME = '${BRAND_NAME}';
PHP
chmod 640 "$APP_DIR/config.php"
chown -R www-data:www-data "$APP_DIR"

cat > /tmp/bluegate-db.sql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
mysql < /tmp/bluegate-db.sql
rm -f /tmp/bluegate-db.sql

PHP_SOCK="$(find /run/php -name 'php*-fpm.sock' | head -n1 || true)"
if [[ -z "$PHP_SOCK" ]]; then
  echo "Could not find php-fpm socket."
  exit 1
fi

cat > "/etc/nginx/sites-available/${APP_NAME}" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    root ${APP_DIR}/public;
    index index.php index.html;

    client_max_body_size 20M;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${PHP_SOCK};
    }

    location ~ /\. {
        deny all;
    }
}
NGINX
ln -sf "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
nginx -t
systemctl reload nginx

echo "==> Requesting SSL certificate"
if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@${DOMAIN}" --redirect; then
  echo "SSL enabled."
else
  echo "WARNING: Certbot failed. The bot can work only after HTTPS is active. Check DNS and rerun: certbot --nginx -d ${DOMAIN}"
fi

sudo -u www-data php "$APP_DIR/public/install.php"

echo "==> Setting Telegram webhook"
curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://${DOMAIN}/bot.php?secret=${WEBHOOK_SECRET}" \
  -d 'allowed_updates=["message","callback_query"]' | sed 's/.*/Telegram: &/'

echo ""
echo "✅ Installation finished"
echo "Bot webhook: https://${DOMAIN}/bot.php?secret=${WEBHOOK_SECRET}"
echo "Mini App URL: https://${DOMAIN}/miniapp/"
echo "Config file: ${APP_DIR}/config.php"
echo ""
echo "Open @BotFather and set the Mini App / Menu Button URL to: https://${DOMAIN}/miniapp/"
