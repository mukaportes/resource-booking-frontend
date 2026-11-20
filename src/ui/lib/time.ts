export const SLOT_MS = 30 * 60 * 1000;

export function formatRange(startAt: number, endAt: number) {
  const date = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'shortOffset',
  });
  const start = new Date(startAt);
  const end = new Date(endAt);
  const endDate =
    start.toDateString() === end.toDateString() ? '' : `${date.format(end)}, `;
  return `${date.format(start)}, ${time.format(start)} – ${endDate}${time.format(end)}`;
}

export function formatDateTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'shortOffset',
  }).format(value);
}

export function toDateInput(value: Date | number) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function toTimeInput(value: Date | number) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function toEpochMs(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    return NaN;
  const value = new Date(`${date}T${time}:00`).getTime();
  return Number.isFinite(value) &&
    toDateInput(value) === date &&
    toTimeInput(value) === time
    ? value
    : NaN;
}

export function nextSlot(now = Date.now()) {
  return Math.ceil(now / SLOT_MS) * SLOT_MS;
}

export function defaultBookingStart(
  date: string,
  now = Date.now(),
): number | null {
  const today = toDateInput(now);
  if (date < today) return null;
  if (date === today) return nextSlot(now);
  const start = nextSlot(toEpochMs(date, '09:00'));
  return Number.isFinite(start) && toDateInput(start) === date ? start : null;
}

export function visibleScheduleRange(
  date: string,
  view: 'day' | 'week' | 'list',
) {
  const start = new Date(`${date}T00:00:00`);
  if (view === 'week')
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + (view === 'week' ? 7 : 1));
  return { from: start.getTime(), to: end.getTime() };
}
