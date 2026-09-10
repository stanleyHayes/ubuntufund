import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Text } from 'react-native-paper'
import { api } from '@/lib/api'
import { Button } from './Loading'
import { SelectionField } from './SelectionField'
import { CampaignCashout } from './CampaignCashout'
export function PayoutAccounts() {
  const [campaigns, setCampaigns] = useState<{ id: string; title: string }[]>([])
  const [id, setId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    api
      .get<{ id: string; title: string }[]>('/campaigns/mine')
      .then((c) => {
        if (active) {
          setCampaigns(c)
          setError('')
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [retry])
  return (
    <View style={{ padding: 20, gap: 16 }}>
      <Text variant="titleLarge">Payout accounts</Text>
      <Text>
        Each campaign has its own bank or MoMo payout account. Choose a campaign to set it up or
        review it.
      </Text>
      {loading && <Text>Loading campaigns…</Text>}
      {error && (
        <>
          <Text accessibilityRole="alert">{error}</Text>
          <Button
            onPress={() => {
              setLoading(true)
              setRetry((r) => r + 1)
            }}
          >
            Retry
          </Button>
        </>
      )}
      {!loading && !error && !campaigns.length && (
        <Text>Create a campaign to set up its payout account.</Text>
      )}
      {campaigns.length > 0 && (
        <SelectionField
          label="Campaign"
          value={id}
          onChange={setId}
          options={campaigns.map((c) => ({ value: c.id, label: c.title }))}
        />
      )}{' '}
      {id && <CampaignCashout key={id} campaignId={id} />}
    </View>
  )
}
