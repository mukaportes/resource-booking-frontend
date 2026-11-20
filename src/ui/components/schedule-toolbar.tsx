import { addDays } from 'date-fns';
import type { ViewState } from '../lib/view-state';
import { toDateInput } from '../lib/time';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
export function ScheduleToolbar({
  state,
  update,
  openFilters,
}: {
  state: ViewState;
  update: (patch: Partial<ViewState>) => void;
  openFilters: () => void;
}) {
  const date = new Date(`${state.date}T12:00:00`);
  const move = (direction: number) =>
    update({
      date: toDateInput(
        addDays(date, direction * (state.view === 'week' ? 7 : 1)),
      ),
    });
  return (
    <div className="schedule-toolbar">
      <div className="toolbar-row">
        <Button
          variant="outline"
          size="sm"
          onClick={() => update({ date: toDateInput(new Date()) })}
        >
          Today
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous period"
          onClick={() => move(-1)}
        >
          ‹
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next period"
          onClick={() => move(1)}
        >
          ›
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Choose schedule date"
            >
              {new Intl.DateTimeFormat(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }).format(date)}
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Calendar
              mode="single"
              selected={date}
              defaultMonth={date}
              onSelect={(selected) => {
                if (selected) update({ date: toDateInput(selected) });
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="toolbar-row">
        <div className="view-switch" role="group" aria-label="Schedule view">
          {(['day', 'week', 'list'] as const).map((view) => (
            <Button
              key={view}
              size="sm"
              variant={state.view === view ? 'default' : 'ghost'}
              aria-pressed={state.view === view}
              onClick={() => update({ view })}
            >
              {view[0].toUpperCase() + view.slice(1)}
            </Button>
          ))}
        </div>
        <label className="scope-control">
          <span className="sr-only">Booking scope</span>
          <select
            className="input"
            value={state.mine ? 'mine' : 'all'}
            onChange={(event) =>
              update({ mine: event.target.value === 'mine' })
            }
          >
            <option value="all">All bookings</option>
            <option value="mine">My bookings</option>
          </select>
        </label>
        <label className="filter-check">
          <input
            type="checkbox"
            checked={state.showCancelled}
            onChange={(event) =>
              update({ showCancelled: event.target.checked })
            }
          />
          Show cancelled
        </label>
        <Button
          variant="outline"
          size="sm"
          className="mobile-filters"
          onClick={openFilters}
        >
          Filters
        </Button>
      </div>
    </div>
  );
}
