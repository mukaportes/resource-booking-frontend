import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const count of [100, 1000, 5000]) {
    const context = await browser.newContext({
      timezoneId: 'UTC',
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2027-01-11T08:00:00Z'));
    await page.goto('http://127.0.0.1:3100/');
    const fixture = await page.evaluate((count) => {
      const users = Array.from({ length: 100 }, (_, i) => ({
        userId: crypto.randomUUID(),
        email: `person${i}@example.com`,
        createdAt: 0,
      }));
      const bookings = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        resourceId: 'room-1',
        userId: users[i % 100].userId,
        startAt: Date.parse('2026-01-01T10:00:00Z') + i * 1800000,
        endAt: Date.parse('2026-01-01T10:30:00Z') + i * 1800000,
        status: i % 2 ? 'cancelled' : 'active',
        createdAt: 0,
        cancelledAt: i % 2 ? 1 : null,
      }));
      const raw = {
        users: JSON.stringify({ schemaVersion: 1, items: users }),
        bookings: JSON.stringify({ schemaVersion: 1, items: bookings }),
        bookingSequence: JSON.stringify({
          schemaVersion: 1,
          lastIssuedId: count,
        }),
      };
      for (const [key, value] of Object.entries(raw))
        localStorage.setItem(`resourceBooking:v1:${key}`, value);
      sessionStorage.setItem(
        'resourceBooking:v1:session',
        JSON.stringify({
          schemaVersion: 1,
          session: { userId: users[0].userId },
        }),
      );
      return {
        bytes: Object.values(raw).reduce(
          (n, s) => n + new TextEncoder().encode(s).length,
          0,
        ),
      };
    }, count);
    const samples = [];
    for (let trial = 0; trial < 3; trial++) {
      const start = performance.now();
      await page.goto(
        'http://127.0.0.1:3100/?view=list&date=2027-01-12&resources=room-1',
      );
      await page
        .getByRole('button', { name: 'Details for booking 1', exact: true })
        .waitFor();
      const loadMs = performance.now() - start;
      const rows = await page.locator('tbody tr').count();
      const sortStart = performance.now();
      await page.getByRole('button', { name: 'ID ↑', exact: true }).click();
      await page
        .getByRole('button', { name: 'ID ↑', exact: true })
        .getAttribute('aria-pressed');
      samples.push({ loadMs, sortMs: performance.now() - sortStart, rows });
    }
    results.push({
      count,
      users: 100,
      cancelled: count / 2,
      ...fixture,
      samples,
    });
    await context.close();
  }
  const output = {
    timestamp: new Date().toISOString(),
    browser: browser.version(),
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    results,
  };
  writeFileSync(
    process.argv[2] ?? '/tmp/history-benchmark.json',
    JSON.stringify(output, null, 2),
  );
  console.log(JSON.stringify(output, null, 2));
} finally {
  await browser.close();
}
