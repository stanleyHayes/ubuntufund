import { useId, useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LayersRoundedIcon from '@mui/icons-material/LayersRounded'
import BubbleChartRoundedIcon from '@mui/icons-material/BubbleChartRounded'
import FilterNoneRoundedIcon from '@mui/icons-material/FilterNoneRounded'
import CropSquareRoundedIcon from '@mui/icons-material/CropSquareRounded'
import { SHAPE, THEME_SKINS, type ThemeSkin } from '@ubuntu-fund/ui'
import { useColorMode } from '@/context/ColorModeContext'

const styleDetails = {
  neumorphism: { icon: LayersRoundedIcon, description: 'Soft relief and gently embossed surfaces.' },
  claymorphism: { icon: BubbleChartRoundedIcon, description: 'Rounded shapes with a playful, sculpted feel.' },
  glassmorphism: { icon: FilterNoneRoundedIcon, description: 'Translucent layers with a frosted finish.' },
  minimal: { icon: CropSquareRoundedIcon, description: 'Clean lines and quiet, simple surfaces.' },
}

function StyleWatermark({ skin }: { skin: ThemeSkin }) {
  return <Box component="svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false"
    sx={{ position: 'absolute', width: 106, height: 106, right: -22, top: -12, color: 'currentColor', opacity: 0.1, pointerEvents: 'none', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
    {skin === 'neumorphism' && <><rect x="26" y="26" width="64" height="64" rx="18" transform="rotate(-20 58 58)" /><rect x="37" y="37" width="42" height="42" rx="12" transform="rotate(-20 58 58)" /><path d="M20 87c13 19 53 23 75-3" /></>}
    {skin === 'claymorphism' && <><rect x="20" y="27" width="66" height="66" rx="25" transform="rotate(-15 53 60)" fill="currentColor" fillOpacity=".25" /><circle cx="88" cy="28" r="17" /><circle cx="87" cy="93" r="10" /><path d="M33 47q5-13 21-13" strokeLinecap="round" /></>}
    {skin === 'glassmorphism' && <><rect x="15" y="35" width="61" height="61" rx="9" /><rect x="38" y="14" width="61" height="61" rx="9" fill="currentColor" fillOpacity=".3" /><path d="m48 50 26-26m-19 40 32-32" /></>}
    {skin === 'minimal' && <><rect x="25" y="25" width="68" height="68" rx="2" /><path d="M25 45h68M45 45v48M34 35h3m6 0h3m6 0h3" /><path d="M14 104h91" /></>}
  </Box>
}

/** Design style and color mode remain independent, immediately saved preferences. */
export default function ThemeMenu() {
  const { skin, setSkin, darkMode, setDarkMode } = useColorMode()
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const id = useId()
  return <>
    <Tooltip title="Appearance">
      <IconButton onClick={(event) => setAnchor(event.currentTarget)} aria-label="Change theme"
        aria-haspopup="dialog" aria-expanded={Boolean(anchor)} aria-controls={anchor ? id : undefined}
        size="small" sx={{ color: 'text.secondary' }}><PaletteRoundedIcon /></IconButton>
    </Tooltip>
    <Popover anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }} transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      marginThreshold={12}
      slotProps={{ paper: { role: 'dialog', id, 'aria-labelledby': `${id}-title`, sx: {
        mt: 1, p: 2, width: 440, maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box',
        borderRadius: SHAPE.card, bgcolor: 'background.paper', backgroundImage: 'none',
        border: '1px solid', borderColor: 'divider', boxShadow: 'var(--neu-raised)',
      } } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 2 }}>
        <Box><Typography id={`${id}-title`} variant="h6" sx={{ fontWeight: 800 }}>Appearance</Typography>
          <Typography variant="body2" color="text.secondary">Choose your look. Changes save automatically.</Typography></Box>
        <IconButton size="small" aria-label="Close appearance settings" onClick={() => setAnchor(null)}><CloseRoundedIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, mb: 2, bgcolor: 'action.hover', borderRadius: SHAPE.sm }}>
        <DarkModeRoundedIcon sx={{ color: 'primary.main', fontSize: 24 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}><Typography component="label" htmlFor={`${id}-dark`} sx={{ display: 'block', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer' }}>Dark mode</Typography>
          <Typography variant="caption" color="text.secondary">A softer palette for low-light spaces.</Typography></Box>
        <Switch id={`${id}-dark`} size="small" checked={darkMode} onChange={(_, checked) => setDarkMode(checked)} slotProps={{ input: { 'aria-label': 'Dark mode' } }} />
      </Box>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1, letterSpacing: '.12em', fontSize: '.65rem', fontWeight: 700 }}>Surface style</Typography>
      <Box role="group" aria-label="Surface style" sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.25, '@media (max-width: 359px)': { gridTemplateColumns: '1fr' } }}>
        {THEME_SKINS.map((option) => {
          const selected = skin === option.id
          const { icon: Icon, description } = styleDetails[option.id]
          return <ButtonBase key={option.id} aria-pressed={selected} onClick={() => setSkin(option.id)} sx={{
            position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left',
            minWidth: 0, minHeight: 148, p: 1.75, borderRadius: SHAPE.sm, color: 'text.primary',
            border: '1.5px solid', borderColor: selected ? 'secondary.main' : 'divider',
            bgcolor: selected ? 'action.selected' : 'background.paper',
            transition: 'border-color 160ms ease, background-color 160ms ease',
            '&:hover': { bgcolor: 'action.hover', borderColor: selected ? 'secondary.main' : 'primary.main' },
            '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2 },
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}>
            <StyleWatermark skin={option.id} />
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', mb: 1.5 }}>
              <Icon sx={{ fontSize: 24, color: selected ? 'secondary.main' : 'primary.main' }} />
              {selected && <CheckRoundedIcon sx={{ fontSize: 18, color: 'secondary.main' }} />}
            </Box>
            <Typography component="span" sx={{ position: 'relative', fontSize: '.9rem', fontWeight: 750, mb: .5, overflowWrap: 'anywhere' }}>{option.label}</Typography>
            <Typography component="span" sx={{ position: 'relative', fontSize: '.75rem', lineHeight: 1.5, color: 'text.secondary' }}>{description}</Typography>
          </ButtonBase>
        })}
      </Box>
    </Popover>
  </>
}
