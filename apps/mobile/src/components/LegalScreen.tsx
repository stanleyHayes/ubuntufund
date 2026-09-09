import { Button } from '@/components/Loading'
import { useRef } from 'react'
import { ScrollView, View } from 'react-native'
import { Text, TouchableRipple } from 'react-native-paper'
import { useRouter, type Href } from 'expo-router'
import Svg, { G, Rect, Circle } from 'react-native-svg'
import { LEGAL_POLICIES, getPolicyBySlug } from '@ubuntu-fund/types/src/legal'
import { usePalette } from '@/context/ColorModeContext'
import { GlassSurface } from './GlassSurface'

export function LegalScreen({ slug }: { slug?: string }) {
  const p = usePalette()
  const router = useRouter()
  const scroll = useRef<ScrollView>(null)
  const positions = useRef<Record<number, number>>({})
  const policy = slug ? getPolicyBySlug(slug) : undefined
  const body = { color: p.textSecondary, fontFamily: 'Outfit_400Regular', fontSize: 16, lineHeight: 26 } as const
  const heading = { color: p.text, fontFamily: 'Outfit_700Bold', fontSize: 22, marginBottom: 14 } as const
  return <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: p.background }} contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 24 }}>
    <GlassSurface style={{ padding: 24, borderRadius: 24, overflow: 'hidden' }}>
      <Svg width={180} height={150} viewBox="0 0 260 180" style={{ position: 'absolute', right: -20, top: 0 }} pointerEvents="none" accessible={false}><G stroke={p.text} strokeWidth={5} fill="none" opacity={.08}><Rect x={35} y={45} width={85} height={85} rx={10} rotation={45} origin="77,87" /><Circle cx={154} cy={87} r={60} /></G></Svg>
      <Text style={{ ...body, fontSize: 12, letterSpacing: 2, marginBottom: 12 }}>UJIMORA · LEGAL & TRUST</Text>
      <Text accessibilityRole="header" style={{ ...heading, fontSize: 30 }}>{policy?.title ?? 'Know where you stand.'}</Text>
      <Text style={body}>{policy?.description ?? 'The policies that guide giving, fundraising and using Ujimora. Read every document here, even when you’re offline.'}</Text>
      {policy && <><Text style={{ ...body, fontSize: 13, marginTop: 16 }}>Effective {policy.effectiveDate}</Text><Button onPress={() => router.push('/legal')}>All policies</Button></>}
    </GlassSurface>
    {!policy ? LEGAL_POLICIES.map(item => <GlassSurface key={item.slug} style={{ padding: 24, borderRadius: 24 }}><Text accessibilityRole="header" style={heading}>{item.navLabel}</Text><Text style={body}>{item.summary}</Text><Button accessibilityLabel={`Read ${item.navLabel}`} onPress={() => router.push(item.route as Href)} style={{ alignSelf: 'flex-start', marginTop: 12 }}>Read policy →</Button></GlassSurface>) : <>
      <GlassSurface style={{ padding: 20, borderRadius: 24 }}><Text accessibilityRole="header" style={heading}>On this page</Text>{policy.sections.map((section, index) => <TouchableRipple key={section.title} accessibilityRole="link" onPress={() => scroll.current?.scrollTo({ y: Math.max(0, (positions.current[index] ?? 0) - 16), animated: false })} style={{ paddingVertical: 12 }}><Text style={{ ...body, color: p.text }}>{section.title}</Text></TouchableRipple>)}</GlassSurface>
      <Text selectable style={body}>{policy.introduction}</Text>
      {policy.sections.map((section, index) => <View key={section.title} onLayout={event => { positions.current[index] = event.nativeEvent.layout.y }}><Text accessibilityRole="header" selectable style={heading}>{section.title}</Text><Text selectable style={body}>{section.content}</Text></View>)}
      <GlassSurface style={{ padding: 24, borderRadius: 24 }}><Text accessibilityRole="header" style={heading}>Need clarification?</Text><Text selectable style={body}>{policy.contact}</Text><Button onPress={() => router.push('/legal')}>Browse all policies</Button></GlassSurface>
    </>}
  </ScrollView>
}
