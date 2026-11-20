# MVP acceptance evidence

The scope is the front-end MVP in PRD §17, using Resource Atlas option 04. Backend roadmap, real authentication, deployment and cross-tab concurrency guarantees are excluded by the PRD.

| PRD §12 criterion                           | Evidence                                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Full §6.3 challenge scenario                | `src/domain/bookings.test.ts`, challenge acceptance scenario                                                            |
| Email gate and tab session                  | Login integration tests; browser gate/reload/logout flow; versioned sessionStorage user ID                              |
| Stable normalized identity                  | Application identity/reload tests and browser normalized login                                                          |
| Ownership beyond the UI                     | Direct application cancellation tests for active and cancelled records; browser readonly non-owner details              |
| Conflict explanation and sorted records     | Domain sorted conflicts; dialog commit-time failure test; browser conflict form preservation                            |
| IDs increase and survive reload             | Application rejection/cancellation/reload and rollback tests; browser create/cancel/recreate/reload                     |
| Numeric UTC persistence and local display   | Domain numeric schemas; UI-only `time.ts`; browser locale/time-zone configuration                                       |
| Shared URL resource filters                 | `view-state.test.ts`; browser filter/scope reload and 360 px empty selection                                            |
| Cancelled records remain visible            | Application soft cancellation/idempotence tests; browser list history                                                   |
| Storage corruption/unavailability preserved | Schema/null/version/FK/sequence/rollback tests; login recovery test; browser raw export/typed reset and blocked storage |
| English code contracts                      | Source diff inspection; stable English enum values, keys and error codes                                                |
| Typecheck/lint/test scripts                 | Milestone PR CI runs; final local verification recorded in the progress tracker                                         |
| Challenge README                            | Root README includes install/run/test, reproducible demo, three tests, decisions, limitations and AI verification       |

## Verification limits

Browser acceptance runs in Chromium. Automated axe checks cover exercised login/workspace/mobile states and do not certify every WCAG criterion. Keyboard paths, modal focus, 360 px overflow and drag selection are exercised separately. Local storage has the documented browser/tab and concurrency limitations; this is not production authentication or backend acceptance.

## M01–M05 browser evidence (historical)

All seven Chromium scenarios passed on 2026-11-20, including native keyboard scrolling through a focusable day grid cell and Enter/Space booking details with focus restoration. Login, empty mobile calendar and populated calendar axe scans reported no serious/critical findings. Typecheck, lint, 55 unit/integration tests and the production build passed. The progress tracker records final publication/CI state.

Implementation CI passed: [run 44728628284](https://github.com/mukaportes/resource-booking-frontend/actions/runs/44728628284). Visual evidence: [desktop](mvp-resource-atlas-desktop.png) and [360 px](mvp-resource-atlas-mobile.png).

## M06 remediation acceptance

All seven original work packages and all four follow-up findings are resolved; see the [final focused audit](Excellence-Bar-Final-M06.md) and [M06 evidence](M06-acceptance.md). Current local verification: 68 tests across nine files, typecheck/lint/build and 16 production Chromium scenarios pass. Repair-source CI passes and M06 is complete/published for review; current documentation-head checks remain visible on PR #7 and in the progress tracker. Negative application probes prove query edits cannot alter trusted ownership, bytes or IDs. Shared-week desktop/360 px, long-label, active/cancelled, keyboard/focus and relevant axe states are verified, alongside the existing time/storage/revision cases. The 4/4/4 focused assessment is grounded in behavior, visuals and measurements; no merge, deployment, independent endorsement or production operational acceptance is inferred.
