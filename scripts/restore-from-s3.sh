#!/bin/bash
# S3 Restore Script for PostgreSQL Database
# Downloads backup from S3 and restores to PostgreSQL

set -euo pipefail

# Configuration with defaults
S3_BUCKET="${S3_BUCKET:-my-app-backups}"
S3_REGION="${S3_REGION:-us-east-1}"

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
PGHOST="${PGHOST:-localhost}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"

TEMP_DIR="/tmp/restore"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

usage() {
    echo "Usage: $0 [backup-name]"
    echo ""
    echo "Arguments:"
    echo "  backup-name    Optional. Name of backup to restore (e.g., backup-2026-01-30-120000)"
    echo "                 If not specified, restores the latest backup."
    echo ""
    echo "Commands:"
    echo "  $0              Restore latest backup"
    echo "  $0 list         List available backups"
    echo "  $0 backup-name  Restore specific backup"
    echo ""
    echo "Environment variables:"
    echo "  S3_BUCKET       S3 bucket name (default: my-app-backups)"
    echo "  S3_REGION       AWS region (default: us-east-1)"
    echo "  AWS_PROFILE     AWS CLI profile (optional, env vars take precedence)"
    echo "  PGHOST          PostgreSQL host (default: localhost)"
    echo "  PGUSER          PostgreSQL user (default: postgres)"
    echo "  PGPASSWORD      PostgreSQL password (default: postgres)"
    echo "  PGDATABASE      PostgreSQL database (default: postgres)"
}

list_backups() {
    echo -e "${BLUE}Available backups in s3://${S3_BUCKET}/backups/:${NC}"
    echo ""
    
    aws s3 ls "s3://${S3_BUCKET}/backups/" \
        $AWS_ARGS \
        2>/dev/null | grep "\.sql\.gz$" | while read -r line; do
        DATE=$(echo "$line" | awk '{print $1}')
        TIME=$(echo "$line" | awk '{print $2}')
        SIZE=$(echo "$line" | awk '{print $3}')
        FILE=$(echo "$line" | awk '{print $4}')
        
        # Convert size to human readable
        if [ "$SIZE" -gt 1073741824 ]; then
            SIZE_HR="$(echo "scale=2; $SIZE/1073741824" | bc)GB"
        elif [ "$SIZE" -gt 1048576 ]; then
            SIZE_HR="$(echo "scale=2; $SIZE/1048576" | bc)MB"
        elif [ "$SIZE" -gt 1024 ]; then
            SIZE_HR="$(echo "scale=2; $SIZE/1024" | bc)KB"
        else
            SIZE_HR="${SIZE}B"
        fi
        
        echo "  ${FILE} (${SIZE_HR}, ${DATE} ${TIME})"
    done
    
    echo ""
}

get_latest_backup() {
    aws s3 ls "s3://${S3_BUCKET}/backups/" \
        $AWS_ARGS \
        2>/dev/null | grep "\.sql\.gz$" | sort -r | head -1 | awk '{print $4}'
}

# Handle arguments
if [ "${1:-}" == "-h" ] || [ "${1:-}" == "--help" ]; then
    usage
    exit 0
fi

if [ "${1:-}" == "list" ]; then
    list_backups
    exit 0
fi

# Create temp directory
mkdir -p "$TEMP_DIR"

# Determine which backup to restore
if [ -n "${1:-}" ]; then
    BACKUP_NAME="$1"
    # Add .sql.gz extension if not present
    if [[ "$BACKUP_NAME" != *.sql.gz ]]; then
        BACKUP_NAME="${BACKUP_NAME}.sql.gz"
    fi
else
    log_info "No backup specified, finding latest..."
    BACKUP_NAME=$(get_latest_backup)
    
    if [ -z "$BACKUP_NAME" ]; then
        log_error "No backups found in s3://${S3_BUCKET}/backups/"
        exit 1
    fi
fi

S3_PATH="s3://${S3_BUCKET}/backups/${BACKUP_NAME}"
LOCAL_FILE="${TEMP_DIR}/${BACKUP_NAME}"

log_info "Restoring backup: ${BACKUP_NAME}"

# Step 1: Download backup from S3
log_info "Downloading from S3..."
if ! aws s3 cp "$S3_PATH" "$LOCAL_FILE" \
    $AWS_ARGS \
    --only-show-errors; then
    log_error "Failed to download backup from S3"
    log_error "Check if backup exists: aws s3 ls ${S3_PATH}"
    exit 1
fi

DOWNLOAD_SIZE=$(du -h "$LOCAL_FILE" | cut -f1)
log_info "Downloaded: ${DOWNLOAD_SIZE}"

# Step 2: Confirm restore (if running interactively)
if [ -t 0 ]; then
    echo ""
    log_warn "WARNING: This will DROP and recreate the following database objects:"
    log_warn "  - All tables in public schema"
    log_warn "  - All data will be replaced with backup data"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM
    
    if [ "$CONFIRM" != "yes" ]; then
        log_info "Restore cancelled."
        exit 0
    fi
fi

# Step 3: Restore database
log_info "Restoring database..."
export PGPASSWORD

# Decompress and restore
if ! gunzip -c "$LOCAL_FILE" | psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" \
    --quiet \
    --set ON_ERROR_STOP=off \
    2>&1 | grep -v "^SET$" | grep -v "already exists" | head -20; then
    log_warn "Some errors occurred during restore (this is often normal for schema conflicts)"
fi

log_info "Restore completed!"
log_info "Restored from: ${BACKUP_NAME}"

# Step 4: Show summary
log_info "Verifying restore..."
CUSTOMER_COUNT=$(psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT COUNT(*) FROM customers;" 2>/dev/null | tr -d ' ')
TIMESHEET_COUNT=$(psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT COUNT(*) FROM timesheets;" 2>/dev/null | tr -d ' ')
ENTRY_COUNT=$(psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT COUNT(*) FROM time_entries;" 2>/dev/null | tr -d ' ')

echo ""
log_info "Database summary after restore:"
log_info "  - Customers: ${CUSTOMER_COUNT:-0}"
log_info "  - Timesheets: ${TIMESHEET_COUNT:-0}"
log_info "  - Time entries: ${ENTRY_COUNT:-0}"
