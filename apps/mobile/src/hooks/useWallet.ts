import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import type { Transaction, Wallet } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

const list = <T,>(value: T[] | { items?: T[] }) => Array.isArray(value) ? value : value.items ?? []

/**
 * Wallets and recent activity for the signed-in user. Reloads whenever the
 * Wallet tab regains focus or the app returns to the foreground while it is
 * focused, so a top-up finished on the website (iOS) or in a checkout tab
 * shows up without restarting the app. A failed reload keeps the last
 * loaded data and clears the error once a later reload succeeds.
 */
export function useWallet(userId: string | undefined) {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [revision, setRevision] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedOnce = useRef(false)
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
        setWallets(list(walletData))
        setTransactions(list(transactionData))
        setError(null)
        setLoaded(true)
        loadedOnce.current = true
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load wallet')
      })
      .finally(() => {
        if (!cancelled) { setIsLoading(false); setRefreshing(false) }
      })
    return () => { cancelled = true }
  }, [userId, revision])

  useFocusEffect(useCallback(() => {
    // The first focus is covered by the initial load above.
    if (loadedOnce.current) reload()
    const subscription = AppState.addEventListener('change', state => { if (state === 'active' && loadedOnce.current) reload() })
    return () => subscription.remove()
  }, [reload]))

  return { wallets, transactions, isLoading, refreshing, loaded, error, reload, refresh }
}
