import { Checkbox, FormControlLabel, Typography, Stack } from '@mui/material'
export function MessageAgreement({ checked, onChange, includeName = false, donation = false }: { checked: boolean; onChange: (checked: boolean) => void; includeName?: boolean; donation?: boolean }) {
  return <Stack sx={{ my: 2 }}>
    <FormControlLabel control={<Checkbox checked={checked} onChange={event => onChange(event.target.checked)} />} label={donation ? "I am at least 18 and agree to the Terms of Use for this donation." : includeName ? "I am at least 18 and agree to the terms for posting my public name and message." : "I am at least 18 and agree to the terms for posting this public message."} />
    <Typography variant="body2">Messages must follow our <a href="/terms" target="_blank" rel="noreferrer">Terms of Use</a>. Do not include private information, threats or abusive content.</Typography>
  </Stack>
}
