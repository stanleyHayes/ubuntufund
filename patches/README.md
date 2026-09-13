# Dependency security patches

Root `postinstall` applies these exact-version patches through
`scripts/apply-security-patches.cjs`. CI runs `npm run test:dependency-security`
against the packages actually loaded by their consumers. Do not use
`--ignore-scripts` for release installs. A version change requires reviewing and
removing or regenerating its patch; installation fails if the version differs.

- `decode-uri-component@0.2.2`: backports the linear UTF-8 decoder from upstream
  npm `decode-uri-component@0.5.0`, retaining the older CommonJS export and plus
  handling required by `query-string@7`. The upstream MIT license is included in
  `LICENSE.decode-uri-component`. Addresses
  [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).
- `image-size@1.2.1`: rejects ICNS entries smaller than their header and ISO image
  boxes with incomplete headers, undersized lengths, or lengths beyond the input.
  These checks prevent loops on malformed ICNS/JXL/HEIF input. Addresses
  [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and
  [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq).
  Zero-to-EOF and extended-size ISO boxes are rejected by this limited parser;
  this patch does not add support for those formats. Ordinary PNG dimensions and
  the native asset build must continue to pass.

The patched packages retain their original version numbers. Package audit tools
therefore continue to report them and their dependents. This is a documented
local mitigation, not an upstream fix or a clean vulnerability audit. Replace
the patches with compatible upstream fixes when available. Keep malformed-input
tests in killable child processes so a regression cannot hang CI indefinitely.
