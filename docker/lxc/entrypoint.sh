#!/usr/bin/env bash
#
# PID 1 for the all-in-one image (docker/Dockerfile.lxc): bring up Postgres,
# apply migrations, then run the web app and the bot side by side.
#
# Runs as root and drops privileges for every service it starts. Root is here
# for exactly one reason: a freshly attached Proxmox mount point belongs to
# container-root, and Postgres refuses to run as root, so somebody has to chown
# it. In an unprivileged container, container-root is an ordinary unprivileged
# user on the host.
#
# Deliberately not s6-overlay. Three processes with one ordering constraint do
# not earn a supervision framework.

set -euo pipefail

PGDATA=${PGDATA:-/data/postgres}
DATA_DIR=$(dirname "$PGDATA")
SECRET_FILE="$DATA_DIR/secret"
DBPASS_FILE="$DATA_DIR/dbpass"
APP_USER=node
APP_HOME=/home/node
PG_USER=postgres
DB_NAME=askarr
DB_ROLE=askarr

say() { printf 'askarr: %s\n' "$*"; }

# ------------------------------------------------------------------ APP_URL
#
# The one value nobody can guess for the operator, and the one whose absence
# is invisible later: Radarr's webhook is the only way Askarr ever learns that
# something was grabbed or imported, so a missing or wrong APP_URL looks
# exactly like a working install until nothing is ever marked available.
# Refusing to start is the honest failure.
if [ -z "${APP_URL:-}" ]; then
  cat >&2 <<'MSG'
askarr: refusing to start, because APP_URL is not set.

APP_URL is the address Askarr is reachable at FROM YOUR RADARR AND SONARR,
not the one you type in your browser. Radarr calls back to it over a webhook,
and that webhook is the only way Askarr learns that something arrived.

On Proxmox, set it in the container's Options tab under Environment, or from
the host shell:

    pct set <ctid> --env APP_URL=http://10.0.0.42:3000
    pct reboot <ctid>

With docker run, pass -e APP_URL=http://... instead.
MSG
  exit 1
fi

mkdir -p "$DATA_DIR"

# ----------------------------------------------------------------- secrets
#
# Generated once and kept, so the operator sets one variable rather than
# three. BETTER_AUTH_SECRET in particular has to survive a restart: changing
# it signs everyone out, and on Proxmox a restart is also how an upgrade
# happens.
if [ -z "${BETTER_AUTH_SECRET:-}" ]; then
  if [ ! -f "$SECRET_FILE" ]; then
    openssl rand -base64 32 > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE"
    say "generated a session secret at $SECRET_FILE"
  fi
  BETTER_AUTH_SECRET=$(cat "$SECRET_FILE")
fi
export BETTER_AUTH_SECRET
export BETTER_AUTH_URL=${BETTER_AUTH_URL:-$APP_URL}
export APP_URL

# ---------------------------------------------------------------- Postgres
#
# An externally set DATABASE_URL means somebody already runs Postgres and
# would rather Askarr used theirs. Honour it and start nothing.
BUNDLED_DB=1
if [ -n "${DATABASE_URL:-}" ]; then
  BUNDLED_DB=0
  say "using the DATABASE_URL you set; not starting the bundled Postgres"
fi

if [ "$BUNDLED_DB" = "1" ]; then
  if [ ! -f "$DBPASS_FILE" ]; then
    openssl rand -hex 24 > "$DBPASS_FILE"
    chmod 600 "$DBPASS_FILE"
  fi
  DB_PASS=$(cat "$DBPASS_FILE")
  chown "$PG_USER:$PG_USER" "$DBPASS_FILE"

  mkdir -p "$PGDATA"
  # Only when it is actually wrong. On a fresh Proxmox mount point the
  # directory belongs to container-root; after that it already belongs to
  # postgres, and recursing over a real database every boot would be a waste.
  if [ "$(stat -c %u "$PGDATA")" != "$(id -u "$PG_USER")" ]; then
    chown -R "$PG_USER:$PG_USER" "$PGDATA"
  fi
  chmod 700 "$PGDATA"

  # Postgres wants somewhere for its socket, and /var/run starts empty on
  # every boot.
  mkdir -p /var/run/postgresql
  chown "$PG_USER:$PG_USER" /var/run/postgresql

  FIRST_BOOT=0
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    FIRST_BOOT=1
    say "initialising the database in $PGDATA"
    su "$PG_USER" -c \
      "initdb --username=$PG_USER --auth-local=trust --auth-host=scram-sha-256 --encoding=UTF8 --locale=C" \
      >/dev/null
  fi

  # Nothing outside this container ever talks to Postgres, so it never listens
  # anywhere else.
  su "$PG_USER" -c \
    "pg_ctl -D '$PGDATA' -o '-c listen_addresses=127.0.0.1 -p 5432' -w -t 60 start"

  if [ "$FIRST_BOOT" = "1" ]; then
    say "creating the askarr role and database"
    su "$PG_USER" -c \
      "psql -v ON_ERROR_STOP=1 --quiet -c \"CREATE ROLE $DB_ROLE LOGIN PASSWORD '$DB_PASS'\"" >/dev/null
    su "$PG_USER" -c \
      "psql -v ON_ERROR_STOP=1 --quiet -c \"CREATE DATABASE $DB_NAME OWNER $DB_ROLE\"" >/dev/null
  fi

  export DATABASE_URL="postgresql://$DB_ROLE:$DB_PASS@127.0.0.1:5432/$DB_NAME"
fi

stop_postgres() {
  if [ "$BUNDLED_DB" = "1" ]; then
    su "$PG_USER" -c "pg_ctl -D '$PGDATA' -m fast -w -t 30 stop" >/dev/null 2>&1 || true
  fi
}

# --------------------------------------------------------------- migrations
#
# Every boot, not only the first. On Proxmox an upgrade means creating a new
# container from the newer image and attaching the same /data, so start-up is
# the only moment a new schema can ever be applied.
say "applying migrations"
if ! npm run --silent db:migrate; then
  say "migrations failed; refusing to serve against a schema Askarr does not know"
  stop_postgres
  exit 1
fi

# ---------------------------------------------------------- web and the bot
#
# Both as children, and neither allowed to fail quietly. If either one dies
# the container dies with it and the platform restarts the pair. A bot that
# vanished while the back office carried on serving would be a very quiet kind
# of broken, and the back office would happily report a bot that is not there.
WEB_PID=
BOT_PID=

shut_down() {
  local code=${1:-0}
  kill -TERM "$WEB_PID" "$BOT_PID" 2>/dev/null || true
  wait "$WEB_PID" "$BOT_PID" 2>/dev/null || true
  stop_postgres
  exit "$code"
}

trap 'say "stopping"; shut_down 0' TERM INT

say "starting the web app on port ${PORT:-3000}"
setpriv --reuid="$APP_USER" --regid="$APP_USER" --init-groups \
  env HOME="$APP_HOME" npm run --silent start &
WEB_PID=$!

say "starting the bot"
setpriv --reuid="$APP_USER" --regid="$APP_USER" --init-groups \
  env HOME="$APP_HOME" npm run --silent start:bot &
BOT_PID=$!

status=0
wait -n "$WEB_PID" "$BOT_PID" || status=$?
say "one of the two processes exited ($status); shutting the container down"
shut_down "${status:-1}"
