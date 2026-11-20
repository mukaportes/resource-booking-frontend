import { RESOURCES } from '../../domain';
import { SLOT_MS, toTimeInput } from '../lib/time';
import { Input } from './ui/input';

export interface BookingFields {
  resourceId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}
export function BookingFormFields({
  fields,
  update,
  startAt,
  invalid,
}: {
  fields: BookingFields;
  update: (name: keyof BookingFields, value: string) => void;
  startAt: number;
  invalid: string;
}) {
  return (
    <>
      <label htmlFor="booking-resource">Resource</label>
      <select
        id="booking-resource"
        className="input"
        value={fields.resourceId}
        onChange={(event) => update('resourceId', event.target.value)}
      >
        <option value="">Choose a resource</option>
        {['room', 'equipment'].map((category) => (
          <optgroup
            key={category}
            label={category === 'room' ? 'Rooms' : 'Equipment'}
          >
            {RESOURCES.filter((item) => item.category === category).map(
              (item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ),
            )}
          </optgroup>
        ))}
      </select>
      <div className="field-row">
        <label>
          Start date
          <Input
            aria-invalid={Boolean(invalid)}
            aria-describedby="booking-validation"
            type="date"
            value={fields.startDate}
            onChange={(event) => update('startDate', event.target.value)}
          />
        </label>
        <label>
          Start time
          <Input
            aria-invalid={Boolean(invalid)}
            aria-describedby="booking-validation"
            type="time"
            step={1800}
            value={fields.startTime}
            onChange={(event) => update('startTime', event.target.value)}
          />
        </label>
      </div>
      <div className="field-row">
        <label>
          End date
          <Input
            aria-invalid={Boolean(invalid)}
            aria-describedby="booking-validation"
            type="date"
            min={fields.startDate}
            value={fields.endDate}
            onChange={(event) => update('endDate', event.target.value)}
          />
        </label>
        <label>
          End time
          <Input
            aria-invalid={Boolean(invalid)}
            aria-describedby="booking-validation"
            type="time"
            step={1800}
            min={
              Number.isFinite(startAt) && fields.startDate === fields.endDate
                ? toTimeInput(startAt + SLOT_MS)
                : undefined
            }
            value={fields.endTime}
            onChange={(event) => update('endTime', event.target.value)}
          />
        </label>
      </div>
    </>
  );
}
