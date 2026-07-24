import React from 'react'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import { formatCurrency } from './CurrencyDisplay'
import { SHAPE } from '../theme'

export interface ProgressBarProps {
  /** Current amount raised */
  current: number
  /** Funding goal amount */
  goal: number
  /** Currency code — the platform uses GHS (Ghanaian cedi) only */
  currency?: string
  /** Whether to show the amounts text below the bar */
  showAmounts?: boolean
  /** Whether to show the percentage text */
  showPercentage?: boolean
  /** Color override for the progress bar */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
}

export function ProgressBar({
  current,
  goal,
  currency = 'GHS',
  showAmounts = true,
  showPercentage = true,
  color = 'primary',
}: ProgressBarProps) {
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0
  const isFunded = current >= goal

  return (
    <Box sx={{ width: '100%' }}>
      {showPercentage && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
          <Typography variant="body2" fontWeight={600} color={isFunded ? 'secondary.dark' : 'text.secondary'}>
            {Math.round(percentage)}%{isFunded ? ' - Funded!' : ''}
          </Typography>
        </Box>
      )}
      <LinearProgress
        variant="determinate"
        value={percentage}
        color={isFunded ? 'secondary' : color}
        sx={{
          height: 10,
          borderRadius: SHAPE.bar,
          backgroundColor: 'rgba(46, 61, 47, 0.10)',
        }}
      />
      {showAmounts && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {formatCurrency(current, currency)} raised
          </Typography>
          <Typography variant="body2" color="text.secondary">
            of {formatCurrency(goal, currency)}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
