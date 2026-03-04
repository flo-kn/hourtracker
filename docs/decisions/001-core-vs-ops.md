# ADR-001: Core vs. Ops

**Core** = breaks the app if removed (source code, migrations, local dev stack).
**Ops** = breaks a deployment if removed (backup scripts, CI, monitoring).

Ops live in opt-in directories (e.g., `scripts/backup/`) with their own README.
Docker Compose `profiles` keep them from starting by default.

> If removing it breaks the app, it is core.
> If removing it breaks your deployment, it is ops.
