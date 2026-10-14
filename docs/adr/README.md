# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) — lightweight documents that capture important technical decisions made during the design and development of DriveMyWay.

## Format

Each ADR is a numbered Markdown file: `ADR-NNN-title.md`

```
# ADR-001: Title

## Status
Accepted | Superseded by ADR-XXX | Deprecated

## Context
What situation or problem led to this decision?

## Decision
What was decided?

## Consequences
What are the tradeoffs and follow-on implications?
```

## Index

| # | Title | Status |
|---|-------|--------|
| [001](./ADR-001-monorepo-structure.md) | Monorepo with npm workspaces | Accepted |
| [002](./ADR-002-realtime-tracking.md) | Socket.IO for real-time tracking | Accepted |
| [003](./ADR-003-payment-provider.md) | Razorpay over Stripe for India | Accepted |
| [004](./ADR-004-family-tracker-pwa.md) | Family tracker as PWA, no app download | Accepted |
