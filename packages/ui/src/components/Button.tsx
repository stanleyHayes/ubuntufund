import React from 'react'
import MuiButton, { ButtonProps as MuiButtonProps } from '@mui/material/Button'
import { SxProps, Theme } from '@mui/material/styles'

export type BrandVariant = 'primary' | 'secondary' | 'donate' | 'outline'

export interface ButtonProps extends Omit<MuiButtonProps, 'variant'> {
  brandVariant?: BrandVariant
  variant?: MuiButtonProps['variant']
}

const brandVariantMap: Record<BrandVariant, Partial<MuiButtonProps>> = {
  primary: {
    variant: 'contained',
    color: 'primary',
  },
  secondary: {
    variant: 'contained',
    color: 'secondary',
  },
  donate: {
    variant: 'contained',
    color: 'primary',
    sx: {
      backgroundColor: '#2E3D2F',
      fontWeight: 700,
      fontSize: '1rem',
      padding: '10px 32px',
      '&:hover': {
        backgroundColor: '#1C261D',
      },
    },
  },
  outline: {
    variant: 'outlined',
    color: 'primary',
  },
}

export function Button({ brandVariant, variant, sx, ...props }: ButtonProps) {
  if (brandVariant) {
    const mapped = brandVariantMap[brandVariant]
    return (
      <MuiButton
        variant={mapped.variant}
        color={mapped.color}
        sx={{ ...mapped.sx, ...sx } as SxProps<Theme>}
        {...props}
      />
    )
  }

  return <MuiButton variant={variant ?? 'contained'} sx={sx} {...props} />
}
