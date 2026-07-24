import { Box, Button, TextField, Autocomplete } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import QuizRoundedIcon from '@mui/icons-material/QuizRounded'
import { EmptyState } from '@ubuntu-fund/ui'
import { useContentBlock } from '@/hooks/useContentBlock'
import ContentEditorLayout from '@/components/content/ContentEditorLayout'
import EditableRow, { moveItem } from '@/components/content/EditableRow'
import { fieldSx } from '@/components/content/styles'

interface FaqItem {
  category: string
  question: string
  answer: string
}
interface FaqData {
  items: FaqItem[]
}

const FALLBACK: FaqData = { items: [] }

const KNOWN_CATEGORIES = [
  'Getting started',
  'Campaigns',
  'Donations',
  'Payments',
  'Trust & safety',
  'Organizations',
]

export default function ContentFaqPage() {
  const block = useContentBlock<FaqData>('faq', 'faq', FALLBACK)
  const { data, setData } = block
  const items = data.items ?? []

  const categoryOptions = Array.from(new Set([...KNOWN_CATEGORIES, ...items.map((i) => i.category).filter(Boolean)]))

  const addRow = () =>
    setData((d) => ({
      items: [...(d.items ?? []), { category: KNOWN_CATEGORIES[0], question: '', answer: '' }],
    }))

  const updateRow = (index: number, field: keyof FaqItem, value: string) =>
    setData((d) => ({
      items: (d.items ?? []).map((it, i) => (i === index ? { ...it, [field]: value } : it)),
    }))

  const removeRow = (index: number) =>
    setData((d) => ({ items: (d.items ?? []).filter((_, i) => i !== index) }))

  const move = (from: number, to: number) =>
    setData((d) => ({ items: moveItem(d.items ?? [], from, to) }))

  return (
    <ContentEditorLayout
      tone="teal"
      eyebrow="Content"
      title="FAQ"
      lede="Questions and answers shown on the marketing FAQ page, grouped by category."
      icon={<QuizRoundedIcon />}
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
            title="No FAQ entries yet"
            description="Add common questions and clear answers to help donors and organizers get started."
            action={
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={addRow}
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              >
                Add first question
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
                label={item.category || 'Uncategorized'}
                onMoveUp={() => move(index, index - 1)}
                onMoveDown={() => move(index, index + 1)}
                onRemove={() => removeRow(index)}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
                    <Autocomplete
                      freeSolo
                      size="small"
                      options={categoryOptions}
                      value={item.category}
                      onInputChange={(_, value) => updateRow(index, 'category', value)}
                      renderInput={(params) => (
                        <TextField {...params} label="Category" sx={fieldSx} />
                      )}
                    />
                    <TextField
                      size="small"
                      label="Question"
                      value={item.question}
                      onChange={(e) => updateRow(index, 'question', e.target.value)}
                      sx={fieldSx}
                    />
                  </Box>
                  <TextField
                    size="small"
                    label="Answer"
                    value={item.answer}
                    onChange={(e) => updateRow(index, 'answer', e.target.value)}
                    multiline
                    minRows={2}
                    maxRows={8}
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
                Add question
              </Button>
            </Box>
          </>
        )}
      </Box>
    </ContentEditorLayout>
  )
}
