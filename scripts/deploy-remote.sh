#!/bin/bash
set -euo pipefail

SITE_DIR="/opt/sites/qafaseman"
APP_DIR="$SITE_DIR/.next/standalone"
ARCHIVE="$SITE_DIR/standalone.tar.gz"
PM2=(sudo -u deployer -H env PORT=3001 HOSTNAME=0.0.0.0 pm2)

test -f "$ARCHIVE"
mkdir -p "$SITE_DIR/.next"
STAGING_DIR=$(mktemp -d "$SITE_DIR/.next/standalone.new.XXXXXX")
BACKUP_DIR=$(mktemp -d "$SITE_DIR/.next/standalone.old.XXXXXX")
rmdir "$BACKUP_DIR"
HAD_PROCESS=false
STOPPED=false
MOVED_OLD=false
MOVED_NEW=false

cleanup() {
    status=$?
    trap - EXIT
    if [ "$status" -ne 0 ]; then
        if [ "$MOVED_NEW" = true ]; then
            "${PM2[@]}" delete qafaseman >/dev/null 2>&1 || true
            rm -rf -- "$APP_DIR"
        fi
        if [ "$MOVED_OLD" = true ]; then
            mv -- "$BACKUP_DIR" "$APP_DIR"
        fi
        if [ "$STOPPED" = true ]; then
            "${PM2[@]}" delete qafaseman >/dev/null 2>&1 || true
            "${PM2[@]}" start "$APP_DIR/server.js" --name qafaseman --cwd "$APP_DIR" || true
        fi
    fi
    rm -rf -- "$STAGING_DIR"
    if [ "$status" -eq 0 ]; then
        rm -rf -- "$BACKUP_DIR"
    fi
    exit "$status"
}
trap cleanup EXIT

tar -xzf "$ARCHIVE" -C "$STAGING_DIR"
test -f "$STAGING_DIR/server.js"
test -d "$STAGING_DIR/.next/server/chunks/ssr"
test -d "$STAGING_DIR/.next/static"
chown -R deployer:deployer "$STAGING_DIR"

if "${PM2[@]}" describe qafaseman >/dev/null 2>&1; then
    HAD_PROCESS=true
    "${PM2[@]}" stop qafaseman
    STOPPED=true
fi
if [ -d "$APP_DIR" ]; then
    mv -- "$APP_DIR" "$BACKUP_DIR"
    MOVED_OLD=true
fi
mv -- "$STAGING_DIR" "$APP_DIR"
MOVED_NEW=true

if [ "$HAD_PROCESS" = true ]; then
    "${PM2[@]}" restart qafaseman --update-env
else
    "${PM2[@]}" start "$APP_DIR/server.js" --name qafaseman --cwd "$APP_DIR"
fi
for attempt in $(seq 1 20); do
    if curl -fsS --max-time 2 http://127.0.0.1:3001/api/health >/dev/null; then
        break
    fi
    if [ "$attempt" -eq 20 ]; then
        echo "qafaseman health check failed" >&2
        exit 1
    fi
    sleep 1
done
"${PM2[@]}" save
rm -f -- "$ARCHIVE"
echo "qafaseman deployment completed"
