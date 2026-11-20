import { createElement } from 'react';
import { toast } from 'sonner';
import type { DomainError } from '../../domain';

export const notify = {
  success(message: string) {
    toast.success(message, { duration: 4000 });
  },
  info(message: string) {
    toast.info(message, { duration: 4000 });
  },
  warning(message: string) {
    toast.warning(message, { duration: 6000 });
  },
  error(error: DomainError) {
    const correlationId =
      typeof error.details?.correlationId === 'string'
        ? error.details.correlationId
        : crypto.randomUUID();
    const details = JSON.stringify({ ...error, correlationId }, null, 2);
    toast.error(createElement('span', { role: 'alert' }, error.message), {
      duration: Infinity,
      action: {
        label: 'Copy details',
        onClick: () => {
          void navigator.clipboard.writeText(details).catch(() => {
            toast.info(
              'Clipboard access is unavailable. Select and copy the error details below.',
              { description: details, duration: Infinity },
            );
          });
        },
      },
    });
  },
};
