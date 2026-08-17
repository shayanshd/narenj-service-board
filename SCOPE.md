# Scope agreement — Narenj service board

## Purpose

This six-hour first version will replace the spoken and paper hand-off between the dining room and kitchen for one table-service restaurant. It will let a waiter send an order, let the kitchen progress the work, and let the waiter see when food is ready without overwriting another staff member's changes.

The product will be designed as a multi-tenant SaaS from the first schema: a restaurant may have several branches, but one restaurant must never be able to read or change another restaurant's data.

## Customer and operating assumptions

- The first customer is a Persian-speaking café/restaurant in Iran with table service.
- Waiters primarily use phones; the kitchen uses a shared tablet or desktop.
- Prices are entered and displayed in toman. Stored amounts are integer rial values with explicit conversion at the boundary.
- Staff may act on the same order at the same time.
- Internet access may be slow or interrupted. This version will make pending and failed writes visible and safe to retry, but it will not claim full multi-device operation during a complete outage.
- The first release is an operational companion, not the restaurant's fiscal system of record.

## Users and permissions

### Manager

Can view the branch overview, use the waiter and kitchen workflows, change menu availability, and view the shift summary.

### Waiter

Can view their branch's tables, open a table, add and send items, and see kitchen progress. They cannot change staff, menu prices, or another restaurant's data.

### Kitchen

Can see submitted kitchen tickets for their branch and move items through `new`, `preparing`, and `ready`. They cannot change prices, tables, or staff.

Three roles are the smallest useful separation because dining-room and kitchen actions need different surfaces, while a manager needs operational oversight.

## In scope

1. A role-based demo sign-in with documented credentials.
2. A branch-aware table board with realistic seeded state.
3. Opening a table and adding quantities and a short kitchen note.
4. Sending new items to the kitchen as explicit, append-only work.
5. A kitchen board ordered by urgency.
6. Validated kitchen state changes from new to preparing to ready.
7. Waiter visibility of current kitchen status.
8. Manager control of item availability.
9. A small, manager-only AI shift handover summary based on bounded aggregate data, with a deterministic fallback.
10. Persian-first, right-to-left, responsive interfaces for phone and kitchen tablet.
11. Server-side tenant and branch authorization on every read and write.
12. Safe retry and conflict behavior for concurrent writes.
13. Seed data for two restaurants, multiple branches, tables, staff, menu items, and order history.

## Explicitly out of scope

- Payment gateways, bank terminals, settlement, refunds, fiscal invoices, and tax reporting.
- Discounts, split bills, tips, and checkout.
- Inventory, recipes, purchasing, and food costing.
- Delivery, takeaway logistics, reservations, and customer accounts.
- Customer QR ordering.
- Receipt and kitchen-printer integrations.
- Arbitrary role/permission configuration.
- Full offline multi-device synchronization.
- Native mobile applications.

These are deferred because each adds a separate operational or regulatory system. Including them would prevent the selected workflow from being complete and defensible within the timebox.

## Behavioural acceptance criteria

The release is acceptable when:

1. A waiter can open a seeded table, add two items, send them, and see them on the kitchen board.
2. Kitchen staff can mark one item preparing and then ready, and the dining-room view reflects the change.
3. Two additions to the same table result in two retained lines; neither is silently overwritten.
4. Retrying the same submitted command does not create a duplicate line.
5. An invalid status transition fails closed with a useful error.
6. A waiter cannot perform a kitchen-only or manager-only mutation.
7. A user from Restaurant A receives no data when using a known Restaurant B identifier, and cannot mutate it.
8. An unavailable item cannot be added to a new order.
9. AI provider failure does not block ordering or kitchen operation and still leaves the manager with deterministic shift metrics.
10. The product opens with realistic data and visible demo-role access.

## Data and domain boundaries

The main domain records will be restaurants, branches, memberships, tables, menu categories, menu items, orders, order items, and idempotency records. Orders will not be modelled as one replaceable screen-shaped document. Each order item is independently addressed, and operational state changes are validated commands.

Every tenant-owned record will carry a restaurant identifier; branch-owned operational records will also carry a branch identifier. Tenant and branch context will be derived server-side from the authenticated membership, never accepted from an untrusted client as authority.

## Quality and proof

- Boundary validation will reject malformed input and unknown fields.
- Monetary values will use integers, not floating-point values.
- Logs will contain request, actor, restaurant, branch, action, result, and latency identifiers without secrets or customer notes.
- Tests will cover one full waiter-to-kitchen workflow, idempotent retry, invalid transition, role denial, and cross-tenant isolation.
- Secrets will be supplied through environment configuration and never committed.

## Known delivery risks

1. **Connectivity:** queued writes help with short interruptions, but a complete external outage prevents separate devices from coordinating until connectivity returns.
2. **Authentication:** assessment demo credentials are not a substitute for production identity lifecycle, recovery, and revocation.
3. **Kitchen hardware:** a web kitchen display is included; heat, gloves, printer fallback, and device mounting need observation in a real venue.
4. **Local validation:** locality decisions are based on desk research and must be checked with restaurant staff before production rollout.

## Delivery order

1. Pre-build scope and domain decisions.
2. Recognisable table and kitchen product surface with demo data.
3. Persistent schema and concurrency-safe commands.
4. Tenant and role enforcement with negative tests.
5. AI shift handover with bounded inputs and fallback.
6. Documentation, limitations, deployment, and walkthrough.

