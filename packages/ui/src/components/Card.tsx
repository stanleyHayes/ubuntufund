import React from 'react'
import MuiCard, { CardProps as MuiCardProps } from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import CardMedia from '@mui/material/CardMedia'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

export interface CardProps extends MuiCardProps {
  /** Optional image displayed at the top of the card */
  imageUrl?: string
  /** Alt text for the image */
  imageAlt?: string
  /** Image height in pixels */
  imageHeight?: number
  /** Card title */
  title?: string
  /** Card subtitle */
  subtitle?: string
  /** Actions rendered at the bottom of the card */
  actions?: React.ReactNode
}

export function Card({
  imageUrl,
  imageAlt,
  imageHeight = 180,
  title,
  subtitle,
  actions,
  children,
  sx,
  ...props
}: CardProps) {
  return (
    <MuiCard {...props} sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...sx }}>
      {imageUrl && (
        <CardMedia
          component="img"
          height={imageHeight}
          image={imageUrl}
          alt={imageAlt ?? title ?? ''}
          sx={{ objectFit: 'cover' }}
        />
      )}
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {title && (
          <Typography variant="h4" component="h2" gutterBottom>
            {title}
          </Typography>
        )}
        {subtitle && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {subtitle}
          </Typography>
        )}
        {children && <Box sx={{ mt: title || subtitle ? 1 : 0 }}>{children}</Box>}
      </CardContent>
      {actions && <CardActions sx={{ px: 2.5, pb: 2 }}>{actions}</CardActions>}
    </MuiCard>
  )
}
