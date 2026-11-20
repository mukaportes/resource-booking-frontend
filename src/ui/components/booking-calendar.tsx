'use client';

import { useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  BookingStatus,
  RESOURCES,
  type Booking,
  type User,
} from '../../domain';
import { formatRange } from '../lib/time';
import type { ViewState } from '../lib/view-state';

export default function BookingCalendar({
  bookings,
  users,
  userId,
  state,
  onSelect,
  onBooking,
}: {
  bookings: Booking[];
  users: User[];
  userId: string;
  state: ViewState;
  onSelect: (startAt: number, endAt: number) => void;
  onBooking: (booking: Booking) => void;
}) {
  const calendar = useRef<FullCalendar>(null);
  useEffect(() => {
    const api = calendar.current?.getApi();
    api?.changeView(state.view === 'day' ? 'timeGridDay' : 'timeGridWeek');
    api?.gotoDate(state.date);
  }, [state.view, state.date]);
  const events = bookings.map((booking) => {
    const resource = RESOURCES.find((item) => item.id === booking.resourceId);
    const owner =
      booking.userId === userId
        ? 'You'
        : (users.find((item) => item.userId === booking.userId)?.email ??
          'Unknown owner');
    return {
      id: String(booking.id),
      title: `${resource?.name} · ${owner}`,
      start: booking.startAt,
      end: booking.endAt,
      backgroundColor: `color-mix(in srgb, var(--${resource?.colorToken}) 12%, white)`,
      borderColor: `var(--${resource?.colorToken})`,
      classNames:
        booking.status === BookingStatus.Cancelled ? ['cancelled-event'] : [],
      extendedProps: { booking, owner, resourceName: resource?.name },
    };
  });
  return (
    <div className="calendar-panel">
      <FullCalendar
        ref={calendar}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView={state.view === 'day' ? 'timeGridDay' : 'timeGridWeek'}
        initialDate={state.date}
        headerToolbar={false}
        height={620}
        allDaySlot={false}
        slotDuration="00:30:00"
        snapDuration="00:30:00"
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        scrollTime="07:00:00"
        nowIndicator
        firstDay={1}
        selectable
        selectMirror
        selectOverlap
        slotEventOverlap={false}
        events={[
          ...events,
          {
            start: '1970-01-01',
            end: new Date().toISOString(),
            display: 'background',
            backgroundColor: '#62758314',
          },
        ]}
        selectAllow={(selection) => selection.start.getTime() >= Date.now()}
        select={(selection) => {
          onSelect(selection.start.getTime(), selection.end.getTime());
          selection.view.calendar.unselect();
        }}
        dateClick={(selection) => {
          if (selection.date.getTime() >= Date.now())
            onSelect(
              selection.date.getTime(),
              selection.date.getTime() + 1_800_000,
            );
        }}
        eventClick={(event) => {
          const selected = bookings.find(
            (booking) => String(booking.id) === event.event.id,
          );
          if (selected) onBooking(selected);
        }}
        eventDidMount={({ el, event }) => {
          const booking = bookings.find((item) => String(item.id) === event.id);
          if (!booking) return;
          el.tabIndex = 0;
          el.setAttribute('role', 'button');
          el.onkeydown = (keyboardEvent) => {
            if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
              keyboardEvent.preventDefault();
              onBooking(booking);
            }
          };
          el.setAttribute(
            'aria-label',
            `Booking #${booking.id}, ${event.title}, ${formatRange(booking.startAt, booking.endAt)}, ${booking.status}`,
          );
        }}
        eventContent={(event) => (
          <div className="calendar-event">
            <strong>{event.event.title}</strong>
            <span>{event.timeText}</span>
            {event.event.extendedProps.booking?.status ===
              BookingStatus.Cancelled && <span>Cancelled</span>}
          </div>
        )}
        eventClassNames={(event) =>
          event.event.start && event.event.start.getTime() < Date.now()
            ? ['past-event']
            : []
        }
        dayCellClassNames={(day) => (day.isPast ? ['past-day'] : [])}
        dayCellDidMount={({ el, date }) => {
          el.tabIndex = 0;
          const day = new Intl.DateTimeFormat(undefined, {
            dateStyle: 'full',
          }).format(date);
          el.setAttribute(
            'aria-label',
            `${day} schedule. Use Up and Down to scroll; New booking to reserve.`,
          );
        }}
      />
    </div>
  );
}
