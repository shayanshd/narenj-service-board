# Recorded walkthrough — 7-minute why-first plan

Target length: **7:00**. Approximately **4:35** explains why and trade-offs; approximately **2:25** demonstrates what. Keep the repository, waiter session, kitchen session, and manager session open before recording so the walkthrough stays within the timebox.

## Before recording

1. Open [DECISIONS.md](./DECISIONS.md) in the repository.
2. Open the [live demo](https://narenj-production.up.railway.app) in three separate browser profiles and sign in as waiter, kitchen, and manager.
3. Choose a free table and an available item, but do not submit it yet.
4. Increase browser zoom enough for Persian labels and status changes to remain legible in the recording.
5. Record the browser and microphone, hide notifications, and do a short audio test.

## 0:00–0:35 — Problem and outcome (why)

**Show:** the live table board, then the kitchen board.

**Say:**

> Narenj solves one narrow but costly hand-off: a waiter sends a table request, the kitchen progresses it, and the waiter confirms delivery. I chose this over a broad POS because it is a frequent multi-user workflow where lost or ambiguous state immediately affects a guest. The goal was to complete one trustworthy operational loop, not to imitate payment, inventory, and reporting with shallow screens.

## 0:35–1:25 — Scope boundary (why)

**Show:** `SCOPE.md`, especially “In scope” and “Explicitly out of scope.”

**Say:**

> The strongest scope decision was to stop before checkout. Payment in this market pulls in terminals, refunds, reconciliation, tax, and fiscal documents. Those decisions require field validation and cannot be made credible inside the assessment timebox. Narenj is therefore an operational companion, not a financial system of record. The acceptance criteria focus on the hand-off, retry safety, invalid transitions, role separation, and cross-tenant isolation.

## 1:25–2:20 — Order and visit model (why)

**Show:** `DECISIONS.md`, decisions D-004, D-012, and D-013.

**Say:**

> I modelled changes as narrow commands instead of repeatedly saving one screen-shaped order document. Separate item additions cannot silently overwrite each other; retries use idempotency keys, and stale state returns a conflict. I also rejected automatically freeing a table when the current dishes are served. A guest can order another round while still seated. Delivery state and the end of a customer visit represent different facts, so the waiter explicitly ends service only after the guest leaves.

## 2:20–3:10 — Trust boundary and tenancy (why)

**Show:** the architecture section in `README.md`, then briefly `app/api/app/route.ts` tenant predicates.

**Say:**

> The client never gets to declare its authoritative restaurant, branch, or role. A server-side session resolves all three, and every operational query includes restaurant and branch predicates. Unknown and unauthorized identifiers return the same not-found response, reducing disclosure. The workflow test uses a known ID from a second seeded restaurant to prove it stays hidden. SQLite is appropriate for one assessment replica, but application-only tenancy is a deliberate limitation; before real onboarding I would move to PostgreSQL row-level security or a data layer where unscoped queries are impossible.

## 3:10–3:50 — AI placement (why)

**Show:** the manager shift-summary screen and `AI_USAGE.md`.

**Say:**

> AI is intentionally outside the service path. It receives bounded branch aggregates and can draft a handover, but it cannot change orders, prices, statuses, or totals. The output is schema-validated, must mention every calculated category leader, and falls back to deterministic Persian text on timeout, invalid output, or missing configuration. I rejected a chatbot and free-form action interpretation because explicit controls are safer for live restaurant work.

## 3:50–4:35 — Honest trade-offs and next change (why)

**Show:** decisions D-009 through D-011 or the scaling section in `HANDOVER.md`.

**Say:**

> Three choices are consciously assessment-grade: one SQLite volume and replica, 15-second polling, and visible demo passwords. They make the product reproducible and reviewable, but they are not disguised as production readiness. The first real rollout would start with venue observation and production identity, then push updates with reconnect catch-up, and then cancellation and audit controls. The command model and tenant identifiers survive those changes; the physical runtime does not survive large scale.

## 4:35–5:25 — Waiter sends work; kitchen progresses it (what)

**Show and do:** on the waiter screen, add the prepared item to the free table. Switch to kitchen, refresh if needed, and choose **شروع** then **آماده شد**.

**Say:**

> The waiter submits an append-only item with a safe retry key. Kitchen owns preparation state, so the waiter cannot perform these transitions. The kitchen board is ordered for operational attention and exposes only this branch's work.

## 5:25–6:05 — Delivery is not departure (what)

**Show and do:** return to waiter, mark the item **تحویل شد**, then add another item to the same table.

**Say:**

> The waiter, not kitchen, confirms physical delivery. Serving every current item does not release the table. This second request joins the same open visit, which demonstrates the corrected domain rule rather than just a status animation.

## 6:05–6:30 — Explicit release (what)

**Show and do:** progress and serve the second item, then choose **پایان سرویس و آزاد کردن میز**.

**Say:**

> The server refuses release while any item is new, preparing, or ready. Once everything is served and the guest has actually left, explicit release makes the table available and ensures the next customer receives a new order.

## 6:30–6:50 — Manager and graceful AI fallback (what)

**Show and do:** switch to manager, briefly show menu availability and generate the shift summary.

**Say:**

> The manager can hide an unavailable item from future additions. The handover reports frequency within categories rather than naming a misleading overall bestseller, and the calculated result remains available even without an AI provider.

## 6:50–7:00 — Close

**Show:** `SUBMISSION.md` or the README verification commands.

**Say:**

> The repository includes the scope, decision record, AI disclosure, operating handover, migrations, and executable workflow proof. The key claim is not feature count; it is that one restaurant hand-off has an explicit trust model, visible trade-offs, and tested failure behavior.

## Recording acceptance check

- Duration is between 5 and 10 minutes.
- At least 3:30 is clearly spent on reasoning; this plan allocates about 4:35.
- Persian text and button changes are readable.
- No API keys, cookies, browser password manager, or private notifications are visible.
- The final uploaded link opens in a signed-out browser and permits playback without requesting access.
