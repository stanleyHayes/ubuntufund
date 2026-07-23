import type { ReactNode } from 'react'
import { usePermissions } from '@/context/PermissionContext'
import { Resource, Action } from '@ubuntu-fund/types'

interface PermissionGateProps {
  resource: Resource
  action?: Action
  fallback?: ReactNode
  children: ReactNode
}

export function PermissionGate({
  resource,
  action = Action.READ,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can } = usePermissions()

  if (!can(resource, action)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
