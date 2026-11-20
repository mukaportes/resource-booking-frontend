import { z } from 'zod';

export const resourceIdSchema = z.enum([
  'room-1',
  'room-2',
  'room-3',
  'computer-1',
  'computer-2',
  'tablet-1',
  'tablet-2',
]);
export type ResourceId = z.infer<typeof resourceIdSchema>;

export enum ResourceType {
  Room = 'room',
  Computer = 'computer',
  Tablet = 'tablet',
}
export enum ResourceCategory {
  Room = 'room',
  Equipment = 'equipment',
}
export enum BookingStatus {
  Active = 'active',
  Cancelled = 'cancelled',
}
export enum CancelOutcome {
  Cancelled = 'cancelled',
  AlreadyCancelled = 'already_cancelled',
}

export interface Resource {
  id: ResourceId;
  name: string;
  type: ResourceType;
  category: ResourceCategory;
  colorToken: string;
}

const timestampSchema = z.number().finite().int();
export const bookingSchema = z
  .object({
    id: z.number().int().positive(),
    resourceId: resourceIdSchema,
    userId: z.string().uuid(),
    startAt: timestampSchema,
    endAt: timestampSchema,
    status: z.nativeEnum(BookingStatus),
    createdAt: timestampSchema,
    cancelledAt: timestampSchema.nullable(),
  })
  .strict()
  .refine((booking) => booking.startAt < booking.endAt, {
    message: 'Booking end must follow start',
  })
  .refine(
    (booking) =>
      booking.status === BookingStatus.Cancelled
        ? booking.cancelledAt !== null
        : booking.cancelledAt === null,
    {
      message: 'Cancellation timestamp must match status',
    },
  );
export type Booking = z.infer<typeof bookingSchema>;

export const emailSchema = z.string().trim().toLowerCase().max(254).email();
export const userSchema = z
  .object({
    userId: z.string().uuid(),
    email: z
      .string()
      .max(254)
      .email()
      .refine((email) => email === email.trim().toLowerCase()),
    createdAt: timestampSchema,
  })
  .strict();
export type User = z.infer<typeof userSchema>;
export const sessionSchema = z
  .object({
    userId: z.string().uuid(),
    startedAt: timestampSchema,
  })
  .strict();
export type Session = z.infer<typeof sessionSchema>;

export interface Interval {
  startAt: number;
  endAt: number;
}
export interface CreateBookingInput extends Interval {
  resourceId: ResourceId;
}
export interface BookingInput extends CreateBookingInput {
  userId: string;
}
export interface AvailabilityResult {
  isAvailable: boolean;
  conflicts: Booking[];
}
export interface CancelResult {
  outcome: CancelOutcome;
  booking: Booking;
}
