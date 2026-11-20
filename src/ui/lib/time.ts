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
  });
  const start = new Date(startAt);
  const end = new Date(endAt);
  const endDate =
    start.toDateString() === end.toDateString() ? '' : `${date.format(end)}, `;
  return `${date.format(start)}, ${time.format(start)} – ${endDate}${time.format(end)}`;
}

export function formatDateTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
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
  return new Date(`${date}T${time}:00`).getTime();
}

export function nextSlot(now = Date.now()) {
  return Math.ceil(now / SLOT_MS) * SLOT_MS;
}
