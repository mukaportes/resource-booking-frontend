# Excellence Bar Audit — Alvorada / spaces

**Sources:** codebase (including local PRD, Atlas design contract and acceptance documentation; no Confluence sources)
**Verdict: CONDITIONAL**

The app has a credible, tested foundation, but I would withhold an excellence-grade release until booking-time correctness and recovery behavior are repaired. The most serious verified defect silently saves a different local time from the one entered during a daylight-saving transition. This is a bounded repair effort, not an architecture rewrite; resolving the Blocker and highest-impact Majors below is the condition for reassessment.

**Audit date:** November 20, 2026 (America/Sao_Paulo)  
**Revision:** `594f198a3657790c5c26c6eaf0dade64f200b709`, clean frontend working tree at inspection.  
**Context:** internal-team, browser-only booking MVP. Demo email identity, local-only persistence and lack of cross-tab atomicity are explicit constraints, not undisclosed security defects. This verdict applies to that product scope; it is not approval to deploy a multi-user production booking service.

## Scorecard

| Dimension | Score (1–5) | Summary |
|---|---:|---|
| Product & UX polish | 3 | Coherent Atlas layout and accessible happy paths; date context, stale availability and recovery still undermine core journeys. |
| Performance & reliability | 3 | Successful build and acceptance suite, deliberate rollback and commit-time conflict checks; local-time correctness, quota recovery, growth and diagnostics need work. |
| Code quality & architecture | 4 | Clear domain/application/infrastructure/UI boundaries, meaningful rule tests and CI; targeted gaps exist at the UI/time/storage seams. |

Scores use the skill's rubric: 3 is competent ordinary shipping quality; excellence requires at least 4 in every dimension. The current app does not pass that bar.

## What's genuinely good

- **Booking semantics are explicit and tested.** Half-open overlap, resource isolation, ordered conflicts, cancellation idempotence and rejection without ID consumption have behavioral tests. See [booking rules](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/domain/bookings.ts:15) and [challenge acceptance test](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/domain/bookings.test.ts:49).
- **Ownership is enforced beyond button visibility.** Application cancellation authenticates the current user, and domain cancellation checks ownership before status. Direct application tests cover both active and cancelled records: [use cases](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/application/use-cases.ts:109), [ownership test](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/application/application.test.ts:134). This is appropriate enforcement for demo identity, not real authentication.
- **Persistence failures received real engineering attention.** Versioned schemas, duplicate/FK/sequence checks, rollback and raw export protect local records. Tests verify failed sequence writes do not leave a successful booking or consume an ID: [storage commit](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/infrastructure/storage/safe-storage.ts:115), [application tests](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/application/application.test.ts:152).
- **The visual system is coherent.** The rendered desktop screen uses consistent resource cards, typography, selected states and schedule hierarchy. Existing Chromium scenarios also verify 360 px containment, keyboard filters and event details, focus restoration, drag entry and axe scans. See [audit screenshot](excellence-audit-evidence/desktop.png) and [browser scenarios](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/e2e/booking-flows.spec.ts:220).
- **Change safety is substantive.** All 55 unit/integration tests and seven browser scenarios passed during this audit. CI runs typecheck, lint, tests, build and Chromium acceptance: [workflow](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/.github/workflows/ci.yml:1).

## Findings

Ordered by severity, then impact on booking and recovery. **Verified** means observed in a local browser or directly established from source; **inference** explicitly identifies an unmeasured consequence.

### [Blocker] Nonexistent local times silently become different bookings

- **Where:** [local-to-epoch conversion](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/ui/lib/time.ts:37), [form validation](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/ui/components/booking-dialog.tsx:59).
- **Evidence:** **Verified against the production build.** In `America/New_York`, enter March 14, 2027, `02:00–02:30`. The form keeps those values and reports “✓ Available”; submission persists `03:00–03:30 EDT`. `new Date(localString)` normalizes the missing hour, and validation checks only finite values, ordering, grid and future start. Existing browser tests use UTC, which never exercises this failure.
- **Why it misses the bar:** A reservation must represent the time the user chose. Silently changing it is a core correctness failure, independent of conflict detection. This is distinct from the documented 45-minute-offset limitation.
- **Fix direction:** Round-trip local date/time fields through conversion and reject nonexistent times before availability/submission. Define how repeated fall-back times are selected or explained. Add spring-forward and fall-back browser cases in a DST-observing zone.

### [Major] A damaged tab session offers deletion of healthy booking history

- **Where:** [session parsing](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/infrastructure/repositories/local-data.ts:104), [recovery UI](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/ui/components/storage-recovery.tsx:71), [reset implementation](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/infrastructure/repositories/local-data.ts:155).
- **Evidence:** **Verified in Chromium.** Create a valid booking, replace only the session value with `{broken`, and reload. The blocking recovery dialog offers raw export and “Reset local data”, which removes users, bookings and the sequence as well as the damaged session. It provides no session-only recovery. The existing malformed-session tests explicitly expect this corruption classification.
- **Why it misses the bar:** Disposable identification state should not drive users toward deleting healthy persistent history. A fresh tab is a technical workaround, not a recovery path explained by the product. This follows the PRD's generic corruption policy, so the specification needs correction too.
- **Fix direction:** Distinguish session corruption from persistent-data corruption. Preserve raw session data for export if needed, clear only the invalid session, explain what happened and request identification again. Assert bookings and sequence remain byte-for-byte unchanged.

### [Major] Full storage is misdiagnosed as disabled storage at startup

- **Where:** [storage probe](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/infrastructure/storage/safe-storage.ts:52), [initialization](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/infrastructure/create-application.ts:22), [blocking explanation](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/ui/components/storage-recovery.tsx:106).
- **Evidence:** **Verified with injected browser failure.** Make probe writes throw `QuotaExceededError` while reads continue to work, then reload. Initialization returns `STORAGE_UNAVAILABLE` and blocks the workspace. The only action is Reload, with advice to allow site data or disable private browsing. Unlike ordinary writes, `probe()` collapses every exception into the same unavailable error.
- **Why it misses the bar:** Readable saved bookings become inaccessible through the UI, and the instructions cannot repair the actual cause. No raw export is offered in this branch. This also diverges from the PRD's distinct quota error contract.
- **Fix direction:** Preserve quota versus access-denied classification during probing. Permit a safe read-only/export mode where reads succeed, with a concrete capacity recovery path and clear mutation restrictions. Test startup quota separately from blocked storage and commit rollback.

### [Major] New booking discards the schedule date being viewed

- **Where:** [primary booking action](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/ui/components/booking-workspace.tsx:62).
- **Evidence:** **Verified in Chromium.** With the clock on January 11, 2027 and the schedule showing March 14, pressing “New booking” prefills January 11. The handler calls `nextSlot()` with the current clock and never uses `state.date`. The keyboard alternative therefore differs from selecting a slot in the visible schedule.
- **Why it misses the bar:** The primary action breaks the user's date context and makes an accidental booking on a different day easy. It particularly affects users relying on the button as the calendar's keyboard booking path.
- **Fix direction:** Use the selected schedule day as the default for future dates; use the next valid slot when viewing today. Define a clear policy for past dates and preserve the single-resource preselection. Add a browser assertion for booking from a future schedule day.

### [Major] Availability stays stale after another tab changes bookings

- **Where:** [availability dependencies](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/ui/hooks/use-booking-availability.ts:18), [external refresh](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/ui/hooks/use-application.tsx:128), [sticky submission error](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/ui/components/booking-dialog.tsx:138).
- **Evidence:** **Verified in Chromium.** Open a valid available interval; write an overlapping booking and sequence from another same-origin tab. The external-update toast appears, but the open form still says “✓ Available” after refresh. Submitting correctly rejects the conflict. The hook depends on interval and stable functions, not a data revision. A commit conflict is also retained until a form field changes.
- **Why it misses the bar:** The product announces an update while leaving its decision-making panel stale. The reverse case can leave a newly freed slot disabled until the user edits or reopens the form. Commit-time validation protects data; it does not repair misleading availability. This does not require cross-tab locking, which remains out of scope.
- **Fix direction:** Invalidate/recheck advisory availability on local mutations and external data revisions. Reconcile commit-time conflict errors against refreshed data without losing the draft. Test both externally occupied and externally freed intervals.

### [Major] Growing history repeatedly parses and renders the entire dataset

- **Where:** [full snapshot validation](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/infrastructure/repositories/local-data.ts:52), [refresh fan-out](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/ui/hooks/use-application.tsx:40), [unbounded table](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/ui/components/booking-table.tsx:16).
- **Evidence:** **Verified from source; large-data latency is unmeasured.** Each `LocalData.read()` parses users and bookings, validates all records, and checks each booking owner with `users.some`. A normal refresh invokes this repeatedly through identity and authenticated list operations. The provider requests all bookings, calendar event construction receives all matching history, and list view maps every matching record into DOM rows. History is retained indefinitely; the README explicitly acknowledges this limitation.
- **Why it misses the bar:** Main-thread work grows with retained history, including work proportional to bookings × users. “Async” repository methods do not move synchronous localStorage, parsing or validation off the UI thread. The risk is accepted in the MVP, but fast behavior at growing data volumes has not met the excellence bar.
- **Fix direction:** Establish a supported local-history budget and benchmark it. Validate/reuse a snapshot per revision, index users by ID, supply the calendar only its visible interval and paginate or virtualize history. Keep sequence and retained-record guarantees intact; pagination after repeated full parsing alone is insufficient.

### [Major] Unexpected-error references lose the diagnostic cause

- **Where:** [unexpected error capture](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/infrastructure/storage/safe-storage.ts:19), [logger](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/infrastructure/logger/index.ts:3), [render fallback](/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/src/ui/components/error-view.tsx:8).
- **Evidence:** **Verified from source.** `capture()` catches an unexpected exception but logs only “Unexpected application failure”, discarding its type, message, stack and operation. The logger writes only to the browser console. Render boundaries pass only `retry` to `ErrorView`, which emits a fresh generic failure without the caught exception. Copyable IDs therefore identify an event with little explanation of its cause.
- **Why it misses the bar:** Even a developer reproducing a failure locally loses the most useful debugging evidence. A reference number alone cannot explain why a booking failed. Remote monitoring is future scope; retaining useful sanitized local diagnostics is necessary now.
- **Fix direction:** Preserve sanitized error type/stack and operation context alongside a consistent correlation ID, without emails or booking payloads. Pass boundary errors into the diagnostic layer. Add a small test proving the user-visible reference resolves to diagnostic evidence; choose a remote sink before production operation.

## Path to the bar

1. **Blockers — M.** Repair local-time conversion and explicitly handle DST gaps/repeated hours. Acceptance: the entered interval is either preserved exactly as a chosen instant or rejected with actionable copy; it is never silently shifted. Run transition cases through the real booking form and persisted records.
2. **Highest-leverage Majors — M–L.** First implement session-only recovery and quota/read-only/export behavior. Then preserve viewed-date context and invalidate live availability on data changes. Finally bound and measure local-history cost and retain useful error causes. Add focused regression cases for these failures; a backend rewrite is unnecessary for these repairs.
3. **Polish pass — S–M.** Re-run desktop and 360 px flows with populated, cancelled, invalid and recovery states; inspect booking-form field error associations, keyboard focus and screen-reader announcements, and verify dense side-by-side events remain readable. Reconcile the PRD and acceptance evidence with the repaired behavior. Rescore after execution; do not infer a 4+ solely from green tests.

Sizing includes verification: S ≈ up to one engineering day, M ≈ two to four days, L ≈ a week or more. These are rough orders of magnitude, not delivery commitments.

## Audit coverage and verification

Critical journeys examined:

| Journey | Evidence and outcome |
|---|---|
| Identify, restore session, switch identity | Passing integration/browser checks; isolated session-corruption recovery gap reproduced. |
| Browse day/week/list, select resources and restore URL | Passing URL tests and browser checks; future-day primary booking mismatch reproduced. |
| Check availability and create conflict-free bookings | Domain and UI tests pass; DST time shift and stale external availability reproduced against the production build. |
| Inspect, cancel, free a slot and retain history | Ownership, idempotence, confirmation, increasing IDs and browser reload checks pass. |
| Recover from corrupt or unavailable storage | Existing export/reset and blocked-storage scenarios pass; quota startup misclassification reproduced. |

Commands rerun on this revision:

| Check | Result |
|---|---|
| `npm test` | 5 files, 55 tests passed; Vitest reported 2.25 seconds. |
| `npm run lint` | Passed with zero warnings. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed; compiler reported 1.824 seconds, TypeScript 1.582 seconds; this is not an end-user latency measurement. |
| `npm run test:e2e` | All 7 Chromium scenarios passed in 9.9 seconds, including the existing axe checks. |
| Additional production-browser probes | Five edge cases above reproduced with isolated browser storage, fixed time and UTC/New York contexts. |

Reproduction source and captured observations are retained in [browser probes](excellence-audit-evidence/browser-probes.mjs) and [probe output](excellence-audit-evidence/probe-results.txt). Run the probes with a local production server on port 3100; their package import is specific to this workspace. No frontend implementation files were changed.

**Limits:** This audit did not measure p95/p99 latency, large-history performance, throttled-device behavior or production operations. Browser execution used Chromium; Safari/Firefox and a full assistive-technology audit remain unassessed. Existing axe checks cover selected states, not complete WCAG conformance. No dependency advisory database was queried, and no claim of vulnerability-free dependencies is made. The performance-growth finding describes verified code paths and inferred impact, not a measured latency failure. Cross-device coordination, trusted authentication and backend operational readiness remain outside the documented MVP.

The initial sandboxed browser run could not bind localhost (`EPERM`); the permitted rerun passed. Additional probes ran on a local production server on port 3100. Probe source and observed output are retained in [browser probes](excellence-audit-evidence/browser-probes.mjs) and [probe results](excellence-audit-evidence/probe-results.txt). The script references this workspace's installed Playwright and expects that server to be running.

**Limits:** No source changes or repairs were made. No Firefox/WebKit, real assistive-technology session, exhaustive accessibility certification, large-history benchmark, field p95/p99, network throttling, deployment, backend, current vulnerability-database audit or external CI verification was performed. No remote dependency is part of the current booking path, so network retries/API timeouts are not scored as missing MVP behavior. Existing desktop/mobile screenshots and live desktop rendering were inspected; automated mobile behavior came from the rerun suite. Documentation was read locally, not fetched from its external links.

## M06 remediation reassessment — November 20, 2026

The original audit and verdict above describe M05. A focused M06 reassessment resolves all seven original findings within the browser-only scope: time-input integrity, session-only recovery, quota read-only/export recovery, viewed-date defaults, revision-driven availability, bounded/measured history processing and sanitized diagnostic causes. See [M06 acceptance](M06-acceptance.md) for the per-finding evidence and remaining limits, and [MVP progress](MVP-progress.md) for the review PR. This remediation assessment does not assign a new excellence score or certify broader release readiness.

### Follow-up correction after implementation CI

The user requested a fresh excellence-bar audit after CI passed. [Post-CI M06 audit](Excellence-Bar-Reaudit-M06.md) supersedes the all-resolved closure statement immediately above: six work packages remain resolved, while M06-06 is reopened for a reproduced mutable-cache/ownership regression. The fresh verdict is CONDITIONAL, with a separate dense-week readability Major and two UX Minors. M06 is not complete.

## Latest focused reassessment after authorized repairs

The user authorized one additional repair cycle for all four follow-up findings. The [final M06 reassessment](Excellence-Bar-Final-M06.md) closes them, restores M06-06's ownership/record-preservation gate and scores 4/4/4 within the browser-only MVP scope. This document's earlier verdict, findings and evidence are retained as history. Required final CI/publication status is recorded in [MVP progress](MVP-progress.md); no merge or deployment occurred.
