#!/usr/bin/env bash
# Sobe um Postgres temporário, aplica as migrações e roda os testes de RLS/planos.
set -eo pipefail
cd "$(dirname "$0")/.."

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then
  echo "Postgres não encontrado. Instale o postgresql ou defina PGBIN." >&2; exit 1
fi
DIR="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN_AS=""
if [ "$(id -u)" = "0" ]; then
  id pgtest >/dev/null 2>&1 || useradd -M pgtest
  chown -R pgtest "$DIR"
  RUN_AS="runuser -u pgtest --"
fi
cleanup() { $RUN_AS "$PGBIN/pg_ctl" -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

$RUN_AS "$PGBIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
$RUN_AS "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses='' -c wal_level=logical" -l "$DIR/log" start -w >/dev/null

PSQL=(psql -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f supabase/tests/rls_test.sql 2>&1 >/dev/null | sed -n "s/.*NOTICE:  //p; /ERROR/p"
echo "✔ testes do banco passaram"
