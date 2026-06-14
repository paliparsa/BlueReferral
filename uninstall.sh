#!/usr/bin/env bash
set -uo pipefail
ENV_FILE="/etc/blue-ref.env"
APP_NAME="bluereferral"
APP_DIR="${APP_DIR:-/var/www/bluereferral}"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root: sudo bash uninstall.sh"
  exit 1
fi
echo "This removes nginx site and app files only. Database and $ENV_FILE will be kept."
read -rp "Continue? [y/N] " yn || true
[[ "$yn" == "y" || "$yn" == "Y" ]] || exit 0
rm -f "/etc/nginx/sites-enabled/${APP_NAME}" "/etc/nginx/sites-available/${APP_NAME}"
rm -rf "$APP_DIR"
if command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx || true
fi
echo "Removed app files. To remove blue-ref command: rm -f /usr/local/bin/blue-ref"
