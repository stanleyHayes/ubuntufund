const { withAppBuildGradle } = require('expo/config-plugins')

// Android NDK r27 needs both flags: LOAD alignment alone does not align RELRO.
// This applies to libraries built by the app's CMake invocation, not prebuilt AARs.
const marker = '// Ujimora: 16 KB app CMake linker alignment'
const block = `
${marker}
android {
  defaultConfig {
    externalNativeBuild {
      cmake {
        arguments "-DCMAKE_SHARED_LINKER_FLAGS=-Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384"
      }
    }
  }
}
`
module.exports = function withAndroidPageAlignment(config) {
  return withAppBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') throw new Error('Ujimora page alignment requires the generated Groovy app build file')
    if (!mod.modResults.contents.includes(marker)) mod.modResults.contents += block
    return mod
  })
}
