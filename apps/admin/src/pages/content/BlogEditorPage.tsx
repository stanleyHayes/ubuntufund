import { useCallback, useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate, useBeforeUnload, useBlocker } from 'react-router-dom'
import {
  Box,
  Stack,
  Button,
  Typography,
  Stepper,
  Step,
  StepButton,
  Alert,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material'
import {
  ArticleRounded,
  SaveRounded,
  ArrowBackRounded,
  ArrowForwardRounded,
  PublishRounded,
} from '@mui/icons-material'
import { ArticleMarkdown, BrandedTextField, ImageUpload } from '@ubuntu-fund/ui'
import type { BlogDraft, BlogRecord } from '@ubuntu-fund/types'
import PageHeader from '@/components/PageHeader'
import { ReviewQueueSkeleton } from '@/components/ReviewQueueStates'
import BlogRichEditor from '@/components/content/BlogRichEditor'
import { api } from '@/lib/api'
import { uploadImageViaApi } from '@/lib/uploadImage'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
const blank: BlogDraft = {
  title: '',
  slug: '',
  excerpt: '',
  category: '',
  authorName: '',
  authorRole: '',
  image: '',
  imageAlt: '',
  body: '',
  featured: false,
}
const steps = ['Details', 'Write', 'Media', 'Review']
export default function BlogEditorPage() {
  const { id } = useParams(),
    navigate = useNavigate(),
    location = useLocation()
  const [record, setRecord] = useState<BlogRecord | null>(null),
    [draft, setDraft] = useState<BlogDraft>(blank),
    [step, setStep] = useState<number>(location.state?.editorStep ?? 0)
  const [loading, setLoading] = useState(id !== 'new'),
    [saving, setSaving] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState<string>(location.state?.editorNotice ?? ''),
    [reviewed, setReviewed] = useState(false),
    [unpublish, setUnpublish] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(record?.draft ?? blank)
  const busy = saving || uploading
  const blocker = useBlocker((dirty || uploading) && !saving)
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (dirty || uploading) {
          event.preventDefault()
          event.returnValue = ''
        }
      },
      [dirty, uploading],
    ),
  )
  const load = useCallback(async () => {
    if (!id || id === 'new') {
      setRecord(null)
      setDraft(blank)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const post = await api.get<BlogRecord>(`/blog/admin/posts/${id}`)
      setRecord(post)
      setDraft(post.draft)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load article')
    } finally {
      setLoading(false)
    }
  }, [id])
  useEffect(() => {
    void load()
  }, [load])
  const update = <K extends keyof BlogDraft>(key: K, value: BlogDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setReviewed(false)
    setNotice('')
  }
  const fields = (
    Object.entries({
      title: 'Title',
      slug: 'URL slug',
      excerpt: 'Summary',
      category: 'Category',
      authorName: 'Author',
      image: 'Cover image',
      imageAlt: 'Cover description',
      body: 'Article body',
    }) as [keyof BlogDraft, string][]
  )
    .filter(([key]) => !String(draft[key]).trim())
    .map(([, label]) => label)
  const persist = async () => {
    const saved = record
      ? await api.put<BlogRecord>(`/blog/admin/posts/${record.id}`, {
          draft,
          revision: record.revision,
        })
      : await api.post<BlogRecord>('/blog/admin/posts', { draft })
    setRecord(saved)
    return saved
  }
  const save = async (publish = false) => {
    if (busy) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      let saved = await persist()
      if (publish)
        saved = await api.post<BlogRecord>(`/blog/admin/posts/${saved.id}/publish`, {
          revision: saved.revision,
        })
      setRecord(saved)
      setDraft(saved.draft)
      setNotice(
        publish
          ? 'Article published to the Ujimora blog.'
          : 'Draft saved. Your public article has not changed.',
      )
      if (id === 'new')
        navigate(`/content/blog/${saved.id}`, {
          replace: true,
          state: {
            editorStep: step,
            editorNotice: publish ? 'Article published to the Ujimora blog.' : 'Draft saved.',
          },
        })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the article')
    } finally {
      setSaving(false)
    }
  }
  const upload = async (file: File, progress: (n: number) => void) => {
    setUploading(true)
    try {
      return await uploadImageViaApi(file, 'misc', progress)
    } finally {
      setUploading(false)
    }
  }
  return (
    <Box>
      <PageHeader
        eyebrow="Content studio · Blog"
        title={draft.title || 'Create an article'}
        lede="A private draft, a careful review, and a story ready to share."
        tone="gold"
        icon={<ArticleRounded />}
        actions={
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            <Button onClick={() => navigate('/content/blog')} startIcon={<ArrowBackRounded />}>
              All articles
            </Button>
            <Button
              variant="outlined"
              startIcon={<SaveRounded />}
              disabled={loading || busy}
              onClick={() => save()}
            >
              Save draft
            </Button>
          </Stack>
        }
      />
      {loading ? (
        <ReviewQueueSkeleton label="Loading article editor" />
      ) : error && !record && id !== 'new' ? (
        <Alert severity="error" action={<Button onClick={load}>Retry</Button>}>
          {error}
        </Alert>
      ) : (
        <>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip
              label={
                record?.published ? 'Published article · editing private draft' : 'Private draft'
              }
              color={record?.published ? 'success' : 'default'}
            />
            {dirty && <Chip label="Unsaved changes" />}
          </Stack>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {notice && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {notice}
            </Alert>
          )}
          <Stepper
            nonLinear
            activeStep={step}
            alternativeLabel
            sx={{ ...raisedSurface, p: { xs: 1, sm: 3 }, mb: 3 }}
          >
            {steps.map((label, index) => (
              <Step key={label}>
                <StepButton
                  disabled={busy}
                  onClick={() => {
                    setStep(index)
                    setReviewed(false)
                  }}
                >
                  {label}
                </StepButton>
              </Step>
            ))}
          </Stepper>
          <Box component="fieldset" disabled={busy} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            {step === 0 && (
              <Box sx={{ ...raisedSurface, p: { xs: 2, md: 4 }, display: 'grid', gap: 3 }}>
                <Typography variant="h5">Give your story a clear introduction</Typography>
                <BrandedTextField
                  label="Article title"
                  fullWidth
                  value={draft.title}
                  onChange={(e) => {
                    update('title', e.target.value)
                    if (
                      !record &&
                      (!draft.slug ||
                        draft.slug ===
                          draft.title
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, ''))
                    )
                      update(
                        'slug',
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-|-$/g, ''),
                      )
                  }}
                  inputProps={{ maxLength: 180 }}
                />
                <BrandedTextField
                  label="URL slug"
                  fullWidth
                  value={draft.slug}
                  onChange={(e) => update('slug', e.target.value)}
                  helperText={`ujimora.com/blog/${draft.slug || 'your-article'} · lowercase letters, numbers and hyphens`}
                />
                <BrandedTextField
                  label="Short summary"
                  multiline
                  minRows={3}
                  fullWidth
                  value={draft.excerpt}
                  onChange={(e) => update('excerpt', e.target.value)}
                  inputProps={{ maxLength: 500 }}
                />
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
                    gap: 2,
                  }}
                >
                  {(['category', 'authorName', 'authorRole'] as const).map((key) => (
                    <BrandedTextField
                      key={key}
                      label={
                        {
                          category: 'Category',
                          authorName: 'Author name',
                          authorRole: 'Author role (optional)',
                        }[key]
                      }
                      value={draft[key]}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  ))}
                </Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={draft.featured}
                      onChange={(e) => update('featured', e.target.checked)}
                    />
                  }
                  label="Feature this article on the blog"
                />
              </Box>
            )}
            {step === 1 && (
              <BlogRichEditor
                key={record?.id ?? 'new'}
                value={draft.body}
                onChange={(body) => update('body', body)}
                disabled={busy}
                onBusy={setUploading}
              />
            )}
            {step === 2 && (
              <Box sx={{ ...raisedSurface, p: { xs: 2, md: 4 }, display: 'grid', gap: 3 }}>
                <Typography variant="h5">Choose the first impression</Typography>
                <Typography color="text.secondary">
                  Upload a landscape cover you have permission to use. Add a useful description for
                  readers who cannot see it.
                </Typography>
                <Box sx={{ maxWidth: 720 }}>
                  <ImageUpload
                    label="Article cover"
                    value={draft.image}
                    onChange={(url) => update('image', url)}
                    uploadFn={upload}
                    disabled={busy}
                    aspectRatio={16 / 9}
                  />
                </Box>
                <BrandedTextField
                  label="Cover image description"
                  fullWidth
                  value={draft.imageAlt}
                  onChange={(e) => update('imageAlt', e.target.value)}
                  inputProps={{ maxLength: 300 }}
                />
              </Box>
            )}
            {step === 3 && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 280px' },
                  gap: 3,
                }}
              >
                <Box sx={{ ...raisedSurface, overflow: 'hidden' }}>
                  {draft.image && (
                    <Box
                      component="img"
                      src={draft.image}
                      alt={draft.imageAlt}
                      sx={{ width: '100%', maxHeight: 400, objectFit: 'cover' }}
                    />
                  )}
                  <Box sx={{ p: { xs: 2, md: 4 } }}>
                    <Typography color="secondary.main" variant="overline">
                      {draft.category}
                    </Typography>
                    <Typography variant="h3" sx={{ overflowWrap: 'anywhere', mb: 2 }}>
                      {draft.title || 'Untitled article'}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                      By {draft.authorName || 'Add an author'} ·{' '}
                      {Math.max(1, Math.ceil(draft.body.split(/\s+/).length / 200))} min read
                    </Typography>
                    <Typography sx={{ ...insetSurface, p: 2, mb: 3 }}>{draft.excerpt}</Typography>
                    <ArticleMarkdown body={draft.body} />
                  </Box>
                </Box>
                <Stack spacing={2} sx={{ ...raisedSurface, p: 3, alignSelf: 'start' }}>
                  <Typography variant="h6">Ready to publish?</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Check wording, links, image rights and accessibility. Publishing makes this
                    reviewed draft public.
                  </Typography>
                  {fields.length > 0 && (
                    <Alert severity="warning">Complete: {fields.join(', ')}.</Alert>
                  )}
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={reviewed}
                        onChange={(e) => setReviewed(e.target.checked)}
                      />
                    }
                    label="I have reviewed this article and its media."
                  />
                  <Button
                    variant="contained"
                    startIcon={<PublishRounded />}
                    disabled={busy || !reviewed || !!fields.length}
                    onClick={() => save(true)}
                  >
                    {record?.published ? 'Publish changes' : 'Publish article'}
                  </Button>
                  {record?.published && (
                    <Button color="warning" onClick={() => setUnpublish(true)}>
                      Unpublish article
                    </Button>
                  )}
                </Stack>
              </Box>
            )}
          </Box>
          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2, mt: 3 }}>
            <Button
              disabled={step === 0 || busy}
              startIcon={<ArrowBackRounded />}
              onClick={() => {
                setStep((s) => s - 1)
                setReviewed(false)
              }}
            >
              Back
            </Button>
            {step < 3 && (
              <Button
                variant="contained"
                disabled={busy}
                endIcon={<ArrowForwardRounded />}
                onClick={() => {
                  setStep((s) => s + 1)
                  setReviewed(false)
                }}
              >
                Continue to {steps[step + 1].toLowerCase()}
              </Button>
            )}
          </Stack>
        </>
      )}
      <Dialog open={blocker.state === 'blocked'} PaperProps={{ sx: raisedSurface }}>
        <DialogTitle>Keep your draft?</DialogTitle>
        <DialogContent>
          Your latest changes have not been saved. Stay here to save them, or leave and discard
          those changes.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => blocker.reset?.()}>Keep editing</Button>
          <Button color="warning" onClick={() => blocker.proceed?.()}>
            Discard changes
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={unpublish}
        onClose={() => {
          if (!saving) setUnpublish(false)
        }}
        PaperProps={{ sx: raisedSurface }}
      >
        <DialogTitle>Unpublish this article?</DialogTitle>
        <DialogContent>
          It will disappear from the public blog. Your draft stays available here.
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setUnpublish(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            color="warning"
            onClick={async () => {
              if (!record) return
              setSaving(true)
              try {
                const saved = await api.post<BlogRecord>(
                  `/blog/admin/posts/${record.id}/unpublish`,
                  { revision: record.revision },
                )
                setRecord(saved)
                setUnpublish(false)
                setNotice('Article unpublished. Your draft is retained.')
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not unpublish')
              } finally {
                setSaving(false)
              }
            }}
          >
            Unpublish
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
