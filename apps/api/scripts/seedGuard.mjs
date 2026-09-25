// Seed scripts write fixture data with known passwords, and seed-dev wipes
// every campaign and donation. They take MONGODB_URI from the environment, so
// one exported production URI (apps/api/.env.production holds one locally)
// would do that to live data. Refuse anything that is not a local database.
//
// Hosts are parsed by hand: new URL() throws on the comma-separated host list
// of a replica-set URI.

export const REMOTE_OVERRIDE = 'I_UNDERSTAND_THIS_WIPES_DATA'
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

/** Why seeding `uri` must be refused, or null when it is a local database. */
export function seedTargetProblem(uri, env = process.env) {
  if (env.NODE_ENV === 'production') return 'NODE_ENV is production'
  const match = /^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri ?? '')
  if (!match) return 'MONGODB_URI is not a mongodb:// connection string'
  if (match[1]) return 'MONGODB_URI uses mongodb+srv:// (a hosted cluster)'
  const hosts = match[2].split(',').map((host) => {
    const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(host)
    return (bracketed ? bracketed[1] : host.replace(/:\d+$/, '')).toLowerCase()
  })
  const remote = hosts.filter((host) => !LOCAL_HOSTS.has(host))
  if (remote.length === 0) return null
  if (env.SEED_ALLOW_REMOTE === REMOTE_OVERRIDE) return null
  return `MONGODB_URI points at a non-local host (${remote.join(', ')})`
}

/** Exit before connecting when the target is not a local database. */
export function assertLocalSeedTarget(uri, scriptName, env = process.env) {
  const problem = seedTargetProblem(uri, env)
  if (!problem) return
  console.error(
    `${scriptName}: refusing to seed — ${problem}.\n` +
      'Seed scripts are for local databases only (127.0.0.1, localhost, ::1).\n' +
      `To seed a non-local, non-SRV, non-production database on purpose, set SEED_ALLOW_REMOTE=${REMOTE_OVERRIDE}.`
  )
  process.exit(1)
}
