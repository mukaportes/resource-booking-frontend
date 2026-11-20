'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { BookingStatus, RESOURCES, type Booking } from '../../domain';
import { useApplication } from '../hooks/use-application';
import { notify } from '../lib/notifications';
import { useViewState } from '../hooks/use-view-state';
import {
  defaultBookingStart,
  SLOT_MS,
  visibleScheduleRange,
} from '../lib/time';
import { BookingDetails } from './booking-details';
import { BookingDialog, type BookingSelection } from './booking-dialog';
import { BookingTable } from './booking-table';
import { ResourceFilter } from './resource-filter';
import { ResourceIcon } from './resource-icon';
import { ScheduleToolbar } from './schedule-toolbar';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import './workspace.css';

const BookingCalendar = dynamic(() => import('./booking-calendar'), {
  ssr: false,
  loading: () => (
    <div className="calendar-skeleton" aria-label="Loading calendar" />
  ),
});
export function BookingWorkspace() {
  const { user, bookings, users, readOnly } = useApplication();
  const { state, update, ready } = useViewState();
  const [selection, setSelection] = useState<BookingSelection | null>(null);
  const [details, setDetails] = useState<Booking | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  if ((!user && !readOnly) || !ready)
    return <div className="calendar-skeleton" aria-label="Loading workspace" />;
  const filtered = bookings.filter(
    (booking) =>
      state.resourceIds.includes(booking.resourceId) &&
      (!state.mine || !user || booking.userId === user.userId),
  );
  const defaultStart = defaultBookingStart(state.date);
  const range = visibleScheduleRange(state.date, state.view);
  const calendarBookings = filtered.filter(
    (booking) =>
      (state.showCancelled || booking.status === BookingStatus.Active) &&
      booking.endAt > range.from &&
      booking.startAt < range.to,
  );
  function select(startAt: number, endAt: number) {
    if (readOnly) return;
    setSelection({
      startAt,
      endAt,
      resourceId:
        state.resourceIds.length === 1 ? state.resourceIds[0] : undefined,
    });
  }
  return (
    <div className="booking-workspace">
      <div className="atlas-header">
        <div>
          <span className="eyebrow">THE WORKSPACE RESOURCE LIBRARY</span>
          <h1>What do you need to do your best work?</h1>
        </div>
        <Button
          disabled={readOnly || defaultStart === null}
          aria-describedby={
            defaultStart === null ? 'booking-date-policy' : undefined
          }
          onClick={() => {
            const start = defaultBookingStart(state.date);
            if (start !== null) select(start, start + SLOT_MS);
            else notify.info('View today or a future day to create a booking.');
          }}
        >
          ＋ New booking
        </Button>
      </div>
      {defaultStart === null && (
        <p id="booking-date-policy" role="status">
          Bookings cannot start on a past day. View today or a future day to
          create a booking.
        </p>
      )}
      <div className="deck-caption">
        <p className="muted">
          Choose a resource to focus its schedule. Use Filters for multiple
          resources.
        </p>
        <Button
          variant="ghost"
          onClick={() =>
            update({ resourceIds: RESOURCES.map((resource) => resource.id) })
          }
        >
          All resources
        </Button>
      </div>
      <div className="resource-deck" aria-label="Resource schedules">
        {RESOURCES.map((resource) => (
          <button
            key={resource.id}
            type="button"
            className="resource-card"
            aria-pressed={state.resourceIds.includes(resource.id)}
            onClick={() => update({ resourceIds: [resource.id] })}
          >
            <span className="resource-card-top">
              <ResourceIcon type={resource.type} />
              <span
                className="resource-dot"
                style={{ background: `var(--${resource.colorToken})` }}
              />
            </span>
            <strong>{resource.name}</strong>
            <small>
              {resource.category === 'room' ? 'Rooms' : 'Equipment'} · View
              schedule ↗
            </small>
          </button>
        ))}
      </div>
      <div className="atlas-workspace">
        <aside className="atlas-sidebar">
          <span className="eyebrow">YOUR SELECTION</span>
          <h2>
            {state.resourceIds.length === 1
              ? RESOURCES.find(
                  (resource) => resource.id === state.resourceIds[0],
                )?.name
              : 'Shared availability'}
          </h2>
          <p className="muted text-small">
            See what’s already booked, then choose a time that works for you.
          </p>
          <ResourceFilter
            selected={state.resourceIds}
            onChange={(resourceIds) => update({ resourceIds })}
          />
          <p className="muted text-small">
            30-minute slots. Your bookings are labelled “You”.
          </p>
        </aside>
        <section
          className="schedule-section"
          aria-labelledby="schedule-heading"
        >
          <h2 id="schedule-heading">The schedule</h2>
          <ScheduleToolbar
            state={state}
            update={update}
            openFilters={() => setFiltersOpen(true)}
          />
          {!state.resourceIds.length ? (
            <div className="empty-state">
              <h3>No resources selected</h3>
              <p>Select resources to see their availability.</p>
              <Button
                onClick={() =>
                  update({
                    resourceIds: RESOURCES.map((resource) => resource.id),
                  })
                }
              >
                Select all resources
              </Button>
            </div>
          ) : state.view === 'list' ? (
            <BookingTable
              key={`${state.resourceIds.join(',')}:${state.mine}`}
              bookings={filtered}
              users={users}
              userId={user?.userId ?? ''}
              onBooking={setDetails}
            />
          ) : (
            <>
              <BookingCalendar
                bookings={calendarBookings}
                users={users}
                userId={user?.userId ?? ''}
                state={state}
                onSelect={select}
                onBooking={setDetails}
              />
              {!calendarBookings.some((booking) => {
                const date = new Date(`${state.date}T00:00:00`);
                if (state.view === 'week')
                  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
                const end = new Date(date);
                end.setDate(end.getDate() + (state.view === 'week' ? 7 : 1));
                return (
                  booking.startAt < end.getTime() &&
                  booking.endAt > date.getTime()
                );
              }) && (
                <p className="empty-range">
                  No bookings in this range. Drag on the calendar to create one.
                </p>
              )}
            </>
          )}
        </section>
      </div>
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="filters-sheet">
          <DialogHeader>
            <DialogTitle>Filter resources</DialogTitle>
            <DialogDescription>
              Select one or more resources to show in the calendar and list.
            </DialogDescription>
          </DialogHeader>
          <ResourceFilter
            selected={state.resourceIds}
            onChange={(resourceIds) => update({ resourceIds })}
          />
          <Button onClick={() => setFiltersOpen(false)}>Done</Button>
        </DialogContent>
      </Dialog>
      {selection && (
        <BookingDialog
          selection={selection}
          onClose={() => setSelection(null)}
        />
      )}
      {details && (
        <BookingDetails
          booking={
            bookings.find((booking) => booking.id === details.id) ?? details
          }
          onClose={() => setDetails(null)}
        />
      )}
    </div>
  );
}
