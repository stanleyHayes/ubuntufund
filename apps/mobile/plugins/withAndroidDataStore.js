const { withProjectBuildGradle } = require('expo/config-plugins')

// Keep the family together: 1.2.1's actual ARM64/x86_64 native counter libraries
// pass LOAD and RELRO checks. This does not fix unrelated prebuilt dependencies.
const marker = '// Ujimora: verified DataStore 1.2.1 native libraries'
const block = `
${marker}
allprojects {
  configurations.configureEach {
    resolutionStrategy.eachDependency { dependency ->
      if (dependency.requested.group == "androidx.datastore") {
        dependency.useVersion("1.2.1")
        dependency.because("Keep DataStore modules aligned with the verified 16 KB native libraries")
      }
    }
  }
}
`

module.exports = function withAndroidDataStore(config) {
  return withProjectBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') throw new Error('Ujimora DataStore pin requires the generated Groovy project build file')
    if (!mod.modResults.contents.includes(marker)) mod.modResults.contents += block
    return mod
  })
}
