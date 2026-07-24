import { Box, Button, TextField } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded'
import { EmptyState } from '@ubuntu-fund/ui'
import { useContentBlock } from '@/hooks/useContentBlock'
import ContentEditorLayout from '@/components/content/ContentEditorLayout'
import EditableRow, { moveItem } from '@/components/content/EditableRow'
import { fieldSx } from '@/components/content/styles'

interface StatItem {
  value: string
  label: string
}
interface StatsData {
  items: StatItem[]
}

const FALLBACK: StatsData = { items: [] }

export default function ContentStatsPage() {
  const block = useContentBlock<StatsData>('marketing.stats', 'stats', FALLBACK)
  const { data, setData } = block
  const items = data.items ?? []

  const addRow = () => setData((d) => ({ items: [...(d.items ?? []), { value: '', label: '' }] }))

  const updateRow = (index: number, field: keyof StatItem, value: string) =>
    setData((d) => ({
      items: (d.items ?? []).map((it, i) => (i === index ? { ...it, [field]: value } : it)),
    }))

  const removeRow = (index: number) =>
    setData((d) => ({ items: (d.items ?? []).filter((_, i) => i !== index) }))

  const move = (from: number, to: number) =>
    setData((d) => ({ items: moveItem(d.items ?? [], from, to) }))

  return (
    <ContentEditorLayout
      tone="gold"
      eyebrow="Content"
      title="Homepage Stats"
      lede="Headline numbers shown on the marketing homepage. Keep them punchy — value plus a short label."
      icon={<QueryStatsRoundedIcon />}
      loading={block.loading}
      saving={block.saving}
      error={block.error}
      isDirty={block.isDirty}
      updatedAt={block.record?.updatedAt}
      onSave={block.save}
      onReload={block.reload}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.length === 0 ? (
          <EmptyState
            variant="noData"
            title="No stats yet"
            description="Add headline figures like “GH₵ 120M+ raised” to build trust on the homepage."
            action={
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={addRow}
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              >
                Add first stat
              </Button>
            }
          />
        ) : (
          <>
            {items.map((item, index) => (
              <EditableRow
                key={index}
                index={index}
                count={items.length}
                label={item.value || 'New stat'}
                onMoveUp={() => move(index, index - 1)}
                onMoveDown={() => move(index, index + 1)}
                onRemove={() => removeRow(index)}
              >
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
                  <TextField
                    size="small"
                    label="Value"
                    placeholder="GH₵ 120M+"
                    value={item.value}
                    onChange={(e) => updateRow(index, 'value', e.target.value)}
                    sx={fieldSx}
                  />
                  <TextField
                    size="small"
                    label="Label"
                    placeholder="Raised on platform"
                    value={item.label}
                    onChange={(e) => updateRow(index, 'label', e.target.value)}
                    sx={fieldSx}
                  />
                </Box>
              </EditableRow>
            ))}
            <Box>
              <Button
                variant="outlined"
                startIcon={<AddRoundedIcon />}
                onClick={addRow}
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              >
                Add stat
              </Button>
            </Box>
          </>
        )}
      </Box>
    </ContentEditorLayout>
  )
}
