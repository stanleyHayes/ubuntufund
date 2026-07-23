import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { QRCodeSVG } from 'qrcode.react'

interface CampaignQRCodeProps {
  url: string
  title: string
}

export function CampaignQRCode({ url, title }: CampaignQRCodeProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <QRCodeSVG value={url} size={200} level="H" marginSize={2} />
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        {title}
      </Typography>
    </Box>
  )
}
