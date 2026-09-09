const { withInfoPlist, withEntitlementsPlist, withXcodeProject, withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')
const plist = require('@expo/plist')
const targetName = 'UjimoraBroadcast'

module.exports = function withBroadcastExtension(config) {
  const bundleId = config.ios.bundleIdentifier
  const group = `group.${bundleId}.broadcast`
  const extensionId = `${bundleId}.broadcast`
  config.extra = { ...config.extra, eas: { ...config.extra?.eas, build: { ...config.extra?.eas?.build, experimental: { ...config.extra?.eas?.build?.experimental, ios: { ...config.extra?.eas?.build?.experimental?.ios, appExtensions: [
    ...(config.extra?.eas?.build?.experimental?.ios?.appExtensions || []).filter(item => item.targetName !== targetName),
    { targetName, bundleIdentifier: extensionId, entitlements: { 'com.apple.security.application-groups': [group] } },
  ] } } } } }
  config = withInfoPlist(config, mod => {
    mod.modResults.UIBackgroundModes = [...new Set([...(mod.modResults.UIBackgroundModes || []), 'audio'])]
    mod.modResults.RTCAppGroupIdentifier = group
    mod.modResults.RTCScreenSharingExtension = extensionId
    return mod
  })
  config = withEntitlementsPlist(config, mod => {
    mod.modResults['com.apple.security.application-groups'] = [...new Set([...(mod.modResults['com.apple.security.application-groups'] || []), group])]
    return mod
  })
  config = withDangerousMod(config, ['ios', async mod => {
    const destination = path.join(mod.modRequest.platformProjectRoot, targetName)
    fs.mkdirSync(destination, { recursive: true })
    for (const file of fs.readdirSync(path.join(__dirname, 'broadcast')).filter(file => file.endsWith('.swift'))) {
      const content = fs.readFileSync(path.join(__dirname, 'broadcast', file), 'utf8').replace('group.com.jitsi.example-screensharing.appgroup', group)
      fs.writeFileSync(path.join(destination, file), content)
    }
    fs.writeFileSync(path.join(destination, 'Info.plist'), plist.default.build({
      CFBundleDisplayName: 'Ujimora screen broadcast', CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
      CFBundleExecutable: '$(EXECUTABLE_NAME)', CFBundleName: '$(PRODUCT_NAME)', CFBundlePackageType: 'XPC!',
      CFBundleShortVersionString: '$(MARKETING_VERSION)', CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
      NSExtension: { NSExtensionPointIdentifier: 'com.apple.broadcast-services-upload', NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).SampleHandler', RPBroadcastProcessMode: 'RPBroadcastProcessModeSampleBuffer' },
    }))
    fs.writeFileSync(path.join(destination, `${targetName}.entitlements`), plist.default.build({ 'com.apple.security.application-groups': [group] }))
    return mod
  }])
  return withXcodeProject(config, mod => {
    const project = mod.modResults
    const exists = Object.values(project.pbxNativeTargetSection()).some(target => target && typeof target === 'object' && target.name?.replaceAll('"', '') === targetName)
    if (exists) return mod
    const target = project.addTarget(targetName, 'app_extension', targetName, extensionId)
    const files = fs.readdirSync(path.join(__dirname, 'broadcast')).filter(file => file.endsWith('.swift')).map(file => `${targetName}/${file}`)
    project.addBuildPhase(files, 'PBXSourcesBuildPhase', 'Sources', target.uuid)
    const sourceGroup = project.addPbxGroup(files, targetName, '.', '"SOURCE_ROOT"')
    project.addToPbxGroup(sourceGroup.uuid, project.getFirstProject().firstProject.mainGroup)
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid)
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid)
    const configurations = project.pbxXCBuildConfigurationSection()
    for (const configuration of Object.values(configurations)) {
      if (configuration?.buildSettings?.PRODUCT_NAME?.replaceAll('"', '') !== targetName) continue
      Object.assign(configuration.buildSettings, {
        INFOPLIST_FILE: `${targetName}/Info.plist`, CODE_SIGN_ENTITLEMENTS: `${targetName}/${targetName}.entitlements`,
        IPHONEOS_DEPLOYMENT_TARGET: '15.1', SWIFT_VERSION: '5.0', TARGETED_DEVICE_FAMILY: '"1,2"',
        APPLICATION_EXTENSION_API_ONLY: 'YES', GENERATE_INFOPLIST_FILE: 'NO',
        MARKETING_VERSION: config.version || '1.0.0', CURRENT_PROJECT_VERSION: config.ios.buildNumber || '1',
        CODE_SIGN_STYLE: 'Automatic',
      })
    }
    return mod
  })
}
