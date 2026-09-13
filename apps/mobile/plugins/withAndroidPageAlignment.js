const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins')

// Android NDK r27 needs both flags: LOAD alignment alone does not align RELRO.
// Covers app and Android-library CMake invocations, not prebuilt AAR binaries.
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
  config = withAppBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') throw new Error('Ujimora page alignment requires the generated Groovy app build file')
    if (!mod.modResults.contents.includes(marker)) mod.modResults.contents += block
    return mod
  })
  return withProjectBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') throw new Error('Ujimora page alignment requires the generated Groovy project build file')
    const dependencyMarker = '// Ujimora: 16 KB dependency CMake linker alignment'
    if (mod.modResults.contents.includes(dependencyMarker)) return mod
    const anchor = 'apply plugin: "expo-root-project"'
    if (!mod.modResults.contents.includes(anchor)) throw new Error('Cannot locate Expo project initialization for native page alignment')
    // Register before Expo/React Native configure dependency projects. A Java-only
    // library has no CMake path and does not gain a native build from arguments.
    const dependencyBlock = `${dependencyMarker}
subprojects { dependencyProject ->
  dependencyProject.pluginManager.withPlugin("com.android.library") {
    dependencyProject.android.defaultConfig.externalNativeBuild.cmake.arguments.add(
      "-DCMAKE_SHARED_LINKER_FLAGS=-Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384"
    )
  }
}
`
    mod.modResults.contents = mod.modResults.contents.replace(anchor, `${dependencyBlock}\n${anchor}`)
    return mod
  })
}
