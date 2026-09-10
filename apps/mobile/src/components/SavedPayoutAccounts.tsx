import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Text } from 'react-native-paper'
import { api } from '@/lib/api'
import { Button, Skeleton } from './Loading'
import { BrandedTextInput as Input } from './BrandedTextInput'
import { SelectionField } from './SelectionField'
import { useNeu } from '@/context/ColorModeContext'
export type SavedAccount = {
  id: string
  type: string
  accountName: string
  last4: string
  bankCode: string
  verificationStatus: string
}
type Data = { planName: string; limit: number; accounts: SavedAccount[] }
export function SavedPayoutAccounts() {
  const neu = useNeu()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([])
  const [type, setType] = useState('mobile_money')
  const [bankCode, setBank] = useState('')
  const [accountName, setName] = useState('')
  const [accountNumber, setNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api
      .get<Data>('/payout-accounts')
      .then((d) => {
        if (active) {
          setData(d)
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
  useEffect(() => {
    let active = true
    api
      .get<{ name: string; code: string }[]>(`/banks?currency=GHS&type=${type}`)
      .then((d) => {
        if (active) setBanks(d)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [retry, type])
  async function save() {
    setBusy(true)
    setError('')
    try {
      setData(
        await api.post<Data>('/payout-accounts', { type, bankCode, accountName, accountNumber }),
      )
      setNumber('')
      setName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }
  async function remove(id: string) {
    setBusy(true)
    try {
      setData(await api.delete<Data>(`/payout-accounts/${id}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove')
    } finally {
      setBusy(false)
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <Text variant="headlineMedium">Payout accounts</Text>
      {error && <Text accessibilityRole="alert">{error}</Text>}
      {!data ? (
        loading && !error ? (
          <View
            accessibilityLabel="Loading payout accounts"
            accessibilityState={{ busy: true }}
            style={{ gap: 16 }}
          >
            <Skeleton width="55%" height={28} />
            <Skeleton height={130} />
            <Skeleton height={56} />
            <Skeleton height={56} />
            <Skeleton width="60%" height={44} />
          </View>
        ) : null
      ) : (
        <>
          <Text>
            {data.planName} · {data.accounts.length} / {data.limit < 0 ? 'Unlimited' : data.limit}{' '}
            saved
          </Text>
          {data.accounts.map((a) => (
            <View key={a.id} style={{ ...neu.raised, padding: 20, borderRadius: 20, gap: 8 }}>
              <Text variant="titleMedium">{a.accountName}</Text>
              <Text>
                {a.bankCode} · Ending {a.last4}
              </Text>
              <Text>
                {a.verificationStatus === 'name_matched'
                  ? 'Registered name matched'
                  : 'Needs beneficiary review'}
              </Text>
              <Button disabled={busy} onPress={() => void remove(a.id)}>
                Remove saved account
              </Button>
            </View>
          ))}
          {data.limit < 0 || data.accounts.length < data.limit ? (
            <>
              <SelectionField
                label="Account type"
                value={type}
                onChange={(v) => {
                  setType(v)
                  setBank('')
                }}
                options={[
                  { value: 'mobile_money', label: 'Mobile money' },
                  { value: 'ghipss', label: 'Bank account' },
                ]}
              />
              <SelectionField
                label="Bank or network"
                value={bankCode}
                onChange={setBank}
                options={banks.map((b) => ({ value: b.code, label: b.name }))}
              />
              <Input label="Registered account name" value={accountName} onChangeText={setName} />
              <Input
                label="Account or MoMo number"
                value={accountNumber}
                onChangeText={setNumber}
              />
              <Button
                mode="contained"
                loading={busy}
                disabled={busy || !bankCode || !accountName.trim() || !accountNumber.trim()}
                onPress={() => void save()}
              >
                Verify & save account
              </Button>
            </>
          ) : (
            <Text>
              You have used your plan’s saved-account allowance. Upgrade or remove an unused account
              to add another.
            </Text>
          )}
        </>
      )}
      <Text>
        Check your wallet limits with your network. Name verification cannot confirm available
        capacity. Removing a saved account does not redirect existing payouts. Never share your PIN.
      </Text>
      <Button onPress={() => setRetry((r) => r + 1)}>Refresh accounts</Button>
    </View>
  )
}
