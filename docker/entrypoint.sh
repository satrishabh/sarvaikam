#!/bin/sh
# Prepares config for the all-in-one image, initialises the embedded database on first boot,
# then hands over to supervisord which runs postgres (optional), the 3 services and nginx.
set -e

: "${PORT:=8080}"
: "${EMBEDDED_DB:=true}"
: "${POSTGRES_DB:=sarvaikam}"
: "${POSTGRES_USER:=sarvaikam}"
: "${POSTGRES_PASSWORD:=sarvaikam}"
: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=5432}"
: "${DB_SSLMODE:=disable}"

# Each service reads differently named variables; derive them all from one set.
export EMBEDDED_DB DB_HOST DB_PORT
export DB_NAME="${DB_NAME:-$POSTGRES_DB}"
export DB_USER="${DB_USER:-$POSTGRES_USER}"
export DB_PASSWORD="${DB_PASSWORD:-$POSTGRES_PASSWORD}"
export DB_URL="${DB_URL:-jdbc:postgresql://$DB_HOST:$DB_PORT/$POSTGRES_DB}"
export DATABASE_URL="${DATABASE_URL:-postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@$DB_HOST:$DB_PORT/$POSTGRES_DB?sslmode=$DB_SSLMODE}"
# Service ports are internal (8081-8083); only nginx listens on $PORT.
sed -i "s/__PORT__/$PORT/" /etc/nginx/http.d/default.conf

if [ "$EMBEDDED_DB" = "true" ]; then
  PGDATA=/var/lib/postgresql/data
  mkdir -p "$PGDATA" /run/postgresql
  chown -R postgres:postgres /var/lib/postgresql /run/postgresql
  chmod 700 "$PGDATA"
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "Initialising embedded PostgreSQL..."
    printf '%s' "$POSTGRES_PASSWORD" > /tmp/pwfile
    chown postgres /tmp/pwfile
    su-exec postgres initdb -D "$PGDATA" -U "$POSTGRES_USER" --pwfile=/tmp/pwfile --auth=scram-sha-256 >/dev/null
    rm -f /tmp/pwfile
    su-exec postgres pg_ctl -D "$PGDATA" -o "-c listen_addresses=127.0.0.1" -w start >/dev/null
    PGPASSWORD="$POSTGRES_PASSWORD" createdb -h 127.0.0.1 -U "$POSTGRES_USER" "$POSTGRES_DB"
    su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop >/dev/null
  fi
fi

# PORT must not leak into the services (auth-service and progress-service read PORT for their own listener).
unset PORT
exec supervisord -c /etc/supervisord.conf
