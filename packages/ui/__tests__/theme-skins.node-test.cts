const { test } = require('node:test')
const assert = require('node:assert/strict')
const { getSkinVars, createUjimoraTheme, THEME_SKINS, NEUMORPHIC_FOREST_VARS } = require('../src/theme')

test('every finish supplies distinct surface geometry and dark-section shadows in both modes', () => {
  for (const dark of [false, true]) {
    const skins = THEME_SKINS.map(({ id }) => getSkinVars(id, dark))
    assert.equal(new Set(skins.map(vars => vars['--shape-card'])).size, 4)
    assert.equal(new Set(skins.map(vars => vars['--neu-raised'])).size, 4)
    assert.equal(new Set(skins.map(vars => vars['--forest-raised'])).size, 4)
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
