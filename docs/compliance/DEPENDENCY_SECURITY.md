# Dependency security checkpoint — 12 September 2026

Status: dependency mitigation checkpoint verified; not a clean upstream audit or
store release approval. This is part of C18 in `READINESS.md`.

## Changes

- All application test runners and matching coverage packages use Vitest
  `^4.1.11`; the lockfile resolves 4.1.11. This removes the older API Vitest 2
  installation and its critical advisory. See the
  [Vitest security advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9).
- Compatible dependency updates remove vulnerable browser-data, XML/YAML and
  filesystem packages. Expo remains on the 55 release line.
- Root overrides pin Express query parsing to `qs@6.16.0`, Xcode project ID
  generation to CommonJS-compatible `uuid@11.1.1`, and build tooling to
  `esbuild@0.28.1`. The latter addresses the
  [Windows development-server advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-g7r4-m6w7-qqqr).
- The two exact-version patches described in `../../patches/README.md` address
  malformed-input denial of service in native URL decoding and image parsing.
  They apply at install time and are exercised through their actual consumers.
- npm 12.0.2 is pinned for CI and Render's lockfile install. The Node engine range
  matches that npm release. Older npm versions were observed leaving stale
  dependency versions under workspace links despite root overrides; the resolved
  versions, not just manifest declarations, are checked. npm's
  [workspace override fix](https://github.com/npm/cli/pull/9671) describes the
  underlying propagation issue.

## Verification and remaining work

Five targeted checks pass locally: malformed UTF-8 decoding, malformed
ICNS/JXL/HEIF rejection, ordinary PNG parsing, Xcode identifier generation,
Express parsing and esbuild TypeScript transformation. (The image checks share
one test.) Each potentially blocking parser fixture runs in a killable process.
CI runs these checks after `npm ci`.

The stable full monorepo audit after all updates reports nine affected package
entries: five moderate and four high; none low or critical. These entries are the
two patched packages and their dependents, which audit identifies by upstream
version. Local mitigations do not mean zero vulnerabilities.

The 18 type/lint/build tasks pass. UI suites pass: web 118, admin 32, marketing 8,
native 42 tests. Android/iOS/web native asset exports pass. The broader web run
exposed two old fixtures lacking the guest auth context now required by safety
controls and a report-dialog transition timing assertion; corrected fixtures pass.
The marketing sitemap now includes the public account-deletion resource.

An isolated clean install applied both patches and passed all five security
checks. The full API run completed with 796 passes and three older fixture failures
(missing required public-message consent); the corrected two files and consent
regression suite pass all 16 tests. This is full-run-plus-focused evidence, not a
claim that the original full invocation passed. Later logging changes have
separate focused verification and require the final release sweep. Clean installs must include the committed `.npmrc` (`legacy-peer-deps=true`); the existing
TypeScript 6 / typescript-eslint peer-range mismatch remains compatibility debt,
not a new security finding or a reason to skip type/lint checks. The isolated
install copies manifests, lockfile, npm configuration, scripts and patches only;
it includes no application credentials or user data.

npm 12 blocks unlisted dependency lifecycle scripts. The repository allows only
`esbuild@0.28.1` and explicitly denies `fsevents` scripts; its shipped macOS
binary loads without rebuilding. The reviewed esbuild installer rebuild and
transform check pass. The final lockfile and allowlist pass a clean install and all five consumer
security checks. Expo SDK package ranges/patches are aligned, navigation is
deduplicated, Expo Doctor passes 20/20, native tests pass 42, native type/lint pass,
and Android/iOS/web export passes after the final alignment.
See [npm install-script policy](https://docs.npmjs.com/cli/v12/commands/npm-install-scripts/).

Replace local backports when compatible upstream fixes are released. Signed
store artifacts, Android 16 KB native-library evidence, physical-device tests,
SDK privacy declarations and operational vulnerability monitoring remain separate
release requirements.

## Admin export dependencies — 12 September 2026

PDF generation uses pdfmake 0.3.11 and spreadsheets use ExcelJS 4.4.0, loaded
on demand. ExcelJS's installed UUID dependency is overridden to 11.1.1; the
consumer check verifies v4 generation and bounded v3/v5 output buffers. The
ExcelJS prebuilt browser bundle was not rebuilt: it includes its legacy UUID
helper for conditional-formatting IDs. This export path does not accept workbook
uploads or expose those UUID APIs/conditional-formatting rules. The override is
not a claim that every embedded upstream dependency has been patched.

The final audit remains at the earlier nine affected package entries (five
moderate, four high, no critical), attributable to the two locally patched
parser chains described above. A fresh isolated install from the current
manifest/lockfile/configuration applies both patches and passes all six consumer
checks. Running npm from the isolated directory was necessary: the initial
`npm ci --prefix` invocation from the source workspace failed workspace/lockfile
validation without installing. No application credentials or user data were
copied. Admin XLSX roundtrip, browser downloads, type/lint and production build
checks pass after the dependency change.

## Current dependency checkpoint — 13 September 2026

Fresh `npm audit --omit=dev --json` on d6b3a05 reports the same9 affected package entries (5moderate,4high,0critical). The6 actual-consumer security tests all pass. Registry latest versions remain image-size2.0.2 and decode-uri-component0.5.0; the latter is already the source of the documented CommonJS backport, not a newly adopted dependency. No downgrade or unsupported major override was introduced. Logs: `/tmp/ujimora-current-production-audit.json`, `/tmp/ujimora-current-security-checks.log`. This refresh verifies the local mitigation checks, not removal of upstream advisories or store approval.
