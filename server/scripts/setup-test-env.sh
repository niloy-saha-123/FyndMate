#!/usr/bin/env bash

set -euo pipefail

TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
TEST_SUPABASE_URL='http://127.0.0.1:54321'
TEST_REDIS_URL='redis://127.0.0.1:6379'

resolve_local_service_role_key() {
  if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    printf '%s\n' "$SUPABASE_SERVICE_ROLE_KEY"
    return 0
  fi

  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi

  local kong_container
  kong_container="$(docker ps --format '{{.Names}}' | rg '^supabase_kong_' | head -n 1 || true)"
  if [[ -z "$kong_container" ]]; then
    return 1
  fi

  docker exec "$kong_container" sh -lc "cat /home/kong/kong.yml" \
    | rg -o 'Bearer eyJ[A-Za-z0-9._-]+' \
    | awk '{ print $2 }' \
    | head -n 1
}

local_service_role_key="$(resolve_local_service_role_key || true)"

if [[ -z "$local_service_role_key" ]]; then
  echo "❌ Missing local SUPABASE_SERVICE_ROLE_KEY for tests." >&2
  echo "   Ensure local Supabase Docker containers are running (including supabase_kong_*)." >&2
  echo "   You can also export SUPABASE_SERVICE_ROLE_KEY and rerun npm run test:setup." >&2
  exit 1
fi

cat > .env.test <<EOF
DATABASE_URL="$TEST_DATABASE_URL"
DIRECT_URL="$TEST_DATABASE_URL"
SUPABASE_URL="$TEST_SUPABASE_URL"
SUPABASE_SERVICE_ROLE_KEY="$local_service_role_key"
REDIS_URL="$TEST_REDIS_URL"
EOF

dotenv -e .env.test -- prisma db push
