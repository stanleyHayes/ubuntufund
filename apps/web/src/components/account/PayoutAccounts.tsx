import { useState } from 'react'
import { Alert, Box, Button, MenuItem, TextField, Typography } from '@mui/material'
import { useMyCampaigns } from '@/hooks/useCampaigns'
import { CampaignCashout } from '@/components/campaigns/CampaignCashout'
export function PayoutAccounts() {
  const { campaigns, isLoading, error } = useMyCampaigns()
  const [id, setId] = useState('')
  return (
    <Box sx={{ my: 3 }}>
      <Typography variant="h6">Payout accounts</Typography>
      <Typography>
        Choose a campaign to add or verify its bank or mobile-money account. Each campaign keeps its
        own payout destination.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {isLoading ? (
        <Typography>Loading campaigns…</Typography>
      ) : campaigns.length ? (
        <TextField
          select
          fullWidth
          label="Campaign"
          value={id}
          onChange={(e) => setId(e.target.value)}
          sx={{ mt: 2 }}
        >
          {campaigns.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.title}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <Button href="/campaigns/new">Create a campaign to set up payouts</Button>
      )}
      {id && <CampaignCashout key={id} campaignId={id} initiallyExpanded />}
    </Box>
  )
}
