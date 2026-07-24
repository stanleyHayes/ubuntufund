import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  TextInput,
} from 'react-native'
import { Text, Icon, Button } from 'react-native-paper'
import { router, Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { brandColors } from '@/theme'

interface Organization {
  id: string
  name: string
  avatar?: string
  verified: boolean
  campaignCount: number
  totalRaised: number
  description?: string
}

const ghsFormatter = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' })

function formatAmount(amount: number) {
  if (amount >= 1_000_000) return `GH₵ ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `GH₵ ${(amount / 1_000).toFixed(1)}K`
  return ghsFormatter.format(amount)
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    ).start()
  }, [])
  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={styles.skeletonAvatar} />
        <View style={{ flex: 1 }}>
          <View style={[styles.skeletonLine, { width: '60%', marginBottom: 6 }]} />
          <View style={[styles.skeletonLine, { width: '35%', height: 10 }]} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <View style={[styles.skeletonLine, { width: 60, height: 10 }]} />
        <View style={[styles.skeletonLine, { width: 60, height: 10 }]} />
      </View>
    </Animated.View>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function OrganizationsScreen() {
  const { user } = useAuth()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchOrganizations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Try dedicated endpoint first, fall back to deriving from campaigns
      let orgs: Organization[]
      try {
        const res = await api.get<Organization[]>('/organizations')
        orgs = Array.isArray(res) ? res : []
      } catch {
        // Fallback: derive from campaigns (/campaigns is paginated: { items }).
        const campaignsRes = await api.get<any[] | { items: any[] }>('/campaigns')
        const campaigns = Array.isArray(campaignsRes) ? campaignsRes : campaignsRes.items ?? []
        const orgMap = new Map<string, Organization>()
        for (const c of campaigns) {
          if (c.creatorRole === 'organization' || c.organizationId) {
            const orgId = c.organizationId ?? c.creatorId
            const existing = orgMap.get(orgId)
            if (existing) {
              existing.campaignCount += 1
              existing.totalRaised += c.raisedAmount ?? 0
            } else {
              orgMap.set(orgId, {
                id: orgId,
                name: c.organizationName ?? c.creatorName ?? 'Organization',
                verified: c.verified ?? false,
                campaignCount: 1,
                totalRaised: c.raisedAmount ?? 0,
              })
            }
          }
        }
        orgs = Array.from(orgMap.values())
      }
      setOrganizations(orgs)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrganizations()
  }, [fetchOrganizations])

  const filtered = search.trim()
    ? organizations.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : organizations

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Organizations',
          headerStyle: { backgroundColor: brandColors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
        }}
      />

      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>Partner Orgs</Text>
        <Text style={styles.pageTitle}>Organizations</Text>
        <Text style={styles.pageLede}>Discover the organizations running campaigns.</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Icon source="magnify" size={20} color={brandColors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search organizations..."
          placeholderTextColor={brandColors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
            <Icon source="close-circle" size={18} color={brandColors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? (
          <View style={styles.listWrap}>
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconTile, styles.errorIconTile]}>
              <Icon source="alert-circle-outline" size={24} color={brandColors.error} />
            </View>
            <Text style={styles.emptyTitle}>{error}</Text>
            <Button
              mode="contained"
              buttonColor={brandColors.primary}
              textColor="#FFFFFF"
              onPress={fetchOrganizations}
              style={styles.actionBtn}
              labelStyle={styles.btnLabel}
            >
              Retry
            </Button>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconTile}>
              <Icon source="office-building-outline" size={24} color={brandColors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {search ? 'No organizations match your search' : 'No organizations found'}
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {filtered.map((org) => {
              const initials = org.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
              return (
                <TouchableOpacity
                  key={org.id}
                  style={styles.orgCard}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/(tabs)/explore', params: { organizationId: org.id } })}
                >
                  <View style={styles.orgHeader}>
                    <View style={styles.orgAvatar}>
                      <Text style={styles.orgAvatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.orgName} numberOfLines={1}>{org.name}</Text>
                        {org.verified && (
                          <Icon source="check-decagram" size={16} color={brandColors.success} />
                        )}
                      </View>
                      {org.description && (
                        <Text style={styles.orgDesc} numberOfLines={2}>{org.description}</Text>
                      )}
                    </View>
                    <Icon source="chevron-right" size={18} color={brandColors.textSecondary} />
                  </View>

                  <View style={styles.orgStats}>
                    <View style={styles.orgStat}>
                      <Icon source="bullhorn" size={14} color={brandColors.textSecondary} />
                      <Text style={styles.orgStatText}>{org.campaignCount} campaigns</Text>
                    </View>
                    <View style={styles.orgStat}>
                      <Icon source="cash" size={14} color={brandColors.textSecondary} />
                      <Text style={styles.orgStatText}>{formatAmount(org.totalRaised)} raised</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },

  headerBlock: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  eyebrow: { fontSize: 11, fontFamily: 'TTSquares-Bold', fontWeight: '700', color: brandColors.secondaryDark, textTransform: 'uppercase', letterSpacing: 2 },
  pageTitle: { fontSize: 24, fontFamily: 'TTSquares-Black', color: brandColors.text, marginTop: 4 },
  pageLede: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginTop: 4 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Outfit_400Regular', color: brandColors.text },

  listWrap: { paddingHorizontal: 16, paddingTop: 8 },

  orgCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  orgHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  orgAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(168,181,160,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orgAvatarText: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: brandColors.primary },
  orgName: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: brandColors.text },
  orgDesc: { fontSize: 12, color: brandColors.textSecondary, marginTop: 2, fontFamily: 'Outfit_400Regular', lineHeight: 16 },
  orgStats: { flexDirection: 'row', gap: 20 },
  orgStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orgStatText: { fontSize: 12, color: brandColors.textSecondary, fontFamily: 'Outfit_400Regular' },

  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  skeletonAvatar: { width: 48, height: 48, backgroundColor: 'rgba(168,181,160,0.35)', borderRadius: 24, marginRight: 12 },
  skeletonLine: { height: 14, backgroundColor: 'rgba(168,181,160,0.35)', borderRadius: 4 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 72, paddingHorizontal: 32 },
  emptyIconTile: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(168,181,160,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorIconTile: { backgroundColor: 'rgba(165,67,47,0.14)' },
  emptyTitle: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: brandColors.text, textAlign: 'center' },
  actionBtn: { marginTop: 16, borderRadius: 999 },
  btnLabel: { fontFamily: 'TTSquares-Bold' },
})
