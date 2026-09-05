import { useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Switch from '@mui/material/Switch'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import { THEME_SKINS } from '@ubuntu-fund/ui'
import { useColorMode } from '@/context/ColorModeContext'

/** Public-site theme control: pick a design skin + toggle dark mode. */
export default function ThemeMenu() {
  const { skin, setSkin, darkMode, setDarkMode } = useColorMode()
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)

  return (
    <>
      <Tooltip title="Theme">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Change theme" size="small" sx={{ color: 'text.secondary' }}>
          <PaletteRoundedIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        slotProps={{ paper: { sx: { mt: 1, width: 288, borderRadius: '4px 16px 4px 16px' } } }}
      >
        <MenuItem onClick={() => setDarkMode(!darkMode)}>
          <ListItemIcon><DarkModeRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Dark mode" />
          <Switch edge="end" size="small" checked={darkMode} />
        </MenuItem>
        <Divider />
        {THEME_SKINS.map((s) => (
          <MenuItem key={s.id} selected={skin === s.id} onClick={() => { setSkin(s.id); setAnchor(null) }} sx={{ alignItems: 'flex-start' }}>
            <ListItemIcon sx={{ mt: 0.5 }}>{skin === s.id ? <CheckRoundedIcon fontSize="small" color="secondary" /> : <Box sx={{ width: 20 }} />}</ListItemIcon>
            <ListItemText primary={s.label} secondary={s.blurb} secondaryTypographyProps={{ sx: { fontSize: '0.7rem', whiteSpace: 'normal' } }} />
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
