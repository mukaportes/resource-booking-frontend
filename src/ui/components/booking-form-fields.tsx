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
  errors,
}: {
  fields: BookingFields;
  update: (name: keyof BookingFields, value: string) => void;
  startAt: number;
  errors: Partial<Record<keyof BookingFields, string>>;
}) {
  return (
    <>
      <label htmlFor="booking-resource">Resource</label>
      <select
        id="booking-resource"
        aria-invalid={Boolean(errors.resourceId)}
        aria-describedby={
          errors.resourceId ? 'booking-error-resourceId' : undefined
        }
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
      {errors.resourceId && (
        <span id="booking-error-resourceId" className="field-error">
          {errors.resourceId}
        </span>
      )}
      <div className="field-row">
        <div>
          <label htmlFor="booking-startDate">Start date</label>
          <Input
            id="booking-startDate"
            aria-invalid={Boolean(errors.startDate)}
            aria-describedby={
              errors.startDate ? 'booking-error-startDate' : undefined
            }
            type="date"
            value={fields.startDate}
            onChange={(event) => update('startDate', event.target.value)}
          />
          {errors.startDate && (
            <span id="booking-error-startDate" className="field-error">
              {errors.startDate}
            </span>
          )}
        </div>
        <div>
          <label htmlFor="booking-startTime">Start time</label>
          <Input
            id="booking-startTime"
            aria-invalid={Boolean(errors.startTime)}
            aria-describedby={
              errors.startTime ? 'booking-error-startTime' : undefined
            }
            type="time"
            step={1800}
            value={fields.startTime}
            onChange={(event) => update('startTime', event.target.value)}
          />
          {errors.startTime && (
            <span id="booking-error-startTime" className="field-error">
              {errors.startTime}
            </span>
          )}
        </div>
      </div>
      <div className="field-row">
        <div>
          <label htmlFor="booking-endDate">End date</label>
          <Input
            id="booking-endDate"
            aria-invalid={Boolean(errors.endDate)}
            aria-describedby={
              errors.endDate ? 'booking-error-endDate' : undefined
            }
            type="date"
            min={fields.startDate}
            value={fields.endDate}
            onChange={(event) => update('endDate', event.target.value)}
          />
          {errors.endDate && (
            <span id="booking-error-endDate" className="field-error">
              {errors.endDate}
            </span>
          )}
        </div>
        <div>
          <label htmlFor="booking-endTime">End time</label>
          <Input
            id="booking-endTime"
            aria-invalid={Boolean(errors.endTime)}
            aria-describedby={
              errors.endTime ? 'booking-error-endTime' : undefined
            }
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
          {errors.endTime && (
            <span id="booking-error-endTime" className="field-error">
              {errors.endTime}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
