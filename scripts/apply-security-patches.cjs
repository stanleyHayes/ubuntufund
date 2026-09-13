const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')

for (const [name, expectedVersion] of [['decode-uri-component', '0.2.2'], ['image-size', '1.2.1']]) {
  let manifest
  try { manifest = require.resolve(`${name}/package.json`, { paths: [root] }) }
  catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') continue // API-only installs may omit mobile tooling.
    throw error
  }
  const version = JSON.parse(fs.readFileSync(manifest, 'utf8')).version
  if (version !== expectedVersion) throw new Error(`Review the ${name} security patch before installing ${version}; expected ${expectedVersion}.`)
  const bin = path.join(path.dirname(require.resolve('patch-package/package.json')), 'index.js')
  execFileSync(process.execPath, [bin, '--error-on-fail', '--patch-dir', `patches/${name}`], { cwd: root, stdio: 'inherit' })
}
