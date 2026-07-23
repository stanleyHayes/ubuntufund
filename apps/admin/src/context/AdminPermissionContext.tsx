import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { Resource, Action, perm, hasPermission, getAllPermissions, type PermissionString } from '@ubuntu-fund/types'

interface AdminPermissionContextValue {
  permissions: PermissionString[]
  can: (resource: Resource, action: Action) => boolean
  canAny: (resource: Resource, ...actions: Action[]) => boolean
  isLoading: boolean
  roleName: string
}

const AdminPermissionContext = createContext<AdminPermissionContextValue | null>(null)

export function AdminPermissionProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<PermissionString[]>([])
  const [roleName, setRoleName] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchPermissions() {
      setIsLoading(true)

      const token = localStorage.getItem('uf_admin_token')

      if (!token) {
        // No token — still grant super admin for demo mode
        if (!cancelled) {
          setPermissions(getAllPermissions())
          setRoleName('Super Admin')
          setIsLoading(false)
        }
        return
      }

      try {
        const res = await fetch('/api/v1/rbac/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) throw new Error('Failed to fetch permissions')

        const data = await res.json()

        if (!cancelled) {
          setPermissions(data.permissions)
          setRoleName(data.roleName)
        }
      } catch {
        // Fall back to super admin permissions for demo mode
        if (!cancelled) {
          setPermissions(getAllPermissions())
          setRoleName('Super Admin')
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
  }, [])

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
    <AdminPermissionContext.Provider value={{ permissions, can, canAny, isLoading, roleName }}>
      {children}
    </AdminPermissionContext.Provider>
  )
}

export function useAdminPermissions() {
  const ctx = useContext(AdminPermissionContext)
  if (!ctx) throw new Error('useAdminPermissions must be used within <AdminPermissionProvider>')
  return ctx
}
