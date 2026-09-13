import ExportMenu from '@/components/ExportMenu'
import { exportTable } from '@/lib/exports/report'
import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Typography, Chip, Stack, Alert, MenuItem } from '@mui/material'
import { ArticleRounded, AddRounded, EditRounded } from '@mui/icons-material'
import { BrandedTextField } from '@ubuntu-fund/ui'
import type { BlogRecord } from '@ubuntu-fund/types'
import PageHeader from '@/components/PageHeader'
import {
  ReviewQueueEmpty,
  ReviewQueueSkeleton,
  ReviewQueueToolbar,
} from '@/components/ReviewQueueStates'
import PaginationBar from '@/components/PaginationBar'
import { usePagination } from '@/hooks/usePagination'
import { raisedSurface } from '@/lib/surfaces'
import { api } from '@/lib/api'
export default function BlogPage() {
  const [posts, setPosts] = useState<BlogRecord[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all')
  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setPosts(await api.get<BlogRecord[]>('/blog/admin/posts'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load articles')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  const pagination = usePagination(
    posts.filter(
      (p) =>
        p.draft.title.toLowerCase().includes(search.toLowerCase()) &&
        (filter === 'all' || (filter === 'published' ? !!p.published : !p.published)),
    ),
  )
  return (
    <Box>
      <PageHeader
        eyebrow="Content studio"
        title="Blog"
        lede="Draft useful stories, review every detail, then publish to the Ujimora journal."
        tone="gold"
        icon={<ArticleRounded />}
        actions={
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            <Button
              component={RouterLink}
              to="/content/blog/new"
              variant="contained"
              startIcon={<AddRounded />}
            >
              Create article
            </Button>
            <ExportMenu
              title="Blog articles"
              disabled={loading || !!error || !posts.length}
              getReport={() => ({
                title: 'Blog articles',
                filters: ['All saved articles and private drafts'],
                tables: [
                  exportTable('Articles', posts, {
                    Title: (p) => p.draft.title,
                    Slug: (p) => p.draft.slug,
                    Status: (p) => (p.published ? 'Published' : 'Draft'),
                    Category: (p) => p.draft.category,
                    Author: (p) => p.draft.authorName,
                    Summary: (p) => p.draft.excerpt,
                    'Body (Markdown)': (p) => p.draft.body,
                    'Cover image': (p) => p.draft.image,
                    'Image description': (p) => p.draft.imageAlt,
                    Updated: (p) => p.updatedAt,
                  }),
                ],
              })}
            />
          </Stack>
        }
      />
      <ReviewQueueToolbar>
        <BrandedTextField
          label="Search articles"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            pagination.goToPage(1)
          }}
        />
        <BrandedTextField
          select
          label="Status"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
            pagination.goToPage(1)
          }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">All articles</MenuItem>
          <MenuItem value="draft">Drafts</MenuItem>
          <MenuItem value="published">Published</MenuItem>
        </BrandedTextField>
        <Button onClick={reload} disabled={loading}>
          Refresh
        </Button>
      </ReviewQueueToolbar>
      {loading ? (
        <ReviewQueueSkeleton label="Loading articles" />
      ) : error ? (
        <Alert severity="error" action={<Button onClick={reload}>Retry</Button>}>
          {error}
        </Alert>
      ) : !pagination.totalItems ? (
        <ReviewQueueEmpty
          title={
            search || filter !== 'all' ? 'No matching articles' : 'Your next story starts here'
          }
          description={
            search || filter !== 'all'
              ? 'Try another search or status.'
              : 'Create a draft and take it through writing, media and a final review.'
          }
          icon={<ArticleRounded />}
        />
      ) : (
        <>
          <Stack spacing={2}>
            {pagination.page.map((post) => (
              <Box
                key={post.id}
                sx={{
                  ...raisedSurface,
                  p: 3,
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
                  <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                    {post.draft.title || 'Untitled article'}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {post.draft.category || 'No category'} · Updated{' '}
                    {new Date(post.updatedAt).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {post.draft.excerpt || 'Add a summary to introduce your story.'}
                  </Typography>
                </Box>
                <Chip
                  label={post.published ? 'Published · draft editable' : 'Draft'}
                  color={post.published ? 'success' : 'default'}
                />
                <Button
                  component={RouterLink}
                  to={`/content/blog/${post.id}`}
                  startIcon={<EditRounded />}
                >
                  Edit article
                </Button>
              </Box>
            ))}
          </Stack>
          <PaginationBar pagination={pagination} neumorphic />
        </>
      )}
    </Box>
  )
}
