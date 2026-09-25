import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { Resource, Action, hasPermission, type PermissionString } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { useAuth } from './AuthContext'

interface AdminPermissionContextValue {
  permissions: PermissionString[]
  can: (resource: Resource, action: Action) => boolean
  canAny: (resource: Resource, ...actions: Action[]) => boolean
  isLoading: boolean
  roleName: string
}

const AdminPermissionContext = createContext<AdminPermissionContextValue | null>(null)

export function AdminPermissionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, tokens, user } = useAuth()
  const [permissions, setPermissions] = useState<PermissionString[]>([])
  const [roleName, setRoleName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  // The account whose permissions are loaded. Access-token rotation for the same
  // account refreshes permissions in the background: returning to the loading
  // state would unmount every guarded page and discard unsaved work.
  const loadedFor = useRef<string | null>(null)
  const userId = user?.id ?? null

  useEffect(() => {
    let cancelled = false

    async function fetchPermissions() {
      const token = tokens?.accessToken ?? localStorage.getItem('uf_admin_token')

      if (!isAuthenticated || !token) {
        loadedFor.current = null
        if (!cancelled) {
          setPermissions([])
          setRoleName('')
          setIsLoading(false)
        }
        return
      }

      if (loadedFor.current !== userId) setIsLoading(true)

      try {
        const data = await api.get<{ permissions: PermissionString[]; roleName: string }>('/rbac/me')

        if (!cancelled) {
          setPermissions(Array.isArray(data.permissions) ? data.permissions : [])
          setRoleName(typeof data.roleName === 'string' ? data.roleName : '')
          loadedFor.current = userId
        }
      } catch {
        // A failed background refresh keeps the last known permissions; the API
        // still enforces every request.
        if (!cancelled && loadedFor.current !== userId) {
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
  }, [isAuthenticated, tokens?.accessToken, userId])

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
