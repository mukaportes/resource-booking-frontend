# Resource Atlas — approved UI direction

| Field | Value |
|---|---|
| Status | Selected by the product owner |
| Decision date | 2026-11-20 |
| Visual reference | [HTML preview, option 04 — Resource Atlas](resource-booking-design-preview.html) |
| Product requirements | [PRD — Resource Booking](PRD-resource-booking.md), especially §§4, 8, 9 and 10 |

## Decision and authority

Implement **option 04, Resource Atlas** as the Resource Booking MVP's UI. Options 01, 02, 03 and 05 remain exploration history and must not be used as alternative implementation directions.

The Atlas composition, visual hierarchy, resource cards, blue accent, and responsive behavior are the approved design reference. This document and PRD §9.1 replace the earlier generic sidebar-first layout and the preview's original preference for Common Ground. The PRD remains authoritative for business rules, data, validation, accessibility, and required states. A prototype omission does not remove a PRD requirement.

## What the preview actually uses

The HTML preview is standalone **HTML, custom CSS, vanilla JavaScript, inline SVG icons, and native `<dialog>` elements**. It loads no UI library, web font, CDN asset, React, Tailwind, shadcn/ui, or FullCalendar runtime. The card layout and calendar are custom recreations; no special Atlas package needs to be found or installed.

Production should implement this appearance using the existing PRD stack below. Reuse the preview's visual decisions, not its in-memory data model or monolithic demo script.

## Approved composition and behavior

1. **Header:** Alvorada / spaces identity on the left; current email and logout on the right. “Switch identity” in the demo represents logout followed by the required email login dialog.
2. **Resource introduction:** a clear resource-oriented heading and a prominent New booking action.
3. **Resource deck:** the exact seven PRD resources, each with an outline room/computer/tablet icon, name, category, resource color marker, and visible selected state. Activating a card focuses the schedule on that resource. All resources restores the full selection; grouped checkboxes support multiple selections.
4. **Schedule workspace:** a compact selection/filter panel on the left and the calendar or booking list on the right. Keep resource filters, Select all, Clear, and the color legend together. The date picker remains available through the toolbar; a mini month may also appear in the selection panel without displacing the resource deck.
5. **Toolbar:** Today, previous/next period, date picker, Day/Week/List controls, All/My bookings scope, Show cancelled, and mobile Filters access. Week is the desktop default; Day is the mobile default. Preserve explicit URL state on reload as required by FR-L4.
6. **Calendar and list:** retain all PRD labels, ownership cues, cancelled styles, empty/loading/error states, local-time display, 30-minute selection, and modal entry points. Resource cards filter ordinary day/week events; they do not introduce resource columns or a resource timeline.
7. **Modals and feedback:** keep the required login, booking, details, cancellation, and storage recovery flows. Live availability is advisory; creation re-checks conflicts. Preserve inline errors and input, focus management, dirty-form discard confirmation, and toast behavior from §§8–9.

The default selection includes all seven resources. When one card is activated, preselect that resource in the booking dialog. With several resources selected, require a resource choice rather than silently selecting the first resource. An empty selection must show the explanatory Select all resources action in both views.

## Visual tokens from the selected preview

Promote these values to shared semantic tokens rather than repeating literals in components. These are the approved light-theme starting values, not a claim of completed contrast certification.

| Token | Reference value | Use |
|---|---|---|
| Foreground | `#263846` | Main text |
| Muted foreground | `#627583` | Supporting text |
| Surface | `#ffffff` | Main surfaces |
| Subtle surface | `#f3f7fa` | Cards and selection panel |
| Border | `#dbe5ec` | Separators and neutral outlines |
| Primary | `#245f89` | Primary actions and selected outlines |
| Primary tint | `#e4eff7` | Selected resource surfaces |
| Card radius | `10px` | Resource cards and selection panel |
| Overlay radius | `14px` | Dialogs |
| Typography | Arial, Helvetica, sans-serif | System font stack; no external font dependency |

Keep the seven categorical resource colors from the preview stable per resource, alongside names and non-color ownership/status cues. The reference values are Room 1 `#4d78b4`, Room 2 `#a06b31`, Room 3 `#8568b4`, Computer 1 `#347e74`, Computer 2 `#b15a72`, Tablet 1 `#6b7833`, and Tablet 2 `#996b53`. Check actual event text/background combinations for WCAG AA during implementation. The other directions' palettes, including Control Desk's dark palette, are not Atlas dark-mode specifications; derive and verify any required dark tokens separately.

## Responsive contract

- **Above 1100 px:** seven resource cards in one row. The lower workspace uses an approximately 230 px selection panel plus a flexible schedule, with about 25 px between them.
- **761–1100 px:** resource cards wrap to four columns; keep the schedule flexible and contained. Calendar scrolling must not create document-level horizontal overflow.
- **760 px and below:** use a horizontally scrollable resource deck with approximately 130 px cards; collapse the left filter panel into a labelled Filters sheet. Stack the heading and primary action, default to Day when URL state does not specify a view, and keep every control accessible down to 360 px.
- Preserve visible focus, keyboard card activation, labelled controls, modal focus trapping/restoration, and non-color selected state. Do not use a clickable non-semantic container for resource cards. Follow PRD §9.6 and validate touch target sizes during implementation.

## Production UI dependencies and component mapping

These choices retain PRD §10.1. They describe the future app dependencies; this documentation update does not install packages or initialize the frontend.

| Concern | Production choice | Atlas mapping / implementation guidance |
|---|---|---|
| Layout, tokens, responsiveness | [Tailwind CSS](https://tailwindcss.com/docs/installation/using-postcss/) | Grid/flex composition, semantic theme variables, resource deck and responsive breakpoints. Small scoped CSS is appropriate for calendar overrides. |
| Accessible UI primitives | [shadcn/ui, Radix variant](https://ui.shadcn.com/docs/components/radix/dialog) | Own the generated components in-repo. Use Button, Badge, Checkbox, Input, Label, Select, Dialog, Alert Dialog, Popover, Sheet, Calendar, Tabs and Table as needed. Atlas resource cards are styled semantic buttons, not a new library. Explicitly choose the Radix variant to match the PRD rather than silently substituting Base UI. |
| Calendar schedule | [FullCalendar Standard React integration](https://fullcalendar.io/docs/react) and [selection documentation](https://fullcalendar.io/docs/selectable) | Day/week TimeGrid with 30-minute slots, event rendering and click/drag selection. Theme its toolbar/events with Atlas tokens; keep date/view state synchronized with the app. Standard views suffice; no Premium resource scheduler dependency is required. |
| Date picker | [shadcn/ui Calendar](https://ui.shadcn.com/docs/components/radix/calendar), backed by React DayPicker | Popover date navigation and the optional mini month. This selects dates; FullCalendar renders timed bookings. |
| Toasts | [Sonner](https://sonner.emilkowal.ski/) (`sonner`) | The existing PRD toast choice: one app-level Toaster and success/info/warning/error variants configured to §8.2. |
| Icons | Local SVG components from the preview | Preserve the existing room, computer and tablet outline icons. No additional icon package is necessary for the selected design. Give icon-only controls accessible names. |
| UI date arithmetic | `date-fns`, as specified in the PRD | Local date navigation and slot generation; use `Intl.DateTimeFormat` for display. Keep domain timestamps numeric and UTC. |

Use the shadcn CLI to add only the components actually needed and retain the generated helper/primitive dependencies. Pin compatible versions in the frontend lockfile when implementation begins. FullCalendar's package/import layout differs by major version: follow the documentation for the selected major, include its required selection modules and peer dependencies, and keep related FullCalendar packages on compatible versions. Do not mix older split-package installation examples with a newer integration. This decision does not select a new calendar major or add a second component system.

No animation, chart, mapping, card-carousel, or paid scheduler library is needed to reproduce Atlas. Use native horizontal scrolling for the mobile resource deck. Zod and the remaining application/test tooling stay governed by PRD §10.1.

## Implementation acceptance

- The implemented desktop and 360 px layouts clearly reproduce option 04's hierarchy, resource deck, selected states, spacing, typography, and blue palette.
- Resource card focus, grouped multi-select, All resources, and Clear update both calendar and list without losing the shared filter state.
- Login gating, availability, conflict details, cancellation ownership, persistence, monotonic IDs, and URL restoration satisfy the PRD independently of the chosen layout.
- Calendar behavior includes full-day scrolling, drag and keyboard entry paths, overlapping-resource events, and past-slot restrictions; demo limitations are not inherited as requirements.
- Loading, empty selection, empty date range, invalid/conflicting booking, non-owner details, cancellation, and storage failure/recovery states are covered.
- Verify contrast, keyboard/focus behavior, narrow viewports, and reduced-motion preferences using the real production components before declaring accessibility complete.
