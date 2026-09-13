const { test } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')

// Vulnerable parsers can block the event loop. Each fixture runs in a killable
// child so a missing postinstall patch fails the check instead of hanging CI.
function isolated(source) {
  const result = spawnSync(process.execPath, ['-e', source], { cwd: require('node:path').resolve(__dirname, '..'), timeout: 5000, encoding: 'utf8' })
  assert.equal(result.status, 0, `${result.error?.message ?? ''}\n${result.stderr}`)
}

test('native query parsing handles malformed UTF-8 without recursive decoding and retains valid links', () => isolated(`
  const assert = require('node:assert/strict');
  const fromQuery = require('node:module').createRequire(require.resolve('query-string/package.json'));
  const decode = fromQuery('decode-uri-component');
  assert.equal(decode('%C3%A9+Accra'), 'é Accra');
  assert.equal(decode('%E0%A4%A'), '%E0%A4%A');
  assert.equal(decode('%C0%80%41'.repeat(20000)), '%C0%80A'.repeat(20000));
  const query = require('query-string');
  assert.deepEqual({...query.parse('campaign=community%20garden&name=Kojo+Mensah&tag=a&tag=b')}, {campaign:'community garden',name:'Kojo Mensah',tag:['a','b']});
`))

test('the Metro image parser rejects zero/undersized ICNS entries and ISO boxes', () => isolated(`
  const assert = require('node:assert/strict');
  const fromMetro = require('node:module').createRequire(require.resolve('metro/package.json'));
  const size = fromMetro('image-size');
  for (const length of [0, 1, 7]) {
    const icns = Buffer.alloc(16); icns.write('icns'); icns.writeUInt32BE(16, 4); icns.write('ic07', 8); icns.writeUInt32BE(length, 12);
    assert.throws(() => size(icns), /ICNS entry length/);
    const jxl = Buffer.alloc(20); jxl.writeUInt32BE(length); jxl.write('JXL ', 4);
    assert.throws(() => size(jxl));
    const heif = Buffer.alloc(24); heif.writeUInt32BE(16); heif.write('ftyp',4); heif.write('heic',8); heif.writeUInt32BE(length,16); heif.write('meta',20);
    assert.throws(() => size(heif));
  }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP4sAAAAASUVORK5CYII=', 'base64');
  assert.deepEqual(size(png), {height:1,width:1,type:'png'});
`))

test('the patched UUID dependency preserves Xcode project identifier generation', () => isolated(`
  const assert = require('node:assert/strict');
  const fromXcode = require('node:module').createRequire(require.resolve('xcode/package.json'));
  assert.equal(fromXcode('uuid/package.json').version, '11.1.1');
  const project = require('xcode').project('unused-test-project.pbxproj');
  project.hash = {project:{objects:{}}};
  const a=project.generateUuid(), b=project.generateUuid();
  assert.match(a, /^[0-9A-F]{24}$/); assert.notEqual(a,b);
`))

test('Express resolves the patched query-string parser', () => isolated(`
  const assert = require('node:assert/strict');
  const fromApi = require('node:module').createRequire(require('node:path').resolve('apps/api/package.json'));
  const fromExpress = require('node:module').createRequire(fromApi.resolve('express/package.json'));
  assert.equal(fromExpress('qs/package.json').version, '6.16.0');
  assert.deepEqual(fromExpress('qs').parse('name=Kojo+Mensah&tags[]=a&tags[]=b'), {name:'Kojo Mensah',tags:['a','b']});
`))

test('ExcelJS resolves bounded UUID operations and still generates identifiers', () => isolated(`
  const assert = require('node:assert/strict');
  const fromExcel = require('node:module').createRequire(require.resolve('exceljs/package.json'));
  const uuid = fromExcel('uuid');
  assert.equal(fromExcel('uuid/package.json').version, '11.1.1');
  assert.match(uuid.v4(), /^[a-f0-9-]{36}$/);
  for (const fn of [uuid.v3, uuid.v5]) assert.throws(() => fn('export', uuid.v4(), Buffer.alloc(1)));
`))

 test('build tooling resolves the patched esbuild release', () => isolated(`
  const assert = require('node:assert/strict');
  const esbuild = require('esbuild');
  assert.equal(esbuild.version, '0.28.1');
  assert.match(esbuild.transformSync('const answer: number = 42', {loader:'ts'}).code, /answer = 42/);
`))
