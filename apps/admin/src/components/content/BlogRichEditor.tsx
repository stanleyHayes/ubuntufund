import { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {
  Box,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
} from '@mui/material'
import { ArticleMarkdown, BrandedTextField, ImageUpload } from '@ubuntu-fund/ui'
import { uploadImageViaApi } from '@/lib/uploadImage'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import {
  FormatBold,
  FormatItalic,
  StrikethroughS,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  Code,
  Link,
  LinkOff,
  Undo,
  Redo,
  HorizontalRule,
  TableChart,
  Checklist,
  ImageOutlined,
  FormatClear,
} from '@mui/icons-material'
export default function BlogRichEditor({
  value,
  onChange,
  disabled,
  onBusy,
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
  onBusy: (v: boolean) => void
}) {
  const [mode, setMode] = useState('write'),
    [dialog, setDialog] = useState<'image' | 'link' | null>(null)
  const [url, setUrl] = useState(''),
    [alt, setAlt] = useState(''),
    [uploading, setUploading] = useState(false)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, protocols: ['https', 'mailto'] },
        underline: false,
      }),
      Markdown,
      Image,
      TableKit,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: value,
    contentType: 'markdown',
    editable: !disabled,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
    editorProps: {
      attributes: { 'aria-label': 'Article body', role: 'textbox', 'aria-multiline': 'true' },
    },
  })
  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])
  if (!editor) return null
  const tool = (label: string, icon: React.ReactNode, action: () => void, active = false) => (
    <Tooltip key={label} title={label}>
      <span>
        <IconButton
          size="small"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={action}
          sx={{
            color: active ? 'primary.main' : 'text.primary',
            bgcolor: active ? 'action.selected' : undefined,
          }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  )
  const switchMode = (next: string | null) => {
    if (!next) return
    if (mode === 'markdown')
      editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
    setMode(next)
  }
  return (
    <Box sx={{ ...raisedSurface, overflow: 'hidden' }}>
      <Stack
        direction="row"
        sx={{ p: 1.5, flexWrap: 'wrap', gap: 1, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, v) => switchMode(v)}
          aria-label="Editor view"
        >
          <ToggleButton value="write">Write</ToggleButton>
          <ToggleButton value="markdown">Markdown</ToggleButton>
          <ToggleButton value="preview">Preview</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {mode === 'write' && (
        <>
          <Box
            role="toolbar"
            aria-label="Article formatting"
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.5,
              p: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            {tool('Undo', <Undo />, () => {
              editor.chain().focus().undo().run()
            })}
            {tool('Redo', <Redo />, () => {
              editor.chain().focus().redo().run()
            })}
            {[1, 2, 3].map((level) => (
              <Button
                key={level}
                size="small"
                disabled={disabled}
                aria-label={`Heading ${level}`}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .toggleHeading({ level: level as 1 | 2 | 3 })
                    .run()
                }
                sx={{ minWidth: 36 }}
              >
                H{level}
              </Button>
            ))}
            {tool(
              'Bold',
              <FormatBold />,
              () => {
                editor.chain().focus().toggleBold().run()
              },
              editor.isActive('bold'),
            )}
            {tool(
              'Italic',
              <FormatItalic />,
              () => {
                editor.chain().focus().toggleItalic().run()
              },
              editor.isActive('italic'),
            )}
            {tool(
              'Strikethrough',
              <StrikethroughS />,
              () => {
                editor.chain().focus().toggleStrike().run()
              },
              editor.isActive('strike'),
            )}
            {tool('Bullet list', <FormatListBulleted />, () => {
              editor.chain().focus().toggleBulletList().run()
            })}
            {tool('Numbered list', <FormatListNumbered />, () => {
              editor.chain().focus().toggleOrderedList().run()
            })}
            {tool('Task list', <Checklist />, () => {
              editor.chain().focus().toggleTaskList().run()
            })}
            {tool('Quote', <FormatQuote />, () => {
              editor.chain().focus().toggleBlockquote().run()
            })}
            {tool('Code block', <Code />, () => {
              editor.chain().focus().toggleCodeBlock().run()
            })}
            {tool('Insert link', <Link />, () => {
              setUrl(editor.getAttributes('link').href || '')
              setDialog('link')
            })}
            {tool('Remove link', <LinkOff />, () => {
              editor.chain().focus().unsetLink().run()
            })}
            {tool('Insert image', <ImageOutlined />, () => {
              setUrl('')
              setAlt('')
              setDialog('image')
            })}
            {tool('Insert table', <TableChart />, () => {
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            })}
            {tool('Divider', <HorizontalRule />, () => {
              editor.chain().focus().setHorizontalRule().run()
            })}
            {tool('Clear formatting', <FormatClear />, () => {
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            })}
            {editor.isActive('table') && (
              <>
                <Button onClick={() => editor.chain().focus().addRowAfter().run()}>Add row</Button>
                <Button onClick={() => editor.chain().focus().addColumnAfter().run()}>
                  Add column
                </Button>
                <Button onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</Button>
                <Button onClick={() => editor.chain().focus().deleteColumn().run()}>
                  Delete column
                </Button>
                <Button onClick={() => editor.chain().focus().deleteTable().run()}>
                  Remove table
                </Button>
              </>
            )}
          </Box>
          <Box
            sx={{
              p: { xs: 2, md: 3 },
              '& .tiptap': {
                minHeight: 360,
                outline: 'none',
                lineHeight: 1.8,
                overflowWrap: 'anywhere',
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: 4,
                },
              },
              '& img': { maxWidth: '100%' },
              '& table': { borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' },
              '& th,& td': { border: '1px solid', borderColor: 'divider', p: 1 },
              '& pre': { ...insetSurface, p: 2, overflowX: 'auto' },
              '& blockquote': { borderLeft: '3px solid', borderColor: 'secondary.main', pl: 2 },
              '& ul[data-type=taskList]': { listStyle: 'none', p: 0 },
              '& li[data-type=taskItem]': { display: 'flex', gap: 1 },
            }}
          >
            <EditorContent editor={editor} />
          </Box>
        </>
      )}
      {mode === 'markdown' && (
        <BrandedTextField
          label="Markdown source"
          fullWidth
          multiline
          minRows={16}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          sx={{ p: 2, '& textarea': { fontFamily: 'monospace' } }}
        />
      )}
      {mode === 'preview' && (
        <Box sx={{ p: { xs: 2, md: 4 }, minHeight: 360 }}>
          <ArticleMarkdown body={value} />
        </Box>
      )}
      <Dialog
        open={!!dialog}
        onClose={() => {
          if (!uploading) setDialog(null)
        }}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: raisedSurface }}
      >
        <DialogTitle>{dialog === 'image' ? 'Add an article image' : 'Add a link'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {dialog === 'image' ? (
            <>
              <ImageUpload
                label="Article image"
                value={url}
                onChange={setUrl}
                disabled={uploading}
                uploadFn={async (file, progress) => {
                  setUploading(true)
                  onBusy(true)
                  try {
                    return await uploadImageViaApi(file, 'misc', progress)
                  } finally {
                    setUploading(false)
                    onBusy(false)
                  }
                }}
              />
              <BrandedTextField
                fullWidth
                label="Describe the image"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                sx={{ mt: 2 }}
              />
            </>
          ) : (
            <BrandedTextField
              label="Link URL"
              fullWidth
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              helperText="Use an https:// or mailto: address."
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={uploading} onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={
              uploading ||
              (dialog === 'image' ? !url || !alt.trim() : !/^(https:\/\/|mailto:)/i.test(url))
            }
            onClick={() => {
              if (dialog === 'image') editor.chain().focus().setImage({ src: url, alt }).run()
              else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
              setDialog(null)
            }}
          >
            Insert
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
