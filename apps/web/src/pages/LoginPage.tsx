import { AuthLayout } from '@/components/auth/AuthLayout'
import { LoginForm } from '@/components/auth/LoginForm'
import { useSeo } from '@/lib/seo'

export function LoginPage() {
  // Sign-in has nothing to rank for and every reason not to appear in results.
  useSeo({
    title: 'Sign in | Ujimora',
    description: 'Sign in to your Ujimora account to manage campaigns, donations and payouts.',
    path: '/login',
    robots: 'noindex, follow',
  })
  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to Ujimora"
      subtitle="Continue supporting the causes you care about."
    >
      <LoginForm />
    </AuthLayout>
  )
}
