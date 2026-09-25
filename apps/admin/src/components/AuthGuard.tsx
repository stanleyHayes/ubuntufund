import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/** Only a signed-in administrator session reaches the console; anything else goes to sign in. */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const token = localStorage.getItem('uf_admin_token')

  if (!token || !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
