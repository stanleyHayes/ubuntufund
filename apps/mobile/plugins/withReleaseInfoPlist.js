const { withInfoPlist } = require('expo/config-plugins')

// expo-dev-client adds a local-network prompt describing the Expo Dev Launcher.
// Release builds never run the launcher, so shipping that purpose string asks App
// Review about a capability the submitted app does not use. Development builds keep it.
function isReleaseBuild(env = process.env) {
  return env.EAS_BUILD_PROFILE === 'production' || env.UJIMORA_RELEASE === '1'
}

function stripDevLauncherKeys(plist) {
  delete plist.NSLocalNetworkUsageDescription
  if (Array.isArray(plist.NSBonjourServices)) {
    const services = plist.NSBonjourServices.filter(service => service !== '_expo._tcp')
    if (services.length) plist.NSBonjourServices = services
    else delete plist.NSBonjourServices
  }
  return plist
}

module.exports = function withReleaseInfoPlist(config) {
  return withInfoPlist(config, mod => {
    if (isReleaseBuild()) stripDevLauncherKeys(mod.modResults)
    return mod
  })
}
module.exports.isReleaseBuild = isReleaseBuild
module.exports.stripDevLauncherKeys = stripDevLauncherKeys
