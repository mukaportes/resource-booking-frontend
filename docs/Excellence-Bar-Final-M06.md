# Excellence Bar Audit — Alvorada / spaces, final M06 reassessment

**Sources:** codebase, local PRD/design documentation, production browser probes and measured acceptance evidence; no Confluence sources.

**Verdict: PASSES THE BAR**

Within the explicitly browser-only MVP scope, the original seven findings and all four follow-up findings are resolved. This judgment is supported by negative application-contract probes, reviewed desktop/mobile states, safe recovery behavior and measured bounded rendering, alongside passing automated checks. It does not endorse production authentication, backend operations, deployment or cross-tab atomicity.

Repair source: `c5390f9af74614393eb957ebc93ae28f93d48bf6`. Date: November 20, 2026, America/Sao_Paulo. [PR #7](https://github.com/mukaportes/resource-booking-frontend/pull/7). This is the implementing agent's focused reassessment of the changed flows, not an independent reviewer endorsement or an exhaustive new audit. The earlier [CONDITIONAL report](Excellence-Bar-Reaudit-M06.md) and its failure evidence are retained as history.

## Scorecard

| Dimension | Score (1–5) | Summary |
| --- | --- | --- |
| Product & UX polish | 4 | Shared weeks now present readable, bounded entries at desktop/360 px; native time grids remain available for one resource. Form errors and picker context are specific, with verified keyboard/focus and cancelled states. |
| Performance & reliability | 4 | Validated cache reuse retains raw revision checks, record isolation and rollback. History and shared-week rendering are bounded; actual production measurements and safe read-only recovery cover the intended local budget. |
| Code quality & architecture | 4 | Cached trusted records are protected and detached at outward ports; ownership/ID/record invariants now include result-mutation regressions. Existing domain/application/infrastructure/UI boundaries and Atlas primitives remain coherent. |

These scores describe the declared local MVP and exercised evidence. No 5 is assigned: field percentiles, slower devices, other browser engines and operational readiness remain outside the assessed evidence.

## What's genuinely good

- **Read models cannot rewrite trusted state.** The original reproduction now returns `NOT_BOOKING_OWNER`; owner/status and raw storage remain unchanged. Private cached records/arrays/snapshots are frozen, while outward results remain detached mutable values. [Actual result](m06-final-evidence/cache-results.json), [`LocalData`](../src/infrastructure/repositories/local-data.ts), [`repository ports`](../src/infrastructure/repositories/local-repositories.ts).
- **The dense week has an intentional presentation.** Multiple selected resources use a time-sorted weekly agenda with ten entries per page. Resource, full owner, resolved local range and status remain readable; one-resource selection restores the time grid. Long-label desktop/mobile screenshots and actual dense fixture pagination support this conclusion. [Desktop](m06-final-evidence/shared-week-desktop.png), [360 px](m06-final-evidence/shared-week-mobile.png).
- **Recovery and time correctness remain intact.** Missing local times are rejected without writes or ID consumption, repeated hours use native resolution with an offset, damaged sessions preserve history, and readable quota exhaustion permits safe export/retry. All original acceptance scenarios remain in the current production suite.
- **Measurements describe real limits.** The final 5,000-record list-load median is 46.1 ms versus 882.2 ms before M06, with 50 rendered history rows. The 2,352-entry shared week renders ten entries, with paging retaining access to all matches. No CI timing threshold or artificial history deletion was added.
- **Diagnostics remain useful and bounded.** Both operation and render-boundary copied references match sanitized local diagnostic events. No owner emails or booking payloads enter the captured diagnostic events; remote monitoring remains explicitly future scope.

## Findings

No unresolved Blocker, Major or Minor remains among the four targeted follow-up findings. This statement is limited to that reassessment; it is not a claim that every possible product state has been audited.

### [Resolved Major] Cached query records are isolated from command state

- **Where:** [`local-data.ts`](../src/infrastructure/repositories/local-data.ts), [`local-repositories.ts`](../src/infrastructure/repositories/local-repositories.ts), [`application.test.ts`](../src/application/application.test.ts).
- **Evidence:** **Verified.** Query mutation followed by cancellation now rejects with `NOT_BOOKING_OWNER`, preserves the original owner and active status, and leaves persisted bytes unchanged. Negative regressions cover booking list/detail, user list, current/initialized identity, availability conflicts, failed creation conflicts and idempotent cancellation results. A rejected attempt does not consume an ID; a subsequent allowed booking is ID 2. Raw-value comparison still catches external changes before commands.
- **Why the previous state missed the bar:** A read result could become a hidden write into the state trusted by a later ownership check.
- **Fix direction / disposition:** Completed through private frozen cache records and detached outward values. Preserve these contracts when adding new repository consumers; [original failure](m06-reaudit-evidence/cache-results.json) and [repaired result](m06-final-evidence/cache-results.json) document the difference.

### [Resolved Major] Shared-week bookings remain readable under overlap

- **Where:** [`booking-agenda.tsx`](../src/ui/components/booking-agenda.tsx), [`booking-workspace.tsx`](../src/ui/components/booking-workspace.tsx), [`workspace.css`](../src/ui/components/workspace.css).
- **Evidence:** **Verified in production Chromium.** Seven simultaneous resources now have full-width entries instead of 21.2 px strips. Long owner labels wrap at 360 px with no document/entry overflow. Keyboard Enter/Space opens details; closing restores focus; cancellation removes the active entry and returns focus to the schedule heading. Show cancelled restores its muted, struck-through entry. The same 5,000-record/100-user fixture with 2,352 visible active records produces ten entries, Page 1/236, and Next page reaches Page 2 with booking #11. Selecting one resource restores the native week grid. [Current browser observations](m06-final-evidence/browser-results.json), [cancelled mobile state](m06-final-evidence/shared-week-cancelled-mobile.png).
- **Why the previous state missed the bar:** Resource numbers and owner labels were clipped in the default shared week, obscuring the information needed to choose a booking.
- **Fix direction / disposition:** Completed with the scoped agenda using existing Atlas buttons, tokens and details flow. Resource/date/mine/cancelled filters apply before paging; global List remains a separate 50-row history view.

### [Resolved Minor] Form errors identify their responsible controls

- **Where:** [`booking-dialog.tsx`](../src/ui/components/booking-dialog.tsx), [`booking-form-fields.tsx`](../src/ui/components/booking-form-fields.tsx).
- **Evidence:** **Verified DOM and browser behavior.** Missing Resource marks that select invalid and describes its specific error; valid dates/times remain `aria-invalid="false"`. End ordering errors describe the end controls while Resource/start remain valid. Explicit labels keep accessible names stable; the live form summary remains. Relevant axe scans pass.
- **Why the previous state missed the bar:** A global invalid flag incorrectly marked four valid time fields when Resource was the actual error.
- **Fix direction / disposition:** Completed through field-specific errors and description IDs, with assertions in the production Chromium suite.

### [Resolved Minor] Date-picker month follows the viewed date

- **Where:** [`schedule-toolbar.tsx`](../src/ui/components/schedule-toolbar.tsx).
- **Evidence:** **Verified in Chromium.** With the clock in January and the schedule on March 14, opening shows March 2027. Navigating the picker to April, closing and reopening returns to the viewed March month. Escape restores focus to the date trigger.
- **Why the previous state missed the bar:** The picker opened on the clock's month and discarded the schedule's visual context.
- **Fix direction / disposition:** Completed through the native picker’s `defaultMonth` on opening; no stored timezone identifier or custom date engine was introduced.

## Path to the bar

1. **Blockers — closed.** Original local-time normalization is rejected at the UI boundary and covered by persisted-epoch/reload evidence.
2. **Highest-leverage Majors — closed.** Original recovery, date/availability, measured history and diagnostic repairs remain verified; cache isolation and shared-week readability have been repaired and reassessed.
3. **Polish pass — closed for the identified items.** Field associations, viewed picker month, active/cancelled agenda states and keyboard focus are verified. No further repair is required for these four findings. Future production work needs its own scope and operational assessment.

## Original M06 closure

| Package | Status | Current evidence |
| --- | --- | --- |
| M06-01 | Resolved | Spring-forward rejection, native fall-back offset, numeric UTC persistence and local display after reload. |
| M06-02 | Resolved | Session-only recovery and re-identification with persistent data unchanged. |
| M06-03 | Resolved | Readable startup quota inspection/export, mutation gates and retry; access-denied blocking and rollback retained. |
| M06-04 | Resolved | Viewed future day/resource retained; click-time today rounding; explicit past-day policy. |
| M06-05 | Resolved | Local/external advisory revisions, freed slots, authoritative submission conflicts and draft preservation. |
| M06-06 | Resolved | Raw-checked immutable cache with detached results; negative ownership/ID preservation; 50-row history, 10-entry shared weeks, visible range and actual measurements. |
| M06-07 | Resolved | Sanitized operation/render causes with matching diagnostic/copied correlation IDs. |

## Verification and measurement limits

Typecheck, lint, 68 unit/integration/component tests across nine files and the production build pass. [Repair-source CI 44744333630](https://github.com/mukaportes/resource-booking-frontend/actions/runs/44744333630) also passes, including 16 Chromium scenarios in 33.2 seconds. All 16 Chromium scenarios pass, including the seven historical M05 scenarios and new storage/time/revision plus four-finding regressions. [Current results](m06-final-evidence/chromium-results.txt). Relevant login, invalid-time, quota, populated/empty calendar and desktop/mobile shared-agenda axe states have no serious/critical findings; this is not complete WCAG certification or a real screen-reader session.

The final history benchmark uses the same local macOS arm64 host, Chromium 159.0.8154.6, production build, fixture sizes and script as the M05 baseline. Medians are from three samples per size and include automation overhead; exact samples are [final](m06-final-evidence/history-final.json) and [baseline](m06-evidence/history-before.json). The dense shared week is one additional descriptive production navigation, approximately 43.8 ms for 2,352 matches/5,000 total records/100 users/912,048 serialized UTF-8 bytes; the render count is ten, not 2,352. This changes the presentation as well as rendering cost, and is not a p99 or isolated microbenchmark claim.

The measured local evaluation envelope remains 5,000 retained records, 100 users and 1 MiB of serialized UTF-8 envelope values. No retained record or sequence is truncated. Larger histories, slower devices, browser-dependent quotas, dense single-resource cancelled grids, Firefox/WebKit, backend/authentication readiness, real multi-user coordination, remote monitoring and deployment remain outside this verdict. The prior production-only npm advisory query reported zero known advisories; dependencies were not changed by the repair cycle. No merge or deployment occurred.
