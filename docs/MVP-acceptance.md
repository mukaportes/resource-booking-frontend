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

## Open acceptance finding

M05 remains incomplete: Chromium axe reports that FullCalendar’s empty scroll area lacks a keyboard focus path. Directly focusing its nested scroller breaks ARIA grid semantics, so that attempted fix was reverted. Six of seven browser scenarios passed; the mobile accessibility scenario is not passing. The progress tracker records the repair boundary and next action.
