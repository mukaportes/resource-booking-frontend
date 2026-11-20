# M06 audit remediation evidence

Scope: the browser-only Alvorada booking MVP, PRD §17.1. The original audit remains historical evidence; this is a focused reassessment of its one Blocker and six Majors, not an independent excellence-bar approval or a new product score.

## Reproduction and resolution

Baseline: `f04f87e` (merged M05; application tree matches audited `594f198`). Before repairs, the original browser probes reproduced the five browser defects against the production build. [Captured output](m06-evidence/before-probes.txt) retains the silent New York 02:00 → 03:00 shift, January default while viewing March, stale “Available”, destructive session recovery and quota misclassification. The full-history finding was reproduced with the benchmark below. The diagnostic regression initially failed because the console event contained no `TypeError` cause; it passes with the repair.

| Finding | Reassessed status | Implementation and evidence |
| --- | --- | --- |
| M06-01 · Blocker | Resolved | `time.ts` converts local fields once and requires an exact local round trip. Chromium rejects New York March 14, 2027 02:00–02:30 inline, retains fields, leaves persistent bytes unchanged and then saves the corrected 03:00 booking as ID 1 at `1805007600000` (`2027-03-14T07:00:00Z`). Reload displays 03:00 GMT-4. November 7 01:00–01:30 uses the native earlier occurrence, `2027-11-07T05:00Z`–`05:30Z`, and displays GMT-4 before submission and after reload. No timezone setting, identifier persistence or custom timezone engine was added. |
| M06-02 · Major | Resolved | Malformed session values are retained in memory for raw export for the current application lifetime, only the invalid tab-session entry is cleared, and identification resumes with an explanation. Integration tests cover null/wrong shape/malformed JSON; Chromium creates a booking, damages only the session, reloads and re-identifies with users/bookings/sequence byte-for-byte unchanged. Persistent corruption still requires export and typed RESET; the original browser recovery test passes. |
| M06-03 · Major | Resolved | Probe writes use the normal quota/access-denied classification. Successful reads after quota failure open a read-only workspace, including without a session. Application mutation gates prevent create/cancel/login/logout/reset until both probes succeed. Chromium inspects details, exports, retries while full, then restores editing without changing saved bytes; unit tests also verify direct mutation refusal and no-session reads. Access denial remains blocking. Existing booking/sequence rollback tests pass. |
| M06-04 · Major | Resolved | The button uses the viewed future date at local 09:00 (rounded to the existing epoch grid), preserves a single focused resource and calculates today's next slot at click time. Past-day entry is disabled with an explicit explanation. Chromium verifies keyboard entry, resource/date defaults, today and past policy, Escape and focus restoration. |
| M06-05 · Major | Resolved | Provider refresh publishes a revision after local or external changes. Availability keys include that revision, discard stale responses and disable submission while rechecking. Commit conflicts trigger refresh and yield to the refreshed advisory result. Component regressions cover local create/cancel and recovery after a submission conflict; Chromium occupies and frees an unchanged open draft from another tab and successfully saves ID 2 while retaining cancelled ID 1. Commit validation remains authoritative. |
| M06-06 · Major | Resolved within the measured local budget | Raw storage values identify cached validated snapshots; reads still compare them before queries and commands, including external writes before storage-event delivery. User ownership checks use a Set. Calendar input is restricted to the local visible day/Monday week with half-open overlap. List history renders at most 50 rows per page, with global sorting and indexed owner labels. Chromium verifies 50/50/24 rows for 124 retained bookings, a spanning-midnight event and exclusion of the next day's event, and unchanged stored records/sequence. Measurements follow below. |
| M06-07 · Major | Resolved | Unexpected failures log operation, allowlisted exception type and up to eight safe stack locations. Arbitrary messages, frame arguments, URL queries, emails and booking payloads are omitted. The log prefix, returned error and copied details use one correlation ID. Injected booking-operation and actual React render-boundary failures exercise both copy paths; tests match each reference to its diagnostic event and verify sensitive fixture content is absent. Route and root boundaries now forward the caught exception. The logger remains local. |

Sources: [`audit-remediation.spec.ts`](../e2e/audit-remediation.spec.ts), [`application.test.ts`](../src/application/application.test.ts), [`booking-dialog.test.tsx`](../src/ui/components/booking-dialog.test.tsx), [`booking-diagnostics.test.tsx`](../src/ui/components/booking-diagnostics.test.tsx), [`error-view.test.tsx`](../src/ui/components/error-view.test.tsx), [`diagnostics.test.ts`](../src/infrastructure/diagnostics.test.ts), [`time.test.ts`](../src/ui/lib/time.test.ts).

## Production history measurements

Same local macOS arm64 host, Node 22.23.2, headless Chromium 159.0.8154.6, UTC, 1440 × 1000 viewport, fixed application clock. Both runs use `next build --webpack` and `next start` on port 3100. Each fixture has 100 users, half active/half cancelled bookings, sequential numeric IDs and retained historical intervals. Three samples per size include a first navigation and two subsequent navigations; medians below are descriptive, not p95/p99. Timings include Playwright navigation/actionability/protocol overhead. The before browser probes briefly ran concurrently with the first baseline samples; no other benchmark suite ran with the after samples. This is a small local comparison, not an isolated-device performance guarantee.

| Bookings | Serialized UTF-8 bytes¹ | List load median before → after | ID-sort median before → after | Rendered rows before → after |
| --- | ---: | ---: | ---: | ---: |
| 100 | 27,278 | 55.3 → 38.1 ms | 51.3 → 28.5 ms | 100 → 50 |
| 1,000 | 187,480 | 183.0 → 47.0 ms | 130.9 → 26.5 ms | 1,000 → 50 |
| 5,000 | 903,480 | 882.2 → 53.3 ms | 513.4 → 32.6 ms | 5,000 → 50 |

¹ Sum of users/bookings/sequence envelope values, excluding keys/session. Fixtures use ASCII; the 5,000-record fixture occupies approximately 1,806,960 bytes as UTF-16 code units. Browser quota accounting and capacity vary.

**Supported local evaluation budget:** up to 5,000 retained bookings, 100 users and 1 MiB total serialized UTF-8 envelope values on this tested desktop configuration. Both count and byte limits describe the measured envelope. No history is deleted, no ID is recycled and no new hard cap silently rejects or truncates stored records. Beyond this budget, performance remains uncharacterized; export before clearing site data. First reads after revisions and commits still validate/serialize retained history synchronously on the main thread. Pagination does not make localStorage a production database. A dense visible calendar and slower hardware may cost more than this fixture; no mobile performance guarantee is inferred.

Reproduce on each revision with the same script:

```sh
npm run build
npm run start -- --hostname 127.0.0.1 --port 3100
# In another terminal:
node scripts/history-benchmark.mjs /tmp/history-results.json
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npm run test:e2e -- --workers=2
```

Raw samples and metadata: [before](m06-evidence/history-before.json), [after](m06-evidence/history-after.json). Script: [`history-benchmark.mjs`](../scripts/history-benchmark.mjs). No wall-clock performance assertion was added to CI.

## Verification and visual review

- Typecheck and lint pass. The initial parallel typegen/build run raced generated `.next` files; subsequent runs use sequential Next checks. Two test-only typing issues were corrected before final verification.
- 65 unit/integration/component tests pass across nine files. The 25 numeric domain tests retain their original meaning and implementation. Half-open intervals, ownership checks, monotonic IDs, rejected-attempt semantics, soft cancellation and commit-time conflict validation remain covered.
- Production build passes. All 14 Chromium scenarios pass against that build, including all seven historical M05 scenarios. [Browser results](m06-evidence/chromium-results.txt).
- Axe reports no serious/critical issues in the exercised login, empty mobile calendar, populated calendar, invalid DST form and read-only quota states. Keyboard booking, modal Escape/focus restoration, calendar scrolling and Enter/Space event details pass.
- Populated [desktop](m06-evidence/desktop.png) and [360 px](m06-evidence/mobile.png) captures are reviewed for Atlas hierarchy, containment, schedule and cancelled-record presentation. Calendar resize is allowed to settle before mobile capture. History and recovery remain usable with their existing local scrolling and responsive controls.

## Delivery and remaining limits

Publication status is recorded in [MVP progress](MVP-progress.md). This evidence covers the browser-only milestone; no merge or deployment is authorized. Demo identity, local-only data, cross-tab write races, browser-dependent storage quota, the epoch-aligned grid's 45-minute-offset limitation, native repeated-hour resolution and local console diagnostics remain deliberate limitations. Safari/Firefox, real assistive-technology certification, throttled-device/field latency, remote monitoring and production backend readiness were not assessed. All seven original findings are resolved within this scope; this does not assign an excellence score or claim broader excellence-bar approval.
