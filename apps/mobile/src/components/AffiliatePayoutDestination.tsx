import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from 'react-native-paper'
import { router } from 'expo-router'
import { payoutInstitutionName, type Affiliate } from '@ubuntu-fund/types'
import { Button } from './Loading'
import {
  affiliateDestinationChoices,
  listSavedPayoutAccounts,
  setAffiliatePayoutRecipient,
  type SavedPayoutAccountSummary,
} from '@/lib/affiliate'

/**
 * Where affiliate payouts go. Requesting a payout needs a destination, and
 * only a saved account whose provider-held name matched can be chosen.
 */
export function AffiliatePayoutDestination({
  affiliate,
  onSaved,
  color,
}: {
  affiliate: Pick<Affiliate, 'recipientCode' | 'accountName' | 'bankCode' | 'accountNumber'>
  onSaved: () => void
  color: { text: string; muted: string; accent: string; error: string }
}) {
  const hasDestination = Boolean(affiliate.recipientCode)
  const [editing, setEditing] = useState(!hasDestination)
  const [accounts, setAccounts] = useState<SavedPayoutAccountSummary[] | null>(null)
  const [choice, setChoice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!editing) return
    let active = true
    listSavedPayoutAccounts()
      .then((list) => {
        if (!active) return
        setAccounts(list)
        setChoice((current) => current || affiliateDestinationChoices(list).selectable[0]?.id || '')
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load your payout accounts.')
      })
    return () => {
      active = false
    }
  }, [editing])

  async function save() {
    setSaving(true)
    setError('')
    try {
      await setAffiliatePayoutRecipient(choice)
      setEditing(false)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your payout destination.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing)
    return (
      <View style={{ marginTop: 8 }}>
        <Text style={{ color: color.muted, fontSize: 13 }}>
          Payouts go to {affiliate.accountName} · {payoutInstitutionName(affiliate.bankCode ?? '', affiliate.bankCode ?? '')} · ••
          {(affiliate.accountNumber ?? '').slice(-4)}
        </Text>
        <Button compact onPress={() => setEditing(true)}>Change payout destination</Button>
      </View>
    )

  const { selectable, blocked } = affiliateDestinationChoices(accounts ?? [])
  return (
    <View style={{ marginTop: 8, gap: 6 }} accessibilityLabel="Payout destination">
      <Text style={{ color: color.text, fontWeight: '700' }}>Payout destination</Text>
      {accounts && selectable.length === 0 ? (
        <Text style={{ color: color.muted, fontSize: 13 }}>
          Add a bank or mobile-money account whose name matches the account holder, then choose it here.
        </Text>
      ) : null}
      {selectable.map((a) => (
        <Pressable
          key={a.id}
          accessibilityRole="radio"
          accessibilityState={{ checked: choice === a.id }}
          onPress={() => setChoice(a.id)}
          style={{ paddingVertical: 6 }}
        >
          <Text style={{ color: choice === a.id ? color.accent : color.text }}>
            {choice === a.id ? '● ' : '○ '}
            {a.accountName} · {payoutInstitutionName(a.bankCode, a.bankCode)} · {a.last4}
          </Text>
        </Pressable>
      ))}
      {blocked.map((a) => (
        <Text key={a.id} style={{ color: color.muted, fontSize: 12 }}>
          {a.accountName} · {a.last4} — name not matched, cannot receive payouts
        </Text>
      ))}
      {error ? <Text accessibilityRole="alert" style={{ color: color.error }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button mode="outlined" disabled={!choice || saving} loading={saving} onPress={() => void save()}>
          Use this account
        </Button>
        {hasDestination ? <Button onPress={() => setEditing(false)}>Cancel</Button> : null}
        <Button onPress={() => router.push('/payout-accounts')}>Add or manage accounts</Button>
      </View>
    </View>
  )
}
