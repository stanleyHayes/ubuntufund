import { useId, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton, { type IconButtonProps } from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import { FIELD_HELP_DISMISS_LABEL, FIELD_HELP_EXAMPLES_LABEL, fieldHelpLabel, type FieldHelpContent } from '@ubuntu-fund/types'

export interface FieldHelpProps {
  /** What to explain. The copy lives in @ubuntu-fund/types so the app and the website say the same thing. */
  help: FieldHelpContent
  /** 'end' inside a text field's end adornment, so the button lines up with the field's edge. */
  edge?: IconButtonProps['edge']
}

/**
 * A field's help button. Hovering or keyboard-focusing it shows the one-line
 * summary; clicking it opens a popup with the full explanation. It is a plain
 * button (type="button"), so it never submits the form it sits in.
 */
export function FieldHelp({ help, edge = false }: FieldHelpProps) {
  const [open, setOpen] = useState(false)
  const [tooltip, setTooltip] = useState(false)
  const descriptionId = useId()
  const examplesId = useId()
  return (
    <>
      {/* Controlled so the tooltip never shows over its own popup. */}
      <Tooltip title={help.summary} arrow describeChild open={tooltip && !open} onOpen={() => setTooltip(true)} onClose={() => setTooltip(false)}>
        <IconButton
          type="button"
          size="small"
          edge={edge}
          aria-label={fieldHelpLabel(help)}
          aria-haspopup="dialog"
          onClick={() => { setTooltip(false); setOpen(true) }}
          sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
        >
          <HelpOutlineRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth aria-describedby={descriptionId}>
        <DialogTitle sx={{ fontWeight: 700 }}>{help.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Stack id={descriptionId} spacing={1.5}>
              {help.body.map(paragraph => <DialogContentText key={paragraph}>{paragraph}</DialogContentText>)}
            </Stack>
            {help.examples && help.examples.length > 0 && (
              <Box>
                <Typography id={examplesId} variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>{FIELD_HELP_EXAMPLES_LABEL}</Typography>
                <Box component="ul" aria-labelledby={examplesId} sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.5 }}>
                  {help.examples.map(example => <Typography key={example} component="li" variant="body2" color="text.secondary">{example}</Typography>)}
                </Box>
              </Box>
            )}
            {help.note && <DialogContentText>{help.note}</DialogContentText>}
            {help.footnote && <Typography component="p" variant="caption" color="text.secondary">{help.footnote}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>{FIELD_HELP_DISMISS_LABEL}</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
