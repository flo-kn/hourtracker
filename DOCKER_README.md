# Docker Development Environment

Complete local development environment with Supabase running in Docker Compose.

## Services

- **Next.js App**: http://localhost:3001
- **Kong API Gateway**: http://localhost:8001
- **PostgreSQL**: localhost:5432
- **PostgREST API**: http://localhost:3002
- **GoTrue Auth**: http://localhost:9999
- **Postgres Meta**: http://localhost:8080
- **Email Testing (Inbucket)**: http://localhost:9000

## Quick Start

```bash
# Generate unique secrets (.env + Kong config)
./scripts/generate-env.sh

# Start all services 
docker-compose up -d
# (The backup is optional but recommended)
docker-compose --profile backup up -d

# Wait for services to be ready, then create test user
./seed-user.sh

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v
```

> Skipping `generate-env.sh` still works (demo defaults are built in), but secrets
> will be publicly known. Run the script for anything beyond a quick local test.

## Test User

After running the seed script, you can login with:
- **Email:** user@example.com
- **Password:** testpassword123
- **Login URL:** http://localhost:3001/auth/login

## Database Access

**PostgreSQL Connection:**
- Host: localhost (bound to `127.0.0.1`)
- Port: 5432
- Database: postgres
- User: postgres
- Password: value of `POSTGRES_PASSWORD` in your `.env` (default: `postgres`)

## API Configuration

**Supabase URL:** `http://localhost:8001`

After running `./scripts/generate-env.sh`, your unique keys are in `.env`:

| Variable | Description |
|---|---|
| `ANON_KEY` | Public API key (safe for client-side) |
| `SERVICE_ROLE_KEY` | Admin key (server-side only, bypasses RLS) |
| `JWT_SECRET` | Signing secret shared by PostgREST and GoTrue |

If you skipped `generate-env.sh`, the [well-known Supabase demo keys](https://supabase.com/docs/guides/self-hosting#api-keys) are used as defaults.

> **Tip:** Never expose the `SERVICE_ROLE_KEY` to client-side code.

## Database Migrations

SQL migrations in `scripts/migrations/` are automatically applied on first start:
- `000-init-auth-schema.sql` - Auth setup
- `001-create-tables.sql` - Main tables
- `002-add-timesheet-status.sql` - Schema updates
- `003-grant-auth-permissions.sql` - Auth permissions

## Email Testing

All emails are captured by Inbucket:
1. Open http://localhost:9000
2. Check the "Recent Mailboxes" for confirmation emails
3. Click links to verify accounts

## Database Management

You can access the PostgreSQL database using any client:

```bash
psql -h localhost -p 5432 -U postgres -d postgres
# Password: postgres
```

Or use Postgres Meta API at http://localhost:8080 for programmatic access.

## Troubleshooting

**Port conflicts:**
```bash
# Check what's using a port
lsof -i :3001

# Change ports in docker-compose.yml if needed
```

**Reset database:**
```bash
docker-compose down -v
docker-compose up -d
```

**View service logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f db
docker-compose logs -f auth
docker-compose logs -f app
```

**Rebuild app after code changes:**
```bash
docker-compose up -d --build app
```

## Backup and Recovery

Hour Tracker stores all data in PostgreSQL. Any standard `pg_dump` of the
`postgres` database is a complete backup. You can use whatever backup tool or
cloud storage fits your setup.

The repository ships with an **optional S3-based reference implementation** in
`scripts/backup/`. See [`scripts/backup/README.md`](./scripts/backup/README.md)
for the full contract and how to swap in a different strategy.

### S3 Reference Implementation

Automated backups to AWS S3. The backup runs once, ~5 minutes
after you start the container, then exits.

### Prerequisites

- AWS CLI installed: `brew install awscli`
- An AWS SSO profile configured (e.g., `your-aws-profile`)
- An S3 bucket for backups

### Start a Backup

```bash
# 1. Log into AWS (if session expired)
aws sso login --profile your-aws-profile

# 2. Start the backup container (extracts temp credentials from SSO session)
./scripts/backup/start-backup.sh

# 3. View logs
docker-compose --profile backup logs -f backup
```

The backup container will:
- Wait 5 minutes (for DB to settle)
- Run one pg_dump backup, compress, and upload to S3
- Clean up backups older than 30 days
- Exit

### Manual Backup (Immediate)

```bash
# Log in, then run backup directly (no 30min wait)
aws sso login --profile your-aws-profile
eval "$(aws configure export-credentials --profile your-aws-profile --format env)"
docker-compose --profile backup run --rm backup /scripts/backup-to-s3.sh
```

### Restore from Backup

```bash
# List available backups
aws sso login --profile your-aws-profile
eval "$(aws configure export-credentials --profile your-aws-profile --format env)"
docker-compose --profile backup run --rm backup /scripts/restore-from-s3.sh list

# Restore latest
docker-compose stop app
docker-compose --profile backup run --rm backup /scripts/restore-from-s3.sh
docker-compose up -d

# Restore specific backup
docker-compose --profile backup run --rm backup /scripts/restore-from-s3.sh backup-2026-01-30-120000
```

### Recovery Checklist

Work through this in order. A restore drops the `public`, `auth` and
`storage` schemas and replaces them with the dump, so make sure it is
actually needed before running it.

```bash
# 1. Is it really data loss? A "Failed to fetch" on the login page usually
#    means kong/auth/rest are down, not that the database is gone.
docker-compose ps -a
docker-compose up -d
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8001/auth/v1/health   # expect 200

# 2. What is in the database right now?
docker exec hourtracker-db psql -U postgres -c "
  SELECT 'customers' AS t, COUNT(*) FROM customers
  UNION ALL SELECT 'timesheets', COUNT(*) FROM timesheets
  UNION ALL SELECT 'time_entries', COUNT(*) FROM time_entries
  UNION ALL SELECT 'auth.users', COUNT(*) FROM auth.users;"
docker exec hourtracker-db psql -U postgres -c "SELECT email, last_sign_in_at FROM auth.users;"

# 3. What is in the backup? Compare before overwriting anything.
aws sso login --profile your-aws-profile
aws s3 ls s3://your-backup-bucket/backups/ --profile your-aws-profile --human-readable
aws s3 cp s3://your-backup-bucket/backups/backup-YYYY-MM-DD-HHMMSS.sql.gz /tmp/ --profile your-aws-profile
gunzip -c /tmp/backup-YYYY-MM-DD-HHMMSS.sql.gz | grep -c "^COPY "     # sanity: tables present
gunzip -c /tmp/backup-YYYY-MM-DD-HHMMSS.sql.gz \
  | awk '/^COPY public.time_entries /{f=1;next} f&&/^\\\.$/{f=0} f' | wc -l   # rows in time_entries

# 4. Restore (only if the backup really has what the database is missing)
eval "$(aws configure export-credentials --profile your-aws-profile --format env)"
docker-compose stop app
docker-compose --profile backup run --rm backup /scripts/restore-from-s3.sh
docker-compose up -d
docker-compose restart auth rest      # GoTrue/PostgREST must reconnect to the recreated schema

# 5. Verify
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8001/auth/v1/health   # expect 200
docker exec hourtracker-db psql -U postgres -c "SELECT email FROM auth.users;"   # log in with one of these
```

Notes:

- The restore script refuses to leave a half-restored database: it runs in a
  single transaction and rolls back on any error.
- Backups are pruned after `BACKUP_RETENTION_DAYS`; if the bucket only holds
  dumps from after the data went missing, a restore will not bring it back.
- `POSTGRES_PASSWORD` in `.env` only applies on first DB init. If it was
  changed after the volume was created, see `scripts/backup/README.md`.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_BUCKET` | `your-backup-bucket` | S3 bucket name |
| `S3_REGION` | `us-east-1` | AWS region |
| `STARTUP_DELAY_SECONDS` | `300` | Delay before backup (5 min) |
| `BACKUP_RETENTION_DAYS` | `30` | Days to keep backups |

### Check Backup Status

```bash
# View backup logs
docker-compose --profile backup logs backup

# List backups in S3
aws s3 ls s3://your-backup-bucket/backups/ --profile your-aws-profile --human-readable
```

### Future: aws-vault (Phase 2)

For unattended backups without SSO re-login, set up a dedicated IAM user with
aws-vault.

---

## Production Deployment

For production, replace the local Supabase services with a real Supabase project:

1. Create a project at https://supabase.com
2. Run migrations in Supabase SQL Editor
3. Update `.env.local` with production credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Deploy only the app container (remove Supabase services from docker-compose.yml)
