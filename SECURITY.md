# Security Policy

## Dependency Management

This project follows supply chain security best practices:

### Pinned Versions
All production dependencies use **exact versions** (no `^` or `~`):
- Prevents unexpected updates from introducing vulnerabilities
- Lockfile (`package-lock.json`) is committed and required

### Minimal Dependencies
- **Production:** `mqtt`, `zod` only
- **Dev:** `typescript`, `vitest`, `@types/node`
- **Peer:** `openclaw` (not bundled)

### Lockfile Integrity
- `package-lock.json` includes SHA-512 integrity hashes
- CI should use `npm ci` (not `npm install`) to enforce lockfile

### Audit Policy
```bash
# Check for vulnerabilities
npm audit

# In CI, fail on high/critical
npm audit --audit-level=high
```

Current known issues (dev dependencies only):
- `esbuild` via `vitest` — moderate severity, no production impact

## Secrets Handling

See [README.md](./README.md#configuration) for secrets management:
- Credentials via environment variables (recommended)
- Config files excluded from git
- `uiHints.sensitive` marks password fields

## Reporting Vulnerabilities

Please report security issues privately via GitHub Security Advisories or email.

Do NOT open public issues for security vulnerabilities.
