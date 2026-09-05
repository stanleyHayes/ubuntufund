import { AuthLayout } from '@/components/auth/AuthLayout'
import { LoginForm } from '@/components/auth/LoginForm'

export function LoginPage() {
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
