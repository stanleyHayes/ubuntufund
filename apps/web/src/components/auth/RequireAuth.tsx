import { useAuth } from '@/context/AuthContext'
import { SignInPrompt } from '@/components/auth/SignInPrompt'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()

  // Instead of a bare redirect / blank screen, show a friendly sign-in panel
  // in place of the protected content. The CTA routes to /login (carrying the
  // current location) so the member lands back here after signing in.
  if (!isAuthenticated) {
    return <SignInPrompt />
  }

  return <>{children}</>
}
