#!/bin/bash
# Start the backup container with AWS credentials from the current SSO session.
#
# Usage:
#   aws sso login --profile your-aws-profile
#   ./scripts/backup/start-backup.sh
#
# The script exports temporary credentials from your SSO session and passes them
# to the backup container via environment variables. The container will wait
# ~5 minutes (STARTUP_DELAY_SECONDS), run one backup, and exit.

set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-default}"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}[BACKUP]${NC} Extracting credentials from AWS profile: ${AWS_PROFILE}"

# Verify SSO session is active
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" > /dev/null 2>&1; then
    echo -e "${RED}[BACKUP]${NC} AWS session expired or not logged in."
    echo -e "${RED}[BACKUP]${NC} Run: aws sso login --profile ${AWS_PROFILE}"
    exit 1
fi

# Export temporary credentials from the SSO session
eval "$(aws configure export-credentials --profile "$AWS_PROFILE" --format env)"

echo -e "${GREEN}[BACKUP]${NC} Credentials exported. Starting backup container..."
echo -e "${GREEN}[BACKUP]${NC} Backup will run in ~5 minutes."

# Start the backup container (credentials are passed via env var passthrough in docker-compose)
docker-compose --profile backup up -d backup

echo -e "${GREEN}[BACKUP]${NC} Backup container started. View logs with:"
echo -e "  docker-compose --profile backup logs -f backup"
