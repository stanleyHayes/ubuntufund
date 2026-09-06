import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, ScrollView, StyleSheet, Animated, Share } from 'react-native'
import { Text, Icon, Button, ActivityIndicator } from 'react-native-paper'
import { Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { SignInRequired } from '@/components/SignInRequired'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'
import {
  getAffiliateDashboard,
  enrollAffiliate,
  listAffiliateReferrals,
  listAffiliateCommissions,
  requestAffiliatePayout,
} from '@/lib/affiliate'
import type {
  AffiliateDashboard,
  AffiliateReferral,
  AffiliateReferralStatus,
  AffiliateCommission,
  AffiliateCommissionStatus,
} from '@ubuntu-fund/types'

// ---------------------------------------------------------------------------
// No shared currency formatter exists in apps/mobile/src (grepped for
// `formatCurrency`/`GHS` — nothing reusable turned up), so this inlines the
// same "GHS 12.34" wording the web page's formatCurrency(x, 'GHS') produces.
// ---------------------------------------------------------------------------
function formatGHS(amount: number) {
  return `GHS ${amount.toFixed(2)}`
}

function formatDate(value?: string | Date) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const REFERRAL_STATUS_LABEL: Record<AffiliateReferralStatus, string> = {
  pending: 'Pending',
  converted: 'Converted',
}

const COMMISSION_STATUS_LABEL: Record<AffiliateCommissionStatus, string> = {
  held: 'Held',
  available: 'Available',
  paid: 'Paid out',
  reversed: 'Reversed',
  cancelled: 'Cancelled',
}

// ─── Styles ──────────────────────────────────────────────────

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },

    sectionTitle: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: p.textSecondary, paddingHorizontal: 20, marginTop: 24, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },

    errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: `${p.error}1A` },
    errorBannerText: { flex: 1, fontSize: 13, fontFamily: 'Outfit_500Medium', color: p.error },
    errorState: { alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 32, padding: 24 },
    errorStateText: { fontSize: 14, fontFamily: 'Outfit_500Medium', color: p.textSecondary, textAlign: 'center' },
    errorRetryButton: { borderRadius: 999, marginTop: 4 },
    successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: `${p.success}1A` },
    successBannerText: { flex: 1, fontSize: 13, fontFamily: 'Outfit_500Medium', color: p.success },

    // Not-enrolled panel
    enrollCard: { ...neu.raised, marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 28, alignItems: 'center' },
    enrollIconTile: {
      width: 64,
      height: 64,
      borderTopLeftRadius: 10, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 10,
      backgroundColor: `${p.primary}1F`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    enrollTitle: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: p.text, textAlign: 'center' },
    enrollSubtitle: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 19 },
    enrollBtn: { marginTop: 20, borderRadius: 999, alignSelf: 'stretch' },
    enrollBtnContent: { paddingVertical: 6, minHeight: 44 },
    enrollBtnLabel: { fontFamily: 'Outfit_700Bold', fontSize: 15 },

    // Referral link card
    card: { ...neu.raised, marginHorizontal: 16, marginTop: 16, borderRadius: 14, padding: 16 },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    cardTitle: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: p.text },
    codeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: `${p.secondary}24` },
    codeBadgeText: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: p.secondaryDark },
    linkBox: { ...neu.inset, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingVertical: 12, paddingLeft: 14, paddingRight: 8 },
    linkText: { flex: 1, fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary },
    shareBtn: { marginTop: 14, borderRadius: 999 },
    shareBtnContent: { minHeight: 44 },
    shareBtnLabel: { fontFamily: 'Outfit_700Bold', fontSize: 14 },

    // Stat tiles (2x2 grid)
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginTop: 4, gap: 0 },
    statTile: { ...neu.raised, width: '46%', margin: '2%', borderRadius: 14, padding: 14 },
    statIconTile: { ...neu.subtle, width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    statValue: { fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: p.text },
    statLabel: { fontSize: 11, fontFamily: 'Outfit_500Medium', color: p.textSecondary, marginTop: 2 },

    // Payout card
    payoutLabel: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: p.text },
    payoutValue: { fontSize: 26, fontFamily: 'Outfit_800ExtraBold', color: p.primary, marginTop: 4, marginBottom: 16 },
    payoutBtn: { borderRadius: 999 },
    payoutBtnContent: { minHeight: 44 },
    payoutBtnLabel: { fontFamily: 'Outfit_700Bold', fontSize: 15 },
    payoutHint: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: p.textSecondary, textAlign: 'center', marginTop: 10 },

    // List panels
    listPanel: { ...neu.raised, marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 16 },
    listPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    listPanelTitle: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: p.text },
    countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: `${p.primary}1A` },
    countBadgeText: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: p.primary },
    emptyListText: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, paddingVertical: 16, textAlign: 'center' },
    listLoading: { paddingVertical: 20, alignItems: 'center' },

    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: p.border },
    rowLast: { borderBottomWidth: 0 },
    rowAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: `${p.primary}1A` },
    rowAvatarText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: p.primary },
    rowIconTile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${p.warning}1A` },
    rowBody: { flex: 1, minWidth: 0 },
    rowTopLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    rowTitle: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: p.text },
    rowAmount: { fontSize: 15, fontFamily: 'Outfit_800ExtraBold', color: p.primary },
    rowSubtitle: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 2 },

    statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, flexShrink: 0 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10, fontFamily: 'Outfit_700Bold' },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}

// ─── Status chip ─────────────────────────────────────────────

function StatusChip({ label, color }: { label: string; color: string }) {
  const styles = useStyles()
  return (
    <View style={[styles.statusChip, { backgroundColor: `${color}1F` }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>{label}</Text>
    </View>
  )
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonBlocks() {
  const p = usePalette()
  const [opacity] = useState(() => new Animated.Value(0.3))
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    ).start()
  }, [opacity])
  return (
    <Animated.View style={{ opacity, paddingHorizontal: 16, paddingTop: 16 }}>
      <View style={{ height: 96, backgroundColor: p.skeleton, borderRadius: 14, marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: '46%', margin: '2%', height: 84, backgroundColor: p.skeleton, borderRadius: 14 }} />
        ))}
      </View>
      <View style={{ height: 140, backgroundColor: p.skeleton, borderRadius: 14, marginTop: 4, marginBottom: 12 }} />
      <View style={{ height: 140, backgroundColor: p.skeleton, borderRadius: 14 }} />
    </Animated.View>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function AffiliateScreen() {
  const { user } = useAuth()
  const p = usePalette()
  const styles = useStyles()

  const [dashboard, setDashboard] = useState<AffiliateDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [enrolling, setEnrolling] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)

  const [referrals, setReferrals] = useState<AffiliateReferral[]>([])
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([])
  const [listsLoading, setListsLoading] = useState(false)

  const [payoutLoading, setPayoutLoading] = useState(false)
  const [payoutError, setPayoutError] = useState<string | null>(null)
  const [payoutSuccess, setPayoutSuccess] = useState(false)

  // Tracks mount so the auto-running fetch never applies a late response after
  // the user navigates away (matches the referrals/commissions effect's guard).
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAffiliateDashboard()
      if (mounted.current) setDashboard(data)
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load your affiliate dashboard')
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetchDashboard()
  }, [user, fetchDashboard])

  // Load the referral + commission ledgers once enrolled — re-runs whenever a
  // fresh `dashboard` object lands (initial load, post-enroll, post-payout),
  // exactly like the web page's Promise.all effect.
  useEffect(() => {
    if (!dashboard) {
      setReferrals([])
      setCommissions([])
      return
    }
    let cancelled = false
    setListsLoading(true)
    Promise.all([listAffiliateReferrals(), listAffiliateCommissions()])
      .then(([refs, comms]) => {
        if (cancelled) return
        setReferrals(refs)
        setCommissions(comms)
      })
      .catch(() => {
        if (!cancelled) {
          setReferrals([])
          setCommissions([])
        }
      })
      .finally(() => {
        if (!cancelled) setListsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dashboard])

  const handleEnroll = useCallback(async () => {
    setEnrolling(true)
    setEnrollError(null)
    try {
      await enrollAffiliate()
      await fetchDashboard()
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Could not enroll in the affiliate program. Please try again.')
    } finally {
      setEnrolling(false)
    }
  }, [fetchDashboard])

  const handleShare = useCallback(async () => {
    if (!dashboard) return
    try {
      await Share.share({ message: dashboard.referralLink })
    } catch {
      // User cancelled the share sheet, or the OS share failed — non-fatal.
    }
  }, [dashboard])

  const handleRequestPayout = useCallback(async () => {
    if (!dashboard) return
    const available = dashboard.stats.availableBalance
    if (available <= 0) return
    setPayoutLoading(true)
    setPayoutError(null)
    setPayoutSuccess(false)
    try {
      await requestAffiliatePayout(available)
      setPayoutSuccess(true)
      await fetchDashboard()
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'We could not request your payout. Please try again.')
    } finally {
      setPayoutLoading(false)
    }
  }, [dashboard, fetchDashboard])

  const headerOptions = {
    title: 'Affiliate',
    headerStyle: { backgroundColor: p.primary },
    headerTintColor: p.onPrimary,
    headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={headerOptions} />
        <SignInRequired what="the affiliate program" />
      </View>
    )
  }

  const canRequestPayout = !!dashboard && dashboard.stats.availableBalance > 0

  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <SkeletonBlocks />
        ) : error && !dashboard ? (
          <View style={styles.errorState}>
            <Icon source="alert-circle-outline" size={28} color={p.error} />
            <Text style={styles.errorStateText}>{error}</Text>
            <Button
              mode="contained"
              buttonColor={p.primary}
              textColor={p.onPrimary}
              onPress={fetchDashboard}
              style={styles.errorRetryButton}
              accessibilityLabel="Try again"
            >
              Try again
            </Button>
          </View>
        ) : !dashboard ? (
          // ── Not enrolled ──────────────────────────────────────────────
          <View style={styles.enrollCard}>
            <View style={styles.enrollIconTile}>
              <Icon source="handshake-outline" size={28} color={p.primary} />
            </View>
            <Text style={styles.enrollTitle}>Earn by referring others</Text>
            <Text style={styles.enrollSubtitle}>
              Join the affiliate program to get your own referral link. Earn a commission every time
              someone you refer starts a paid subscription.
            </Text>
            <Button
              mode="contained"
              buttonColor={p.primary}
              textColor="#FFFFFF"
              icon="handshake-outline"
              loading={enrolling}
              disabled={enrolling}
              onPress={handleEnroll}
              style={styles.enrollBtn}
              contentStyle={styles.enrollBtnContent}
              labelStyle={styles.enrollBtnLabel}
              accessibilityLabel="Join the affiliate program"
            >
              {enrolling ? 'Enrolling…' : 'Join the affiliate program'}
            </Button>
            {enrollError ? (
              <Text style={[styles.enrollSubtitle, { color: p.error, marginTop: 12 }]}>{enrollError}</Text>
            ) : null}
          </View>
        ) : (
          // ── Enrolled dashboard ───────────────────────────────────────────
          <>
            {error ? (
              <View style={styles.errorBanner}>
                <Icon source="alert-circle-outline" size={18} color={p.error} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {/* Referral link */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Your referral link</Text>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeBadgeText}>{dashboard.affiliate.referralCode}</Text>
                </View>
              </View>
              <View style={styles.linkBox}>
                <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="tail">
                  {dashboard.referralLink}
                </Text>
                <Icon source="link-variant" size={18} color={p.textSecondary} />
              </View>
              <Button
                mode="contained"
                buttonColor={p.primary}
                textColor="#FFFFFF"
                icon="share-variant"
                onPress={handleShare}
                style={styles.shareBtn}
                contentStyle={styles.shareBtnContent}
                labelStyle={styles.shareBtnLabel}
                accessibilityLabel="Share referral link"
              >
                Share referral link
              </Button>
            </View>

            {/* Earnings stat tiles */}
            <Text style={styles.sectionTitle}>Earnings</Text>
            <View style={styles.statGrid}>
              <View style={styles.statTile}>
                <View style={[styles.statIconTile, { backgroundColor: `${p.success}1A` }]}>
                  <Icon source="piggy-bank-outline" size={18} color={p.success} />
                </View>
                <Text style={styles.statValue}>{formatGHS(dashboard.stats.totalEarned)}</Text>
                <Text style={styles.statLabel}>Total earned</Text>
              </View>
              <View style={styles.statTile}>
                <View style={[styles.statIconTile, { backgroundColor: `${p.primary}1A` }]}>
                  <Icon source="wallet-outline" size={18} color={p.primary} />
                </View>
                <Text style={styles.statValue}>{formatGHS(dashboard.stats.availableBalance)}</Text>
                <Text style={styles.statLabel}>Available</Text>
              </View>
              <View style={styles.statTile}>
                <View style={[styles.statIconTile, { backgroundColor: `${p.warning}1A` }]}>
                  <Icon source="timer-sand" size={18} color={p.warning} />
                </View>
                <Text style={styles.statValue}>{formatGHS(dashboard.stats.pendingBalance)}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={styles.statTile}>
                <View style={[styles.statIconTile, { backgroundColor: `${p.secondaryDark}1A` }]}>
                  <Icon source="cash-multiple" size={18} color={p.secondaryDark} />
                </View>
                <Text style={styles.statValue}>{formatGHS(dashboard.stats.paidOutBalance)}</Text>
                <Text style={styles.statLabel}>Paid out</Text>
              </View>
            </View>

            {/* Payout */}
            <View style={styles.card}>
              <Text style={styles.payoutLabel}>Available to withdraw</Text>
              <Text style={styles.payoutValue}>{formatGHS(dashboard.stats.availableBalance)}</Text>
              <Button
                mode="contained"
                buttonColor={p.primary}
                textColor="#FFFFFF"
                icon="cash-fast"
                loading={payoutLoading}
                disabled={!canRequestPayout || payoutLoading}
                onPress={handleRequestPayout}
                style={styles.payoutBtn}
                contentStyle={styles.payoutBtnContent}
                labelStyle={styles.payoutBtnLabel}
                accessibilityLabel="Request payout"
              >
                {payoutLoading ? 'Requesting…' : 'Request payout'}
              </Button>
              {!canRequestPayout ? (
                <Text style={styles.payoutHint}>Commission becomes available after its hold window.</Text>
              ) : null}
            </View>

            {payoutError ? (
              <View style={styles.errorBanner}>
                <Icon source="alert-circle-outline" size={18} color={p.error} />
                <Text style={styles.errorBannerText}>{payoutError}</Text>
              </View>
            ) : null}
            {payoutSuccess ? (
              <View style={styles.successBanner}>
                <Icon source="check-circle-outline" size={18} color={p.success} />
                <Text style={styles.successBannerText}>
                  Payout requested — you&apos;ll be notified once it&apos;s processed.
                </Text>
              </View>
            ) : null}

            {/* Referrals */}
            <View style={styles.listPanel}>
              <View style={styles.listPanelHeader}>
                <Text style={styles.listPanelTitle}>Referrals</Text>
                {referrals.length > 0 ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{referrals.length}</Text>
                  </View>
                ) : null}
              </View>
              {listsLoading ? (
                <View style={styles.listLoading}>
                  <ActivityIndicator animating color={p.primary} />
                </View>
              ) : referrals.length === 0 ? (
                <Text style={styles.emptyListText}>No referrals yet</Text>
              ) : (
                referrals.map((r, i) => {
                  const color = r.status === 'converted' ? p.success : p.warning
                  return (
                    <View
                      key={`${r.referralCode}-${i}`}
                      style={[styles.row, i === referrals.length - 1 && styles.rowLast]}
                    >
                      <View style={styles.rowAvatar}>
                        <Text style={styles.rowAvatarText}>
                          {r.referralCode?.[0]?.toUpperCase() ?? 'R'}
                        </Text>
                      </View>
                      <View style={styles.rowBody}>
                        <View style={styles.rowTopLine}>
                          <Text style={styles.rowTitle}>Referred signup</Text>
                          <StatusChip label={REFERRAL_STATUS_LABEL[r.status]} color={color} />
                        </View>
                        <Text style={styles.rowSubtitle}>Joined {formatDate(r.createdAt)}</Text>
                      </View>
                    </View>
                  )
                })
              )}
            </View>

            {/* Commissions */}
            <View style={[styles.listPanel, { marginBottom: 8 }]}>
              <View style={styles.listPanelHeader}>
                <Text style={styles.listPanelTitle}>Commissions</Text>
                {commissions.length > 0 ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{commissions.length}</Text>
                  </View>
                ) : null}
              </View>
              {listsLoading ? (
                <View style={styles.listLoading}>
                  <ActivityIndicator animating color={p.primary} />
                </View>
              ) : commissions.length === 0 ? (
                <Text style={styles.emptyListText}>No commissions yet</Text>
              ) : (
                commissions.map((c, i) => {
                  const colorMap: Record<AffiliateCommissionStatus, string> = {
                    held: p.warning,
                    available: p.success,
                    paid: p.primaryLight,
                    reversed: p.error,
                    cancelled: p.textSecondary,
                  }
                  const color = colorMap[c.status] ?? p.textSecondary
                  return (
                    <View
                      key={`${c.createdAt}-${i}`}
                      style={[styles.row, i === commissions.length - 1 && styles.rowLast]}
                    >
                      <View style={styles.rowIconTile}>
                        <Icon source="receipt-text-outline" size={18} color={p.warning} />
                      </View>
                      <View style={styles.rowBody}>
                        <View style={styles.rowTopLine}>
                          <Text style={styles.rowAmount}>{formatGHS(c.amount)}</Text>
                          <StatusChip label={COMMISSION_STATUS_LABEL[c.status]} color={color} />
                        </View>
                        <Text style={styles.rowSubtitle}>
                          {c.commissionRate}% commission · {formatDate(c.createdAt)}
                        </Text>
                      </View>
                    </View>
                  )
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}
