import type { BookingApplication } from '../../application';
import { notify } from './notifications';

export async function exportRecoveryData(app: BookingApplication) {
  const result = await app.exportRawData();
  if (!result.ok) {
    notify.error(result.error);
    return;
  }
  const url = URL.createObjectURL(
    new Blob([result.value], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'resource-booking-recovery.json';
  anchor.click();
  URL.revokeObjectURL(url);
}
