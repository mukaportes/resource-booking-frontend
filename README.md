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

The domain uses numeric UTC epoch milliseconds and half-open intervals `[startAt, endAt)`. Local dates and times are converted only in the UI. Every write re-reads storage; availability shown in the form is advisory and creation re-checks conflicts. Records are soft-cancelled and retain their IDs.

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

- UTC numeric timestamps preserve the challenge’s plain-number domain while the calendar displays the browser locale and time zone.
- A separate persisted monotonic sequence preserves IDs through cancellation and reloads. Successful local booking+sequence writes are committed synchronously with rollback if the second write fails. Rollback failure is reported as corruption requiring recovery, never as success.
- Fake email identity and per-browser data are deliberate MVP constraints. Anyone can identify as another email; there is no security boundary between users sharing a browser.
- localStorage cannot guarantee concurrency across tabs/devices. A storage event refreshes other tabs and warns when a dialog is open.
- Epoch-aligned half-hour slots have a known display limitation in time zones with 45-minute offsets.
- Resource history is retained without a maximum duration or automatic cleanup. The MVP scans the local dataset; large history/performance and production authentication belong to the backend roadmap.
- There is no automatic migration from local demo data to a future backend.

## Delivery and AI use

Milestones M01–M05 follow PRD §17 with one branch and PR per milestone. Dependent PRs are stacked in order toward main; none are merged automatically. The progress tracker records actual verification and PR links.

AI agents implemented the domain, persistence/application layer, and UI in parallel against the PRD and shared contracts. Changes were integrated, typechecked, linted, exercised through rule and UI tests, and compared visually with the selected preview. Generated code was reviewed against the storage, ownership and dependency contracts. Automated accessibility checks are evidence for their tested states, not a claim of complete WCAG certification.

Time spent and final verification evidence are recorded in the progress tracker at delivery. Backend, deployment and production operational acceptance are outside this MVP.

Verification: typecheck, lint, production build, 55 unit/integration tests and all seven Chromium scenarios passed. See [MVP progress](docs/MVP-progress.md) for final PR/CI status and [acceptance evidence](docs/MVP-acceptance.md) for scope and limits.
