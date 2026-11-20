import { z } from 'zod';
import { failure, success, type Result } from './errors';
import { resourceIdSchema, type CreateBookingInput } from './types';

const commandSchema = z
  .object({
    resourceId: z.string(),
    startAt: z.number().finite().int(),
    endAt: z.number().finite().int(),
  })
  .strict();

export function validateBookingInput(
  input: unknown,
): Result<CreateBookingInput> {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_INPUT',
      'Provide a resource and finite integer start and end times.',
      {
        fields: [
          ...new Set(
            parsed.error.issues.map((issue) => issue.path.join('.') || 'input'),
          ),
        ],
      },
    );
  }
  const resource = resourceIdSchema.safeParse(parsed.data.resourceId);
  if (!resource.success) {
    return failure('RESOURCE_NOT_FOUND', 'This resource does not exist.', {
      resourceId: parsed.data.resourceId,
    });
  }
  if (parsed.data.startAt >= parsed.data.endAt) {
    return failure('INVALID_INTERVAL', 'End time must be after start time.', {
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
    });
  }
  return success({ ...parsed.data, resourceId: resource.data });
}
