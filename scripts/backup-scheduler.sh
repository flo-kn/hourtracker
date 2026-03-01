#!/bin/bash
# Backup Scheduler - Single Run
# Waits ~30 minutes after startup, runs one backup, then exits.
# Designed to capture data changes made shortly after app startup.

set -euo pipefail

STARTUP_DELAY_SECONDS="${STARTUP_DELAY_SECONDS:-300}" # 5 minutes
MAX_RETRIES=3
RETRY_DELAY_SECONDS=60

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-to-s3.sh"

# Unset AWS_PROFILE if empty (AWS CLI treats "" as a profile name lookup)
if [ -z "${AWS_PROFILE:-}" ]; then
    unset AWS_PROFILE
fi

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[SCHEDULER]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "${YELLOW}[SCHEDULER]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[SCHEDULER]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

check_database() {
    export PGPASSWORD="${PGPASSWORD:-postgres}"
    pg_isready -h "${PGHOST:-supabase-db}" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-postgres}" > /dev/null 2>&1
}

check_aws() {
    # Build AWS CLI args
    local aws_args="--region ${S3_REGION:-us-east-1}"
    if [ -n "${AWS_PROFILE:-}" ] && [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
        aws_args="$aws_args --profile $AWS_PROFILE"
    fi

    aws s3 ls "s3://${S3_BUCKET:-my-app-backups}/" $aws_args > /dev/null 2>&1
}

shutdown() {
    log_info "Received shutdown signal, exiting..."
    exit 0
}

trap shutdown SIGTERM SIGINT

main() {
    log_info "=========================================="
    log_info "Backup Scheduler (single-run mode)"
    log_info "=========================================="
    log_info "  S3 Bucket: ${S3_BUCKET:-my-app-backups}"
    log_info "  Startup delay: $((STARTUP_DELAY_SECONDS / 60)) minutes"
    log_info "  Credentials: $([ -n "${AWS_ACCESS_KEY_ID:-}" ] && echo "env vars" || echo "profile ${AWS_PROFILE:-none}")"
    log_info "=========================================="

    log_info "Waiting $((STARTUP_DELAY_SECONDS / 60)) minutes before backup..."
    sleep "$STARTUP_DELAY_SECONDS"

    # Pre-flight checks with retries
    local attempt=0
    while [ $attempt -lt $MAX_RETRIES ]; do
        attempt=$((attempt + 1))
        log_info "Pre-flight check (attempt ${attempt}/${MAX_RETRIES})..."

        if ! check_database; then
            log_warn "Database not ready"
            sleep "$RETRY_DELAY_SECONDS"
            continue
        fi
        log_info "Database: OK"

        if ! check_aws; then
            log_error "AWS S3 not accessible"
            sleep "$RETRY_DELAY_SECONDS"
            continue
        fi
        log_info "AWS S3: OK"

        # Run backup
        log_info "Starting backup..."
        if "$BACKUP_SCRIPT"; then
            log_info "Backup completed successfully. Scheduler exiting."
            exit 0
        else
            log_error "Backup failed"
            sleep "$RETRY_DELAY_SECONDS"
            continue
        fi
    done

    log_error "All ${MAX_RETRIES} attempts failed. Exiting."
    exit 1
}

main
