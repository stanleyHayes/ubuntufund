import { Redirect } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { PageSkeleton } from '@/components/Loading'

export default function Index() {
  const { isLoading } = useAuth()
  if (isLoading) return <PageSkeleton />
  return <Redirect href="/(tabs)" />
}
