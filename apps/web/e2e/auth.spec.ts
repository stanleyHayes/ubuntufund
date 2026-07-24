import { randomUUID } from 'crypto'
import { test, expect, registerFreshUser } from './fixtures'

test.describe('Authentication', () => {
  test('user can register through the UI', async ({ page }) => {
    await registerFreshUser(page)
    await expect(page).toHaveURL(/dashboard/)
  })

  test('user can log in with existing credentials', async ({ page }) => {
    const email = `e2e-login-${randomUUID()}@example.com`
    const password = 'E2ePassword123!'
    // Provision the account through the API (via the dev-server proxy).
    const res = await page.request.post('/api/v1/auth/register', {
      data: { email, password, name: 'Login Tester' },
    })
    expect(res.status()).toBe(201)

    await page.goto('/login')
    await page.getByLabel(/^Email/).fill(email)
    await page.getByLabel(/^Password/).fill(password)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page).toHaveURL(/dashboard/)
  })

  test('wrong password shows an error and stays on the login page', async ({ page }) => {
    const email = `e2e-wrongpw-${randomUUID()}@example.com`
    await page.request.post('/api/v1/auth/register', {
      data: { email, password: 'E2ePassword123!', name: 'Wrong PW Tester' },
    })

    await page.goto('/login')
    await page.getByLabel(/^Email/).fill(email)
    await page.getByLabel(/^Password/).fill('not-the-password')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/login/)
  })
})
