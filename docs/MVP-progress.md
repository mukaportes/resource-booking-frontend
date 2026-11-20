# MVP milestone progress

Source: [PRD-resource-booking.md](PRD-resource-booking.md), §17. UI: [Resource Atlas, option 04](UI-resource-atlas.md).

Updated: 2026-11-20. Delivery means implemented, verified and published for review; it does not mean merged or deployed.

| Code | Milestone | Status | Branch | Dependency | PR | Verification |
|---|---|---|---|---|---|---|
| M01 | Domain core + tests | Complete — PR open | `feat/M01-domain-core` | — | [#1](https://github.com/mukaportes/resource-booking-frontend/pull/1) | 25 tests; typecheck/lint; GitHub CI passed |
| M02 | Storage adapter, repositories and use cases | Complete — PR open | `feat/M02-storage-use-cases` | M01 | [#2](https://github.com/mukaportes/resource-booking-frontend/pull/2) | 41 tests; typecheck/lint; GitHub CI passed |
| M03 | Login, session, app shell and toasts | Complete — PR open | `feat/M03-session-app-shell` | M02 | [#3](https://github.com/mukaportes/resource-booking-frontend/pull/3) | 47 tests; typecheck/lint/build; browser login smoke; GitHub CI passed |
| M04 | Calendar, filters, booking modals and list | Complete — PR open | `feat/M04-booking-workspace` | M03 | [#4](https://github.com/mukaportes/resource-booking-frontend/pull/4) | 55 tests; typecheck/lint/build; GitHub CI passed |
| M05 | Accessibility, resilience, README and demo | Incomplete — draft delivery | `feat/M05-polish-demo` | M04 | [#5 (draft)](https://github.com/mukaportes/resource-booking-frontend/pull/5) | 6/7 browser scenarios passed; calendar scroll accessibility unresolved; final checks pending |

## Acceptance and delivery rules

- M01: pure domain functions, the full PRD §6.3 scenario and meaningful rule tests.
- M02: validated storage, rollback, monotonic sequence, identity and ownership use cases.
- M03: FR-U1–U6, empty gated shell, Atlas primitives, consistent toasts.
- M04: FR-A/B/C/L, FullCalendar day/week, shared URL filters, create/details/cancel flows and list.
- M05: PRD §12 acceptance evidence, keyboard/mobile checks, error boundaries, recovery and challenge README.
- Each dependent PR targets its predecessor for a focused diff and ultimately lands on `main` in stack order. No automatic merges.
- Status changes are recorded here when each milestone finishes, with checks actually run and any limitations.

## M05 handoff — 2026-11-20

Implemented: seven Chromium acceptance scenarios; root/route error fallbacks; challenge README and demo; acceptance evidence; browser CI; stronger resource-caption/toast contrast; status badges. The source PRD and Atlas preview/specification are mirrored into the frontend repository for reviewers.

Unresolved: the calendar's empty scroll region needs a valid keyboard focus path. Adding focus directly to FullCalendar's nested scroller breaks its ARIA grid hierarchy. That attempted change was reverted to the M04 baseline; the original scroll-focus finding remains. Automated accessibility acceptance is not complete.

Evidence: M04's 55 tests/typecheck/lint/build and GitHub CI passed. M05's initial full Chromium suite passed six scenarios and failed the mobile accessibility scenario. The contrast fixes passed the subsequent mobile scan, but scroll/grid semantics did not. Final M05 checks must be rerun after the remaining fix.

Execution boundary: the principal-engineer skill's two repair cycles have been used for M05. Further implementation requires a user-directed continuation or extension. Recommended next action: focus a semantically valid calendar descendant, verify keyboard scrolling and axe, then run all checks and finish the draft. Estimated remaining effort: 10–20 minutes. No PR has been merged or deployed.

Started at 2026-11-20 07:55 America/Sao_Paulo. The initial implementation/handoff took approximately 20 minutes; the skill's 90-minute time budget was not exhausted.

Native GitHub stack **#6** has been created and verified through the GitHub API. It contains PRs #1 → #2 → #3 → #4 → #5 and targets `main`; #5 is a draft. Its stack map is available from each PR. M05 CI is running; passing completion is not claimed. A user-directed one-cycle extension has been requested and is pending.
