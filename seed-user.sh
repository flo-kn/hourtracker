#!/bin/bash

# Create a user via the GoTrue admin API (works even when signup is disabled).
# Usage: ./seed-user.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

# Source .env if it exists (overrides demo defaults below)
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

SUPABASE_URL="${SUPABASE_PUBLIC_URL:-http://localhost:8001}"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"

TEST_EMAIL="${TEST_EMAIL:-user@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-testpassword123}"

echo "Waiting for services to be ready..."

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SUPABASE_URL}/auth/v1/health" \
    -H "apikey: ${SERVICE_ROLE_KEY}" 2>/dev/null)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "Auth service is ready!"
    break
  fi

  echo "Waiting for auth service... (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
  sleep 2
  RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "Error: Auth service did not become ready in time"
  exit 1
fi

echo ""
echo "Creating user: ${TEST_EMAIL}"

RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\",\"email_confirm\":true}")

if echo "$RESPONSE" | grep -q '"id"'; then
  echo "User created successfully!"
  echo ""
  echo "You can now login with:"
  echo "  Email: ${TEST_EMAIL}"
  echo "  Password: ${TEST_PASSWORD}"
  echo ""
  echo "Login URL: http://localhost:3001/auth/login"
elif echo "$RESPONSE" | grep -q "already been registered"; then
  echo "User already exists."
  echo ""
  echo "You can login with:"
  echo "  Email: ${TEST_EMAIL}"
  echo "  Password: ${TEST_PASSWORD}"
  echo ""
  echo "Login URL: http://localhost:3001/auth/login"
else
  echo "Failed to create user. Response:"
  echo "$RESPONSE"
  exit 1
fi
