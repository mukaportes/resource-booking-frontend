# Excellence Bar Audit — Alvorada / spaces, after M06

**Sources:** codebase, including local PRD, design contract, README and acceptance evidence; no Confluence sources.  
**Verdict: CONDITIONAL**

M06 repairs the original time, recovery and live-availability failures and substantially improves measured list performance. I would still withhold excellence-grade approval: the new cache exposes mutable trusted records across the query/command boundary, and an ordinary seven-resource overlap makes the shared week unreadable. Passing CI does not close either finding; M06 remains incomplete pending the cache-integrity repair and acceptance reassessment.

Audited application revision: `ecbfc38fcffdeafa245ce930295c770bdba4ba4a`, after [CI 44737120998](https://github.com/mukaportes/resource-booking-frontend/actions/runs/44737120998) passed. Audit date: November 20, 2026, America/Sao_Paulo. [Review PR #7](https://github.com/mukaportes/resource-booking-frontend/pull/7). This is the implementing agent's evidence-based reassessment, not an independent reviewer endorsement. Findings below were reproduced after CI; no application repairs were made during this audit.

The product remains a browser-only internal booking MVP. Demo identity, local persistence, no cross-tab locking, native browser timezone resolution and no remote monitoring are explicit scope constraints, not newly discovered production security guarantees.

## Scorecard

| Dimension | Score (1–5) | Summary |
| --- | --- | --- |
| Product & UX polish | 3 | Coherent Atlas UI and strong repaired recovery/time flows; seven concurrent resources lose readable labels in the core week view, and field/date-picker semantics retain rough edges. |
| Performance & reliability | 4 | Within the documented desktop envelope, snapshot reuse, indexed checks, bounded history, rollback and read-only/export recovery are deliberate and measured. Dense-week cost is higher than list measurements; no field p99 or mobile performance guarantee is established. |
| Code quality & architecture | 3 | Clear boundaries and meaningful tests remain, but cached mutable query results can alter the supposedly trusted state used by later commands; the current suite misses this new coupling. |

Scores use the excellence-bar rubric: a pass requires all dimensions at least 4 and no Blockers. No new Blocker is claimed; the two Majors are bounded repairs with concrete evidence.

## What's genuinely good

- **The silent time shift is repaired at the right boundary.** [`time.ts:41`](../src/ui/lib/time.ts#L41) requires a local round trip while domain values remain numeric UTC epochs. Production Chromium spring-forward and fall-back cases prove rejected inputs write nothing, valid inputs persist expected epochs, and reload displays the resolved local offset. See [M06 acceptance](M06-acceptance.md).
- **Recovery protects useful data.** [`create-application.ts:24`](../src/infrastructure/create-application.ts#L24) distinguishes probe quota from denied access. Tests verify read-only inspection/export, mutation refusal, safe retry, session-only recovery and retained persistent bytes; typed reset and rollback remain covered.
- **Live drafts and details respond to external data.** The revision-keyed availability hook rechecks open drafts. A separate fresh probe also confirmed an open booking detail changes to Cancelled after an external cancellation; stale-detail behavior was investigated and not reproduced. [Fresh observations](m06-reaudit-evidence/browser-results.json), [`booking-workspace.tsx:234`](../src/ui/components/booking-workspace.tsx#L234).
- **The history improvement is measured rather than inferred.** At 5,000 retained records and 100 users, median production list navigation changed from 882.2 to 53.3 ms and sort interaction from 513.4 to 32.6 ms, with 50 rendered rows. This remains a small same-host comparison with stated limits, not a latency SLO. [Raw measurements](M06-acceptance.md#production-history-measurements).
- **Diagnostics and verification now reach the difficult seams.** Operation/render copy-path tests match references to sanitized diagnostic events. CI passed typecheck/lint/build, 65 tests and 14 Chromium scenarios. Selected axe states and the dense fixture have no serious/critical violations. Production dependency `npm audit --omit=dev` reported zero known advisories at audit time; [registry output](m06-reaudit-evidence/npm-audit.json) is evidence for that command, not a vulnerability-free certification.

## Findings

### [Major] Query consumers can mutate cached records used by ownership checks

- **Where:** [`local-data.ts:71`](../src/infrastructure/repositories/local-data.ts#L71), [`local-data.ts:118`](../src/infrastructure/repositories/local-data.ts#L118), [`local-repositories.ts:22`](../src/infrastructure/repositories/local-repositories.ts#L22), [`local-repositories.ts:62`](../src/infrastructure/repositories/local-repositories.ts#L62), [`local-repositories.ts:105`](../src/infrastructure/repositories/local-repositories.ts#L105).
- **Evidence:** **Verified through the real application API.** Create booking #1 as owner A, identify as B, query bookings, change the returned booking's `userId` to B, then call `cancelBooking(1)`. The query edit does not change localStorage. Nevertheless cancellation succeeds and persists both the changed owner and cancelled status. `filter()` copies the list but retains cached object references; unchanged raw strings cause `read()` to trust the mutated snapshot. [Reproduction](m06-reaudit-evidence/cache-probe.test.mjs), [captured result](m06-reaudit-evidence/cache-results.json).
- **Why it misses the bar:** A read model must not become a hidden write path into state used to enforce later commands. Snapshot reuse introduced this regression relative to reparsing stored data. Current UI components do not perform this mutation, and this is not a claim of a new unauthenticated network exploit in the deliberately fake-identity MVP. It is a verified application-contract and retained-record-integrity failure that a future consumer can trigger with the mutable types already exposed.
- **Fix direction:** Keep the validated cache isolated from query consumers: immutable/frozen cached records with safe query contracts or detached returned records. Cover list/detail/users/availability references as applicable, assert a mutated result cannot change subsequent ownership/validation/ID behavior or persisted bytes, and rerun the existing raw-revision/commit and performance checks. Do not remove commit-time raw checks or cache all data blindly.

### [Major] A normal shared-week overlap clips resource and owner labels

- **Where:** [`booking-calendar.tsx:49`](../src/ui/components/booking-calendar.tsx#L49), [`booking-calendar.tsx:79`](../src/ui/components/booking-calendar.tsx#L79), [`workspace.css:94`](../src/ui/components/workspace.css#L94).
- **Evidence:** **Verified in production Chromium at 1440 × 1000.** Seven legal bookings, one per resource, overlap Tuesday 10:00–11:00. In Week with all resources selected, event boxes measure about **21.2 px** wide; labels collapse to fragments such as “Co”, “Ro” and “me”. The resource number and owner cannot be read from the shared schedule. This does not require thousands of visible events. [Seven-event screenshot](m06-reaudit-evidence/shared-week-seven-events.png), [observations](m06-reaudit-evidence/browser-results.json). A separate legal 2,352-event week within the 5,000-record budget shows the same problem across the grid: [dense capture](m06-reaudit-evidence/dense-desktop.png).
- **Why it misses the bar:** Understanding which resource is booked is a core scheduling task. Complete ARIA labels, details and one-resource filtering are useful fallbacks, but do not make the default shared week visually legible. Automated axe checks did not flag this state; a clean scan is not proof that the schedule communicates its content.
- **Fix direction:** Provide an intentional dense overview, such as a resource-focused or agenda presentation, a readable minimum layout with a clear overflow summary, or another scoped fallback using the existing design system. Preserve keyboard details and the current filtering semantics. Accept with seven simultaneous resources, long owner labels, desktop and 360 px states; no FullCalendar Premium or backend is required.

### [Minor] Resource validation marks four valid time fields invalid

- **Where:** [`booking-dialog.tsx:62`](../src/ui/components/booking-dialog.tsx#L62), [`booking-form-fields.tsx:25`](../src/ui/components/booking-form-fields.tsx#L25), [`booking-form-fields.tsx:52`](../src/ui/components/booking-form-fields.tsx#L52).
- **Evidence:** **Verified DOM state.** Open New booking with multiple resources selected. The message is “Choose a resource”, the resource select has neither `aria-invalid` nor an error description, and all four valid date/time controls report `aria-invalid="true"`. [Captured field attributes](m06-reaudit-evidence/browser-results.json).
- **Why it misses the bar:** Assistive technology receives the wrong field-level failure, despite the visible form-level explanation and passing axe state.
- **Fix direction:** Associate each error with its responsible control or field group, including Resource. Keep the existing live summary, but avoid applying one global invalid flag to every time field.

### [Minor] Schedule date picker opens on the clock's month instead of the viewed month

- **Where:** [`schedule-toolbar.tsx:64`](../src/ui/components/schedule-toolbar.tsx#L64), [`ui/calendar.tsx:17`](../src/ui/components/ui/calendar.tsx#L17).
- **Evidence:** **Verified in Chromium.** With the schedule on March 14, 2027 and the clock on January 11, the date-picker caption opens on January 2027. The selected date is supplied, but its displayed month is not initialized from the schedule context. [Captured picker text](m06-reaudit-evidence/browser-results.json).
- **Why it misses the bar:** The booking-button date repair works, but nearby date navigation still discards the current visual context and adds unnecessary month navigation.
- **Fix direction:** Initialize/control the picker month from the viewed date when opening, while retaining ordinary month navigation and keyboard focus. Add a future-month opening/reopening assertion.

## Path to the bar

1. **Blockers — none newly verified.** The original silent-normalization Blocker is resolved by the numeric/local-boundary repair.
2. **Highest-leverage Majors — M.** First isolate cached trusted records and add negative ownership/record-mutation regressions; this is a small source change with broad contract verification. Then make the shared week readable under seven concurrent resources and verify both desktop/mobile/keyboard alternatives. Recheck the affected measurements and current-head CI; do not declare a 4+ from test counts alone.
3. **Polish pass — S.** Correct field-specific error associations and date-picker month context. Revisit the same exercised states with keyboard and relevant axe checks; these are contained refinements, not an architecture rewrite.

Sizing is rough engineering effort, not elapsed agent time or a delivery promise. This audit did not implement the fixes.

## M06 disposition and verification limits

| Work package | Fresh disposition |
| --- | --- |
| M06-01 | Resolved: missing local times rejected, native repeated-hour/offset policy demonstrated. |
| M06-02 | Resolved: isolated session recovery preserves healthy persistent records. |
| M06-03 | Resolved: quota/read-only/export/retry behavior and denied-access blocking verified. |
| M06-04 | Resolved for its primary booking-action scope; the separate date-picker Minor remains. |
| M06-05 | Resolved: local/external advisory changes, conflict reconciliation and draft preservation verified. |
| M06-06 | **Open completion gate:** performance/rendering improvements verified, but cache isolation violates the required preservation of ownership and retained records. |
| M06-07 | Resolved: sanitized diagnostic causes and matching copied references demonstrated. |

M06 is not marked complete. [PR #7](https://github.com/mukaportes/resource-booking-frontend/pull/7) contains the implementation and this review evidence for the next repair/review cycle. Original [M06 acceptance](M06-acceptance.md) remains the implementation evidence, corrected to reflect this follow-up result.

The dense-week probe used 5,000 records, 100 users, 2,352 legal active half-hour bookings across seven resources during a Monday–Sunday week, and 2,648 cancelled historical records: 912,048 serialized UTF-8 bytes. Its single production navigation took approximately 976.0 ms including Playwright overhead; this is a workload observation, not a p95/p99 or before/after dense-calendar claim. The separate seven-event layout probe retains the same total history but only seven visible active events. Desktop/mobile captures and acceptance came from the preceding production run; the fresh dense layout was separately inspected on desktop. Real screen-reader use, Safari/Firefox, field latency, slower hardware, exhaustive WCAG certification, development-only dependency advisories and production/backend operations remain unassessed.

Reproduce the additional probes against a production server on port 3100:

```sh
node docs/m06-reaudit-evidence/browser-probes.mjs
npx vitest run --config docs/m06-reaudit-evidence/vitest.audit.config.mjs
npm audit --omit=dev --json
```

The cache probe intentionally records the current failure, so its passing result means the defect was reproduced; it is audit evidence, not a new acceptance test. Its module and all audit scripts live in documentation, outside the application test suite and production artifacts. No source repair, merge or deployment occurred after the passing implementation CI during this audit.
