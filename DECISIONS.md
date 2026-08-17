# Decision record

This is a living record. Each entry states the decision, why it was made, the strongest alternative considered, and the trade-off accepted. Entries D-009 and D-010 are implementation choices I would now revisit.

## D-001 — Build the table-order-to-kitchen workflow

**Decision:** Deliver the flow from opening a table through kitchen readiness.

**Reason:** It is a high-frequency operational hand-off whose failure immediately affects guests and staff. It naturally proves multi-user correctness, role boundaries, and realtime state while producing the data that later checkout, inventory, and reporting need.

**Alternative considered:** Checkout and payment, QR menu, or inventory management.

**Trade-off accepted:** The release cannot replace the restaurant's full POS. It solves one operational loop completely instead of presenting several shallow modules.

## D-002 — Stop before payment and accounting

**Decision:** Do not calculate settlement, integrate a gateway, or create fiscal documents.

**Reason:** Those capabilities require local hardware, banking, reconciliation, tax, refund, and audit decisions that cannot be validated within six hours.

**Alternative considered:** A simplified cash/card checkout screen.

**Trade-off accepted:** Revenue totals remain indicative operational data, not an accounting system of record.

## D-003 — Use three fixed operational roles

**Decision:** Use manager, waiter, and kitchen roles.

**Reason:** This is the smallest model that separates dining-room work, food preparation, and privileged configuration. Fixed roles keep authorization easy to audit.

**Alternative considered:** Manager and staff only, or a configurable permission builder.

**Trade-off accepted:** Cashier, supervisor, and custom mixed duties are not represented in this version.

## D-004 — Model order changes as commands, not whole-order replacement

**Decision:** Add items independently, use explicit state-transition commands, idempotency keys, and conflict responses.

**Reason:** Two staff members should be able to add separate items without a last-write-wins update silently deleting either action.

**Alternative considered:** Save the complete current order document after each UI edit, or implement full event sourcing.

**Trade-off accepted:** The API and interface must handle explicit conflicts; a complete event-sourced audit model is deferred.

## D-005 — Make restaurant the tenant and branch a subordinate boundary

**Decision:** Tenant-owned records carry `restaurant_id`; operational records also carry `branch_id`. Authorization derives both from server-side membership.

**Reason:** Independent restaurant companies require hard isolation while managers may legitimately operate several branches belonging to the same company.

**Alternative considered:** Treat each branch as an unrelated tenant or rely on application screens to filter data.

**Trade-off accepted:** Cross-company franchises and shared central kitchens require later domain work.

## D-006 — Use Persian-first operational conventions

**Decision:** Use a right-to-left Persian interface, display toman explicitly, store integer rial values, and store UTC timestamps for localized display.

**Reason:** Currency-unit ambiguity can create tenfold price errors, while storage and integration boundaries benefit from an explicit official unit. UTC timestamps preserve ordering and auditability.

**Alternative considered:** Store/display an unlabeled generic currency amount and use browser-local timestamps.

**Trade-off accepted:** Currency conversion and localized date presentation require additional boundary tests.

## D-007 — Keep AI outside the critical service path

**Decision:** AI may draft a manager's shift handover from bounded aggregates. It cannot alter orders, statuses, prices, or totals.

**Reason:** A useful summary addresses manual reporting without making active service depend on model correctness, latency, or availability.

**Alternative considered:** A restaurant chatbot or AI interpretation of live order instructions.

**Trade-off accepted:** The capability is intentionally modest and does not automate an operational decision.

## D-008 — Acknowledge partial, not full, offline resilience

**Decision:** Make failed/pending commands visible and retryable, but do not promise multi-device synchronization through a complete outage.

**Reason:** Correct offline coordination between separate waiter and kitchen devices needs a local network service or a significantly more complex synchronization protocol.

**Alternative considered:** Market the browser cache as full offline support or build an untested local-first protocol.

**Trade-off accepted:** During a complete connectivity loss, staff must use a documented manual fallback until devices can reach the service again.

## D-009 — Would revisit: rely on application-enforced tenancy in D1

**Decision:** Keep D1 for the assessment deployment and enforce tenant isolation in the API with mandatory restaurant and branch predicates.

**Reason:** D1 fits the selected hosting path, gives a durable relational store with migrations, and allowed the workflow and negative isolation test to be completed inside the timebox.

**Alternative considered:** PostgreSQL with database row-level security, using transaction-local tenant context and policies as a second boundary below the API.

**Trade-off accepted:** The current test proves known cross-tenant IDs are denied, but the database cannot independently stop a future repository query that accidentally omits a tenant predicate. Before onboarding real restaurants, I would move to database-enforced row security or provide a data-access layer that makes unscoped queries impossible by construction.

## D-010 — Would revisit: use 15-second polling for coordination

**Decision:** Refresh signed-in dashboards every 15 seconds and after each successful command.

**Reason:** Polling is simple, recoverable, and sufficient to demonstrate concurrent append and conflict behavior without introducing a second realtime subsystem.

**Alternative considered:** Server-Sent Events or WebSockets with a per-branch event stream, sequence numbers, and reconnect catch-up.

**Trade-off accepted:** A ready dish may wait up to 15 seconds before another device sees it, while many idle devices generate repetitive reads. A real-service pilot may show that this latency is unacceptable; push updates would then be the first infrastructure change, while commands and version checks remain authoritative.

## D-011 — Would revisit: ship application-owned demo passwords

**Decision:** Seed three named role accounts and use a minimal password-to-session exchange for an immediately usable assessment.

**Reason:** Reviewers need visible credentials for every role, and a managed identity integration would consume time without proving the selected restaurant workflow.

**Alternative considered:** A managed identity provider with invitation, recovery, revocation, rate limits, multi-factor authentication, and audit hooks.

**Trade-off accepted:** The current credentials and password comparison are demonstration infrastructure, not a production identity lifecycle. This was correct for reviewability but wrong for real customer data; production onboarding must replace it rather than extend it.

