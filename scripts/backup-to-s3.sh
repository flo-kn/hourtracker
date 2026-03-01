#!/bin/bash
# S3 Backup Script for PostgreSQL Database
# Performs pg_dump, compresses, uploads to S3, and cleans up old backups

set -euo pipefail

# Configuration with defaults
S3_BUCKET="${S3_BUCKET:-my-app-backups}"
S3_REGION="${S3_REGION:-us-east-1}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Unset AWS_PROFILE if empty (AWS CLI treats "" as a profile name lookup)
if [ -z "${AWS_PROFILE:-}" ]; then
    unset AWS_PROFILE
fi

# AWS CLI args: use --profile only when set and no env var credentials present
AWS_ARGS="--region $S3_REGION"
if [ -n "${AWS_PROFILE:-}" ] && [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
    AWS_ARGS="$AWS_ARGS --profile $AWS_PROFILE"
fi

# PostgreSQL connection (uses libpq environment variables)
PGHOST="${PGHOST:-supabase-db}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"

# Backup file naming
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
BACKUP_FILE="backup-${TIMESTAMP}.sql.gz"
S3_PATH="s3://${S3_BUCKET}/backups/${BACKUP_FILE}"
TEMP_DIR="/tmp/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

trap cleanup EXIT

# Create temp directory
mkdir -p "$TEMP_DIR"

log_info "Starting backup to S3..."
log_info "Target: ${S3_PATH}"

# Step 1: Create database dump
log_info "Creating database dump..."
export PGPASSWORD

if ! pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" \
    --no-owner --no-acl \
    --format=plain \
    | gzip > "${TEMP_DIR}/${BACKUP_FILE}"; then
    log_error "Failed to create database dump"
    exit 1
fi

BACKUP_SIZE=$(du -h "${TEMP_DIR}/${BACKUP_FILE}" | cut -f1)
log_info "Dump created: ${BACKUP_SIZE}"

# Step 2: Upload to S3
log_info "Uploading to S3..."
if ! aws s3 cp "${TEMP_DIR}/${BACKUP_FILE}" "$S3_PATH" \
    $AWS_ARGS \
    --only-show-errors; then
    log_error "Failed to upload backup to S3"
    exit 1
fi

log_info "Upload complete: ${S3_PATH}"

# Step 3: Update last backup timestamp metadata
log_info "Updating backup metadata..."
echo "$TIMESTAMP" > "${TEMP_DIR}/last-backup.txt"
aws s3 cp "${TEMP_DIR}/last-backup.txt" "s3://${S3_BUCKET}/backups/last-backup.txt" \
    $AWS_ARGS \
    --only-show-errors

# Step 4: Clean up old backups
log_info "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."

# Calculate cutoff date
if [[ "$(uname)" == "Darwin" ]]; then
    # macOS date command
    CUTOFF_DATE=$(date -v-${BACKUP_RETENTION_DAYS}d +%Y-%m-%d)
else
    # GNU date command (Linux)
    CUTOFF_DATE=$(date -d "-${BACKUP_RETENTION_DAYS} days" +%Y-%m-%d)
fi

# List all backups and delete old ones
DELETED_COUNT=0
while IFS= read -r line; do
    # Extract filename from S3 listing
    FILENAME=$(echo "$line" | awk '{print $4}')
    
    if [[ -z "$FILENAME" ]] || [[ "$FILENAME" == "last-backup.txt" ]]; then
        continue
    fi
    
    # Extract date from filename (backup-YYYY-MM-DD-HHMMSS.sql.gz)
    BACKUP_DATE=$(echo "$FILENAME" | sed -n 's/backup-\([0-9-]*\)-[0-9]*.sql.gz/\1/p')
    
    if [[ -n "$BACKUP_DATE" ]] && [[ "$BACKUP_DATE" < "$CUTOFF_DATE" ]]; then
        log_info "Deleting old backup: ${FILENAME}"
        aws s3 rm "s3://${S3_BUCKET}/backups/${FILENAME}" \
            $AWS_ARGS \
            --only-show-errors
        ((DELETED_COUNT++))
    fi
done < <(aws s3 ls "s3://${S3_BUCKET}/backups/" $AWS_ARGS 2>/dev/null || true)

if [ $DELETED_COUNT -gt 0 ]; then
    log_info "Deleted ${DELETED_COUNT} old backup(s)"
fi

log_info "Backup completed successfully!"
log_info "Backup file: ${BACKUP_FILE}"
log_info "S3 location: ${S3_PATH}"
