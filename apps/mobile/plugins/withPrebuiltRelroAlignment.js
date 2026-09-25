const { withAppBuildGradle } = require('expo/config-plugins')

// Prebuilt AAR libraries cannot take linker flags, so their RELRO ends are aligned to
// 16 KB after stripping. See plugins/relro16k.gradle for the safety rules.
const marker = '// Ujimora: 16 KB RELRO alignment for prebuilt native libraries'
const line = `${marker}\napply from: new File(rootDir, "../plugins/relro16k.gradle")\n`

module.exports = function withPrebuiltRelroAlignment(config) {
  return withAppBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') throw new Error('Ujimora RELRO alignment requires the generated Groovy app build file')
    if (!mod.modResults.contents.includes(marker)) mod.modResults.contents += `\n${line}`
    return mod
  })
}
