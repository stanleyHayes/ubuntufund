const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins')

// An unavailable push feature must not rely only on the absence of JS token
// requests. Firebase documents both values as necessary to disable auto-init.
module.exports = function withDisabledPushAutoInit(config) {
  return withAndroidManifest(config, mod => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults)
    for (const name of ['firebase_messaging_auto_init_enabled', 'firebase_analytics_collection_enabled']) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(application, name, 'false')
    }
    return mod
  })
}
