# Database Backup

Hour Tracker stores all data in a single PostgreSQL database. The tables that
matter are:

| Schema | Table | Description |
|--------|-------|-------------|
| `public` | `customers` | Customer records |
| `public` | `timesheets` | Monthly timesheets per customer |
| `public` | `time_entries` | Individual time log entries |
| `auth` | `users` | Supabase/GoTrue user accounts |

A standard `pg_dump` of the `postgres` database produces a complete backup.

## Reference Implementation (AWS S3)

This directory contains an **optional**, S3-based backup using `pg_dump` +
AWS CLI. It is wired into Docker Compose behind the `backup` profile so it
never runs unless you explicitly opt in.

| Script | Purpose |
|--------|---------|
| `start-backup.sh` | Host-side helper: extracts AWS SSO credentials, starts the backup container |
| `backup-scheduler.sh` | Runs inside the container: waits, then triggers a single backup |
| `backup-to-s3.sh` | Performs `pg_dump`, compresses, uploads to S3, prunes old backups |
| `restore-from-s3.sh` | Downloads a backup from S3 and restores it into PostgreSQL |

### Configuration

All settings are passed as environment variables (defaults in `docker-compose.yml`):

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_BUCKET` | `your-backup-bucket` | S3 bucket name |
| `S3_REGION` | `us-east-1` | AWS region |
| `AWS_PROFILE` | `default` | AWS CLI profile (for SSO) |
| `BACKUP_RETENTION_DAYS` | `30` | Days to keep old backups |
| `STARTUP_DELAY_SECONDS` | `300` | Delay before first backup (seconds) |

### Quick Start

```bash
# Log in to AWS
aws sso login --profile your-aws-profile

# Start the backup container
./scripts/backup/start-backup.sh

# Or run a manual backup immediately
docker-compose --profile backup run --rm backup /scripts/backup-to-s3.sh
```

### Restore Notes

- The restore script automatically re-applies role grants (`anon`,
  `authenticated`) after loading the dump. Older dumps taken with `--no-acl`
  may be missing these grants; the script handles both cases.
- `POSTGRES_PASSWORD` in `.env` only takes effect on first DB init. If you
  regenerated secrets after the volume was created, update the password
  manually:
  ```bash
  docker exec hourtracker-db psql -U postgres -c \
    "ALTER USER postgres WITH PASSWORD 'your-new-password';"
  ```
  Then restart services: `docker-compose restart auth rest meta`.

## Using a Different Backup Strategy

If you prefer a different approach (GCS, Azure Blob, local NAS, `wal-g`,
managed Postgres with built-in backups, etc.), you can safely ignore this
entire directory. Just make sure your solution covers the `postgres` database
on port 5432.

To remove S3 backup support entirely, delete the `backup` service from
`docker-compose.yml` and remove this directory.
