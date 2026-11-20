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

test('validation identifies the responsible field and the picker reopens on the viewed month', async ({
  page,
}) => {
  await openWorkspace(page, '?view=week&date=2027-03-14');
  const dateTrigger = page.getByRole('button', {
    name: 'Choose schedule date',
  });
  await dateTrigger.click();
  await expect(page.locator('.atlas-date-picker')).toContainText('March 2027');
  await page.getByRole('button', { name: /next month/i }).click();
  await expect(page.locator('.atlas-date-picker')).toContainText('April 2027');
  await page.keyboard.press('Escape');
  await expect(dateTrigger).toBeFocused();
  await dateTrigger.click();
  await expect(page.locator('.atlas-date-picker')).toContainText('March 2027');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '＋ New booking' }).click();
  const resource = page.getByLabel('Resource', { exact: true });
  await expect(resource).toHaveAttribute('aria-invalid', 'true');
  await expect(resource).toHaveAttribute(
    'aria-describedby',
    'booking-error-resourceId',
  );
  await expect(page.getByLabel('Start date', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'false',
  );
  await expect(page.getByLabel('Start time', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'false',
  );
  await expect(page.getByLabel('End date', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'false',
  );
  await expect(page.getByLabel('End time', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'false',
  );
  await resource.selectOption('room-1');
  await page.getByLabel('End time', { exact: true }).fill('08:30');
  await expect(resource).toHaveAttribute('aria-invalid', 'false');
  await expect(page.getByLabel('Start time', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'false',
  );
  await expect(page.getByLabel('End time', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByLabel('End time', { exact: true })).toHaveAttribute(
    'aria-describedby',
    'booking-error-endTime',
  );
  await accessible(page);
});

test('the shared week shows readable bounded entries, preserves filters and opens keyboard details at desktop and 360px', async ({
  page,
}) => {
  await openWorkspace(page, '?view=week&date=2027-01-12');
  await page.evaluate(() => {
    const users = JSON.parse(
      localStorage.getItem('resourceBooking:v1:users')!,
    ).items;
    users[0].email = 'very.long.owner.name.for.resource.scheduling@example.com';
    const resources = [
      'room-1',
      'room-2',
      'room-3',
      'computer-1',
      'computer-2',
      'tablet-1',
      'tablet-2',
    ];
    const items = resources.map((resourceId, index) => ({
      id: index + 1,
      resourceId,
      userId: users[0].userId,
      startAt: Date.parse('2027-01-12T10:00:00Z'),
      endAt: Date.parse('2027-01-12T11:00:00Z'),
      status: 'active',
      createdAt: 0,
      cancelledAt: null,
    }));
    items.push({
      ...items[0],
      id: 8,
      startAt: Date.parse('2027-01-19T10:00:00Z'),
      endAt: Date.parse('2027-01-19T11:00:00Z'),
    });
    localStorage.setItem(
      'resourceBooking:v1:users',
      JSON.stringify({ schemaVersion: 1, items: users }),
    );
    localStorage.setItem(
      'resourceBooking:v1:bookings',
      JSON.stringify({ schemaVersion: 1, items }),
    );
    localStorage.setItem(
      'resourceBooking:v1:bookingSequence',
      JSON.stringify({ schemaVersion: 1, lastIssuedId: 8 }),
    );
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Shared week overview' }),
  ).toBeVisible();
  await expect(page.locator('.agenda-booking')).toHaveCount(7);
  await expect(
    page.getByRole('button', { name: 'Details for booking 7', exact: true }),
  ).toContainText('Tablet 2');
  await expect(
    page.getByRole('button', { name: 'Details for booking 8', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.agenda-booking').first()).toContainText(
    'very.long.owner.name.for.resource.scheduling@example.com',
  );
  const entry = page.getByRole('button', {
    name: 'Details for booking 1',
    exact: true,
  });
  await expect(entry).toHaveAccessibleDescription(/Room 1/);
  await entry.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('dialog', { name: 'Booking #1', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(entry).toBeFocused();
  await accessible(page);
  await page.screenshot({
    path: 'docs/m06-final-evidence/shared-week-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await entry.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await accessible(page);
  await page.screenshot({
    path: 'docs/m06-final-evidence/shared-week-mobile.png',
    fullPage: true,
  });
  await entry.focus();
  await page.keyboard.press('Space');
  await page
    .getByRole('button', { name: 'Cancel booking', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm cancellation' }).click();
  await expect(
    page.getByRole('heading', { name: 'The schedule', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Details for booking 1', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: /Room 2 Rooms/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Shared week overview' }),
  ).toHaveCount(0);
  await expect(page.locator('.fc-timegrid-body')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Booking #2,/ })).toHaveCount(
    1,
  );
});
