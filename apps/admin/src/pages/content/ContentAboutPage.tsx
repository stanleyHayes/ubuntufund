import { BrandedTextField as TextField, ImageUpload } from '@ubuntu-fund/ui'
import { useState, type ReactNode } from 'react'
import { uploadImageViaApi } from '@/lib/uploadImage'
import { Box, Button, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import InfoRoundedIcon from '@mui/icons-material/InfoRounded'
import { useContentBlock } from '@/hooks/useContentBlock'
import ContentEditorLayout from '@/components/content/ContentEditorLayout'
import EditableRow, { moveItem } from '@/components/content/EditableRow'
import { fieldSx, sectionCardSx } from '@/components/content/styles'

interface RichBlock {
  eyebrow: string
  title: string
  body: string
}
interface TeamSocial {
  label: string
  href: string
}
interface TeamMember {
  name: string
  role: string
  initials: string
  bio: string
  /**
   * The rest of the leadership card, which this editor previously could not
   * reach. Saving the block without them blanked the photo and every link on
   * the public page, because the marketing side takes a CMS member wholesale.
   */
  image?: string
  website?: string
  websiteLabel?: string
  companyUrl?: string
  companyLabel?: string
  socials?: TeamSocial[]
}
interface AboutData {
  hero: { title: string; subtitle: string }
  mission: RichBlock
  vision: RichBlock
  philosophy: { eyebrow: string; quote: string; body: string }
  team: TeamMember[]
}

const FALLBACK: AboutData = {
  hero: { title: '', subtitle: '' },
  mission: { eyebrow: '', title: '', body: '' },
  vision: { eyebrow: '', title: '', body: '' },
  philosophy: { eyebrow: '', quote: '', body: '' },
  team: [],
}

/** "LinkedIn: https://…" per line — the shape the public card renders. */
function parseSocials(raw: string): TeamSocial[] {
  return raw
    .split('\n')
    .map((line) => {
      const at = line.indexOf(':')
      if (at < 0) return null
      const label = line.slice(0, at).trim()
      const href = line.slice(at + 1).trim()
      return label && href ? { label, href } : null
    })
    .filter((x): x is TeamSocial => x !== null)
}

function SectionPanel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Box sx={sectionCardSx}>
      <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'text.primary', mb: description ? 0.25 : 2 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {description}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</Box>
    </Box>
  )
}

export default function ContentAboutPage() {
  const block = useContentBlock<AboutData>('about', 'about', FALLBACK)
  const { data, setData } = block
  const [uploading, setUploading] = useState(false)
  const uploadPhoto = async (file: File, onProgress: (percent: number) => void) => {
    setUploading(true)
    try {
      return await uploadImageViaApi(file, 'profiles', onProgress)
    } finally {
      setUploading(false)
    }
  }

  const team = data.team ?? []

  const setHero = (field: keyof AboutData['hero'], value: string) =>
    setData((d) => ({ ...d, hero: { ...d.hero, [field]: value } }))

  const setBlock = (section: 'mission' | 'vision', field: keyof RichBlock, value: string) =>
    setData((d) => ({ ...d, [section]: { ...d[section], [field]: value } }))

  const setPhilosophy = (field: keyof AboutData['philosophy'], value: string) =>
    setData((d) => ({ ...d, philosophy: { ...d.philosophy, [field]: value } }))

  const addMember = () =>
    setData((d) => ({
      ...d,
      team: [...(d.team ?? []), { name: '', role: '', initials: '', bio: '', socials: [] }],
    }))

  const updateMember = (
    index: number,
    field: keyof TeamMember,
    // Socials are a list, every other field is text.
    value: string | TeamSocial[],
  ) =>
    setData((d) => ({
      ...d,
      team: (d.team ?? []).map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    }))

  const removeMember = (index: number) =>
    setData((d) => ({ ...d, team: (d.team ?? []).filter((_, i) => i !== index) }))

  const moveMember = (from: number, to: number) =>
    setData((d) => ({ ...d, team: moveItem(d.team ?? [], from, to) }))

  return (
    <ContentEditorLayout
      tone="green"
      eyebrow="Content"
      title="About Page"
      lede="The story, mission, vision, and team shown on the marketing About page."
      icon={<InfoRoundedIcon />}
      loading={block.loading}
      saving={block.saving || uploading}
      error={block.error}
      isDirty={block.isDirty}
      updatedAt={block.record?.updatedAt}
      onSave={block.save}
      onReload={block.reload}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <SectionPanel title="Hero">
          <TextField
            size="small"
            label="Title"
            value={data.hero?.title ?? ''}
            onChange={(e) => setHero('title', e.target.value)}
            sx={fieldSx}
          />
          <TextField
            size="small"
            label="Subtitle"
            value={data.hero?.subtitle ?? ''}
            onChange={(e) => setHero('subtitle', e.target.value)}
            multiline
            minRows={2}
            sx={fieldSx}
          />
        </SectionPanel>

        {(['mission', 'vision'] as const).map((section) => (
          <SectionPanel key={section} title={section === 'mission' ? 'Mission' : 'Vision'}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
              <TextField
                size="small"
                label="Eyebrow"
                value={data[section]?.eyebrow ?? ''}
                onChange={(e) => setBlock(section, 'eyebrow', e.target.value)}
                sx={fieldSx}
              />
              <TextField
                size="small"
                label="Title"
                value={data[section]?.title ?? ''}
                onChange={(e) => setBlock(section, 'title', e.target.value)}
                sx={fieldSx}
              />
            </Box>
            <TextField
              size="small"
              label="Body"
              value={data[section]?.body ?? ''}
              onChange={(e) => setBlock(section, 'body', e.target.value)}
              multiline
              minRows={3}
              sx={fieldSx}
            />
          </SectionPanel>
        ))}

        <SectionPanel title="Philosophy">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
            <TextField
              size="small"
              label="Eyebrow"
              value={data.philosophy?.eyebrow ?? ''}
              onChange={(e) => setPhilosophy('eyebrow', e.target.value)}
              sx={fieldSx}
            />
            <TextField
              size="small"
              label="Quote"
              value={data.philosophy?.quote ?? ''}
              onChange={(e) => setPhilosophy('quote', e.target.value)}
              sx={fieldSx}
            />
          </Box>
          <TextField
            size="small"
            label="Body"
            value={data.philosophy?.body ?? ''}
            onChange={(e) => setPhilosophy('body', e.target.value)}
            multiline
            minRows={3}
            sx={fieldSx}
          />
        </SectionPanel>

        <Box component="fieldset" disabled={uploading || block.saving} sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}>
        <SectionPanel title="Team" description="Members shown in the team grid. Reorder to control display order.">
          {team.length === 0 ? (
            <Box>
              <Button
                variant="outlined"
                startIcon={<AddRoundedIcon />}
                onClick={addMember}
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              >
                Add team member
              </Button>
            </Box>
          ) : (
            <>
              {team.map((member, index) => (
                <EditableRow
                  key={index}
                  index={index}
                  count={team.length}
                  label={member.name || 'New member'}
                  onMoveUp={() => moveMember(index, index - 1)}
                  onMoveDown={() => moveMember(index, index + 1)}
                  onRemove={() => removeMember(index)}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 2fr 1fr' }, gap: 2 }}>
                      <TextField
                        size="small"
                        label="Name"
                        value={member.name}
                        onChange={(e) => updateMember(index, 'name', e.target.value)}
                        sx={fieldSx}
                      />
                      <TextField
                        size="small"
                        label="Role"
                        value={member.role}
                        onChange={(e) => updateMember(index, 'role', e.target.value)}
                        sx={fieldSx}
                      />
                      <TextField
                        size="small"
                        label="Initials"
                        value={member.initials}
                        onChange={(e) => updateMember(index, 'initials', e.target.value)}
                        inputProps={{ maxLength: 3 }}
                        sx={fieldSx}
                      />
                    </Box>
                    <TextField
                      size="small"
                      label="Bio"
                      value={member.bio}
                      onChange={(e) => updateMember(index, 'bio', e.target.value)}
                      multiline
                      minRows={2}
                      sx={fieldSx}
                    />
                    <Box sx={{ maxWidth: 360, width: '100%' }}>
                      <ImageUpload
                        label={`Photo for ${member.name || 'team member'}`}
                        value={member.image ?? ''}
                        onChange={(url) => updateMember(index, 'image', url)}
                        uploadFn={uploadPhoto}
                        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                        aspectRatio={1}
                        disabled={uploading || block.saving}
                        helperText="Upload a portrait up to 4 MB. Save changes to publish it. Without a photo, the member’s initials are shown."
                      />
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2 }}>
                      <TextField
                        size="small"
                        label="Personal link"
                        value={member.website ?? ''}
                        onChange={(e) => updateMember(index, 'website', e.target.value)}
                        sx={fieldSx}
                      />
                      <TextField
                        size="small"
                        label="Link label"
                        value={member.websiteLabel ?? ''}
                        onChange={(e) => updateMember(index, 'websiteLabel', e.target.value)}
                        sx={fieldSx}
                      />
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2 }}>
                      <TextField
                        size="small"
                        label="Company link"
                        value={member.companyUrl ?? ''}
                        onChange={(e) => updateMember(index, 'companyUrl', e.target.value)}
                        sx={fieldSx}
                      />
                      <TextField
                        size="small"
                        label="Company label"
                        value={member.companyLabel ?? ''}
                        onChange={(e) => updateMember(index, 'companyLabel', e.target.value)}
                        sx={fieldSx}
                      />
                    </Box>
                    <TextField
                      size="small"
                      label="Social links"
                      value={(member.socials ?? []).map((x) => `${x.label}: ${x.href}`).join('\n')}
                      onChange={(e) => updateMember(index, 'socials', parseSocials(e.target.value))}
                      multiline
                      minRows={2}
                      helperText="One per line, as “LinkedIn: https://…”."
                      sx={fieldSx}
                    />
                  </Box>
                </EditableRow>
              ))}
              <Box>
                <Button
                  variant="outlined"
                  startIcon={<AddRoundedIcon />}
                  onClick={addMember}
                  sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                >
                  Add team member
                </Button>
              </Box>
            </>
          )}
        </SectionPanel>
        </Box>
      </Box>
    </ContentEditorLayout>
  )
}
