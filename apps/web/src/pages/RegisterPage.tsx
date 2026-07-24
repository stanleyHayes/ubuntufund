import { AuthLayout } from '@/components/auth/AuthLayout'
import { RegisterForm } from '@/components/auth/RegisterForm'

export function RegisterPage() {
  return (
    <AuthLayout
      eyebrow="Join the chain"
      title="Create your account"
      subtitle="Start giving — or start a campaign for your community."
    >
      <RegisterForm />
    </AuthLayout>
  )
}
