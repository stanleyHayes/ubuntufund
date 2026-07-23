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

function formatAmount(amount: number) {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`
  return `$${amount.toLocaleString()}`
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
        <View style={{ width: 48, height: 48, backgroundColor: '#E0E0E0', borderRadius: 24, marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <View style={{ width: '60%', height: 14, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 6 }} />
          <View style={{ width: '35%', height: 10, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <View style={{ width: 60, height: 10, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
        <View style={{ width: 60, height: 10, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
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
        orgs = await api.get<Organization[]>('/organizations')
      } catch {
        // Fallback: derive from campaigns
        const campaigns = await api.get<any[]>('/campaigns')
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

      {/* Search */}
      <View style={styles.searchWrap}>
        <Icon source="magnify" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search organizations..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon source="close-circle" size={18} color="#999" />
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
            <Icon source="alert-circle-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>{error}</Text>
            <Button mode="outlined" onPress={fetchOrganizations} style={{ marginTop: 12 }}>
              Retry
            </Button>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon source="office-building-outline" size={48} color="#ccc" />
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
                          <Icon source="check-decagram" size={16} color="#1565C0" />
                        )}
                      </View>
                      {org.description && (
                        <Text style={styles.orgDesc} numberOfLines={2}>{org.description}</Text>
                      )}
                    </View>
                    <Icon source="chevron-right" size={18} color="#ccc" />
                  </View>

                  <View style={styles.orgStats}>
                    <View style={styles.orgStat}>
                      <Icon source="bullhorn" size={14} color="#999" />
                      <Text style={styles.orgStatText}>{org.campaignCount} campaigns</Text>
                    </View>
                    <View style={styles.orgStat}>
                      <Icon source="currency-usd" size={14} color="#999" />
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
  container: { flex: 1, backgroundColor: '#F8F8F4' },

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
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'TTSquares-Regular', color: '#1a1a1a' },

  listWrap: { paddingHorizontal: 16, paddingTop: 8 },

  orgCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  orgHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  orgAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orgAvatarText: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: brandColors.primary },
  orgName: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: '#1a1a1a' },
  orgDesc: { fontSize: 12, color: '#999', marginTop: 2, fontFamily: 'TTSquares-Regular', lineHeight: 16 },
  orgStats: { flexDirection: 'row', gap: 20 },
  orgStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orgStatText: { fontSize: 12, color: '#999', fontFamily: 'TTSquares-Regular' },

  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: '#666', marginTop: 16, textAlign: 'center' },
})
