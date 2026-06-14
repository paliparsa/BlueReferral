#!/usr/bin/env bash
# BlueReferral interactive installer / manager
# Repo: https://github.com/paliparsa/BlueReferral

set -uo pipefail

APP_NAME="bluereferral"
DEFAULT_REPO_URL="https://github.com/paliparsa/BlueReferral.git"
DEFAULT_APP_DIR="/var/www/${APP_NAME}"
ENV_FILE="/etc/blue-ref.env"
LOG_FILE="/var/log/blue-ref-install.log"
REMOTE_INSTALL_URL="https://raw.githubusercontent.com/paliparsa/BlueReferral/main/install.sh"

# Defaults, may be overwritten by /etc/blue-ref.env or user input.
DOMAIN="${DOMAIN:-}"
BOT_TOKEN="${BOT_TOKEN:-}"
BOT_USERNAME="${BOT_USERNAME:-}"
ADMIN_IDS="${ADMIN_IDS:-}"
SUPPORT_USERNAME="${SUPPORT_USERNAME:-BlueGateSupport}"
REPO_URL="${REPO_URL:-$DEFAULT_REPO_URL}"
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
DB_NAME="${DB_NAME:-bluegate_referral}"
DB_USER="${DB_USER:-bluegate_user}"
DB_PASS="${DB_PASS:-}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-}"
THEME_COLOR="${THEME_COLOR:-#1d9bf0}"
BRAND_NAME="${BRAND_NAME:-BlueGate}"
FORCE_JOIN_CHANNEL="${FORCE_JOIN_CHANNEL:-}"
ENABLE_SSL="${ENABLE_SSL:-yes}"

[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

# Recreate log redirection only in interactive/root runs.
if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
  touch "$LOG_FILE" 2>/dev/null || true
  chmod 600 "$LOG_FILE" 2>/dev/null || true
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

line() { printf '%*s\n' "${COLUMNS:-72}" '' | tr ' ' '-'; }
info() { echo "[INFO] $*"; }
ok() { echo "[OK] $*"; }
warn() { echo "[WARN] $*"; }
fail() { echo "[ERROR] $*"; }
pause() { echo; read -rp "Press Enter to return to menu..." _ || true; }

require_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    echo "Please run as root. Example: sudo blue-ref"
    exit 1
  fi
}

rand_hex() { openssl rand -hex "${1:-16}" 2>/dev/null || date +%s%N | sha256sum | cut -c1-$(( ${1:-16} * 2 )); }

ask_value() {
  local var="$1" prompt="$2" default="${3:-}" secret="${4:-no}" current value shown
  current="${!var:-}"
  [[ -z "$current" && -n "$default" ]] && current="$default"
  if [[ "$secret" == "yes" && -n "$current" ]]; then
    read -rp "$prompt [saved, press Enter to keep]: " value || true
    [[ -n "$value" ]] && printf -v "$var" '%s' "$value" || printf -v "$var" '%s' "$current"
    return
  fi
  if [[ -n "$current" ]]; then
    read -rp "$prompt [$current]: " value || true
    printf -v "$var" '%s' "${value:-$current}"
  else
    while true; do
      read -rp "$prompt: " value || true
      [[ -n "$value" ]] && { printf -v "$var" '%s' "$value"; break; }
      echo "This value is required."
    done
  fi
}
ask_optional() {
  local var="$1" prompt="$2" current value
  current="${!var:-}"
  if [[ -n "$current" ]]; then
    read -rp "$prompt [$current, Enter=keep, - = disable]: " value || true
    if [[ "$value" == "-" ]]; then
      printf -v "$var" '%s' ""
    else
      printf -v "$var" '%s' "${value:-$current}"
    fi
  else
    read -rp "$prompt [optional, Enter=disable]: " value || true
    printf -v "$var" '%s' "$value"
  fi
}

save_env() {
  umask 077
  {
    echo "# BlueReferral manager state - generated automatically"
    for var in DOMAIN BOT_TOKEN BOT_USERNAME ADMIN_IDS SUPPORT_USERNAME REPO_URL APP_DIR DB_NAME DB_USER DB_PASS WEBHOOK_SECRET THEME_COLOR BRAND_NAME FORCE_JOIN_CHANNEL ENABLE_SSL; do
      printf '%s=%q\n' "$var" "${!var:-}"
    done
  } > "$ENV_FILE"
  ok "Settings saved to $ENV_FILE"
}

php_escape() {
  # Escapes single-quoted PHP strings.
  printf "%s" "$1" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g"
}

admin_array_php() {
  echo "$ADMIN_IDS" | awk -F, '{c=0; for(i=1;i<=NF;i++){gsub(/ /,"",$i); if($i ~ /^[0-9]+$/){printf "%s%s", (c++?",":""), $i}}}' | sed 's/^/[/' | sed 's/$/]/'
}

try_extract_php_config() {
  # If /etc/blue-ref.env is missing but config.php exists, recover useful values.
  local cfg="$APP_DIR/config.php"
  [[ -f "$cfg" ]] || return 0
  local val
  extract_string() {
    local key="$1"
    grep -E "^\\\$$key[[:space:]]*=" "$cfg" | head -n1 | sed -E "s/^\\\$$key[[:space:]]*=[[:space:]]*'([^']*)'.*/\\1/"
  }
  [[ -z "$BOT_TOKEN" ]] && BOT_TOKEN="$(extract_string BOT_TOKEN)"
  [[ -z "$BOT_USERNAME" ]] && BOT_USERNAME="$(extract_string BOT_USERNAME)"
  [[ -z "$SUPPORT_USERNAME" ]] && SUPPORT_USERNAME="$(extract_string SUPPORT_USERNAME)"
  [[ -z "$DB_NAME" ]] && DB_NAME="$(extract_string DB_NAME)"
  [[ -z "$DB_USER" ]] && DB_USER="$(extract_string DB_USER)"
  [[ -z "$DB_PASS" ]] && DB_PASS="$(extract_string DB_PASS)"
  [[ -z "$WEBHOOK_SECRET" ]] && WEBHOOK_SECRET="$(extract_string WEBHOOK_SECRET)"
  [[ -z "$THEME_COLOR" ]] && THEME_COLOR="$(extract_string DEFAULT_THEME_COLOR)"
  [[ -z "$BRAND_NAME" ]] && BRAND_NAME="$(extract_string BRAND_NAME)"
  [[ -z "$FORCE_JOIN_CHANNEL" ]] && FORCE_JOIN_CHANNEL="$(extract_string FORCE_JOIN_CHANNEL)"
  val="$(grep -E '^\$PUBLIC_BASE_URL[[:space:]]*=' "$cfg" | head -n1 | sed -E "s#^\\\$PUBLIC_BASE_URL[[:space:]]*=[[:space:]]*'https?://([^']*)'.*#\\1#")"
  [[ -z "$DOMAIN" && -n "$val" ]] && DOMAIN="$val"
}

collect_settings() {
  clear
  echo "BlueReferral setup wizard"
  line
  try_extract_php_config
  [[ -z "$DB_PASS" ]] && DB_PASS="$(rand_hex 16)"
  [[ -z "$WEBHOOK_SECRET" ]] && WEBHOOK_SECRET="$(rand_hex 20)"

  ask_value DOMAIN "Domain without https, example ref.yourdomain.com"
  ask_value BOT_TOKEN "Telegram bot token" "" yes
  ask_value BOT_USERNAME "Bot username without @"
  ask_value ADMIN_IDS "Admin Telegram numeric IDs, comma separated"
  ask_value SUPPORT_USERNAME "Support username without @" "BlueGateSupport"
  ask_value REPO_URL "GitHub repository URL" "$DEFAULT_REPO_URL"
  ask_value APP_DIR "Install directory" "$DEFAULT_APP_DIR"
  ask_value DB_NAME "Database name" "bluegate_referral"
  ask_value DB_USER "Database user" "bluegate_user"
  ask_value DB_PASS "Database password" "" yes
  ask_value WEBHOOK_SECRET "Webhook secret" "" yes
  ask_value BRAND_NAME "Brand name" "BlueGate"
  ask_value THEME_COLOR "Mini App default theme color" "#1d9bf0"
  ask_optional FORCE_JOIN_CHANNEL "Force join channel, example @BllueGate"
  ask_value ENABLE_SSL "Enable SSL with certbot? yes/no" "yes"
  save_env
}

install_blue_ref_command() {
  require_root
  cat > /usr/local/bin/blue-ref <<'CLI'
#!/usr/bin/env bash
set -uo pipefail
ENV_FILE="/etc/blue-ref.env"
APP_DIR="/var/www/bluereferral"
REMOTE_INSTALL_URL="https://raw.githubusercontent.com/paliparsa/BlueReferral/main/install.sh"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  exec sudo -E "$0" "$@"
fi
if [[ -f "$APP_DIR/install.sh" ]]; then
  exec bash "$APP_DIR/install.sh" "$@"
fi
if command -v curl >/dev/null 2>&1; then
  exec bash <(curl -fsSL "$REMOTE_INSTALL_URL") "$@"
fi
echo "BlueReferral is not installed yet and curl is missing."
exit 1
CLI
  chmod +x /usr/local/bin/blue-ref
  ok "Command installed: blue-ref"
}

run_step() {
  local title="$1" fn="$2"
  echo
  line
  info "$title"
  line
  if "$fn"; then
    ok "$title finished"
    return 0
  fi
  local code=$?
  fail "$title failed with exit code $code"
  echo "Log file: $LOG_FILE"
  return "$code"
}

step_packages() {
  require_root
  export DEBIAN_FRONTEND=noninteractive
  export NEEDRESTART_MODE=a
  apt-get update -y || return 1
  apt-get install -y nginx mariadb-server git curl unzip openssl ca-certificates php-fpm php-cli php-mysql php-curl php-mbstring certbot python3-certbot-nginx || return 1
  timeout 60 systemctl enable nginx mariadb || true
  timeout 60 systemctl start nginx || return 1
  timeout 60 systemctl start mariadb || return 1
}

step_repo() {
  require_root
  [[ -n "$REPO_URL" ]] || { fail "REPO_URL is empty. Run setup wizard first."; return 1; }
  [[ -n "$APP_DIR" ]] || { fail "APP_DIR is empty. Run setup wizard first."; return 1; }
  mkdir -p "$(dirname "$APP_DIR")" || return 1
  git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
  if [[ -d "$APP_DIR/.git" ]]; then
    info "Updating existing repository in $APP_DIR"
    git -C "$APP_DIR" fetch --all --prune || return 1
    git -C "$APP_DIR" pull --ff-only || return 1
  else
    info "Cloning $REPO_URL into $APP_DIR"
    rm -rf "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR" || return 1
  fi
  chmod +x "$APP_DIR/install.sh" "$APP_DIR/update.sh" "$APP_DIR/uninstall.sh" 2>/dev/null || true
  chown -R www-data:www-data "$APP_DIR" 2>/dev/null || true
}

step_config() {
  require_root
  [[ -d "$APP_DIR" ]] || { fail "Project directory not found. Run repository step first."; return 1; }
  [[ -n "$DOMAIN" && -n "$BOT_TOKEN" && -n "$BOT_USERNAME" && -n "$ADMIN_IDS" ]] || { fail "Missing required settings. Run setup wizard first."; return 1; }
  [[ -n "$DB_PASS" ]] || DB_PASS="$(rand_hex 16)"
  [[ -n "$WEBHOOK_SECRET" ]] || WEBHOOK_SECRET="$(rand_hex 20)"

  local admin_array public_base mini_url
  admin_array="$(admin_array_php)"
  [[ "$admin_array" == "[]" ]] && { fail "ADMIN_IDS must contain at least one numeric Telegram ID."; return 1; }
  public_base="https://${DOMAIN}"
  mini_url="https://${DOMAIN}/miniapp/"

  cat > "$APP_DIR/config.php" <<PHP
<?php
\$BOT_TOKEN = '$(php_escape "$BOT_TOKEN")';
\$BOT_USERNAME = '$(php_escape "$BOT_USERNAME")';
\$ADMIN_IDS = ${admin_array};
\$SUPPORT_USERNAME = '$(php_escape "$SUPPORT_USERNAME")';
\$TIMEZONE = 'Europe/Istanbul';
\$PUBLIC_BASE_URL = '$(php_escape "$public_base")';
\$WEBHOOK_SECRET = '$(php_escape "$WEBHOOK_SECRET")';
\$MINIAPP_URL = '$(php_escape "$mini_url")';
\$DB_HOST = 'localhost';
\$DB_NAME = '$(php_escape "$DB_NAME")';
\$DB_USER = '$(php_escape "$DB_USER")';
\$DB_PASS = '$(php_escape "$DB_PASS")';
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
\$FORCE_JOIN_CHANNEL = '$(php_escape "$FORCE_JOIN_CHANNEL")';
\$DEFAULT_THEME_COLOR = '$(php_escape "$THEME_COLOR")';
\$BRAND_NAME = '$(php_escape "$BRAND_NAME")';
\$CRYPTO_RATE_SOURCE = 'nobitex';
\$CRYPTO_RATE_MARKUP_PERCENT = 1;
\$CRYPTO_MANUAL_RATES = ['USDT'=>0,'TRX'=>0,'TON'=>0];
\$TRONSCAN_API_KEY = '';
\$TONCENTER_API_KEY = '';
PHP
  php -l "$APP_DIR/config.php" || return 1
  chmod 640 "$APP_DIR/config.php"
  chown -R www-data:www-data "$APP_DIR" 2>/dev/null || true
  save_env
}

step_database() {
  require_root
  timeout 60 systemctl start mariadb || return 1
  local tmp
  tmp="$(mktemp)" || return 1
  cat > "$tmp" <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
  mysql < "$tmp" || { rm -f "$tmp"; return 1; }
  rm -f "$tmp"
}

find_php_sock() {
  find /run/php -name 'php*-fpm.sock' 2>/dev/null | sort -V | tail -n1
}

step_nginx() {
  require_root
  [[ -d "$APP_DIR/public" ]] || { fail "Public directory not found: $APP_DIR/public"; return 1; }
  local php_sock
  php_sock="$(find_php_sock)"
  [[ -n "$php_sock" ]] || { fail "Could not find php-fpm socket in /run/php"; return 1; }
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
        fastcgi_pass unix:${php_sock};
    }

    location ~ /\. {
        deny all;
    }
}
NGINX
  ln -sf "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}" || return 1
  nginx -t || return 1
  timeout 60 systemctl reload nginx || return 1
}

step_ssl() {
  require_root
  if [[ "${ENABLE_SSL,,}" != "yes" && "${ENABLE_SSL,,}" != "y" ]]; then
    warn "SSL step skipped because ENABLE_SSL=$ENABLE_SSL"
    return 0
  fi
  [[ -n "$DOMAIN" ]] || { fail "DOMAIN is empty"; return 1; }
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@${DOMAIN}" --redirect
}

step_migrate() {
  require_root
  [[ -f "$APP_DIR/public/install.php" ]] || { fail "Missing $APP_DIR/public/install.php"; return 1; }
  if command -v runuser >/dev/null 2>&1; then
    runuser -u www-data -- php "$APP_DIR/public/install.php" || return 1
  else
    php "$APP_DIR/public/install.php" || return 1
  fi
}

step_webhook() {
  require_root
  [[ -n "$BOT_TOKEN" && -n "$DOMAIN" && -n "$WEBHOOK_SECRET" ]] || { fail "Missing BOT_TOKEN / DOMAIN / WEBHOOK_SECRET"; return 1; }
  local res
  res="$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
    -d "url=https://${DOMAIN}/bot.php?secret=${WEBHOOK_SECRET}" \
    -d 'allowed_updates=["message","callback_query","pre_checkout_query"]')" || return 1
  echo "Telegram response: $res"
  echo "$res" | grep -q '"ok":true' || return 1
}

step_crypto_cron() {
  require_root
  [[ -f "$APP_DIR/public/cron_crypto.php" ]] || { fail "Missing $APP_DIR/public/cron_crypto.php"; return 1; }
  cat > /etc/cron.d/blue-ref-crypto <<CRON
# BlueReferral crypto jobs
# Check submitted TXIDs every minute so payments are confirmed quickly.
* * * * * www-data php ${APP_DIR}/public/cron_crypto.php --check-payments >/dev/null 2>&1
# Refresh Nobitex cached rates every 10 minutes so Mini App/API stays fast.
*/10 * * * * www-data php ${APP_DIR}/public/cron_crypto.php --refresh-rates >/dev/null 2>&1
CRON
  chmod 644 /etc/cron.d/blue-ref-crypto
  ok "Crypto cron installed: payments every 1 min, rates every 10 min (/etc/cron.d/blue-ref-crypto)"
}

step_update() {
  require_root
  [[ -d "$APP_DIR/.git" ]] || { fail "No git repository found in $APP_DIR"; return 1; }
  git -C "$APP_DIR" pull --ff-only || return 1
  chown -R www-data:www-data "$APP_DIR" 2>/dev/null || true
  step_migrate || return 1
  nginx -t && timeout 60 systemctl reload nginx || true
}

step_status() {
  echo "BlueReferral status"
  line
  echo "App dir:      $APP_DIR"
  echo "Repo URL:     $REPO_URL"
  echo "Domain:       ${DOMAIN:-not set}"
  echo "Mini App:     ${DOMAIN:+https://${DOMAIN}/miniapp/}"
  echo "Env file:     $ENV_FILE"
  echo "Log file:     $LOG_FILE"
  echo "blue-ref cmd: $(command -v blue-ref || echo not installed)"
  echo
  [[ -d "$APP_DIR" ]] && echo "Project dir:  exists" || echo "Project dir:  missing"
  [[ -f "$APP_DIR/config.php" ]] && echo "Config:       exists" || echo "Config:       missing"
  [[ -f "$APP_DIR/config.php" ]] && php -l "$APP_DIR/config.php" || true
  echo
  systemctl is-active --quiet nginx && echo "nginx:        active" || echo "nginx:        inactive/failed"
  systemctl is-active --quiet mariadb && echo "mariadb:      active" || echo "mariadb:      inactive/failed"
  nginx -t || true
}

step_uninstall_files() {
  require_root
  echo "This removes nginx site and app files. Database is NOT removed."
  read -rp "Continue? [y/N] " yn || true
  [[ "$yn" == "y" || "$yn" == "Y" ]] || return 0
  rm -f "/etc/nginx/sites-enabled/${APP_NAME}" "/etc/nginx/sites-available/${APP_NAME}"
  rm -rf "$APP_DIR"
  nginx -t && timeout 60 systemctl reload nginx || true
  ok "App files removed. Database and $ENV_FILE kept."
}

full_install() {
  run_step "Install/repair blue-ref command" install_blue_ref_command || { pause; return 1; }
  collect_settings
  run_step "Install system packages" step_packages || { pause; return 1; }
  run_step "Clone/update repository" step_repo || { pause; return 1; }
  run_step "Generate config.php" step_config || { pause; return 1; }
  run_step "Create/update database" step_database || { pause; return 1; }
  run_step "Configure nginx" step_nginx || { pause; return 1; }
  run_step "Request SSL certificate" step_ssl || { pause; return 1; }
  run_step "Run database migrations" step_migrate || { pause; return 1; }
  run_step "Set Telegram webhook" step_webhook || { pause; return 1; }
  run_step "Install crypto payment cron" step_crypto_cron || { pause; return 1; }
  echo
  ok "Installation finished"
  echo "Bot webhook: https://${DOMAIN}/bot.php?secret=${WEBHOOK_SECRET}"
  echo "Mini App URL: https://${DOMAIN}/miniapp/"
  echo "Run anytime: blue-ref"
  pause
}

menu() {
  require_root
  while true; do
    clear
    echo "BlueReferral Installer / Manager"
    line
    echo "1) Full install / reinstall recommended path"
    echo "2) Setup wizard only: domain, token, database, theme"
    echo "3) Install/repair system packages"
    echo "4) Clone/update GitHub repository"
    echo "5) Generate/repair config.php"
    echo "6) Create/update database user and DB"
    echo "7) Configure nginx"
    echo "8) Request/repair SSL certificate"
    echo "9) Run database migrations"
    echo "10) Set Telegram webhook"
    echo "11) Install/repair blue-ref command"
    echo "12) Update project from GitHub"
    echo "13) Status / diagnostics"
    echo "14) Remove app files only"
    echo "15) Install/repair crypto payment cron"
    echo "0) Exit"
    line
    echo "After installation you can run this menu anytime with: blue-ref"
    echo "Log: $LOG_FILE"
    line
    read -rp "Choose an option: " choice || true
    case "$choice" in
      1) full_install ;;
      2) collect_settings; pause ;;
      3) run_step "Install system packages" step_packages; pause ;;
      4) run_step "Clone/update repository" step_repo; pause ;;
      5) run_step "Generate/repair config.php" step_config; pause ;;
      6) run_step "Create/update database" step_database; pause ;;
      7) run_step "Configure nginx" step_nginx; pause ;;
      8) run_step "Request/repair SSL certificate" step_ssl; pause ;;
      9) run_step "Run database migrations" step_migrate; pause ;;
      10) run_step "Set Telegram webhook" step_webhook; pause ;;
      11) run_step "Install/repair blue-ref command" install_blue_ref_command; pause ;;
      12) run_step "Update project from GitHub" step_update; pause ;;
      13) step_status; pause ;;
      14) step_uninstall_files; pause ;;
      15) run_step "Install/repair crypto payment cron" step_crypto_cron; pause ;;
      0) exit 0 ;;
      *) echo "Invalid option"; sleep 1 ;;
    esac
  done
}

case "${1:-}" in
  --full) require_root; full_install ;;
  --status) require_root; step_status ;;
  --webhook) require_root; run_step "Set Telegram webhook" step_webhook ;;
  --update) require_root; run_step "Update project from GitHub" step_update ;;
  --install-command) require_root; run_step "Install/repair blue-ref command" install_blue_ref_command ;;
  --crypto-cron) require_root; run_step "Install/repair crypto payment cron" step_crypto_cron ;;
  --help|-h)
    echo "Usage: sudo bash install.sh [--full|--status|--webhook|--update|--install-command]"
    echo "Default: opens interactive menu. After setup run: blue-ref"
    ;;
  *) menu ;;
esac
