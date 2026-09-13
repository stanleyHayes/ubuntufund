import { test as base, type Page } from '@playwright/test'
import { randomUUID } from 'crypto'

export interface TestUser {
  email: string
  password: string
  name: string
}

/** Register a brand-new user through the real UI; resolves once authenticated. */
export async function registerFreshUser(page: Page): Promise<TestUser> {
  const user: TestUser = {
    email: `e2e-${randomUUID()}@example.com`,
    password: 'E2ePassword123!',
    name: 'E2E Tester',
  }
  await page.goto('/register')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel(/^Full name/i).fill(user.name)
  await page.getByLabel(/^Email/).fill(user.email)
  await page.getByLabel(/^Password/).fill(user.password)
  await page.getByLabel(/^Confirm password/i).fill(user.password)
  await page.getByRole('checkbox', { name: /I agree to the Terms of Use/ }).check()
  await page.getByRole('checkbox', { name: /I confirm that I am at least 18/ }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: /^Create account$/i }).click()
  await page.waitForURL(/dashboard/)
  return user
}

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await registerFreshUser(page)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page)
  },
})

export { expect } from '@playwright/test'
