# Alvorada / spaces

Case 02: Conflict-Free Resource Booking. A browser-only Next.js and TypeScript MVP for reserving shared rooms and equipment, following the approved Resource Atlas design (preview option 04).

## Run locally

Requires Node.js 22.13 or newer and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000 and enter an email. Identification is a demo identity, without password or verification. Browser localStorage persists users and bookings; sessionStorage retains the current user only in this tab. No external account, server, environment variables or seed data is required.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run start
```

For browser tests:

```sh
npx playwright install chromium
npm run test:e2e
```

## Focus and architecture

- `src/domain`: framework-free rules, Zod schemas, seven static resources, Result and repository contracts.
- `src/application`: injected use cases, identity, grid/future policies and ownership enforcement.
- `src/infrastructure`: validated browser storage, local repositories, rollback and logging; composition in `create-application.ts`.
- `src/ui`: Atlas components, hooks, FullCalendar Standard day/week grid, URL filters and accessible Radix dialogs.
- `src/app`: Next.js shell and error boundaries.

The domain uses numeric UTC epoch milliseconds and half-open intervals `[startAt, endAt)`. Local dates and times are converted only in the UI. Every command compares current raw storage values before reusing a validated snapshot; availability shown in the form is advisory and creation re-checks conflicts. Records are soft-cancelled and retain their IDs.

The async repository ports permit a future API implementation. This MVP implements no server, real authentication or cross-tab locking; future server rules must be enforced at the server boundary.

## Reproducible demo

1. Sign in as `alex@example.com`. Pick a future date to avoid the past-start policy.
2. Focus Room 1, choose New booking or select a 30-minute calendar slot, and book 10:00–11:00. Record its ID.
3. Book Room 1 at 11:00–11:30: adjacency is accepted. Try 10:30–11:30: conflicts appear inline and no ID is allocated.
4. Book Room 2 at 10:30–11:30: another resource is allowed.
5. Open your first Room 1 booking, confirm cancellation, then book its freed interval. The next ID increases; the old ID stays cancelled.
6. Switch to List and inspect both active and cancelled records. Toggle Show cancelled for the calendar. Choose resources, switch Day/Week/List and reload: the URL restores the view and filters.
7. Log out and sign in as `maria@example.com`. Alex’s bookings are visible with their owner email, but no cancellation action is available.
8. Log back in as Alex: the same normalized email reuses the same user ID. Reload preserves the tab session; a fresh tab requires identification (duplicated tabs can inherit sessionStorage).

The PRD §6.3 numeric scenario uses `[10,20)` values and is exercised directly in domain tests. UI examples use future 30-minute epoch slots because the application adds grid and past-time rules.

## Three meaningful tests

1. **Back-to-back intervals:** `[10,20)` followed by `[20,30)` succeeds, catching an incorrect inclusive-end comparison.
2. **IDs across rejection and cancellation:** a rejected conflicting attempt consumes no ID, cancellation retains its record, and a subsequent booking uses a larger persisted ID.
3. **Ownership at the application boundary:** a second user calls cancellation directly and receives `NOT_BOOKING_OWNER`, for both active and already-cancelled bookings, with storage unchanged.

Additional tests cover validation ordering, conflict sorting, malformed storage, missing/regressed sequence, session restoration, quota rollback, modal submission errors and browser workflows.

## Decisions and limitations

- All timestamps are numeric UTC epoch milliseconds. Local form values must round-trip exactly; nonexistent local times are rejected with the draft preserved. Repeated hours use the browser’s native resolution; the form and details show the resolved local UTC offset. No timezone configuration is stored.
- A separate persisted monotonic sequence preserves IDs through cancellation and reloads. Successful local booking+sequence writes are committed synchronously with rollback if the second write fails. Rollback failure is reported as corruption requiring recovery, never as success.
- Fake email identity and per-browser data are deliberate MVP constraints. Anyone can identify as another email; there is no security boundary between users sharing a browser.
- localStorage cannot guarantee concurrency across tabs/devices. Local mutations and external storage events refresh advisory availability; commit-time conflict validation remains authoritative. A storage event warns when a dialog is open.
- Epoch-aligned half-hour slots have a known display limitation in time zones with 45-minute offsets.
- Resource history is retained without automatic cleanup. A validated snapshot is reused until raw storage changes, calendar input is limited to the visible interval, and list history uses 50-row pages. The measured local evaluation budget is 5,000 retained bookings, 100 users and 1 MiB of serialized UTF-8 envelope values on the tested desktop. Larger histories, dense calendars and slower devices remain uncharacterized. See [M06 measurements](docs/M06-acceptance.md); first reads after changes and commits still process history synchronously.
- Damaged tab sessions recover independently of healthy persistent history; the original invalid session remains exportable in memory until reload. Persistent corruption still requires explicit export/reset with typed confirmation. Readable storage with exhausted quota opens a read-only/export workspace, including without an active session; editing resumes only after both storage probes succeed. Allow site data for actual access-denied failures.
- New booking uses the viewed future date at local 09:00, rounded to the epoch grid; today uses the next slot calculated when pressed. Past-day entry is explained and disabled.
- Unexpected operation/render failures retain sanitized type, operation and safe stack locations in the local console under the same reference as Copy details. Arbitrary exception messages and booking/identity payloads are omitted. A remote diagnostic sink remains future work.
- There is no automatic migration from local demo data to a future backend.

## Delivery and AI use

Milestones M01–M06 follow PRD §17 with one branch and PR per milestone. Dependent PRs are stacked in order toward main; none are merged automatically. The progress tracker records actual verification and PR links.

AI agents implemented the domain, persistence/application layer, and UI in parallel against the PRD and shared contracts. Changes were integrated, typechecked, linted, exercised through rule and UI tests, and compared visually with the selected preview. Generated code was reviewed against the storage, ownership and dependency contracts. Automated accessibility checks are evidence for their tested states, not a claim of complete WCAG certification.

Time spent: approximately 45 minutes elapsed, including verification and the repair-authorization pause. Final verification evidence is recorded in the progress tracker. Backend, deployment and production operational acceptance are outside this MVP.

M06 verification: typecheck, lint, production build, 65 unit/integration/component tests and all 14 Chromium scenarios passed. See [MVP progress](docs/MVP-progress.md) for final PR/CI status and [acceptance evidence](docs/MVP-acceptance.md) for scope and limits.

Product documentation, design previews and audit evidence live in `docs/`. This directory is outside the application source and public assets, excluded from Next.js production file tracing, and skipped by TypeScript, ESLint and Prettier. Keep documentation imports out of application code so these artifacts remain outside browser bundles.

The [fresh post-CI excellence audit](docs/Excellence-Bar-Reaudit-M06.md) is **CONDITIONAL**. M06 remains incomplete: mutable query results can affect cached records used by later ownership checks, and the shared week needs a readable dense-overlap presentation. Passing checks and the list benchmark do not establish excellence-bar approval.
