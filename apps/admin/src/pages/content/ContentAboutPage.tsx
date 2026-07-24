import type { ReactNode } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
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
interface TeamMember {
  name: string
  role: string
  initials: string
  bio: string
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

  const team = data.team ?? []

  const setHero = (field: keyof AboutData['hero'], value: string) =>
    setData((d) => ({ ...d, hero: { ...d.hero, [field]: value } }))

  const setBlock = (section: 'mission' | 'vision', field: keyof RichBlock, value: string) =>
    setData((d) => ({ ...d, [section]: { ...d[section], [field]: value } }))

  const setPhilosophy = (field: keyof AboutData['philosophy'], value: string) =>
    setData((d) => ({ ...d, philosophy: { ...d.philosophy, [field]: value } }))

  const addMember = () =>
    setData((d) => ({ ...d, team: [...(d.team ?? []), { name: '', role: '', initials: '', bio: '' }] }))

  const updateMember = (index: number, field: keyof TeamMember, value: string) =>
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
      saving={block.saving}
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
    </ContentEditorLayout>
  )
}
