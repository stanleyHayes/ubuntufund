const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins')
const fs = require('node:fs/promises')
const path = require('node:path')

// Exclude app-local identity, checkout recovery and credential state from both
// cloud backup and device transfer, including device-protected storage domains.
const domains = ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref']
const exclusions = domains.map(domain => `    <exclude domain="${domain}" path="." />`).join('\n')
const backupRules = `<?xml version="1.0" encoding="utf-8"?>\n<full-backup-content>\n${exclusions}\n</full-backup-content>\n`
const extractionRules = `<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules>\n  <cloud-backup>\n${exclusions}\n  </cloud-backup>\n  <device-transfer>\n${exclusions}\n  </device-transfer>\n</data-extraction-rules>\n`

module.exports = function withPrivateBackupRules(config) {
  config = withAndroidManifest(config, mod => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults)
    application.$['android:allowBackup'] = 'false'
    application.$['android:fullBackupContent'] = '@xml/ujimora_backup_rules'
    application.$['android:dataExtractionRules'] = '@xml/ujimora_data_extraction_rules'
    return mod
  })
  return withDangerousMod(config, ['android', async mod => {
    const directory = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml')
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(path.join(directory, 'ujimora_backup_rules.xml'), backupRules)
    await fs.writeFile(path.join(directory, 'ujimora_data_extraction_rules.xml'), extractionRules)
    return mod
  }])
}
