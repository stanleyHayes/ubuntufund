const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins')

// KYC uses a one-shot foreground fix and reverse geocoding, not persistent
// location tasks. Remove the transitive background-task service at merge time.
module.exports = function withForegroundLocationOnly(config) {
  return withAndroidManifest(config, mod => {
    const manifest = mod.modResults.manifest
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools'
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults)
    const serviceName = 'expo.modules.location.services.LocationTaskService'
    application.service = (application.service || []).filter(service => service.$['android:name'] !== serviceName)
    application.service.push({ $: { 'android:name': serviceName, 'tools:node': 'remove' } })
    return mod
  })
}
