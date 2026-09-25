import { Redirect, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { PageSkeleton } from '@/components/Loading'

export default function Index() {
  const { isLoading, isAuthenticated } = useAuth()
  const { ref } = useLocalSearchParams<{ ref?: string }>()
  if (isLoading) return <PageSkeleton />
  // A referral link (/?ref=CODE) opens sign-up with the code for someone new;
  // a member who is already signed in just lands on Home.
  const referral = typeof ref === 'string' ? ref.trim() : ''
  if (referral && !isAuthenticated) return <Redirect href={{ pathname: '/(auth)/register', params: { ref: referral } }} />
  return <Redirect href="/(tabs)" />
}
