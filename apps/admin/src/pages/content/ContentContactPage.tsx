import type { ReactNode } from 'react'
import { Box, TextField, Typography, InputAdornment } from '@mui/material'
import ContactMailRoundedIcon from '@mui/icons-material/ContactMailRounded'
import EmailRoundedIcon from '@mui/icons-material/EmailRounded'
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded'
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import FacebookIcon from '@mui/icons-material/Facebook'
import XIcon from '@mui/icons-material/X'
import InstagramIcon from '@mui/icons-material/Instagram'
import LinkedInIcon from '@mui/icons-material/LinkedIn'
import YouTubeIcon from '@mui/icons-material/YouTube'
import { useContentBlock } from '@/hooks/useContentBlock'
import ContentEditorLayout from '@/components/content/ContentEditorLayout'
import { fieldSx, sectionCardSx } from '@/components/content/styles'

interface Socials {
  facebook: string
  x: string
  instagram: string
  linkedin: string
  youtube: string
}
interface ContactData {
  email: string
  phone: string
  address: string
  hours: string
  socials: Socials
}

const FALLBACK: ContactData = {
  email: '',
  phone: '',
  address: '',
  hours: '',
  socials: { facebook: '', x: '', instagram: '', linkedin: '', youtube: '' },
}

const SOCIAL_FIELDS: { key: keyof Socials; label: string; icon: ReactNode; placeholder: string }[] = [
  { key: 'facebook', label: 'Facebook', icon: <FacebookIcon sx={{ fontSize: 18 }} />, placeholder: 'https://facebook.com/ubuntufund' },
  { key: 'x', label: 'X', icon: <XIcon sx={{ fontSize: 18 }} />, placeholder: 'https://x.com/ubuntufund' },
  { key: 'instagram', label: 'Instagram', icon: <InstagramIcon sx={{ fontSize: 18 }} />, placeholder: 'https://instagram.com/ubuntufund' },
  { key: 'linkedin', label: 'LinkedIn', icon: <LinkedInIcon sx={{ fontSize: 18 }} />, placeholder: 'https://linkedin.com/company/ubuntufund' },
  { key: 'youtube', label: 'YouTube', icon: <YouTubeIcon sx={{ fontSize: 18 }} />, placeholder: 'https://youtube.com/@ubuntufund' },
]

function SectionPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={sectionCardSx}>
      <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'text.primary', mb: 2 }}>{title}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</Box>
    </Box>
  )
}

export default function ContentContactPage() {
  const block = useContentBlock<ContactData>('contact', 'contact', FALLBACK)
  const { data, setData } = block

  const setField = (field: 'email' | 'phone' | 'address' | 'hours', value: string) =>
    setData((d) => ({ ...d, [field]: value }))

  const setSocial = (key: keyof Socials, value: string) =>
    setData((d) => ({ ...d, socials: { ...d.socials, [key]: value } }))

  const adorn = (icon: ReactNode) => ({
    startAdornment: (
      <InputAdornment position="start" sx={{ color: 'text.secondary' }}>
        {icon}
      </InputAdornment>
    ),
  })

  return (
    <ContentEditorLayout
      tone="clay"
      eyebrow="Content"
      title="Contact Details"
      lede="The contact information and social links shown on the marketing contact page and footer."
      icon={<ContactMailRoundedIcon />}
      loading={block.loading}
      saving={block.saving}
      error={block.error}
      isDirty={block.isDirty}
      updatedAt={block.record?.updatedAt}
      onSave={block.save}
      onReload={block.reload}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <SectionPanel title="Contact details">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              size="small"
              label="Email"
              type="email"
              value={data.email ?? ''}
              onChange={(e) => setField('email', e.target.value)}
              InputProps={adorn(<EmailRoundedIcon sx={{ fontSize: 18 }} />)}
              sx={fieldSx}
            />
            <TextField
              size="small"
              label="Phone"
              value={data.phone ?? ''}
              onChange={(e) => setField('phone', e.target.value)}
              InputProps={adorn(<PhoneRoundedIcon sx={{ fontSize: 18 }} />)}
              sx={fieldSx}
            />
          </Box>
          <TextField
            size="small"
            label="Address"
            value={data.address ?? ''}
            onChange={(e) => setField('address', e.target.value)}
            InputProps={adorn(<PlaceRoundedIcon sx={{ fontSize: 18 }} />)}
            sx={fieldSx}
          />
          <TextField
            size="small"
            label="Hours"
            placeholder="Mon-Fri, 9am-5pm GMT"
            value={data.hours ?? ''}
            onChange={(e) => setField('hours', e.target.value)}
            InputProps={adorn(<ScheduleRoundedIcon sx={{ fontSize: 18 }} />)}
            sx={fieldSx}
          />
        </SectionPanel>

        <SectionPanel title="Social links">
          {SOCIAL_FIELDS.map(({ key, label, icon, placeholder }) => (
            <TextField
              key={key}
              size="small"
              label={label}
              placeholder={placeholder}
              value={data.socials?.[key] ?? ''}
              onChange={(e) => setSocial(key, e.target.value)}
              InputProps={adorn(icon)}
              sx={fieldSx}
            />
          ))}
        </SectionPanel>
      </Box>
    </ContentEditorLayout>
  )
}
