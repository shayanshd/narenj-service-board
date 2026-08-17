# Narenj handover

This document is for the restaurant owner and shift manager.

## What has been delivered

Narenj replaces the paper or spoken hand-off between the dining room and kitchen for table orders. A waiter can select a table and send a menu item with a quantity and short note. The kitchen sees the ticket, marks the item as being prepared, and marks it ready. The waiter sees that result on the table board. A manager can temporarily mark menu items unavailable and produce a shift handover summary.

The demonstration already contains a realistic Persian menu, 12 tables, staff roles, active orders, and history. Each staff member sees only the tools for their job.

## How staff can use it on Monday

1. The waiter signs in with the waiter account, opens **وضعیت سالن**, and selects a table.
2. They choose **افزودن به سفارش**, select a menu item, quantity, and optional kitchen note, then send it. Adding a new item does not replace earlier items.
3. Kitchen staff sign in on the kitchen display. For each new item they choose **شروع**, then **آماده شد** when it is ready.
4. The waiter checks the table board. Ready tables are highlighted for service.
5. The manager can use **منو و موجودی** to hide an unavailable item from new orders, and **خلاصه شیفت** for a short handover.

If a button reports a conflict, refresh the screen before acting again; another staff member changed the same item first. If internet access is completely lost, switch to the restaurant's agreed paper/verbal fallback until both devices can reconnect. Do not keep clicking blindly.

## Known limitations

- This is not a checkout or accounting system. It does not take payment, split a bill, apply a discount, calculate tax, or issue a fiscal receipt. The sales number is an operational estimate only.
- It has no printer, bank-terminal, inventory, recipe, purchasing, delivery, reservation, or customer QR integration.
- Devices refresh every 15 seconds rather than receiving instant push updates. A ready item can therefore appear late by up to one refresh cycle.
- A complete internet outage stops coordination between separate devices. There is no true offline or local-network mode.
- The demonstration passwords are visible and have no password recovery, lockout, invitation, or multi-factor authentication. They must not be used for a real restaurant rollout.
- The Persian wording, toman display, kitchen ergonomics, and working rules came from desk research and still require observation with real staff during a busy service.
- The manager summary can use AI, but it does not make decisions. If the provider is slow, unavailable, or not configured, the product displays a calculated fallback.
- There is no deletion or correction workflow for mistakenly submitted items in this version. Staff must use the manual fallback and record the correction outside Narenj.

## The next five things to build

1. **Pilot hardening and real identity:** observe two real shifts, replace demo passwords, add staff invitations/revocation/rate limits, and correct the highest-friction workflow issues. Real customer data should not enter before this.
2. **Instant branch updates and outage handling:** add a sequenced push stream with reconnect catch-up, visible connection state, and an agreed local printer/manual fallback. Coordination speed is the core promise.
3. **Correction, cancellation, and audit controls:** let authorized staff void an item with a reason while retaining its history. Mistakes are normal during service and should not require hidden database edits.
4. **Checkout and local payment reconciliation:** only after studying Iranian cash, card-terminal, discount, tax, refund, and receipt practices with the customer. It should build on the existing order ledger, not turn an estimate into accounting by label.
5. **Menu, recipe, and stock operations:** connect availability to ingredients and purchasing after the hand-off data is trustworthy. This has high owner value but a larger domain than a single on/off switch.

## Where the current architecture breaks

### At 10 restaurants

The database and indexed queries are adequate, but manual onboarding, demo-style authentication, support, kitchen hardware, and outage procedures break first. A venue pilot, production identity, monitoring alerts, backups, and a printer/manual recovery plan are required. Application-only tenant predicates deserve a second database-enforced guardrail before real expansion.

### At 1,000 restaurants

Fifteen-second polling from every waiter and kitchen screen amplifies idle reads, and each dashboard currently loads the branch's whole active view. A single globally shared D1 write path becomes a contention and operational-risk point. The service needs push delivery, paged/incremental reads, queues for noncritical work, tenant-aware database partitioning, SLOs, tracing, and automated tenant provisioning/restore tests.

### At 100,000 restaurants

A single application/database deployment and one universal operational process are no longer credible. Tenant routing, regional data residency, sharded or per-tenant storage, an event pipeline, fleet-wide schema rollout, abuse controls, compliance, support tooling, and disaster recovery become product systems of their own. The existing command and tenant identifiers can survive; the shared physical runtime cannot.

