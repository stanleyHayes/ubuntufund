import { AuthLayout } from '@/components/auth/AuthLayout'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { useSeo } from '@/lib/seo'

export function RegisterPage() {
  useSeo({
    title: 'Create your account | Ujimora',
    description: 'Create a free Ujimora account to start a campaign in Ghana or support the causes you care about.',
    path: '/register',
  })
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
