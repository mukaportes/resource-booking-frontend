import { logger } from './index';

const errorTypes = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'SecurityError',
  'QuotaExceededError',
]);

export function reportUnexpected(
  error: unknown,
  operation: string,
  correlationId = crypto.randomUUID(),
) {
  const type =
    error instanceof Error && errorTypes.has(error.name)
      ? error.name
      : 'UnknownError';
  // Omit exception messages and frame arguments: they may contain identity or booking data.
  const frames =
    error instanceof Error
      ? (error.stack ?? '')
          .split('\n')
          .slice(1, 9)
          .flatMap((frame) => {
            const location = frame.match(
              /(?:\/|\\)([a-zA-Z0-9_.-]+\.(?:m?js|tsx?)):(\d+):(\d+)\)?$/,
            );
            return location
              ? [`${location[1]}:${location[2]}:${location[3]}`]
              : [];
          })
          .join('\n')
      : '';
  return logger.error(
    'Unexpected application failure',
    { operation, type, stack: frames || 'No safe stack locations available' },
    correlationId,
  );
}
