import type { ReactNode } from 'react'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { Resource, Action } from '@ubuntu-fund/types'

interface AdminPermissionGateProps {
  resource: Resource
  action?: Action
  fallback?: ReactNode
  children: ReactNode
}

export function AdminPermissionGate({
  resource,
  action = Action.READ,
  fallback = null,
  children,
}: AdminPermissionGateProps) {
  const { can } = useAdminPermissions()

  if (!can(resource, action)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
