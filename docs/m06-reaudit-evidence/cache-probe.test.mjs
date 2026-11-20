// Audit reproduction only. Excluded from the application regression suite.
import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createApplication } from '../../src/infrastructure/create-application';

it('measures whether query-result mutation can affect cancellation ownership', async () => {
  localStorage.clear(); sessionStorage.clear();
  const app = createApplication(localStorage,sessionStorage,() => 0);
  const owner = await app.login('owner@example.com');
  const created = await app.createBooking({resourceId:'room-1',startAt:1800000,endAt:3600000});
  const other = await app.login('other@example.com');
  const listed = await app.listBookings();
  expect(owner.ok && other.ok && created.ok && listed.ok).toBe(true);
  const originalRaw = localStorage.getItem('resourceBooking:v1:bookings');
  listed.value[0].userId = other.value.userId;
  const beforeCommand = localStorage.getItem('resourceBooking:v1:bookings');
  const cancelled = await app.cancelBooking(1);
  const stored = JSON.parse(localStorage.getItem('resourceBooking:v1:bookings')).items[0];
  writeFileSync('docs/m06-reaudit-evidence/cache-results.json',JSON.stringify({revision:'ecbfc38',queryMutationChangedStorage:beforeCommand!==originalRaw,cancelSucceeded:cancelled.ok,originalOwner:owner.value.email,persistedOwnerIsOriginal:stored.userId===owner.value.userId,persistedOwnerIsOther:stored.userId===other.value.userId,persistedStatus:stored.status},null,2));
  expect(cancelled.ok).toBe(true);
  expect(stored.userId).toBe(other.value.userId);
});
