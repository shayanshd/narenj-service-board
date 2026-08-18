# Narenj final submission

## Submission links

- **Repository:** [https://github.com/shayanshd/narenj-service-board](https://github.com/shayanshd/narenj-service-board)
- **Live demo:** [https://narenj-production.up.railway.app](https://narenj-production.up.railway.app)
- **Recorded walkthrough:** `REPLACE_WITH_RECORDED_WALKTHROUGH_URL`

The repository is the source of truth. The Railway service builds the checked-in `Dockerfile` from the default `main` branch.

## Demo credentials

| Role | Email | Password | Best screen to review |
| --- | --- | --- | --- |
| Waiter | `waiter@narenj.demo` | `Waiter123!` | Table state, adding items, confirming delivery, ending service |
| Kitchen | `kitchen@narenj.demo` | `Kitchen123!` | New → preparing → ready workflow |
| Manager | `manager@narenj.demo` | `Manager123!` | Menu availability and shift handover |

These are public assessment credentials, not production identity infrastructure. The second seeded restaurant is intentionally not given a login; it exists to exercise tenant-isolation tests.

## Required documents

- [README.md](./README.md) — product summary, local setup, architecture, verification, security, and deployment
- [SCOPE.md](./SCOPE.md) — pre-build boundary, assumptions, acceptance criteria, and risks
- [DECISIONS.md](./DECISIONS.md) — decisions, alternatives, trade-offs, and choices to revisit
- [AI_USAGE.md](./AI_USAGE.md) — development/runtime AI use, rejected suggestions, and verification
- [HANDOVER.md](./HANDOVER.md) — operating guide, limitations, next steps, and scaling breakpoints
- [WALKTHROUGH.md](./WALKTHROUGH.md) — a timed 7-minute recording plan with more than half devoted to why

## Reviewer quick path

1. Open the live demo and sign in as the waiter. Add an item to a free table.
2. In a separate browser profile, sign in as kitchen and move it to **preparing**, then **ready**.
3. Return to the waiter, mark it **served**, add a second item to the same table, and observe that it remains the same customer visit.
4. Serve the second item, then explicitly end service and release the table.
5. Sign in as manager, toggle one menu item's availability, and generate the shift handover.
6. Read [DECISIONS.md](./DECISIONS.md) for the reasoning behind this boundary and [tests/api-workflow.test.mjs](./tests/api-workflow.test.mjs) for the executable proof.

## Local verification

```bash
npm ci
npm run verify
```

For the live multi-role workflow, start the app in one terminal:

```bash
npm run dev
```

Then run this in a second terminal:

```bash
npm run test:workflow
```

## Final owner gates

Complete these two external actions immediately before sending the submission:

- [ ] Make the GitHub repository public, or grant the named reviewer access. An unauthenticated request currently receives `404` because the repository is private.
- [ ] Record and upload the walkthrough using [WALKTHROUGH.md](./WALKTHROUGH.md), replace `REPLACE_WITH_RECORDED_WALKTHROUGH_URL` above, and verify the link in a signed-out browser.

After those actions, confirm that the live app, repository, and recording all open without relying on the submitter's browser session.
