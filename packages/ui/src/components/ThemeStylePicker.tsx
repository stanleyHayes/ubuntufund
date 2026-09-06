import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import LayersRoundedIcon from '@mui/icons-material/LayersRounded'
import BubbleChartRoundedIcon from '@mui/icons-material/BubbleChartRounded'
import FilterNoneRoundedIcon from '@mui/icons-material/FilterNoneRounded'
import CropSquareRoundedIcon from '@mui/icons-material/CropSquareRounded'
import { SHAPE, THEME_SKINS, getSkinVars, type ThemeSkin } from '../theme'

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

export function ThemeStylePicker({ value, onChange }: { value: ThemeSkin; onChange: (skin: ThemeSkin) => void }) {
  const theme = useTheme()
  return <Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
      <Box><Typography sx={{ fontWeight: 800 }}>Surface style</Typography>
        <Typography variant="body2" color="text.secondary">Choose a finish. Your selection applies and saves immediately.</Typography></Box>
      <Typography role="status" sx={{ color: 'primary.main', fontSize: '.75rem', fontWeight: 700 }}>{THEME_SKINS.find(s => s.id === value)?.label} selected</Typography>
    </Box>
    <Box role="group" aria-label="Surface style" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
      {THEME_SKINS.map(option => {
        const selected = value === option.id
        const { icon: Icon, description } = styleDetails[option.id]
        const preview = getSkinVars(option.id, theme.palette.mode === 'dark')
        return <ButtonBase key={option.id} onClick={() => onChange(option.id)} aria-pressed={selected} sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'stretch', minWidth: 0, textAlign: 'left', overflow: 'hidden',
          borderRadius: SHAPE.card, border: '1px solid', borderColor: selected ? 'secondary.main' : 'divider',
          bgcolor: selected ? 'action.selected' : 'background.paper', color: 'text.primary',
          '&:hover': { borderColor: 'primary.main' }, '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 3 },
        }}>
          <Box aria-hidden="true" sx={{ ...preview, position: 'relative', overflow: 'hidden', height: 106, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: theme.palette.mode === 'dark' ? 'linear-gradient(125deg, #29382B, #172019)' : 'linear-gradient(125deg, #ECE6DD, #F5F2EA)' }}>
            <StyleWatermark skin={option.id} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, width: 140, borderRadius: 'var(--shape-card)',
              bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised)', border: 'var(--neu-border)', backdropFilter: 'var(--neu-backdrop)' }}>
              <Icon sx={{ color: 'primary.main', fontSize: 28 }} />
              <Box sx={{ flex: 1 }}><Box sx={{ height: 5, width: '80%', bgcolor: 'text.primary', opacity: .45, borderRadius: 1, mb: .8 }} /><Box sx={{ height: 4, bgcolor: 'text.secondary', opacity: .25, borderRadius: 1 }} /></Box>
            </Box>
          </Box>
          <Box sx={{ p: 2, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: .75 }}><Icon sx={{ fontSize: 20, color: 'primary.main' }} />
              <Typography component="span" sx={{ fontWeight: 800, flex: 1 }}>{option.label}</Typography>
              {selected && <CheckRoundedIcon sx={{ color: 'secondary.main', fontSize: 20 }} />}</Box>
            <Typography component="span" sx={{ display: 'block', color: 'text.secondary', fontSize: '.8rem', lineHeight: 1.5 }}>{description}</Typography>
          </Box>
        </ButtonBase>
      })}
    </Box>
  </Box>
}
