# AI usage

## Tools and purpose

- **Codex:** helped turn the assessment into a bounded workflow, scaffold the vinext application, draft repetitive schema/API/UI code, generate tests, and keep the four delivery documents consistent.
- **Web research:** checked the shape of Iranian restaurant software and connectivity/currency constraints, and used official OpenAI documentation to verify the selected API and structured-output pattern.
- **OpenAI ImageGen:** produced the single Persian social-preview card in `public/og.png`; it is presentation material, not an operational product screen.
- **OpenAI model at runtime:** optionally drafts a manager's shift handover from calculated aggregates. It is advisory and is not on the ordering path.

## Where AI saved real time

It was most useful on mechanical work: creating the first-pass schema and seed, laying out the RTL interface, wiring repetitive role-specific states, and drafting the test harness. That left more of the fixed timebox for the decisions that mattered: stopping before payment, making order-item commands independent, placing the tenant boundary on every query, and proving failure behavior.

## Where it produced something bad

The first generated project setup path assumed a package-manager environment that was not actually available and attempted to pull unnecessary platform artifacts. I discarded that setup path, used the bundled Node runtime, regenerated the lockfile with npm, and rebuilt from a clean dependency install. Generated UI markup also contained an inaccessible quantity label and claimed automatic refresh before polling existed; linting and product review exposed both, and I corrected them.

## A recommendation I rejected

A broader design could have added an AI restaurant chatbot or let a model interpret free-form kitchen instructions into actions. I rejected it. It increases prompt-injection and correctness risk exactly where service must be deterministic, and it has no advantage over explicit buttons for the selected workflow. The smaller shift-handover feature removes a manual reporting chore, receives only aggregates, has a strict schema, and can fail without affecting a guest.

I also rejected saving an entire order document after every edit. It is quick to scaffold, but simultaneous waiters can overwrite one another. Explicit item commands, idempotency keys, and optimistic versions are slightly more code and materially safer.

## How generated work was verified

- Read and revised every migration, tenant predicate, permission, and state transition.
- Seeded a second restaurant with a known identifier, then tested that its data stayed absent and its ID failed closed.
- Ran a live API workflow from waiter login through idempotent add, role denial, kitchen preparation, readiness, and stale/invalid conflicts.
- Ran ESLint, TypeScript checking, the production build, and a rendered HTML/metadata test.
- Exercised the AI endpoint with no provider key and verified that the deterministic fallback returned useful metrics instead of blocking.
- Rendered and visually inspected the application and social card.

Model prose is not accepted as fact or as an action. Runtime model output is parsed against a strict JSON shape and labelled by source; calculated totals remain server-owned.

## Architecture that was my own judgment

The product boundary, selected operational hand-off, three-role split, restaurant/branch ownership model, append-command API, version conflict behavior, currency storage rule, partial-offline claim, AI placement, and scaling limitations were architectural decisions rather than AI defaults. AI accelerated expression and implementation; it did not decide what the customer should trust.

