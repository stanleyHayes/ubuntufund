import { describe, expect, it } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createAppConfigRoutes } from '../../../src/infrastructure/adapters/inbound/http/routes/appConfigRoutes.js'
import { DEFAULT_PLAY_STORE_URL, loadMobileAppConfig } from '../../../src/infrastructure/config/mobileApp.js'

describe('mobile app release policy', () => {
  it('has no minimum version by default, so no build is blocked', () => {
    expect(loadMobileAppConfig({})).toEqual({
      minSupportedVersion: { ios: null, android: null },
      storeUrls: { ios: null, android: DEFAULT_PLAY_STORE_URL },
    })
  })

  it('reads per-platform minimums and https store links', () => {
    const config = loadMobileAppConfig({
      MIN_APP_VERSION_IOS: ' 1.2.0 ', MIN_APP_VERSION_ANDROID: '1.3',
      APP_STORE_URL_IOS: 'https://apps.apple.com/app/id123456789', APP_STORE_URL_ANDROID: '',
    })
    expect(config.minSupportedVersion).toEqual({ ios: '1.2.0', android: '1.3' })
    expect(config.storeUrls).toEqual({ ios: 'https://apps.apple.com/app/id123456789', android: DEFAULT_PLAY_STORE_URL })
  })

  it('fails loudly at boot on a malformed version or a non-https store link', () => {
    expect(() => loadMobileAppConfig({ MIN_APP_VERSION_IOS: 'v1.2' })).toThrow('MIN_APP_VERSION_IOS')
    expect(() => loadMobileAppConfig({ MIN_APP_VERSION_ANDROID: '1.2.0-beta' })).toThrow('MIN_APP_VERSION_ANDROID')
    expect(() => loadMobileAppConfig({ APP_STORE_URL_IOS: 'http://apps.apple.com/app/id1' })).toThrow('https')
    expect(() => loadMobileAppConfig({ APP_STORE_URL_ANDROID: 'market://details?id=x' })).toThrow('https')
  })

  it('serves the policy publicly without authentication', async () => {
    const app = express()
    app.use('/api/v1/app', createAppConfigRoutes(loadMobileAppConfig({ MIN_APP_VERSION_ANDROID: '2.0.0' })))
    const res = await request(app).get('/api/v1/app/config')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({
      minSupportedVersion: { ios: null, android: '2.0.0' },
      storeUrls: { ios: null, android: DEFAULT_PLAY_STORE_URL },
    })
    expect(res.headers['cache-control']).toBe('public, max-age=300')
  })
})
