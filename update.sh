#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR="${APP_DIR:-/var/www/bluegate-referral-wallet}"
if [[ $EUID -ne 0 ]]; then echo "Run as root"; exit 1; fi
git -C "$APP_DIR" pull --ff-only
chown -R www-data:www-data "$APP_DIR"
sudo -u www-data php "$APP_DIR/public/install.php"
systemctl reload nginx || true
echo "Updated."
