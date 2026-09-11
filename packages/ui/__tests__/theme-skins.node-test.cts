const { test } = require('node:test')
const assert = require('node:assert/strict')
const { getContrastRatio } = require('@mui/material/styles')
const {
  getSkinVars,
  createUjimoraTheme,
  getBrandTokens,
  THEME_SKINS,
  NEUMORPHIC_FOREST_VARS,
} = require('../src/theme.ts')

const MODES = ['light', 'dark'] as const

type SkinVars = Record<string, string>

/**
 * Glass surfaces are authored as rgba over the mode's opaque ground, and
 * getContrastRatio ignores alpha — measuring the raw token would score a 22%
 * white wash as if it were solid white. Compositing first keeps the number
 * honest for the one skin where paper and default genuinely differ.
 */
function flatten(color: string, behind: string): string {
  const rgba = color.match(/rgba?\(([^)]+)\)/)
  if (!rgba) return color
  const [r, g, b, a = '1'] = rgba[1].split(',').map((part: string) => Number(part.trim()))
  const alpha = Number(a)
  const base = behind.replace('#', '')
  const mix = (channel: number, offset: number) =>
    Math.round(channel * alpha + parseInt(base.slice(offset, offset + 2), 16) * (1 - alpha))
  const hex = (value: number) => value.toString(16).padStart(2, '0')
  return `#${hex(mix(r, 0))}${hex(mix(g, 2))}${hex(mix(b, 4))}`
}

test('every finish supplies distinct surface geometry and dark-section shadows in both modes', () => {
  for (const dark of [false, true]) {
    const skins: SkinVars[] = THEME_SKINS.map(({ id }: { id: string }) => getSkinVars(id, dark))
    assert.equal(new Set(skins.map((vars: SkinVars) => vars['--shape-card'])).size, 4)
    assert.equal(new Set(skins.map((vars: SkinVars) => vars['--neu-raised'])).size, 4)
    assert.equal(new Set(skins.map((vars: SkinVars) => vars['--forest-raised'])).size, 4)
    for (const vars of skins) {
      for (const key of ['raised', 'raised-hover', 'subtle', 'inset']) {
        assert.ok(vars[`--forest-${key}`])
        assert.equal(NEUMORPHIC_FOREST_VARS[`--neu-${key}`], `var(--forest-${key})`)
      }
    }
  }
})

test('theme palette and baseline agree with the selected finish, including after a mode switch', () => {
  for (const { id } of THEME_SKINS) for (const mode of ['light', 'dark']) {
    const vars = getSkinVars(id, mode === 'dark')
    const theme = createUjimoraTheme(mode, id)
    assert.equal(theme.palette.background.paper, vars['--neu-surface'])
    assert.equal(theme.components.MuiCssBaseline.styleOverrides[':root']['--neu-raised'], vars['--neu-raised'])
    assert.equal(theme.components.MuiCssBaseline.styleOverrides[':root']['--shape-card'], vars['--shape-card'])
    assert.equal(theme.components.MuiCssBaseline.styleOverrides.body.backgroundColor, theme.palette.background.default)
  }
})

test('interactive components inherit the selected shadows instead of frozen neumorphism', () => {
  const c = createUjimoraTheme('dark', 'claymorphism').components
  assert.match(c.MuiChip.styleOverrides.root['&.MuiChip-clickable:hover'].boxShadow, /var\(--neu-raised-hover\)/)
  assert.match(c.MuiOutlinedInput.styleOverrides.root['&.Mui-focused'].boxShadow, /var\(--neu-inset\)/)
  assert.match(c.MuiCard.styleOverrides.root.border, /var\(--neu-border/)
})

test('every text-grade tone clears AA on both grounds, in both modes, on every finish', () => {
  let checked = 0
  for (const mode of MODES) {
    const brand = getBrandTokens(mode === 'dark')
    for (const { id } of THEME_SKINS) {
      const theme = createUjimoraTheme(mode, id)
      const base = theme.palette.background.default
      // Components in this app paint on `paper`, not `default`. For glass the
      // two differ, so both are measured rather than assumed interchangeable.
      const grounds = [base, flatten(theme.palette.background.paper, base)]
      const tones = {
        'text.primary': brand.textPrimary,
        'text.secondary': brand.textSecondary,
        primary: brand.primary.text,
        secondary: brand.secondary.text,
        success: brand.success.text,
        warning: brand.warning.text,
        error: brand.error.text,
        info: brand.info.text,
      }
      for (const [name, tone] of Object.entries(tones)) {
        for (const ground of grounds) {
          const ratio = getContrastRatio(tone, ground)
          assert.ok(
            ratio >= 4.5,
            `${mode}/${id}: ${name} ${tone} on ${ground} is ${ratio.toFixed(2)}:1`,
          )
          checked += 1
        }
        // Disabled text is exempt from 1.4.3, but it still has to be findable.
        for (const ground of grounds) {
          const ratio = getContrastRatio(brand.textDisabled, ground)
          assert.ok(ratio >= 3, `${mode}/${id}: text.disabled on ${ground} is ${ratio.toFixed(2)}:1`)
        }
      }
    }
  }
  // A filtered or empty THEME_SKINS would otherwise pass vacuously.
  assert.equal(checked, MODES.length * THEME_SKINS.length * 8 * 2)
})

test('the keyboard focus ring stays locatable against every surface (WCAG 1.4.11)', () => {
  for (const mode of MODES) {
    const { focusRing } = getBrandTokens(mode === 'dark')
    for (const { id } of THEME_SKINS) {
      const theme = createUjimoraTheme(mode, id)
      const base = theme.palette.background.default
      for (const ground of [base, flatten(theme.palette.background.paper, base)]) {
        const ratio = getContrastRatio(focusRing, ground)
        assert.ok(ratio >= 3, `${mode}/${id}: focus ring on ${ground} is ${ratio.toFixed(2)}:1`)
      }
    }
  }
})

test('MUI derives Alert and Button hover tones from the ramp, so dark mode must brighten', () => {
  const brand = getBrandTokens(true)
  const theme = createUjimoraTheme('dark', 'neumorphism')
  const ground = theme.palette.background.default
  for (const name of ['primary', 'secondary', 'success', 'warning', 'error', 'info'] as const) {
    const ramp = brand[name]
    // `.light` feeds standard/outlined Alert text in dark mode and `.dark` feeds
    // contained-Button hover, so on a dark ground both have to sit at or above
    // `main` in luminance — never below it, which would darken on hover.
    assert.ok(
      getContrastRatio(ramp.light, ground) >= getContrastRatio(ramp.main, ground),
      `${name}.light (${ramp.light}) is dimmer than main (${ramp.main}) in dark mode`,
    )
    assert.ok(
      getContrastRatio(ramp.dark, ground) >= getContrastRatio(ramp.main, ground),
      `${name}.dark (${ramp.dark}) darkens on hover against a dark ground`,
    )
  }
})

test('palette, chip labels and --text-* custom properties all resolve to one value', () => {
  for (const mode of MODES) {
    const brand = getBrandTokens(mode === 'dark')
    const theme = createUjimoraTheme(mode, 'neumorphism')
    const chip = theme.components.MuiChip.styleOverrides.root
    const vars = theme.components.MuiCssBaseline.styleOverrides[':root']
    const pairs = [
      ['Primary', 'brand', brand.primary.text],
      ['Secondary', 'accent-gold', brand.secondary.text],
      ['Success', 'success', brand.success.text],
      ['Warning', 'warning', brand.warning.text],
      ['Error', 'error', brand.error.text],
      ['Info', 'info', brand.info.text],
    ] as const
    for (const [chipSuffix, varName, expected] of pairs) {
      assert.equal(chip[`&.MuiChip-color${chipSuffix}`].color, expected, `${mode} chip ${chipSuffix}`)
      if (varName !== 'accent-gold') {
        assert.equal(vars[`--text-${varName}`], expected, `${mode} --text-${varName}`)
      }
    }
    assert.equal(vars['--text-primary'], theme.palette.text.primary)
    assert.equal(vars['--text-secondary'], theme.palette.text.secondary)
    assert.equal(vars['--text-disabled'], theme.palette.text.disabled)
    assert.equal(vars['--focus-ring'], brand.focusRing)
  }
})
