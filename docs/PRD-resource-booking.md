# PRD — Conflict-Free Resource Booking (MVP)

| Field | Value |
|---|---|
| Source challenge | [Alvorada-Dev — Case 02: Conflict-Free Reservations](https://github.com/Alvorada-Dev/desafios-tecnicos/blob/main/casos/02-reservas-de-recursos.md) |
| Document status | Draft v1 |
| Last updated | 2026-11-20 |
| MVP scope | Front-end only (Next.js + TypeScript), persistence in browser storage |
| Future scope | Python serverless back end on AWS Lambda + DynamoDB (roadmap in §13) |

---

## 1. Overview

A small web app for booking shared resources (rooms and equipment) without time conflicts. Users pick a time slot on a calendar, the app checks whether the resource is free, and creates the booking or explains why it can't. Users can cancel only the bookings they own.

The MVP runs fully in the browser. All business rules live in a framework-free domain layer behind a repository interface, so the planned back end can replace the local storage adapter without changing the rules or the UI.

### 1.1 Goals

- Implement every business rule in the challenge exactly, including the edge cases: half-open intervals, IDs that are never reused, rejected attempts that don't consume an ID, and idempotent cancellation.
- Provide a clean, modern calendar UI to see booked slots and select new ones, with multi-resource filtering.
- Identify users through a simple email login and enforce booking ownership on cancellation.
- Make error handling explicit and consistent: modals when the user must decide or type, toasts to inform.
- Keep the code ready for the back end: one domain core, a swappable data source, and English-only identifiers and values.

### 1.2 Non-goals (MVP)

- Real authentication (passwords, tokens, email verification).
- Payments, recurring bookings, approvals, notifications.
- Real concurrency guarantees across tabs or devices (see §10.4).
- Time zone configuration. Data is stored in UTC and displayed in the browser's local time zone and locale.
- Admin features (managing resources or users).
- A maximum booking duration is not needed for now (O-1).

---

## 2. Challenge requirements → product mapping

The challenge uses Portuguese field names. This product uses English for **all** identifiers, enum values, schema fields, storage keys, and error codes.

| Challenge term | Product term | Notes |
|---|---|---|
| `id` | `id` | Positive integer, monotonic, never reused |
| `recurso` | `resourceId` | References a static resource |
| `inicio` | `startAt` | Epoch milliseconds, UTC |
| `fim` | `endAt` | Epoch milliseconds, UTC; must be greater than `startAt` |
| active / cancelled | `BookingStatus.Active` = `"active"`, `BookingStatus.Cancelled` = `"cancelled"` | |
| `ja_cancelada` | `CancelOutcome.AlreadyCancelled` = `"already_cancelled"` | A non-error outcome, no changes made |

| Challenge rule | Where it is satisfied |
|---|---|
| Fixed resource list | §5.2 static resources |
| `start < end` | FR-B2, `INVALID_INTERVAL` |
| "Time uses numbers; calendars and time zones out of scope" | Domain operates on plain numbers (epoch ms). Calendar and locale exist only in the UI layer (§9) |
| Half-open `[start, end)` | FR-B3, overlap formula in §6.2 |
| Only active bookings on the same resource conflict | §6.2 |
| Rejections explain the problem and create nothing; no ID consumed | FR-B5, FR-B6 |
| IDs never reused, even after cancellation | §5.4 sequence |
| Cancel frees the time; `already_cancelled` when repeated; error if not found | FR-C1 to FR-C4 |
| Availability query: free/busy + conflicts in ascending ID order; read-only | FR-A1 to FR-A3 |
| Listing shows active and cancelled | FR-L1 to FR-L3 |
| "In-memory, one operation at a time, no authentication" | We keep single-operation semantics. Persistence (localStorage) and the email login are additions requested for this product; they don't change any rule (see §10.4 and D-1) |

---

## 3. Users and user stories

**Persona:** a team member who needs a room or a device for a period of time.

| ID | Story | Priority |
|---|---|---|
| US-1 | As a user, I identify myself with my email so my bookings are linked to me. | P0 |
| US-2 | As a user, I see a week calendar with existing bookings so I know what's taken. | P0 |
| US-3 | As a user, I filter the calendar by one or more resources. | P0 |
| US-4 | As a user, I select a slot on the calendar and book a resource for it. | P0 |
| US-5 | As a user, I get a clear explanation when a booking is rejected, including which bookings conflict. | P0 |
| US-6 | As a user, I check whether a resource is free for a period before confirming. | P0 |
| US-7 | As a user, I cancel my own bookings, and only mine. | P0 |
| US-8 | As a user, I see a list of bookings with their status (active or cancelled). | P0 |
| US-9 | As a user, I switch between day and week views and jump to a date with a date picker. | P1 |
| US-10 | As a user, I log out to switch identity. | P1 |

---

## 4. Functional requirements

### 4.1 Identification (fake login)

| ID | Requirement |
|---|---|
| FR-U1 | The app requires identification before any booking feature is visible. An unidentified visitor sees a non-dismissible login modal over an empty app shell. |
| FR-U2 | The login asks only for an email. The email is trimmed and lowercased, then validated (RFC 5322-lite pattern, max 254 characters). Invalid input shows an inline field error; the modal stays open. |
| FR-U3 | Users are kept in a local "users table" (§5.3). If the normalized email already exists, the existing `userId` is reused; otherwise a new user is created with `userId = crypto.randomUUID()`. |
| FR-U4 | The session stores only the current `userId` in `sessionStorage`, so it lasts as long as the browser tab. Reloading keeps the session; a new tab or a closed tab requires logging in again. |
| FR-U5 | A logout action clears the session and reopens the login modal. Bookings and users are not deleted. |
| FR-U6 | If the session references a `userId` that no longer exists in the users table (for example after storage was cleared), the session is discarded and the login modal opens with an info toast. |

> Note: browsers copy `sessionStorage` when a tab is **duplicated**, so a duplicated tab starts already logged in. This is accepted behavior for the MVP.

### 4.2 Resources

| ID | Requirement |
|---|---|
| FR-R1 | Resources are a static, read-only list shipped with the app (§5.2). |
| FR-R2 | Every resource has a stable ID, a display name, a type, and a color token used on the calendar. |

### 4.3 Availability query

| ID | Requirement |
|---|---|
| FR-A1 | Given a valid `resourceId` and a valid interval, return `{ isAvailable, conflicts }`, where `conflicts` lists **active** bookings on that resource that overlap the interval, sorted by `id` ascending. |
| FR-A2 | The query never changes data (no writes, no sequence change). |
| FR-A3 | Invalid input returns the same validation errors as creation (`RESOURCE_NOT_FOUND`, `INVALID_INPUT`, `INVALID_INTERVAL`). |
| FR-A4 | The booking modal runs the availability query live (debounced ~200 ms) as the user changes resource or times, and shows "Available" or the conflict list before submission. |

### 4.4 Create booking

| ID | Requirement |
|---|---|
| FR-B1 | Input: `resourceId`, `startAt`, `endAt`. `userId` comes from the session, never from form input. |
| FR-B2 | `startAt` and `endAt` must be finite integers and `startAt < endAt`. |
| FR-B3 | Intervals are half-open `[startAt, endAt)`. A booking ending at T does not conflict with one starting at T. |
| FR-B4 | Application-level rules (UI layer, not the domain core): `startAt` and `endAt` align to the 30-minute grid, and `startAt` is not in the past (clock injected for tests). See D-4. |
| FR-B5 | Validation runs in this order and stops at the first failure: session → input types → resource exists → interval valid → application rules → conflicts. A rejection creates nothing. |
| FR-B6 | An ID is allocated only after every check passes. Rejected attempts never advance the sequence. |
| FR-B7 | On success the booking is stored with `status: "active"` and the UI shows a success toast with the booking ID, resource, and local time range. |
| FR-B8 | On conflict the modal stays open and lists the conflicting bookings (ID, owner email, local time range), sorted by ID. |

### 4.5 Cancel booking

| ID | Requirement |
|---|---|
| FR-C1 | Only the booking owner (`booking.userId === session.userId`) can cancel. Any other caller gets `NOT_BOOKING_OWNER` and nothing changes. The UI hides the cancel action for non-owners, **and** the application service re-checks ownership (the UI is never the only guard). |
| FR-C2 | Cancelling an active booking sets `status: "cancelled"` and `cancelledAt`, frees the slot, and keeps the record and its ID forever. "Delete" in the UI means this soft cancellation; records are never physically removed. |
| FR-C3 | Cancelling an already cancelled booking (by its owner) returns `already_cancelled` and changes nothing. The UI shows an info toast. |
| FR-C4 | Cancelling an unknown ID returns `BOOKING_NOT_FOUND`. |
| FR-C5 | Cancellation always goes through a confirmation modal. |
| FR-C6 | Past and ongoing bookings can be cancelled by their owner (the challenge sets no restriction). |

Order of checks for cancellation: session → booking exists → ownership → status. Ownership is checked before status, so a non-owner can't learn the state of someone else's booking through the outcome.

### 4.6 Listing and filtering

| ID | Requirement |
|---|---|
| FR-L1 | The schedule shows active bookings for the visible date range. A "Show cancelled" toggle also renders cancelled bookings, visually muted with strikethrough. Shared weeks with multiple resources use a readable, time-sorted agenda with 10 entries per page; a single resource retains the week time grid. Day grids and 50-row global history remain available. |
| FR-L2 | A list view shows bookings in a table: ID, resource, owner email, local start, local end, status badge, actions. Scopes: "All bookings" and "My bookings". Default sort: `startAt` ascending; sortable by ID. |
| FR-L3 | A resource multi-select filter (grouped by Rooms / Equipment, with "Select all" and "Clear") applies to both calendar and list. An empty selection shows an empty state with a "Select all resources" action, never a blank grid without explanation. |
| FR-L4 | Filter and view state are kept in the URL (`?view=week&date=2026-11-20&resources=room-1,tablet-2&showCancelled=1`) so reloads and shared links restore them. Unknown resource IDs in the URL are dropped with a warning toast. |

---

## 5. Data model

### 5.1 Types (TypeScript, domain layer)

```ts
export type ResourceId = "room-1" | "room-2" | "room-3"
  | "computer-1" | "computer-2" | "tablet-1" | "tablet-2";

export enum ResourceType {
  Room = "room",
  Computer = "computer",
  Tablet = "tablet",
}

export enum ResourceCategory {
  Room = "room",
  Equipment = "equipment",
}

export interface Resource {
  id: ResourceId;
  name: string;
  type: ResourceType;
  category: ResourceCategory;
  colorToken: string; // design-system token, e.g. "resource-1"
}

export enum BookingStatus {
  Active = "active",
  Cancelled = "cancelled",
}

export interface Booking {
  id: number;            // positive integer, never reused
  resourceId: ResourceId;
  userId: string;        // UUID of the owner
  startAt: number;       // epoch ms, UTC, inclusive
  endAt: number;         // epoch ms, UTC, exclusive
  status: BookingStatus;
  createdAt: number;     // epoch ms, UTC
  cancelledAt: number | null;
}

export interface User {
  userId: string;        // UUID
  email: string;         // normalized: trimmed + lowercase, unique
  createdAt: number;     // epoch ms, UTC
}

export interface Session {
  userId: string;
  startedAt: number;
}

export enum CancelOutcome {
  Cancelled = "cancelled",
  AlreadyCancelled = "already_cancelled",
}

export interface AvailabilityResult {
  isAvailable: boolean;
  conflicts: Booking[];  // active, same resource, overlapping, sorted by id asc
}
```

Runtime schemas are defined with **Zod** next to the types (types inferred from schemas where practical) and used to validate everything read from storage and every command input.

### 5.2 Static resources

| `id` | `name` | `type` | `category` |
|---|---|---|---|
| `room-1` | Room 1 | `room` | `room` |
| `room-2` | Room 2 | `room` | `room` |
| `room-3` | Room 3 | `room` | `room` |
| `computer-1` | Computer 1 | `computer` | `equipment` |
| `computer-2` | Computer 2 | `computer` | `equipment` |
| `tablet-1` | Tablet 1 | `tablet` | `equipment` |
| `tablet-2` | Tablet 2 | `tablet` | `equipment` |

Shipped as a typed constant (`RESOURCES`) in the domain layer, not in storage.

### 5.3 Storage layout

| Store | Key | Shape | Lifetime |
|---|---|---|---|
| `localStorage` | `resourceBooking:v1:users` | `{ schemaVersion: 1, items: User[] }` | Persistent |
| `localStorage` | `resourceBooking:v1:bookings` | `{ schemaVersion: 1, items: Booking[] }` | Persistent |
| `localStorage` | `resourceBooking:v1:bookingSequence` | `{ schemaVersion: 1, lastIssuedId: number }` | Persistent |
| `sessionStorage` | `resourceBooking:v1:session` | `{ schemaVersion: 1, session: Session }` | Tab lifetime |

### 5.4 ID sequence

- `lastIssuedId` starts at `0`. Creating a booking issues `lastIssuedId + 1` and saves both the booking and the new sequence value in the same synchronous commit (§10.3).
- The sequence never decreases and is never derived from `max(bookings.id)`. That way IDs stay unique even if bookings data were edited or truncated.
- If the sequence key is missing but bookings exist, the repository recovers with `max(id)` and logs a warning. If `lastIssuedId < max(id)`, the data is treated as corrupted (§8.3).

---

## 6. Business rules (domain core)

### 6.1 Pure functions

The domain core is pure TypeScript with no dependency on React, Next.js, browser storage, or the clock:

```ts
checkAvailability(bookings, resourceId, interval): Result<AvailabilityResult, DomainError>
planBooking(bookings, input, nextId, now): Result<Booking, DomainError>
planCancellation(booking | undefined, userId, now): Result<{ outcome: CancelOutcome; booking: Booking }, DomainError>
```

`Result<T, E>` is a discriminated union: `{ ok: true; value: T } | { ok: false; error: E }`. Expected failures are returned as values, never thrown. Exceptions are reserved for unexpected faults.

### 6.2 Overlap

Two intervals `[aStart, aEnd)` and `[bStart, bEnd)` overlap **iff** `aStart < bEnd && bStart < aEnd`.
A booking is a conflict iff `booking.status === "active"`, `booking.resourceId === resourceId`, and the intervals overlap.

### 6.3 Challenge example as an acceptance scenario

Using `room-1` (R1) and `room-2` (R2), with the numbers below standing in for epoch values:

| Step | Action | Expected |
|---|---|---|
| 1 | Create R1 `[10,20)` | Accepted, `id = 1` |
| 2 | Create R1 `[20,30)` | Accepted, `id = 2` (starts when #1 ends) |
| 3 | Create R1 `[19,21)` | Rejected `TIME_SLOT_CONFLICT`, conflicts `[1, 2]`; sequence unchanged |
| 4 | Create R2 `[19,21)` | Accepted, `id = 3` (step 3 consumed no ID) |
| 5 | Query R1 `[19,21)` | `isAvailable: false`, conflicts `[1, 2]` |
| 6 | Cancel #1 (by owner) | `cancelled` |
| 7 | Query R1 `[10,20)` | `isAvailable: true`, conflicts `[]` |
| 8 | Create R1 `[10,20)` | Accepted, `id = 4` (ID 1 stays taken) |
| 9 | Cancel #1 again (by owner) | `already_cancelled`, no changes |

---

## 7. Error catalog

Every failure has a stable `code` (English, `UPPER_SNAKE_CASE`), a user-facing message, and optional `details`. The same codes become the back-end API error contract (§13).

| Code | Raised when | `details` | UI channel |
|---|---|---|---|
| `UNAUTHENTICATED` | No valid session | — | Login modal |
| `INVALID_EMAIL` | Email fails validation | `{ field: "email" }` | Inline in login modal |
| `INVALID_INPUT` | Missing field, non-integer/NaN times, unknown shape | `{ fields: string[] }` | Inline in booking modal |
| `RESOURCE_NOT_FOUND` | `resourceId` not in `RESOURCES` | `{ resourceId }` | Inline in booking modal |
| `INVALID_INTERVAL` | `startAt >= endAt` | `{ startAt, endAt }` | Inline in booking modal |
| `OFF_GRID_TIME` | Not aligned to 30 minutes (app rule) | `{ slotMinutes: 30 }` | Inline in booking modal |
| `START_IN_PAST` | `startAt < now` (app rule) | `{ now }` | Inline in booking modal |
| `TIME_SLOT_CONFLICT` | Overlaps active booking(s) | `{ conflicts: Booking[] }` sorted by id | Conflict list in booking modal |
| `BOOKING_NOT_FOUND` | Unknown booking ID | `{ bookingId }` | Error toast |
| `NOT_BOOKING_OWNER` | Caller is not the owner | `{ bookingId }` | Error toast |
| `STORAGE_UNAVAILABLE` | Storage disabled or blocked (private mode, policy) | — | Blocking error modal |
| `STORAGE_QUOTA_EXCEEDED` | Write fails with quota error | — | Error toast; nothing committed |
| `STORAGE_CORRUPTED` | Stored data fails schema validation or sequence check | `{ key }` | Recovery modal (§8.3) |
| `UNEXPECTED_ERROR` | Any unhandled exception | `{ correlationId }` | Error toast + error boundary |

`already_cancelled` is **not** an error: it is a successful outcome with no change, shown as an info toast.

---

## 8. Error handling and user communication

### 8.1 Channel rules

- **Modal** when the user must type, choose, or confirm: login, create booking, booking details, cancel confirmation, data-corruption recovery, storage unavailable.
- **Toast** to inform about something that already happened: success, info, warning, error not tied to a form field.
- **Inline field error** for validation problems inside an open modal. A modal never closes on a validation or conflict error, and the user's input is preserved.
- A single action produces at most one toast. Errors don't stack duplicate toasts for the same cause.

### 8.2 Toast behavior

| Variant | Use | Auto-dismiss |
|---|---|---|
| Success | Booking created, booking cancelled, logged in | 4 s |
| Info | `already_cancelled`, session reset | 4 s |
| Warning | Unknown resources dropped from URL, external data change detected | 6 s |
| Error | Not found, not owner, quota, unexpected | Sticky until dismissed; includes "Copy details" with `correlationId` |

Toasts use an ARIA live region (`polite` for success/info, `assertive` for errors).

### 8.3 Storage resilience

- All storage access goes through one storage adapter wrapped in `try/catch`. No component touches `localStorage` directly.
- On startup the adapter checks storage (write/read/remove a probe key). Access denial maps to `STORAGE_UNAVAILABLE` with blocking guidance. Quota exhaustion remains `STORAGE_QUOTA_EXCEEDED`; when reads succeed, offer read-only access and raw export rather than claiming storage is disabled (M6, §17.1).
- Every read is validated with Zod. Invalid persistent data opens `STORAGE_CORRUPTED` recovery with **Export raw data** and **Reset local data** (typed confirmation). Invalid tab-session data instead recovers only that session and requests identification, preserving healthy users, bookings and sequence (M6, §17.1). The app never silently replaces persistent user data.
- Writes are all-or-nothing from the user's point of view (§10.3). Quota errors leave the previous state intact.

### 8.4 Unexpected errors

- A Next.js `error.tsx` boundary per route segment, plus a root `global-error.tsx`, shows a friendly fallback with "Try again" and "Copy details".
- A small `logger` module (`debug/info/warn/error`) is the only place that writes to the console. It tags each error with a `correlationId`, and is the seam where a remote sink plugs in later. It never logs full booking lists or emails at `info` level.
- No empty `catch` blocks. Every caught error is either mapped to a catalog code or logged and re-thrown to the boundary.

---

## 9. UI / UX specification

### 9.1 Layout — approved Resource Atlas direction

**Decision (2026-11-20): implement option 04, Resource Atlas.** The product owner selected this direction from the [five-option HTML preview](resource-booking-design-preview.html). [Resource Atlas UI specification](UI-resource-atlas.md) records the visual tokens, responsive contract, component mapping, and production dependencies. Options 01, 02, 03 and 05 are retained as research history only.

```text
┌──────────────────────────────────────────────────────────────────┐
│ Header: Alvorada / spaces                         user · Logout   │
├──────────────────────────────────────────────────────────────────┤
│ Resource-oriented heading                         [New booking]  │
│ [Room 1] [Room 2] [Room 3] [Computer 1] [Computer 2] [Tab 1] [Tab 2]│
├────────────────┬─────────────────────────────────────────────────┤
│ Selection panel│ Schedule toolbar: Today · ‹ › · date picker      │
│ • Rooms        │ Day / Week / List · All / My · Show cancelled   │
│ • Equipment    │─────────────────────────────────────────────────│
│ • Select all   │ Time grid or booking table                      │
│ • Clear        │ Resource labels, ownership and status cues      │
│ • Legend       │                                                 │
└────────────────┴─────────────────────────────────────────────────┘
```

- Resource cards focus the schedule on one resource. The grouped multi-select supports several resources and applies to both calendar and list. Start with all seven selected; All resources restores them.
- Desktop: a resource deck above a left selection panel and flexible schedule. At intermediate widths, cards wrap. Down to 360 px: the deck scrolls horizontally, filters move into a sheet behind a Filters button, and the default view becomes Day unless URL state supplies a view.
- Follow Atlas's white and pale blue surfaces, blue primary accent, outline resource icons, system sans-serif typography, rounded cards, and restrained spacing. Keep the stable seven-color resource palette; verify contrast in light and dark modes rather than copying another option's theme.
- The preview uses plain HTML/CSS/JavaScript and inline SVG; no UI library was loaded. Production uses the stack in §10.1, styled to match Atlas. The required behavior and states in §§4, 8 and 9 remain mandatory even where the preview is simplified.

### 9.2 Calendar

- Views: Week (default) and Day. Slot duration 30 minutes. Visible hours 07:00–21:00 local by default, scrollable to the full 24 h.
- Event label: resource name, local time range, and "You" or the owner's full email. Owner emails are visible to other users because the app is for internal team use (O-4).
- **Select to book:** dragging across empty slots (or clicking one slot for a 30-minute booking) opens the Create booking modal prefilled with the selection. If exactly one resource is selected in the filter, it is preselected.
- **Click a booking:** opens the Booking details modal. Owners see "Cancel booking"; others see read-only details.
- Past time is shaded and not selectable (`START_IN_PAST`).
- Bookings on different resources at the same time display side by side.

### 9.3 Create booking modal

Fields: Resource (select, grouped), Date (date picker), Start time and End time (30-minute steps; end options are always after start). A live availability panel shows "✓ Available" or "✕ Conflicts with #12, #15" with details. The **Book** button is disabled while invalid, unavailable, or submitting, and shows a spinner during submission. Pressing Enter submits; Escape closes (with a discard confirmation if fields were changed).

The availability shown before submit is advisory. The create command re-checks everything at commit time.

### 9.4 Booking details and cancel

Details: ID, resource, owner email, local start/end, status badge, created at. The owner of an active booking sees "Cancel booking", which opens a confirmation modal ("Cancel booking #12 for Room 1, Fri Nov 20, 14:00–15:30?") with a destructive confirm button.

### 9.5 Empty, loading and error states

- Empty week: an illustration-free message, "No bookings in this range. Drag on the calendar to create one."
- No resources selected: message plus "Select all resources".
- Hydration: a skeleton grid until client storage has been read (avoids server/client mismatch, since data only exists on the client).

### 9.6 Accessibility

- All modals trap focus, restore focus on close, and are labelled (Radix Dialog semantics).
- Every calendar action has a keyboard path: the "New booking" button opens the same modal without dragging.
- Color is never the only signal: own bookings also get an icon or label, cancelled ones get strikethrough and a "Cancelled" badge.
- Target: WCAG 2.2 AA for contrast and keyboard operation.

### 9.7 Time display

- Stored and computed values are UTC epoch milliseconds.
- Display uses `Intl.DateTimeFormat(undefined, …)`, so the browser's locale and local time zone decide the format.
- Conversion between local selections and UTC epochs happens only in the UI adapter (`toEpochMs` / `formatRange`), never in the domain. ALWAYS store timestamps in UTC; display them in browser-local time. M6 adds round-trip validation against silent input normalization, without timezone configuration or a custom timezone engine (§17.1).
- The 30-minute grid is evaluated on the epoch value (`startAt % 1_800_000 === 0`). This is correct for every time zone whose offset is a multiple of 30 minutes. Zones with 45-minute offsets (for example Nepal) are a known limitation (§14).

---

## 10. Front-end architecture

### 10.1 Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router), TypeScript `strict` | Requested stack |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) | Accessible primitives, clean modern look, components owned in-repo |
| Toasts | Sonner (shadcn/ui toast) | Accessible, stack-aware, minimal API |
| Calendar | FullCalendar Standard (MIT): `timeGrid` views, `selectable`, `slotDuration: "00:30"` | Mature drag-to-select time grid; premium resource views are not needed |
| Mini date picker | shadcn/ui `Calendar` (react-day-picker) | Matches the design system |
| Validation | Zod | Shared runtime schemas for storage and inputs |
| Date utilities | `date-fns` (UI layer only) | Local-time arithmetic for slot generation |
| Unit/integration tests | Vitest + Testing Library | Fast, TS-native |
| E2E (P1) | Playwright | Calendar drag and modal flows |
| Lint/format | ESLint (`next/core-web-vitals`, `@typescript-eslint/strict`) + Prettier | |

**Approved UI implementation:** use Tailwind CSS and shadcn/ui with Radix primitives to reproduce Resource Atlas. Use FullCalendar Standard for the time grid, shadcn/ui Calendar for date selection, and Sonner for toasts. Resource cards and outline SVG icons are local components; no additional UI library or Premium resource scheduler is needed. See [UI-resource-atlas.md](UI-resource-atlas.md) for component mapping and version-selection guidance.

Every booking feature is a client component; the page renders as a client-side app inside the Next.js shell.

### 10.2 Layers and folders

```
src/
  domain/              # pure TS: types, schemas, RESOURCES, overlap, rules, errors, Result
  application/         # use cases: login, createBooking, cancelBooking, checkAvailability, listBookings
  infrastructure/
    storage/           # safeStorage adapter (probe, try/catch, Zod parse)
    repositories/      # BookingRepository, UserRepository, SessionStore — local implementations
    logger/
  ui/
    components/        # calendar, resource filter, modals, list table
    hooks/             # useSession, useBookings, useAvailability
    lib/time.ts        # UTC <-> local conversion and formatting
  app/                 # Next.js routes, layouts, error boundaries
```

Dependency direction: `ui → application → domain`, `infrastructure → domain`. The domain imports nothing from the other layers.

```ts
export interface BookingRepository {
  list(filter: { resourceIds?: ResourceId[]; from?: number; to?: number; status?: BookingStatus[] }): Promise<Booking[]>;
  getById(id: number): Promise<Booking | undefined>;
  create(input: CreateBookingInput, userId: string): Promise<Result<Booking, DomainError>>;
  cancel(id: number, userId: string): Promise<Result<CancelResult, DomainError>>;
  checkAvailability(resourceId: ResourceId, startAt: number, endAt: number): Promise<Result<AvailabilityResult, DomainError>>;
}
```

The interface is async even though `localStorage` is synchronous, so the future `ApiBookingRepository` drops in without changing callers. Use-case functions take the repository and a `clock` as parameters, which keeps them testable.

### 10.3 Write path (local)

`create` and `cancel` in the local repository:

1. Read and validate the latest bookings and sequence from storage (never from React state).
2. Run the pure domain function.
3. If it succeeds, serialize the new bookings and sequence, then write them. Bookings are written first and the sequence second. If the second write fails, the first is rolled back to its previous serialized value before the error is reported.
4. Notify subscribers so the UI refreshes.

### 10.4 Multiple tabs

The challenge scope is one operation at a time, and the MVP does not guarantee correctness under concurrent writes from several tabs. Mitigations:

- Every command re-reads storage right before deciding (step 1 above), so the window for a lost update is limited to the same event-loop task.
- A `storage` event listener refreshes data when another tab changes it, with a warning toast "Bookings were updated in another tab" if a modal is open.
- Real concurrency control comes with the back end (conditional writes, §13.3).

---

## 11. Testing strategy

### 11.1 Layers

| Layer | Tool | Focus |
|---|---|---|
| Domain | Vitest | Every rule in §6, the full §6.3 scenario, error ordering |
| Application + local repository | Vitest + in-memory `Storage` fake | Commit atomicity, sequence persistence, Zod-based corruption detection, ownership |
| UI | Vitest + Testing Library | Modal/toast channels, disabled states, owner-only actions |
| E2E (P1) | Playwright | Login → drag-select → book → conflict → cancel |

### 11.2 Three meaningful tests (for the challenge README)

1. **Boundary value: back-to-back bookings.** Create R1 `[10,20)` then R1 `[20,30)`. Expected: both accepted. Catches an inclusive-end comparison (`<=` instead of `<`) that would wrongly reject adjacent bookings.
2. **Rule interaction: rejection doesn't consume an ID, cancellation doesn't free one.** Create #1, try a conflicting booking (rejected), create another on R2, cancel #1, create again on R1's freed slot. Expected IDs `1, 2, 3`, and the rejected attempt leaves the sequence untouched. Catches pre-allocated IDs and IDs derived from `max(id)` or the active count.
3. **Authorization at the trusted boundary.** User B calls `cancelBooking` directly (bypassing the hidden UI button) on user A's booking. Expected: `NOT_BOOKING_OWNER`, booking unchanged. Also verifies a non-owner can't tell `already_cancelled` from `cancelled`. Catches ownership enforced only in the UI.

Additional required cases: `startAt === endAt` and `startAt > endAt` → `INVALID_INTERVAL`; NaN and non-integer times → `INVALID_INPUT`; unknown resource; conflicts sorted ascending even when stored out of order; cancelled bookings never conflict; availability query leaves storage byte-for-byte unchanged; `already_cancelled` leaves `cancelledAt` unchanged; corrupted JSON triggers `STORAGE_CORRUPTED`; quota error leaves previous state intact.

---

## 12. Acceptance criteria (MVP)

- [ ] All §6.3 steps pass as an automated test and can be reproduced manually in the UI.
- [ ] No booking feature is reachable without an email session; the session ends when the tab closes.
- [ ] The same email always maps to the same `userId`.
- [ ] Non-owners never see a cancel action, and a direct use-case call by a non-owner is rejected.
- [ ] Rejected bookings show the reason in the modal; conflicts list ID, resource, owner, and local time range, sorted by ID.
- [ ] Booking IDs are strictly increasing, survive reloads, and are never reused.
- [ ] Stored timestamps are UTC epoch ms; displayed times follow the browser locale and time zone.
- [ ] Resource multi-select filters both the calendar and the list, and survives reload through the URL.
- [ ] Cancelled bookings remain visible in the list (and on the calendar with "Show cancelled").
- [ ] Corrupted or unavailable storage never crashes the app or silently wipes data.
- [ ] No Portuguese identifiers, enum values, storage keys, or error codes anywhere in the code.
- [ ] `typecheck`, `lint`, and `test` scripts pass.
- [ ] README covers: case name, focus, time spent, install, run, test, reproducible demo, the three tests (§11.2), two decisions (§15), pending work, and how AI was used and verified.

---

## 13. Roadmap: back end and front-end integration (high level)

The back end replaces browser storage as the source of truth and becomes the trusted boundary for every rule. The domain rules and error codes stay identical.

### Phase 0 — Contract (before writing BE code)

- Write an **OpenAPI 3.1** spec derived from `BookingRepository` and the §7 error catalog. Error envelope: `{ "error": { "code": "TIME_SLOT_CONFLICT", "message": "...", "details": { ... }, "correlationId": "..." } }`.
- Generate TypeScript types for the FE from the spec (`openapi-typescript`), and keep Pydantic models in the BE aligned with it through contract tests.

| Method | Path | Purpose | Success |
|---|---|---|---|
| `POST` | `/sessions` | Fake login: upsert user by email (replaced by real auth in Phase 3) | `200 { userId, email }` |
| `GET` | `/resources` | Static resource list | `200` |
| `GET` | `/resources/{resourceId}/availability?startAt=&endAt=` | Availability query | `200 { isAvailable, conflicts }` |
| `GET` | `/bookings?resourceIds=&from=&to=&status=` | Listing | `200` |
| `POST` | `/bookings` | Create | `201` / `409 TIME_SLOT_CONFLICT` / `400` / `404` |
| `POST` | `/bookings/{id}/cancel` | Cancel (idempotent) | `200 { outcome }` / `403` / `404` |

### Phase 1 — Service skeleton (Python, serverless)

- Python 3.12 on AWS Lambda behind API Gateway HTTP API; infrastructure as code with **Serverless Framework** (O-2).
- AWS Lambda Powertools (event handler router, structured logging, tracing, idempotency), Pydantic v2 for validation, `pytest` + `moto` for unit tests.
- Domain rules ported 1:1 from `src/domain` as a pure Python module, tested against the same §6.3 scenario and §11.2 cases (shared JSON fixtures used by both test suites).
- Local demo without AWS: provide a local API runner compatible with the Serverless Framework setup + DynamoDB Local in `docker compose`, as the challenge requires for external services. Select the local runner during service setup.

### Phase 2 — DynamoDB design

Single table, on-demand capacity:

| Item | PK | SK | Notes |
|---|---|---|---|
| User | `USER#{userId}` | `PROFILE` | |
| Email uniqueness | `EMAIL#{email}` | `EMAIL` | Created in the same transaction as the user, `attribute_not_exists` |
| Booking | `BOOKING#{id}` | `BOOKING` | GSI1: `GSI1PK = RESOURCE#{resourceId}`, `GSI1SK = {startAt zero-padded}#{id}` |
| Booking sequence | `SEQUENCE` | `BOOKING` | `lastIssuedId` |
| Resource lock | `RESOURCE#{resourceId}` | `LOCK` | `version` number |

- **Conflict query:** no maximum booking duration is required for now (O-1), so the query must include all potentially overlapping bookings with `startAt < reqEnd`, then filter `endAt > reqStart` and `status = active`. Do not use a duration-based lower bound. Finalize the query design before back-end implementation; reads can grow with resource history without a duration bound.
- **Race-free create:** read the resource `version` and `lastIssuedId`, check conflicts, then `TransactWriteItems`: (a) update the resource lock with `version = :expected` → `version + 1`; (b) update the sequence with `lastIssuedId = :expected` → `+1`; (c) put the booking with `attribute_not_exists(PK)`. On `TransactionCanceledException` retry with jittered backoff (max 3), then return `409` or `503`. A rejected attempt never commits, so it never consumes an ID.
- **Cancel:** conditional update `userId = :caller AND status = active`. On condition failure, read the item to return `NOT_BOOKING_OWNER`, `already_cancelled`, or `BOOKING_NOT_FOUND`. Cancellation also bumps the resource lock version so a concurrent create re-checks.
- A single global sequence item is a write hotspot, but it is fine at this scale. If throughput grows, switch to ULIDs with a separate monotonic display number, recorded as an ADR.

### Phase 3 — Identity

- Replace the fake login with Amazon Cognito (email OTP / passwordless). `userId` comes **only** from verified token claims; request bodies never carry it.
- Keep `POST /sessions` behind a feature flag for local demos.

### Phase 4 — Front-end integration

- Add `ApiBookingRepository` and `ApiUserRepository` implementing the existing interfaces; select them with `NEXT_PUBLIC_DATA_SOURCE=local|api`.
- Use TanStack Query for fetching and cache invalidation after create and cancel. Writes are pessimistic (spinner, no optimistic insert), so a conflict can't flash a booking that never existed.
- HTTP → error mapping: map `error.code` to the existing §7 catalog, so modal/toast behavior stays the same. Network failures and timeouts (10 s) map to a new `NETWORK_ERROR` toast with Retry. Only GETs and cancel (idempotent) retry automatically.
- Do not migrate local MVP bookings to the back end. Local data is demo-only; no one-time import is planned (O-3).

### Phase 5 — Production readiness

- GitHub Actions: lint, typecheck, tests for FE and BE, Serverless Framework configuration validation and packaging, contract tests; deploy to `dev` → `prod` stages.
- Observability: Powertools structured logs with `correlationId` propagated from the FE, CloudWatch alarms on 5xx rate and transaction-conflict retries.
- API Gateway throttling, CORS restricted to the FE origin, least-privilege IAM per function.

---

## 14. Risks and known limitations

| Risk / limitation | Impact | Mitigation |
|---|---|---|
| localStorage is per browser: users on different devices see different data | Demo-only persistence | Documented; resolved by the back end |
| Multi-tab write race | Rare duplicate or overlapping booking in MVP | Re-read before commit, `storage` listener; solved by conditional writes in Phase 2 |
| Fake login has no verification | Anyone can claim any email | Accepted for MVP; Cognito in Phase 3 |
| 45-minute UTC offset time zones | 30-min grid misaligned in local time | Documented limitation |
| Duplicated tab inherits the session | Two tabs share one session | Accepted browser behavior |
| FullCalendar bundle size | Larger initial JS | Dynamic import of the calendar component |

---

## 15. Key decisions

| ID | Decision | Rationale |
|---|---|---|
| D-1 | Times are UTC epoch milliseconds in storage and in the domain | Satisfies "time uses numbers" while supporting a real calendar UI |
| D-2 | Booking IDs are integers from a persisted monotonic sequence, not UUIDs | Matches the "ascending ID order" rule and makes "never reused" verifiable; UUIDs have no meaningful order |
| D-3 | "Delete" in the UI is a soft cancel | The challenge requires cancelled bookings to stay listed and their IDs to stay taken |
| D-4 | 30-min grid and "no past start" are application rules, outside the domain core | Keeps the core faithful to the challenge's numeric examples (`[10,20)`) and testable with plain numbers |
| D-5 | Ownership checked before status on cancel | Prevents non-owners from learning another booking's state |
| D-6 | Users identified only by email; no anonymous mode | Product decision for this MVP: every booking has a real owner |
| D-7 | Async repository interface over synchronous storage | The back end plugs in without changing use cases or UI |
| D-8 | Resource Atlas (preview option 04) is the approved UI direction | Product owner selection on 2026-11-20; §9.1 and [UI specification](UI-resource-atlas.md) define the implementation reference and retain the existing UI stack |

---

## 16. Resolved open questions

All four questions were answered by the product owner on 2026-11-20.

| ID | Question | Answer |
|---|---|---|
| O-1 | Should there be a maximum booking duration? | Not needed for now; do not add a maximum booking duration. The back-end conflict query must accommodate this decision (§13, Phase 2). |
| O-2 | Which IaC tool should the back end use? | Use Serverless Framework. |
| O-3 | Should local MVP bookings be migrated to the back end? | No; local data is demo-only. |
| O-4 | Should owner emails be visible to other users on the calendar? | Yes; owner emails are visible because the app is for internal team use (§9.2). |

---

## 17. Milestones (MVP)

| # | Milestone | Exit criteria |
|---|---|---|
| M1 | Domain core + tests | §6 functions, §6.3 scenario and §11.2 tests green |
| M2 | Storage adapter + repositories + use cases | Atomic commit, corruption handling, ownership tests green |
| M3 | Login, session, app shell, toasts | FR-U1 to FR-U6 |
| M4 | Calendar, filter, create/details/cancel modals, list view | FR-A, FR-B, FR-C, FR-L |
| M5 | Polish: accessibility, empty/error states, README, demo script | §12 checklist complete |
| M6 | Audit remediation: correctness, recovery, booking context, performance and diagnostics | One Blocker and six Majors resolved with §17.1 evidence; all required checks pass |

### 17.1 M6 — Audit remediation and acceptance

**Status:** Complete — all seven packages and all four follow-up findings resolved; local checks and repair-source CI pass, with PR #7 published for review. [MVP progress](MVP-progress.md) records current-head CI and evidence. See [final reassessment](Excellence-Bar-Final-M06.md), [M06 acceptance](M06-acceptance.md) and [PR #7](https://github.com/mukaportes/resource-booking-frontend/pull/7).

**Dependency:** M5 implementation.

**Branch:** `fix/M06-audit-remediation`, based on `main` containing merged M05.

**Source:** [Excellence Bar Audit — booking app](Excellence-Bar-Audit-booking-app.md), November 20, 2026.

**Goal:** Resolve the audit's one Blocker and six Majors, with focused regression evidence for each. Preserve the front-end-only challenge scope and existing booking rules.

#### Time contract and scope

- ALWAYS persist timestamps as numeric UTC epoch milliseconds, including booking start/end, creation and cancellation timestamps. Domain comparisons, overlap checks and repository contracts continue to operate on these numbers.
- Display dates and times in the browser's local time. Convert local form/calendar selections to UTC exactly once at the UI boundary; do not store formatted local strings or apply an offset a second time.
- Timezone configuration, timezone selection, stored timezone identifiers and a custom timezone engine are outside this milestone. The challenge's plain-number domain remains unchanged.
- Address the audit's time-shift blocker with a narrow input-integrity guard: round-trip converted values to the original local fields and reject values the browser silently normalizes, preserving the draft and explaining the invalid local time. No silent substitution of another booking time.
- For repeated local times, retain the browser's native resolution and show the resolved instant with its local UTC offset when ambiguity matters; do not build a timezone/disambiguation picker. Include a fall-back conversion regression so UTC persistence and displayed local time stay consistent.
- Keep the existing epoch-aligned 30-minute grid and documented 45-minute-offset limitation. Expanding timezone support is not an acceptance condition for M6.

#### Work packages and exit criteria

| ID | Audit finding | Planned change | Acceptance evidence |
|---|---|---|---|
| M06-01 | Blocker — silently shifted local time | Add the UI conversion/round-trip guard under the time contract above; keep all persisted timestamps UTC. | A valid local interval persists the expected UTC epoch and displays back in local time after reload. The reproduced New York spring-forward `02:00–02:30` is rejected inline, keeps the fields, and writes nothing and consumes no ID. A fall-back case verifies the documented native resolution and offset display. Existing numeric domain tests remain unchanged in meaning. |
| M06-02 | Major — damaged session drives full reset | Separate tab-session corruption from persistent users/bookings corruption. Preserve diagnostic/export evidence, clear only the invalid session and return to identification with an explanation. | With healthy bookings and malformed session data, re-identification works while users, bookings and sequence remain byte-for-byte unchanged. Persistent-data corruption still requires explicit recovery and typed confirmation for full reset. |
| M06-03 | Major — startup quota misclassified | Distinguish quota exhaustion from denied storage access during probing. Provide read-only access and raw export when data remains readable, with a capacity explanation and safe recovery/retry. | Inject a startup `QuotaExceededError`: existing bookings can be inspected/exported, mutations are disabled until writable storage is confirmed, and no data is changed. A genuine access-denied failure retains its blocking explanation. Existing commit rollback checks still pass. |
| M06-04 | Major — New booking ignores viewed date | Derive default booking date from the schedule context; use the next valid slot for today and a valid local slot on a viewed future day. Explain the past-date policy instead of silently switching dates. | Keyboard/button entry from a future viewed day prefills that day and the focused resource; today never defaults to a past start. Past-day behavior is explicit. UTC serialization follows M06-01. |
| M06-05 | Major — stale live availability | Invalidate/recheck availability on local mutations and external data revisions; reconcile submission conflicts without requiring an unrelated field edit. | Another tab occupying a draft interval updates the conflict panel; freeing it restores availability and enables submission without reopening/editing the draft. Commit-time conflict validation remains authoritative. No cross-tab locking guarantee is added. |
| M06-06 | Major — repeated full-history work | Reuse validated snapshots per data revision, index ownership lookup, limit calendar input to the visible interval, and bound history rendering with pagination or virtualization. Define a supported local-history budget using measured production-build behavior. | Record before/after measurements on the same browser/device and explicit fixture sizes, including cancelled history and multiple users. Document the supported record/byte budget and measured interaction costs. Verify bounded rendered history, correct visible-range events, revision invalidation and unchanged retained records/sequence. Timing evidence is measured, not a flaky CI wall-clock threshold. |
| M06-07 | Major — diagnostic causes lost | Preserve sanitized exception type/stack and operation context; use one correlation ID across the diagnostic event and copied user reference. Pass boundary exceptions into this layer. | Inject an unexpected operation failure and a render-boundary failure: each copied reference matches a useful diagnostic event, without owner emails or booking payloads. Keep the local logger seam; a remote monitoring service is not required. |

#### Execution order and completion gate

1. Implement M06-01 first, then M06-02 and M06-03 to repair correctness and safe recovery.
2. Implement M06-04 and M06-05 to repair the booking journey, then M06-06 and M06-07 for performance and diagnosability.
3. Run focused regressions for all seven packages, then typecheck, lint, unit/integration tests, production build and Chromium acceptance. Browser coverage must include UTC/local round trips, an injected startup quota failure, session-only recovery, external availability changes and future-date booking entry.
4. Recheck populated desktop and 360 px views, keyboard/focus paths and relevant axe states. Update the README limitations, acceptance evidence and this progress tracker with actual outcomes; retain historical M01–M05 results.
5. Re-audit the seven findings and record resolved/open status with evidence. M6 is complete only when all seven findings are resolved and required checks pass. A 4+ excellence score requires reassessment, not just passing tests. Publish for review under the existing milestone delivery convention; no automatic merge or deployment.

**Planning estimate:** M–L overall (roughly one to two engineering weeks, including regression checks and the history benchmark); revise after the performance baseline. Backend, real authentication, deployment, remote monitoring and cross-tab transaction guarantees remain outside this milestone.

#### M6 implemented policies and evidence

- New booking preserves a viewed future day and focused resource, defaulting to local 09:00 rounded to the existing epoch grid. Today rounds the current instant forward at click time; past dates are explicitly disabled. No automatic switch to another viewed date occurs.
- Probe quota failures permit inspection and export when all persistent reads validate, including without a session. Create/cancel/identity/reset mutations remain disabled until both local and session storage probes succeed. Session recovery preserves invalid raw session data in memory for export until reload; persistent history is not rewritten.
- Availability is keyed by a refreshed data revision after local changes or external storage events. Submission conflicts initiate refresh and yield to the new advisory result; the draft is retained.
- Snapshot reuse compares raw storage values on every read, including commit-time reads. Ownership validation uses a Set, calendar input overlaps only the visible local interval and list history uses 50-row pages. No retained record or sequence is truncated.
- The supported local evaluation envelope is 5,000 bookings, 100 users and 1 MiB total serialized UTF-8 envelope values on the measured desktop configuration. Larger history/dense calendars/slower devices remain unmeasured. Detailed fixture, raw samples and interaction timings are in [M06 acceptance](M06-acceptance.md); CI has no timing threshold.
- Diagnostics omit arbitrary messages and retain safe type/stack locations plus fixed operation context. The diagnostic event, returned error and copied reference share one correlation ID; the sink remains local console output.

#### Post-CI reassessment (historical, before authorized follow-up repairs)

The fresh excellence-bar audit found a cache-isolation regression: callers can mutate returned booking objects while raw storage remains unchanged, and a later cancellation trusts that cached owner. M06-06 must isolate validated records from query consumers and prove ownership/record/ID preservation before M6 can be marked complete. The report also records a shared-week readability Major and field-association/date-picker Minors. The acceptance criteria above are unchanged; passing CI alone does not close these findings.

#### Authorized follow-up repair closure

The user authorized one additional targeted cycle for all four post-CI findings. Cached snapshots/records/arrays are frozen privately and outward models are detached, including identity, list/detail, availability, rejected-creation conflicts and idempotent cancellation. Mutating returned records cannot affect trusted ownership, persisted bytes or ID allocation. Shared weeks with multiple selected resources use the existing Atlas visual language in a 10-entry paginated agenda; choosing one resource restores its native week grid. Date/mine/resource/cancelled filters apply before paging. Cancelled entries retain status/muting/strikethrough; keyboard details restore focus, with a schedule-heading fallback when cancellation removes the trigger. Form errors use explicit field labels and specific description IDs. The picker opens/reopens on the viewed month.

All seven original packages and all four follow-up findings are reassessed as resolved in [final focused audit](Excellence-Bar-Final-M06.md). Repair-source CI passed and the milestone is published for review in PR #7. Current documentation-head checks are visible on the PR; no merge/deployment is authorized.
