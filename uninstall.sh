#!/usr/bin/env bash
set -Eeuo pipefail
APP_NAME="bluegate-referral-wallet"
APP_DIR="${APP_DIR:-/var/www/${APP_NAME}}"
read -rp "This removes nginx site and app files, not database. Continue? [y/N] " yn
[[ "$yn" == "y" || "$yn" == "Y" ]] || exit 0
rm -f "/etc/nginx/sites-enabled/${APP_NAME}" "/etc/nginx/sites-available/${APP_NAME}"
rm -rf "$APP_DIR"
nginx -t && systemctl reload nginx
