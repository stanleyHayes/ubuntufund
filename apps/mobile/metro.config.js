const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname

// Expo detects npm workspaces and supplies the required monorepo watch and
// resolver defaults. Keeping those defaults intact is required for doctor and
// avoids stale hand-maintained Metro paths.
module.exports = getDefaultConfig(projectRoot)
