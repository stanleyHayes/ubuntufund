import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import type { Transaction, Wallet } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

const list = <T,>(value: T[] | { items?: T[] }) => Array.isArray(value) ? value : value.items ?? []
const NO_WALLETS: Wallet[] = []
const NO_TRANSACTIONS: Transaction[] = []

/**
 * Wallets and recent activity for the signed-in user. Reloads whenever the
 * Wallet tab regains focus or the app returns to the foreground while it is
 * focused, so a top-up finished on the website (iOS) or in a checkout tab
 * shows up without restarting the app. A failed reload keeps the last
 * loaded data and clears the error once a later reload succeeds.
 *
 * Data and errors are tagged with the user they were loaded for. The tab can
 * stay mounted while one session ends (idle expiry, refresh failure) and
 * another account signs in, so nothing loaded for a previous user is ever
 * returned for the current one.
 */
export function useWallet(userId: string | undefined) {
  const [data, setData] = useState<{ userId: string; wallets: Wallet[]; transactions: Transaction[] } | null>(null)
  const [failure, setFailure] = useState<{ userId: string; message: string } | null>(null)
  const [settledFor, setSettledFor] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const loadedFor = useRef<string | null>(null)
  const reload = useCallback(() => setRevision(n => n + 1), [])
  const refresh = useCallback(() => { setRefreshing(true); setRevision(n => n + 1) }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    Promise.all([
      api.get<Wallet[] | { items: Wallet[] }>('/wallets'),
      api.get<Transaction[] | { items: Transaction[] }>('/wallets/transactions?limit=30'),
    ])
      .then(([walletData, transactionData]) => {
        if (cancelled) return
        setData({ userId, wallets: list(walletData), transactions: list(transactionData) })
        setFailure(null)
        loadedFor.current = userId
      })
      .catch((err: unknown) => {
        if (!cancelled) setFailure({ userId, message: err instanceof Error ? err.message : 'Failed to load wallet' })
      })
      .finally(() => {
        if (!cancelled) { setSettledFor(userId); setRefreshing(false) }
      })
    return () => { cancelled = true }
  }, [userId, revision])

  useFocusEffect(useCallback(() => {
    // The first focus (and a newly signed-in user) is covered by the load above.
    if (userId && loadedFor.current === userId) reload()
    const subscription = AppState.addEventListener('change', state => { if (state === 'active' && userId && loadedFor.current === userId) reload() })
    return () => subscription.remove()
  }, [reload, userId]))

  const current = userId && data?.userId === userId ? data : null
  return {
    wallets: current?.wallets ?? NO_WALLETS,
    transactions: current?.transactions ?? NO_TRANSACTIONS,
    isLoading: !userId || settledFor !== userId,
    refreshing,
    loaded: !!current,
    error: userId && failure?.userId === userId ? failure.message : null,
    reload,
    refresh,
  }
}
