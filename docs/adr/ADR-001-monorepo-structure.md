# ADR-001: Monorepo with npm Workspaces

## Status
Accepted

## Context

DriveMyWay has three distinct codebases: customer mobile app, driver mobile app, and the backend (multiple microservices). Additionally, there is a family tracking web app.

We needed to decide how to organise these in source control:
1. **Polyrepo** — separate git repositories per service/app
2. **Monorepo** — all code in one repository

## Decision

Use a **monorepo with npm workspaces**, with the following structure:

```
drivemyway/
├── backend/services/{auth,booking,tracking,payment,...}
├── backend/shared
├── apps/{customer,driver,family-tracker}
└── scripts/
```

## Consequences

**Positive:**
- Shared TypeScript types (`@drivemyway/shared`) can be imported by all services without a private npm registry
- Atomic commits span multiple services — avoids "deploy service A before B" ordering issues
- Single CI pipeline sees all code changes holistically
- Developers only need one `git clone` to work on any part of the system

**Negative:**
- `npm install` pulls all dependencies at once — mitigated by workspace hoisting
- GitHub Actions matrix must be careful to only rebuild affected packages — acceptable for MVP team size

**Follow-on:**
- If the team grows significantly (>20 engineers), consider Turborepo for build caching
