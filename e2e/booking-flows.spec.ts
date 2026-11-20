import { expect, test, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { BOOKING_DATE, login, openWorkspace } from './helpers';

async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Calendar time slot has no measurable bounds');
  return box;
}

async function fillBooking(
  page: Page,
  resource = 'room-1',
  start = '10:00',
  end = '11:00',
) {
  await page.getByRole('button', { name: '＋ New booking' }).click();
  const dialog = page.getByRole('dialog', { name: 'New booking' });
  await dialog.getByLabel('Resource', { exact: true }).selectOption(resource);
  await dialog.getByLabel('Start date').fill(BOOKING_DATE);
  await dialog.getByLabel('Start time').fill(start);
  await dialog.getByLabel('End date').fill(BOOKING_DATE);
  await dialog.getByLabel('End time').fill(end);
  return dialog;
}

async function createBooking(
  page: Page,
  resource = 'room-1',
  start = '10:00',
  end = '11:00',
) {
  const dialog = await fillBooking(page, resource, start, end);
  await expect(dialog.getByText('✓ Available', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Book', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function seriousAccessibilityIssues(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return result.violations.filter(
    (violation) =>
      violation.impact === 'critical' || violation.impact === 'serious',
  );
}

test('login gate rejects invalid email, blocks Escape and restores the tab session', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2027-01-11T08:00:00Z'));
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole('button', { name: '＋ New booking' }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.getByLabel('Work email').fill('not-an-email');
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(page.getByRole('alert')).toContainText('valid email');
  await expect(page.getByLabel('Work email')).toHaveValue('not-an-email');
  expect(await seriousAccessibilityIssues(page)).toEqual([]);
  await login(page, ' Alex@Example.COM ');
  await expect(page.locator('.identity-email')).toHaveText('alex@example.com');
  await page.reload();
  await expect(
    page.getByRole('button', { name: '＋ New booking' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByLabel('Work email')).toBeVisible();
});

test('booking conflict, adjacent interval, confirmed cancellation and IDs survive reload', async ({
  page,
}) => {
  await openWorkspace(page, `?date=${BOOKING_DATE}&view=list`);
  await createBooking(page);
  await expect(page.getByRole('row').filter({ hasText: '#1' })).toContainText(
    'Active',
  );

  const conflict = await fillBooking(page);
  await expect(conflict.locator('.conflict-list')).toContainText(
    '#1 · Room 1 · alex@example.com',
  );
  await expect(
    conflict.getByRole('button', { name: 'Book', exact: true }),
  ).toBeDisabled();
  await expect(conflict.getByLabel('Start time')).toHaveValue('10:00');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('heading', { name: 'Discard this booking?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(conflict.getByLabel('Start time')).toHaveValue('10:00');
  await conflict.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();

  await createBooking(page, 'room-1', '11:00', '11:30');
  await expect(page.getByRole('row').filter({ hasText: '#2' })).toContainText(
    'Active',
  );
  await page.getByRole('button', { name: 'Details for booking 1' }).click();
  await page
    .getByRole('button', { name: 'Cancel booking', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Cancel booking #1?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Keep booking' }).click();
  await expect(
    page.getByRole('heading', { name: 'Booking #1', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Cancel booking', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm cancellation' }).click();
  await expect(page.getByRole('row').filter({ hasText: '#1' })).toContainText(
    'Cancelled',
  );
  await createBooking(page);
  await expect(page.getByRole('row').filter({ hasText: '#3' })).toContainText(
    'Active',
  );

  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: '#3' })).toContainText(
    'Room 1',
  );
  await expect(page.getByRole('row').filter({ hasText: '#1' })).toContainText(
    'Cancelled',
  );
  await expect(
    page.getByRole('button', { name: 'List', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/view=list/);
});

test('non-owners see read-only details and shared URL filters restore after reload', async ({
  page,
}) => {
  await openWorkspace(page, `?date=${BOOKING_DATE}&view=list&resources=room-1`);
  await createBooking(page);
  await page.getByRole('button', { name: 'Log out' }).click();
  await login(page, 'blair@example.com');
  await page.getByRole('button', { name: 'Details for booking 1' }).click();
  const details = page.getByRole('dialog', { name: 'Booking #1', exact: true });
  await expect(details).toContainText('alex@example.com');
  await expect(
    details.getByRole('button', { name: 'Cancel booking', exact: true }),
  ).toHaveCount(0);
  await details.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Details for booking 1' }),
  ).toBeFocused();
  await page.getByLabel('Booking scope').selectOption('mine');
  await expect(page.getByText('No bookings match this view.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Booking scope')).toHaveValue('mine');
  await expect(
    page.getByRole('button', { name: /Room 1 Rooms/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: /Room 2 Rooms/ }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(page).toHaveURL(/scope=mine/);
});

test('corrupted storage stays intact until export and typed reset', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('resourceBooking:v1:users', '{broken'),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Your saved data needs attention' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('resourceBooking:v1:users')),
  ).toBe('{broken');
  await expect(
    page.getByRole('button', { name: 'Reset local data' }),
  ).toBeDisabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export raw data' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('resource-booking-recovery.json');
  await page.getByLabel('Type RESET to confirm').fill('RESET');
  await page.getByRole('button', { name: 'Reset local data' }).click();
  await expect(page.getByLabel('Work email')).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('resourceBooking:v1:users')),
  ).toBeNull();
});

test('blocked browser storage opens a blocking explanation', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'The workspace can’t access its data' }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Allow site data');
  await expect(
    page.getByRole('button', { name: '＋ New booking' }),
  ).toHaveCount(0);
});

test('360px Atlas defaults to day, scrolls cards locally and exposes keyboard filters', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openWorkspace(page, `?date=${BOOKING_DATE}`);
  await expect(
    page.getByRole('button', { name: 'Day', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.resource-card')).toHaveCount(7);
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth > innerWidth,
    deck: document.querySelector('.resource-deck')?.scrollWidth ?? 0,
    viewport: innerWidth,
  }));
  expect(overflow.document).toBe(false);
  expect(overflow.deck).toBeGreaterThan(overflow.viewport);
  const filters = page.getByRole('button', { name: 'Filters', exact: true });
  await filters.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Filter resources' });
  await sheet.getByRole('button', { name: 'Clear', exact: true }).click();
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(filters).toBeFocused();
  await expect(
    page.getByRole('heading', { name: 'No resources selected' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Select all resources' }).click();
  await expect(page.locator('.fc-timegrid-body')).toBeVisible();
  expect(await seriousAccessibilityIssues(page)).toEqual([]);
  await page.getByRole('button', { name: '＋ New booking' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'New booking' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: '＋ New booking' }),
  ).toBeFocused();
});

test('dragging a future calendar interval opens a prefilled booking', async ({
  page,
}) => {
  await openWorkspace(page, `?date=${BOOKING_DATE}&view=day&resources=room-1`);
  const startSlot = page.locator(
    '.fc-timegrid-slot-lane[data-time="10:00:00"]',
  );
  const endSlot = page.locator('.fc-timegrid-slot-lane[data-time="10:30:00"]');
  await expect(startSlot).toBeVisible();
  const start = await bounds(startSlot);
  const end = await bounds(endSlot);
  const x = start.x + start.width / 2;
  await page.mouse.move(x, start.y + 3);
  await page.mouse.down();
  await page.mouse.move(x, end.y + end.height - 3, { steps: 12 });
  await page.mouse.up();
  const dialog = page.getByRole('dialog', { name: 'New booking' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Resource', { exact: true })).toHaveValue(
    'room-1',
  );
  await expect(dialog.getByLabel('Start time')).toHaveValue('10:00');
  await expect(dialog.getByLabel('End time')).toHaveValue('11:00');
  await expect(
    dialog.getByRole('button', { name: 'Book', exact: true }),
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Book', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /^Booking #1,/ }),
  ).toBeVisible();
});
