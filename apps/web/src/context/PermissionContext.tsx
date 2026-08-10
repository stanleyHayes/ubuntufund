import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { Resource, Action, hasPermission, type PermissionString, type UserPermissions } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

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
        const data = await api.get<UserPermissions>('/rbac/me')

        if (!cancelled) {
          setPermissions(data.permissions)
          setRoleName(data.roleName)
        }
      } catch {
        if (!cancelled) {
          setPermissions([])
          setRoleName('')
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
  }, [isAuthenticated, tokens?.accessToken])

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
