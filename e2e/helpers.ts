import { expect, type Page } from '@playwright/test';

export const BOOKING_DATE = '2027-01-12';

export async function openWorkspace(
  page: Page,
  query = `?date=${BOOKING_DATE}&view=week`,
  email = 'alex@example.com',
) {
  await page.clock.setFixedTime(new Date('2027-01-11T08:00:00Z'));
  await page.goto(`/${query}`);
  await login(page, email);
}

export async function login(page: Page, email: string) {
  await page.getByLabel('Work email').fill(email);
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'What do you need to do your best work?',
    }),
  ).toBeVisible();
}
