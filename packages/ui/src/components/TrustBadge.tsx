import React from 'react'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import type { VerificationLevel } from '@ubuntu-fund/types'

interface TrustLevelConfig {
  label: string
  tooltip: string
  color: string
  backgroundColor: string
}

const TRUST_LEVEL_CONFIG: Record<number, TrustLevelConfig> = {
  0: {
    label: 'Unverified',
    tooltip: 'This user has not completed any verification steps',
    color: '#616161',
    backgroundColor: '#EEEEEE',
  },
  1: {
    label: 'Level 1',
    tooltip: 'Email and phone verified',
    color: '#1565C0',
    backgroundColor: '#E3F2FD',
  },
  2: {
    label: 'Level 2',
    tooltip: 'National ID verified',
    color: '#1565C0',
    backgroundColor: '#BBDEFB',
  },
  3: {
    label: 'Level 3',
    tooltip: 'Institutional verification complete',
    color: '#E65100',
    backgroundColor: '#FFF3E0',
  },
  4: {
    label: 'Level 4',
    tooltip: 'Community vouched and fully verified',
    color: '#1B5E20',
    backgroundColor: '#E8F5E9',
  },
}

export interface TrustBadgeProps {
  /** Verification level (0-4) from the user's profile */
  level: VerificationLevel
  /** Size of the badge chip */
  size?: 'small' | 'medium'
}

export function TrustBadge({ level, size = 'small' }: TrustBadgeProps) {
  const config = TRUST_LEVEL_CONFIG[level] ?? TRUST_LEVEL_CONFIG[0]

  return (
    <Tooltip title={config.tooltip} arrow>
      <Chip
        label={config.label}
        size={size}
        sx={{
          color: config.color,
          backgroundColor: config.backgroundColor,
          fontWeight: 600,
          border: `1px solid ${config.color}20`,
        }}
      />
    </Tooltip>
  )
}
