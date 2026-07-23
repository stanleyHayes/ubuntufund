import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { Resource, Action, perm, hasPermission, type PermissionString, type UserPermissions } from '@ubuntu-fund/types'

const DEMO_PERMS: PermissionString[] = [
  'campaigns:read', 'campaigns:create',
  'donations:read', 'donations:create',
  'wallets:read',
  'comments:read', 'comments:create',
  'notifications:read',
  'subscriptions:read',
]

interface PermissionContextValue {
  permissions: PermissionString[]
  can: (resource: Resource, action: Action) => boolean
  canAny: (resource: Resource, ...actions: Action[]) => boolean
  isLoading: boolean
  roleName: string
}

const PermissionContext = createContext<PermissionContextValue | null>(null)

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, tokens } = useAuth()
  const [permissions, setPermissions] = useState<PermissionString[]>([])
  const [roleName, setRoleName] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      setPermissions([])
      setRoleName('')
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function fetchPermissions() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/v1/rbac/me', {
          headers: {
            Authorization: `Bearer ${tokens?.accessToken ?? ''}`,
          },
        })

        if (!res.ok) throw new Error('Failed to fetch permissions')

        const data: UserPermissions = await res.json()

        if (!cancelled) {
          setPermissions(data.permissions)
          setRoleName(data.roleName)
        }
      } catch {
        // Fall back to default user permissions for demo mode
        if (!cancelled) {
          setPermissions(DEMO_PERMS)
          setRoleName('User')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchPermissions()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, tokens])

  const can = useCallback(
    (resource: Resource, action: Action): boolean => {
      return hasPermission(permissions, resource, action)
    },
    [permissions]
  )

  const canAny = useCallback(
    (resource: Resource, ...actions: Action[]): boolean => {
      return actions.some((action) => hasPermission(permissions, resource, action))
    },
    [permissions]
  )

  return (
    <PermissionContext.Provider value={{ permissions, can, canAny, isLoading, roleName }}>
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermissions() {
  const ctx = useContext(PermissionContext)
  if (!ctx) throw new Error('usePermissions must be used within <PermissionProvider>')
  return ctx
}
