import { Checkbox, FormControlLabel, Stack, Typography } from '@mui/material'
export function PublicationConsent({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <Stack spacing={0.5}>
    <FormControlLabel control={<Checkbox checked={value} onChange={e => onChange(e.target.checked)} />} label="Use OpenAI to check this public text for safety (optional)" />
    <Typography variant="caption" color="text.secondary">Only this proposed public text is shared for automated screening. Without permission, staff review it. Flagged text and attached media need staff review. Check Settings → Publication reviews for decisions.</Typography>
  </Stack>
}
