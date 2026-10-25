#!/bin/sh
# Entrypoint for the all-in-one image. Driven by APP_ENV (dev | staging | prod):
#   * applies environment-specific defaults (dev gets working demo defaults, staging/prod get none),
#   * validates configuration and refuses to start staging/prod with demo or missing secrets,
#   * renders nginx config + /config.json, initialises the embedded DB if used, then starts supervisord.
set -eu

RUNTIME=/tmp/runtime
mkdir -p "$RUNTIME"

APP_ENV="${APP_ENV:-dev}"
case "$APP_ENV" in
  dev|staging|prod) ;;
  *) echo "APP_ENV must be one of dev, staging, prod (got '$APP_ENV')" >&2; exit 1 ;;
esac
export APP_ENV

DEMO_JWT_SECRET="change-me-to-a-long-random-secret-of-32-bytes-min"
DEMO_DB_PASSWORD="sarvaikam"
DEMO_ADMIN_PASSWORD="admin12345"
ERRORS=0
fail() { echo "[$APP_ENV] configuration error: $*" >&2; ERRORS=$((ERRORS + 1)); }
warn() { echo "[$APP_ENV] warning: $*" >&2; }

: "${PORT:=8080}"
: "${POSTGRES_DB:=sarvaikam}"
: "${POSTGRES_USER:=sarvaikam}"
: "${DB_PORT:=5432}"

# ---------------------------------------------------------------- environment defaults
if [ "$APP_ENV" = "dev" ]; then
  # Dev works out of the box: embedded Postgres and demo credentials.
  : "${EMBEDDED_DB:=true}"
  : "${JWT_SECRET:=$DEMO_JWT_SECRET}"
  : "${POSTGRES_PASSWORD:=$DEMO_DB_PASSWORD}"
  : "${ADMIN_EMAIL:=admin@sarvaikam.dev}"
  : "${ADMIN_PASSWORD:=$DEMO_ADMIN_PASSWORD}"
  : "${LOG_LEVEL:=debug}"
else
  # Staging/prod: an external managed Postgres and real secrets are expected.
  : "${EMBEDDED_DB:=false}"
  : "${LOG_LEVEL:=info}"
  : "${JWT_SECRET:=}" "${POSTGRES_PASSWORD:=}" "${ADMIN_PASSWORD:=}"
fi

# ---------------------------------------------------------------- validation
case "$EMBEDDED_DB" in true|false) ;; *) fail "EMBEDDED_DB must be true or false" ;; esac

if [ "$EMBEDDED_DB" = "true" ]; then
  DB_HOST=127.0.0.1
  : "${DB_SSLMODE:=disable}"
  if [ "$APP_ENV" = "prod" ] && [ "${ALLOW_EMBEDDED_DB:-false}" != "true" ]; then
    fail "embedded database is not allowed in prod (data is per-pod and lost on restart). Set EMBEDDED_DB=false and DB_HOST, or ALLOW_EMBEDDED_DB=true to override"
  elif [ "$APP_ENV" != "dev" ]; then
    warn "using the embedded database: data lives in this pod only - do not run more than 1 replica"
  fi
else
  : "${DB_SSLMODE:=$([ "$APP_ENV" = "dev" ] && echo disable || echo require)}"
  if [ -z "${DB_HOST:-}" ] || [ "$DB_HOST" = "127.0.0.1" ] || [ "$DB_HOST" = "localhost" ]; then
    fail "DB_HOST must point at an external PostgreSQL when EMBEDDED_DB=false"
  fi
fi
case "$DB_SSLMODE" in disable|require|verify-ca|verify-full) ;; *) fail "DB_SSLMODE must be disable, require, verify-ca or verify-full" ;; esac

if [ "$APP_ENV" != "dev" ]; then
  [ -n "$JWT_SECRET" ] || fail "JWT_SECRET is required"
  [ "$JWT_SECRET" != "$DEMO_JWT_SECRET" ] || fail "JWT_SECRET must not be the demo value"
  [ "${#JWT_SECRET}" -ge 32 ] || fail "JWT_SECRET must be at least 32 characters"
  [ -n "$POSTGRES_PASSWORD" ] || fail "POSTGRES_PASSWORD is required"
  [ "$POSTGRES_PASSWORD" != "$DEMO_DB_PASSWORD" ] || fail "POSTGRES_PASSWORD must not be the demo value"
  if [ -n "${ADMIN_EMAIL:-}" ]; then
    # Admin bootstrap is optional outside dev; if requested it must use a strong password.
    [ "${#ADMIN_PASSWORD}" -ge 12 ] || fail "ADMIN_PASSWORD must be at least 12 characters when ADMIN_EMAIL is set"
    [ "$ADMIN_PASSWORD" != "$DEMO_ADMIN_PASSWORD" ] || fail "ADMIN_PASSWORD must not be the demo value"
  fi
elif [ "$JWT_SECRET" = "$DEMO_JWT_SECRET" ]; then
  warn "using the demo JWT secret (fine for dev only)"
fi

if [ "$ERRORS" -gt 0 ]; then
  echo "[$APP_ENV] refusing to start: $ERRORS configuration error(s). See README 'Environments'." >&2
  exit 1
fi

# ---------------------------------------------------------------- derived settings per service
export EMBEDDED_DB DB_HOST DB_PORT DB_SSLMODE POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD JWT_SECRET LOG_LEVEL
if [ -n "${ADMIN_EMAIL:-}" ]; then export ADMIN_EMAIL ADMIN_PASSWORD; fi
export DB_NAME="${DB_NAME:-$POSTGRES_DB}"
export DB_USER="${DB_USER:-$POSTGRES_USER}"
export DB_PASSWORD="${DB_PASSWORD:-$POSTGRES_PASSWORD}"
# content-service (JDBC)
export DB_URL="${DB_URL:-jdbc:postgresql://$DB_HOST:$DB_PORT/$POSTGRES_DB?sslmode=$DB_SSLMODE}"
export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-$APP_ENV}"
: "${JAVA_OPTS:=-XX:MaxRAMPercentage=30 -XX:+UseSerialGC -Xss512k -XX:+ExitOnOutOfMemoryError}"
export JAVA_OPTS
# auth-service (node-postgres): "require" encrypts without verifying, verify-* also verifies the CA
if [ "$DB_SSLMODE" = "disable" ]; then export DB_SSL=false; else export DB_SSL=true; fi
case "$DB_SSLMODE" in verify-*) export DB_SSL_REJECT_UNAUTHORIZED=true ;; *) export DB_SSL_REJECT_UNAUTHORIZED=false ;; esac
export NODE_ENV=production
: "${NODE_OPTIONS:=--max-old-space-size=192}"
export NODE_OPTIONS
# progress-service (pgx) + its readiness aggregation. Keyword/value DSN so any password character is safe.
pg_quote() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e "s/'/\\\\'/g"; }
export DATABASE_URL="${DATABASE_URL:-host=$DB_HOST port=$DB_PORT dbname=$POSTGRES_DB user=$POSTGRES_USER password='$(pg_quote "$POSTGRES_PASSWORD")' sslmode=$DB_SSLMODE}"
export READY_URLS="http://127.0.0.1:8081/api/content/actuator/health/readiness,http://127.0.0.1:8082/api/auth/health"

# ---------------------------------------------------------------- nginx + SPA runtime config
if [ "$APP_ENV" = "dev" ]; then
  ENV_HEADERS=""
else
  # TLS is terminated at the ingress in staging/prod.
  ENV_HEADERS='        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;'
fi
sed -e "s/__PORT__/$PORT/" /etc/sarvaikam/nginx.conf.template \
  | awk -v h="$ENV_HEADERS" '{ if ($0 == "__ENV_HEADERS__") print h; else print }' > "$RUNTIME/nginx.conf"
printf '{"env":"%s"}\n' "$APP_ENV" > "$RUNTIME/config.json"

# ---------------------------------------------------------------- embedded database
export PGDATA="${PGDATA:-/data/pgdata}"
if [ "$EMBEDDED_DB" = "true" ]; then
  mkdir -p "$PGDATA"
  chmod 0700 "$PGDATA"
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "[$APP_ENV] initialising embedded PostgreSQL in $PGDATA"
    printf '%s' "$POSTGRES_PASSWORD" > "$RUNTIME/pwfile"
    initdb -D "$PGDATA" -U "$POSTGRES_USER" --pwfile="$RUNTIME/pwfile" --auth=scram-sha-256 >/dev/null
    rm -f "$RUNTIME/pwfile"
    pg_ctl -D "$PGDATA" -o "-c listen_addresses=127.0.0.1 -c unix_socket_directories=$RUNTIME" -w start >/dev/null
    PGPASSWORD="$POSTGRES_PASSWORD" createdb -h 127.0.0.1 -U "$POSTGRES_USER" "$POSTGRES_DB"
    pg_ctl -D "$PGDATA" -m fast -w stop >/dev/null
  fi
fi

echo "[$APP_ENV] starting: embedded_db=$EMBEDDED_DB db_host=$DB_HOST sslmode=$DB_SSLMODE port=$PORT"
# PORT is for nginx only; auth-service and progress-service read PORT for their own listeners.
unset PORT
exec supervisord -c /etc/sarvaikam/supervisord.conf
