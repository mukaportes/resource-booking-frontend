type LogMetadata = Record<string, string | number | boolean>;

function log(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  metadata?: LogMetadata,
) {
  const correlationId = crypto.randomUUID();
  console[level](
    `[resource-booking:${correlationId}] ${message}`,
    metadata ?? {},
  );
  return correlationId;
}

export const logger = {
  debug: (message: string, metadata?: LogMetadata) =>
    log('debug', message, metadata),
  info: (message: string, metadata?: LogMetadata) =>
    log('info', message, metadata),
  warn: (message: string, metadata?: LogMetadata) =>
    log('warn', message, metadata),
  error: (message: string, metadata?: LogMetadata) =>
    log('error', message, metadata),
};
