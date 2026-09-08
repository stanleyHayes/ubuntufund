import { Box, Button, Checkbox, FormControlLabel, TextField, Typography } from '@mui/material'
import type { CampaignCreationOptions } from '@/hooks/useCampaignCreationOptions'

export interface SplitRow { name: string; email: string; percent: string }
export function CampaignCreationExtras({ options, invitations, setInvitations, split, setSplit, rows, setRows }: {
  options: CampaignCreationOptions; invitations: string; setInvitations: (value: string) => void
  split: boolean; setSplit: (value: boolean) => void; rows: SplitRow[]; setRows: (value: SplitRow[]) => void
}) {
  return <Box sx={{ mt: 3, borderTop: '1px solid', borderColor: 'divider', pt: 3 }}>
    <Typography variant="h6">People & shared proceeds</Typography>
    {options.plan.campaignCollaboration ? <TextField fullWidth multiline minRows={2} label="Invite collaborators by email (optional)" value={invitations} onChange={e => setInvitations(e.target.value)} helperText={`Separate emails with commas. Invites are sent to existing Ujimora accounts as editors after creation. ${options.plan.maxCollaboratorsPerCampaign < 0 ? 'Unlimited collaborators.' : `Up to ${options.plan.maxCollaboratorsPerCampaign} collaborators.`}`} sx={{ mt: 2 }} /> : <Typography color="text.secondary" sx={{ mt: 2 }}>Your plan does not include collaborator invitations. <Button href="/subscription" size="small">Compare plans</Button></Typography>}
    <FormControlLabel sx={{ mt: 2 }} control={<Checkbox checked={split} disabled={!options.canSplit} onChange={e => setSplit(e.target.checked)} />} label="Set up split proceeds" />
    <Typography variant="body2" color="text.secondary">{!options.splitEnabled ? 'Split proceeds are not currently enabled.' : !options.canSplit ? 'Split proceeds require campaign collaboration and escrow support in your plan.' : 'Create a draft allocation. Every beneficiary must consent before a split can be activated; this does not transfer money.'}</Typography>
    {split && <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
      {rows.map((row, index) => <Box key={index} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1.2fr 100px' }, gap: 1 }}>
        {(['name', 'email', 'percent'] as const).map(field => <TextField key={field} label={`${field === 'percent' ? 'Share %' : field === 'email' ? 'Email' : 'Name'} ${index + 1}`} type={field === 'percent' ? 'number' : field === 'email' ? 'email' : 'text'} value={row[field]} onChange={e => setRows(rows.map((item, i) => i === index ? { ...item, [field]: e.target.value } : item))} />)}
        {rows.length > 2 && <Button onClick={() => setRows(rows.filter((_, i) => i !== index))}>Remove beneficiary {index + 1}</Button>}
      </Box>)}
      <Button disabled={rows.length >= 50} onClick={() => setRows([...rows, { name: '', email: '', percent: '' }])}>Add beneficiary</Button>
      <Typography variant="body2">Shares must total exactly 100%.</Typography>
    </Box>}
  </Box>
}
