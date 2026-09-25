import { test, expect } from '@playwright/test'

for (const width of [390, 1440])
  test(`focused settings retain drafts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(() => {
      localStorage.setItem(
        'uf_admin_user',
        JSON.stringify({
          id: 'settings-admin',
          name: 'Reviewer',
          email: 'review@example.test',
          role: 'admin',
        }),
      )
      localStorage.setItem(
        'uf_admin_tokens',
        JSON.stringify({ accessToken: 'test', refreshToken: 'test' }),
      )
      localStorage.setItem('uf_admin_token', 'test')
      localStorage.setItem('uf.admin.tourSeen.settings-admin', '1')
    })
    const writes: unknown[] = []
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      let data: unknown = []
      if (path.endsWith('/rbac/me'))
        data = { permissions: ['settings:read', 'settings:update'], roleName: 'Administrator' }
      else if (path.endsWith('/admin/commercial-config'))
        data = {
          resolved: {
            earlyFeePercent: 1,
            'affiliate.referralDiscountPercent': 5,
            'campaigns.autoApproveMaxTier': 3,
            'campaigns.tierThreshold1': 1000,
            'campaigns.tierThreshold2': 5000,
            'campaigns.tierThreshold3': 25000,
            'campaigns.tierThreshold4': 250000,
          },
        }
      else if (path.endsWith('/admin/automatic-payouts'))
        data = {
          enabled: false,
          maxAmount: 100,
          dailyOwnerLimit: 200,
          dailyPlatformLimit: 1000,
          reviewMaxAgeDays: 30,
          mobileMoneyMaxAmount: 100,
          mobileMoneyReviewMaxAgeHours: 24,
        }
      else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
      else if (path.endsWith('/admin/action-center')) data = { items: [] }
      if (route.request().method() === 'PUT') writes.push(route.request().postDataJSON())
      await route.fulfill({ json: { data } })
    })
    await page.goto('/settings')
    const surcharge = page.getByRole('spinbutton', { name: 'Additional early cashout (%)' })
    await expect(surcharge).toHaveValue('1')
    await surcharge.fill('2.5')
    await page.getByRole('tab', { name: 'Campaigns', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Campaign review', exact: true })).toBeVisible()
    await expect(surcharge).toBeHidden()
    await page.getByRole('tab', { name: 'Payments', exact: true }).click()
    await expect(surcharge).toHaveValue('2.5')
    await page.getByRole('button', { name: 'Save surcharge' }).click()
    await expect(page.getByText('Early cashout surcharge saved.', { exact: false })).toBeVisible()
    expect(writes).toContainEqual({
      value: 2.5,
      reason: 'Early cashout surcharge updated from platform settings',
    })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    await page.screenshot({ path: `/tmp/ujimora-settings-tabs-${width}.png`, fullPage: true })
    await page.getByRole('tab', { name: 'Appearance', exact: true }).click()
    // Switching mode re-themes the whole app; assert the settled state rather than
    // uncheck()'s immediate read, which races that re-render on slow runners.
    const darkMode = page.getByRole('switch', { name: 'Dark mode' })
    await darkMode.click()
    await expect(darkMode).not.toBeChecked()
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('uf_admin_color_mode')))
      .toBe('light')
    await expect(page).toHaveURL(/tab=appearance/)
  })
