# Narenj — restaurant service board

Narenj is a Persian-first, multi-tenant order hand-off for table-service restaurants. A waiter adds an item to a table, the kitchen moves it from new to preparing to ready, and the dining room sees the change without replacing the whole order.

The product deliberately stops before checkout. The rationale, alternatives, and accepted trade-offs are in [DECISIONS.md](./DECISIONS.md); the agreed pre-build boundary is in [SCOPE.md](./SCOPE.md).

## Open the demo

Live Railway deployment: [https://narenj-production.up.railway.app](https://narenj-production.up.railway.app)

The sign-in screen lists all three demonstration accounts:

| Role | Email | Password |
| --- | --- | --- |
| Waiter | `waiter@narenj.demo` | `Waiter123!` |
| Kitchen | `kitchen@narenj.demo` | `Kitchen123!` |
| Manager | `manager@narenj.demo` | `Manager123!` |

Seed data includes two restaurants, more than one branch, 12 tables, a Persian menu, staff, active orders, and history. Only Narenj credentials are advertised; the second restaurant exists to prove isolation.

## Local setup

Prerequisite: Node.js 22.13 or newer. From a fresh clone, one command installs dependencies and starts the app:

```bash
npm install && npm run dev
```

Open `http://localhost:3000`. The local SQLite database is migrated and seeded on its first API request.

To enable the optional model-generated shift handover, copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`. Without it, the manager still gets the same calculated metrics and a deterministic handover; ordering never depends on an AI provider.

## Architecture

- **UI:** React 19 and vinext, responsive RTL Persian screens for floor, kitchen, menu availability, and shift handover.
- **Runtime:** Node.js server routes built with vinext and packaged in the repository's Dockerfile for Railway.
- **Data:** SQLite migrations generated from a Drizzle domain schema. Railway stores the database in a persistent volume mounted at `/data`; WAL mode and a busy timeout protect a single application replica. Tenant-owned rows carry `restaurant_id`; operational rows also carry `branch_id`.
- **Identity:** short-lived opaque session tokens are stored only as SHA-256 hashes. The HTTP-only, `SameSite=Strict` cookie resolves the actor, restaurant, branch, and role on the server.
- **Writes:** narrow commands (`add_item`, `transition_item`, `set_availability`) replace whole-order saves. Additions use idempotency keys; updates use versions and return `409` on stale state.
- **AI:** a manager-only endpoint sends bounded branch aggregates—not customer notes or raw order text—to a structured-output model. It uses a timeout, no response storage, schema validation, and a deterministic fallback.

The critical boundary is server-side: the client never supplies an authoritative restaurant, branch, or role. Every read and mutation includes tenant predicates, and unknown or unauthorized object IDs fail as `404` so they do not reveal whether another tenant's record exists.

## Commands

```bash
npm run lint           # static rules and accessibility checks
npx tsc --noEmit       # TypeScript boundary check
npm run build          # production build
npm test               # build plus rendered-page and metadata test
npm run test:workflow  # live waiter-to-kitchen workflow test
npm run db:generate    # generate a migration after schema edits
```

The workflow test signs in as a waiter, adds an item, retries the same command, checks that a known second-tenant menu ID is hidden, confirms waiter role denial, then signs in as kitchen and progresses the exact item through `preparing` and `ready`. It also proves stale and invalid transitions return conflicts.

I did not unit-test presentational CSS, the model's prose quality, or every browser/device combination. Visual styling is better checked by rendering the real product; model output is treated as untrusted and schema-validated; device and assistive-technology coverage needs a dedicated compatibility pass. Payment, tax, inventory, printer, and full-offline behavior are intentionally outside this release.

## Security decisions

1. **Cross-tenant disclosure:** actor context is derived from a server-side membership; all queries are restaurant- and branch-scoped; unauthorized object access returns the same `404` as a missing object. A seeded second tenant and negative workflow test exercise this boundary.
2. **Lost or duplicated concurrent writes:** order items are appended with an idempotency key rather than saving a replaceable order document. Version checks make state races visible as `409` instead of silently winning.
3. **Privilege misuse and session theft:** each command is authorized server-side by role, session cookies are HTTP-only/secure in production/strict same-site, and only token hashes are persisted. Demo passwords are a documented assessment limitation and must be replaced before real customer data is used.

Operational logs include request, actor, tenant, branch, action, outcome, and duration. They exclude passwords, tokens, kitchen notes, and AI prompt content.

## Railway deployment

Railway builds the checked-in `Dockerfile`. The service must have one persistent volume mounted at `/data`, with `NARENJ_SQLITE_PATH=/data/narenj.sqlite`. Keep the service at one replica: SQLite on one mounted volume is a deliberate first-release constraint, not a horizontally scalable database design. Railway supplies `PORT` automatically and `vinext start` binds to it.

Set `OPENAI_API_KEY` as a Railway secret only if model-generated shift handovers are required. `OPENAI_MODEL` defaults to `gpt-4.1-mini`; without a key, the deterministic handover remains available.

## Repository guide

- `db/schema.ts` — domain schema
- `drizzle/` — forward migrations
- `db/bootstrap.ts` — migration runner and realistic seed
- `db/node-d1.ts` — small D1-shaped adapter over the Node SQLite driver
- `app/api/` — session, product-command, and AI endpoints
- `domain/` — authorization policy and state-machine validation
- `tests/` — rendered output and full workflow proof
- `SCOPE.md`, `DECISIONS.md`, `AI_USAGE.md`, `HANDOVER.md` — product and delivery reasoning
