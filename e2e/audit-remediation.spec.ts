import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openWorkspace } from './helpers';

async function persistentData(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      ['users', 'bookings', 'bookingSequence'].map((key) => [
        key,
        localStorage.getItem(`resourceBooking:v1:${key}`),
      ]),
    ),
  );
}
async function draft(page: Page, date: string, start: string, end: string) {
  await page.getByRole('button', { name: '＋ New booking' }).click();
  await page.getByLabel('Start date').fill(date);
  await page.getByLabel('End date').fill(date);
  await page.getByLabel('Start time').fill(start);
  await page.getByLabel('End time').fill(end);
}
async function book(page: Page) {
  await expect(
    page.getByRole('button', { name: 'Book', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Book', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function accessible(page: Page) {
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    scan.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    ),
  ).toEqual([]);
}

test.describe('native local-time input integrity', () => {
  test.use({ timezoneId: 'America/New_York' });
  test('rejects the spring-forward gap without any write or consumed ID, then round trips a valid local booking', async ({
    page,
  }) => {
    await openWorkspace(page, '?view=list&date=2027-03-14&resources=room-1');
    const before = await persistentData(page);
    await draft(page, '2027-03-14', '02:00', '02:30');
    await expect(page.locator('#booking-validation')).toContainText(
      'does not exist',
    );
    await expect(page.getByLabel('Start time')).toHaveValue('02:00');
    await expect(
      page.getByRole('button', { name: 'Book', exact: true }),
    ).toBeDisabled();
    await expect(page.getByLabel('Start time')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await accessible(page);
    expect(await persistentData(page)).toEqual(before);
    await page.getByLabel('Start time').fill('03:00');
    await page.getByLabel('End time').fill('03:30');
    await book(page);
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('resourceBooking:v1:bookings')!)
            .items[0],
      ),
    ).toMatchObject({
      id: 1,
      startAt: Date.parse('2027-03-14T07:00:00Z'),
      endAt: Date.parse('2027-03-14T07:30:00Z'),
    });
    await page.reload();
    await page
      .getByRole('button', { name: 'Details for booking 1', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toContainText('03:00 AM GMT-4');
  });
  test('persists the browser-native earlier repeated hour and explains its resolved offset', async ({
    page,
  }) => {
    await openWorkspace(page, '?view=list&date=2027-11-07&resources=room-1');
    await draft(page, '2027-11-07', '01:00', '01:30');
    await expect(page.getByText(/Resolved local time:/)).toContainText(
      '01:00 AM GMT-4',
    );
    await expect(page.getByText(/Resolved local time:/)).toContainText(
      'native resolution',
    );
    await book(page);
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('resourceBooking:v1:bookings')!)
            .items[0],
      ),
    ).toMatchObject({
      startAt: Date.parse('2027-11-07T05:00:00Z'),
      endAt: Date.parse('2027-11-07T05:30:00Z'),
    });
    await page.reload();
    await page
      .getByRole('button', { name: 'Details for booking 1', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toContainText('01:00 AM GMT-4');
  });
});

test('primary keyboard booking retains the viewed day/resource, today rounds forward and past-day entry is explained', async ({
  page,
}) => {
  await openWorkspace(page, '?view=day&date=2027-03-14&resources=tablet-2');
  const trigger = page.getByRole('button', { name: '＋ New booking' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Start date')).toHaveValue('2027-03-14');
  await expect(page.getByLabel('Resource', { exact: true })).toHaveValue(
    'tablet-2',
  );
  await expect(page.getByLabel('Start time')).toHaveValue('09:00');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.goto('/?view=day&date=2027-01-10');
  await expect(trigger).toBeDisabled();
  await expect(
    page.getByRole('status').filter({ hasText: 'past day' }),
  ).toBeVisible();
  await page.clock.setFixedTime(new Date('2027-01-11T08:01:00Z'));
  await page.goto('/?view=day&date=2027-01-11&resources=room-1');
  await trigger.click();
  await expect(page.getByLabel('Start date')).toHaveValue('2027-01-11');
  await expect(page.getByLabel('Start time')).toHaveValue('08:30');
  await expect(
    page.getByRole('button', { name: 'Book', exact: true }),
  ).toBeEnabled();
});

test('malformed session recovers through identification while healthy history and sequence remain byte-for-byte intact', async ({
  page,
}) => {
  await openWorkspace(page, '?view=list&date=2027-01-12&resources=room-1');
  await draft(page, '2027-01-12', '10:00', '11:00');
  await book(page);
  const before = await persistentData(page);
  await page.evaluate(() =>
    sessionStorage.setItem('resourceBooking:v1:session', '{broken'),
  );
  await page.reload();
  await expect(page.getByLabel('Work email')).toBeVisible();
  await expect(page.getByText(/Your saved session was reset/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Reset local data' }),
  ).toHaveCount(0);
  await page.getByLabel('Work email').fill('alex@example.com');
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(
    page.getByRole('button', { name: 'Details for booking 1', exact: true }),
  ).toBeVisible();
  expect(await persistentData(page)).toEqual(before);
});

test('startup quota allows inspection/export, gates writes and enables retry without losing data at 360px', async ({
  page,
}) => {
  await openWorkspace(page, '?view=list&date=2027-01-12&resources=room-1');
  await draft(page, '2027-01-12', '10:00', '11:00');
  await book(page);
  const before = await persistentData(page);
  await page.addInitScript(() => {
    const write = Storage.prototype.setItem;
    Object.assign(window, { capacityFull: true });
    Storage.prototype.setItem = function (key, value) {
      if (
        (window as Window & { capacityFull?: boolean }).capacityFull &&
        key.startsWith('resourceBooking:probe:')
      )
        throw new DOMException('Full', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await expect(
    page.getByRole('heading', {
      name: 'Storage is full — read-only workspace',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '＋ New booking' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Details for booking 1', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Room 1');
  await expect(
    page.getByRole('button', { name: 'Cancel booking', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export raw data' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    'resource-booking-recovery.json',
  );
  expect(await persistentData(page)).toEqual(before);
  await accessible(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Retry storage' }).click();
  await expect(
    page.getByRole('button', { name: '＋ New booking' }),
  ).toBeDisabled();
  await page.evaluate(() => Object.assign(window, { capacityFull: false }));
  await page.getByRole('button', { name: 'Retry storage' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Storage is full — read-only workspace',
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '＋ New booking' }),
  ).toBeEnabled();
  expect(await persistentData(page)).toEqual(before);
});

test('external occupation and cancellation refresh advisory availability without changing the draft', async ({
  page,
  context,
}) => {
  await openWorkspace(page, '?view=day&date=2027-01-12&resources=room-1');
  await draft(page, '2027-01-12', '10:00', '11:00');
  await expect(page.getByText('✓ Available', { exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('resourceBooking:v1:users')!)
      .items[0];
    localStorage.setItem(
      'resourceBooking:v1:bookings',
      JSON.stringify({
        schemaVersion: 1,
        items: [
          {
            id: 1,
            resourceId: 'room-1',
            userId: user.userId,
            startAt: Date.parse('2027-01-12T10:00:00Z'),
            endAt: Date.parse('2027-01-12T11:00:00Z'),
            status: 'active',
            createdAt: 0,
            cancelledAt: null,
          },
        ],
      }),
    );
    localStorage.setItem(
      'resourceBooking:v1:bookingSequence',
      JSON.stringify({ schemaVersion: 1, lastIssuedId: 1 }),
    );
  });
  await expect(page.locator('.conflict-list')).toContainText('#1 · Room 1');
  await expect(
    page.getByRole('button', { name: 'Book', exact: true }),
  ).toBeDisabled();
  await other.evaluate(() => {
    const stored = JSON.parse(
      localStorage.getItem('resourceBooking:v1:bookings')!,
    );
    stored.items[0].status = 'cancelled';
    stored.items[0].cancelledAt = 1;
    localStorage.setItem('resourceBooking:v1:bookings', JSON.stringify(stored));
  });
  await expect(page.getByText('✓ Available', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Start time')).toHaveValue('10:00');
  await book(page);
  expect(
    await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem('resourceBooking:v1:bookings')!,
      ).items.map((b: { id: number; status: string }) => [b.id, b.status]),
    ),
  ).toEqual([
    [1, 'cancelled'],
    [2, 'active'],
  ]);
});

test('history renders bounded pages, retains records and supplies only overlapping calendar events', async ({
  page,
}) => {
  await openWorkspace(page, '?view=list&date=2027-01-12&resources=room-1');
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('resourceBooking:v1:users')!)
      .items[0];
    const booking = {
      resourceId: 'room-1',
      userId: user.userId,
      startAt: Date.parse('2027-01-12T10:00:00Z'),
      endAt: Date.parse('2027-01-12T11:00:00Z'),
      status: 'cancelled',
      createdAt: 0,
      cancelledAt: 1,
    };
    const items = Array.from({ length: 123 }, (_, i) => ({
      ...booking,
      id: i + 1,
      startAt: booking.startAt + i * 86400000,
      endAt: booking.endAt + i * 86400000,
    }));
    items.push({
      ...booking,
      id: 124,
      startAt: Date.parse('2027-01-11T23:30:00Z'),
      endAt: Date.parse('2027-01-12T00:30:00Z'),
    });
    localStorage.setItem(
      'resourceBooking:v1:bookings',
      JSON.stringify({ schemaVersion: 1, items }),
    );
    localStorage.setItem(
      'resourceBooking:v1:bookingSequence',
      JSON.stringify({ schemaVersion: 1, lastIssuedId: 124 }),
    );
  });
  await page.reload();
  const before = await persistentData(page);
  await expect(page.locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Page 2 of 3' }),
  ).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(24);
  await expect(
    page.getByRole('button', { name: 'Next page', exact: true }),
  ).toBeDisabled();
  await page.goto(
    '/?view=day&date=2027-01-12&resources=room-1&showCancelled=1',
  );
  await expect(page.locator('.fc-event[role="button"]')).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: /^Booking #124,/ }),
  ).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Booking #2,/ })).toHaveCount(
    0,
  );
  expect(await persistentData(page)).toEqual(before);
  await page.screenshot({
    path: 'docs/m06-evidence/desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await expect
    .poll(() =>
      page
        .locator('.fc-timegrid-body')
        .evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeLessThanOrEqual(330);
  await page.screenshot({
    path: 'docs/m06-evidence/mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
