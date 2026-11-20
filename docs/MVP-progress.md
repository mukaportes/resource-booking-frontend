# MVP milestone progress

Source: [PRD-resource-booking.md](PRD-resource-booking.md), §17. UI: [Resource Atlas, option 04](UI-resource-atlas.md).

Updated: 2026-11-20. Delivery means implemented, verified and published for review; deployment is outside scope. M01–M05 were delivered through native GitHub stack **#6** and are now merged into `main`. M06 targets `main` after M05.

| Code | Milestone                                   | Status                         | Branch                       | Dependency | PR                                                                   | Verification                                                             |
| ---- | ------------------------------------------- | ------------------------------ | ---------------------------- | ---------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| M01  | Domain core + tests                         | Complete — merged              | `feat/M01-domain-core`       | —          | [#1](https://github.com/mukaportes/resource-booking-frontend/pull/1) | 25 tests; typecheck/lint; GitHub CI passed                               |
| M02  | Storage adapter, repositories and use cases | Complete — merged              | `feat/M02-storage-use-cases` | M01        | [#2](https://github.com/mukaportes/resource-booking-frontend/pull/2) | 41 tests; typecheck/lint; GitHub CI passed                               |
| M03  | Login, session, app shell and toasts        | Complete — merged              | `feat/M03-session-app-shell` | M02        | [#3](https://github.com/mukaportes/resource-booking-frontend/pull/3) | 47 tests; typecheck/lint/build; browser login smoke; GitHub CI passed    |
| M04  | Calendar, filters, booking modals and list  | Complete — merged              | `feat/M04-booking-workspace` | M03        | [#4](https://github.com/mukaportes/resource-booking-frontend/pull/4) | 55 tests; typecheck/lint/build; GitHub CI passed                         |
| M05  | Accessibility, resilience, README and demo  | Complete — merged | `feat/M05-polish-demo`       | M04        | [#5](https://github.com/mukaportes/resource-booking-frontend/pull/5) | 55 tests; 7/7 Chromium scenarios; typecheck/lint/build; GitHub CI passed |
| M06 | Audit remediation — 1 Blocker + 6 Majors | Complete — PR ready for review | `fix/M06-audit-remediation` | M05 | [#7](https://github.com/mukaportes/resource-booking-frontend/pull/7) | 68 tests; 16/16 production Chromium scenarios; typecheck/lint/build; repair CI passed; final-head checks on PR #7 |

## Acceptance and delivery

- M01: framework-free domain functions and the full PRD §6.3 numeric scenario.
- M02: validated storage, synchronous booking/sequence commit and rollback, monotonic IDs, identity and trusted ownership checks.
- M03: FR-U1–U6, gated empty shell, Atlas primitives, feedback and typed storage recovery.
- M04: FR-A/B/C/L, day/week FullCalendar, shared URL filters, create/details/cancel workflows and list history.
- M05: challenge README/demo, route/root error boundaries, contrast, browser CI and keyboard/mobile acceptance.
- M06: all seven original packages and all four post-CI findings are resolved; [per-finding reassessment and measured evidence](M06-acceptance.md). Store every timestamp as UTC epoch milliseconds and display browser-local time; no timezone configuration or custom timezone engine. The focused reassessment covers all seven findings; it does not assign a broader excellence score.
- Dependent PRs form a native GitHub stack rooted at `main`; the stack retargets as lower layers merge. M01–M04 were merged on GitHub during delivery; the agent did not merge them.

## M01–M05 verification (historical)

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

The front-end MVP retains the PRD's fake identity, per-browser storage and multi-tab concurrency limitations. Backend, deployment and production operational acceptance were not performed. The implementation CI passed: [GitHub Actions run 44728628284](https://github.com/mukaportes/resource-booking-frontend/actions/runs/44728628284). Final PR checks remain visible on PR #5.

Time spent: approximately 45 minutes elapsed, including verification and the repair-authorization pause. No deployment was performed.

UI evidence: [Desktop Atlas capture](mvp-resource-atlas-desktop.png) · [360 px Atlas capture](mvp-resource-atlas-mobile.png).

## M06 verification and delivery

- Based on `main` at `f04f87e`, containing merged M05. Original PRD/progress planning edits were preserved. During execution the user confirmed repository `docs/` as the canonical location after the separate shared directory was moved; documentation-exclusion configuration was preserved. No second documentation tree is recreated.
- Reproduced original browser defects against the M05 production build; reproduced full-history cost at 100/1,000/5,000 records and the missing diagnostic cause with a failing regression.
- Typecheck and lint pass. 68 unit/integration/component tests pass across nine files; numeric domain rules remain unchanged. Production build passes. 16/16 Chromium scenarios pass against the production server, including the seven historical scenarios.
- New behavioral regressions cover local/DST-to-UTC persistence and reload, session-only recovery, readable startup quota versus access denial, date-context defaults, local/external availability revision changes, submission-conflict reconciliation, bounded history/visible-range events and both copied diagnostic references.
- Populated desktop/360 px, keyboard/focus and relevant axe states were rechecked. No serious/critical axe issues were reported in the exercised states; this is not a full accessibility certification.
- Initial M06 measurements (historical): at 5,000 bookings / 100 users / 903,480 serialized UTF-8 bytes, median list load changed from 882.2 to 53.3 ms and ID-sort interaction from 513.4 to 32.6 ms; rendered history changed from 5,000 to at most 50 rows. Three samples per fixture per revision; exact samples and limitations are in [M06 acceptance](M06-acceptance.md). No CI timing threshold was introduced.
- Implementation CI passed: [run 44737120998](https://github.com/mukaportes/resource-booking-frontend/actions/runs/44737120998), including 14 Chromium scenarios in 24.7 seconds. [PR #7](https://github.com/mukaportes/resource-booking-frontend/pull/7) targets `main`.
- The user requested a fresh excellence-bar audit after CI. [Post-CI report](Excellence-Bar-Reaudit-M06.md): CONDITIONAL; two Majors (mutable cache/query ownership coupling and unreadable shared-week overlap), two Minors (field associations and picker month). That assessment reopened M06-06 for mutable-query ownership/record preservation and kept M06 incomplete until the authorized repairs below.
- No merge, deployment, production authentication, cross-tab locking or remote monitoring was performed. The initial run stopped at its repair boundary; the user then authorized the additional cycle recorded below.

### Authorized repair cycle and final reassessment

The user explicitly authorized one additional cycle to repair all four findings. Repair source `c5390f9af74614393eb957ebc93ae28f93d48bf6` passes local typecheck/lint, 68 tests, build and 16/16 production Chromium scenarios (12.0 seconds). Negative record-mutation regressions preserve ownership, storage and IDs. Shared weeks now use ten readable entries per page; single-resource week grids remain. Long-label desktop/360 px, active/cancelled, field associations, viewed-month picker context and keyboard focus pass. [Final focused audit](Excellence-Bar-Final-M06.md): 4/4/4, PASSES THE BAR within the documented browser-only MVP scope, based on behavior, visuals and measurements as well as tests. Earlier CONDITIONAL findings remain historical evidence and are now closed.

Final 5,000-record medians: list load 46.1 ms versus 882.2 ms before M06; ID sort 34.8 ms versus 513.4 ms; 50 history rows. The 2,352-match shared week renders ten entries with working page navigation. [Final measurements/evidence](M06-acceptance.md#final-authorized-repair-cycle-evidence). No timing threshold, retained-record deletion, merge or deployment was introduced. Repair-source CI passed: [run 44744333630](https://github.com/mukaportes/resource-booking-frontend/actions/runs/44744333630), including all 16 Chromium scenarios in 33.2 seconds. All seven original packages and four follow-up findings are resolved, required checks pass and PR #7 is published for review; M06 is complete. Final documentation-head checks remain visible on the PR.
