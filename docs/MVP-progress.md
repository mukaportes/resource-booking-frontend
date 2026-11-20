# MVP milestone progress

Source: [PRD-resource-booking.md](PRD-resource-booking.md), §17. UI: [Resource Atlas, option 04](UI-resource-atlas.md).

Updated: 2026-11-20. Delivery means implemented, verified and published for review; deployment is outside scope. Native GitHub stack **#6** contains the milestone PRs and lands on `main`.

| Code | Milestone                                   | Status                            | Branch                       | Dependency | PR                                                                   | Verification                                                          |
| ---- | ------------------------------------------- | --------------------------------- | ---------------------------- | ---------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| M01  | Domain core + tests                         | Complete — merged                 | `feat/M01-domain-core`       | —          | [#1](https://github.com/mukaportes/resource-booking-frontend/pull/1) | 25 tests; typecheck/lint; GitHub CI passed                            |
| M02  | Storage adapter, repositories and use cases | Complete — merged                 | `feat/M02-storage-use-cases` | M01        | [#2](https://github.com/mukaportes/resource-booking-frontend/pull/2) | 41 tests; typecheck/lint; GitHub CI passed                            |
| M03  | Login, session, app shell and toasts        | Complete — PR open                | `feat/M03-session-app-shell` | M02        | [#3](https://github.com/mukaportes/resource-booking-frontend/pull/3) | 47 tests; typecheck/lint/build; browser login smoke; GitHub CI passed |
| M04  | Calendar, filters, booking modals and list  | Complete — PR open                | `feat/M04-booking-workspace` | M03        | [#4](https://github.com/mukaportes/resource-booking-frontend/pull/4) | 55 tests; typecheck/lint/build; GitHub CI passed                      |
| M05  | Accessibility, resilience, README and demo  | Verification passed — awaiting CI | `feat/M05-polish-demo`       | M04        | [#5](https://github.com/mukaportes/resource-booking-frontend/pull/5) | 55 tests; 7/7 Chromium scenarios; typecheck/lint/build; CI pending    |

## Acceptance and delivery

- M01: framework-free domain functions and the full PRD §6.3 numeric scenario.
- M02: validated storage, synchronous booking/sequence commit and rollback, monotonic IDs, identity and trusted ownership checks.
- M03: FR-U1–U6, gated empty shell, Atlas primitives, feedback and typed storage recovery.
- M04: FR-A/B/C/L, day/week FullCalendar, shared URL filters, create/details/cancel workflows and list history.
- M05: challenge README/demo, route/root error boundaries, contrast, browser CI and keyboard/mobile acceptance.
- Dependent PRs form a native GitHub stack rooted at `main`; the stack retargets as lower layers merge. M01 and M02 were merged on GitHub during delivery; the agent did not merge them.

## Final verification

- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm test`: 55 passed across five files.
- `npm run build`: passed using Next.js Webpack.
- `npm run test:e2e -- --workers=2`: 7/7 Chromium scenarios passed.
- Real browser flows cover login/session/logout, conflict and adjacency, cancellation and non-reused IDs, non-owner details, URL restoration, corruption export/reset, blocked storage, 360 px layout, drag submission, keyboard scrolling and event Enter/Space access.
- Axe scans cover login, mobile empty calendar and a populated calendar, with no serious/critical findings in those states. This is not a full WCAG certification or cross-browser audit.
- Visual comparison at desktop and 360 px confirms Atlas hierarchy, seven-resource deck, blue tokens and responsive schedule composition.

## Execution record and limits

Started: 2026-11-20 07:55 America/Sao_Paulo. The skill's initial two M05 repair cycles reached a calendar accessibility boundary. The user explicitly authorized one additional targeted cycle; it passed. The fix focuses FullCalendar's existing day grid cells through `dayCellDidMount`, retaining its ARIA grid hierarchy and native keyboard scrolling.

The front-end MVP retains the PRD's fake identity, per-browser storage and multi-tab concurrency limitations. Backend, deployment and production operational acceptance were not performed. CI for the final published revision must pass before M05 is marked complete.
