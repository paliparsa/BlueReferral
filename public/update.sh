#!/usr/bin/env bash
set -uo pipefail
ENV_FILE="/etc/blue-ref.env"
APP_DIR="${APP_DIR:-/var/www/bluereferral}"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root: sudo bash update.sh or sudo blue-ref"
  exit 1
fi
if [[ -f "$APP_DIR/install.sh" ]]; then
  exec bash "$APP_DIR/install.sh" --update
fi
echo "Cannot find $APP_DIR/install.sh. Run the one-line installer again or use: blue-ref"
exit 1
