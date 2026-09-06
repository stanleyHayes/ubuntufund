import { AccountPageSkeleton } from '@/components/account/AccountPage'
import { useAuth } from '@/context/AuthContext'
import { SignInPrompt } from '@/components/auth/SignInPrompt'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, sessionExpired } = useAuth()

  // Instead of a bare redirect / blank screen, show a friendly sign-in panel
  // in place of the protected content. The CTA routes to /login (carrying the
  // current location) so the member lands back here after signing in.
  if (isLoading) return <AccountPageSkeleton />

  if (!isAuthenticated) {
    return <SignInPrompt title={sessionExpired ? 'Your session has expired' : undefined} description={sessionExpired ? 'Sign in again to securely continue. We’ll bring you back to this page.' : undefined} />
  }

  return <>{children}</>
}
