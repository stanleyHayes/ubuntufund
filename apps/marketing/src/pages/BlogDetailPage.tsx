import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import { SHAPE, ItemNotFound } from '@ubuntu-fund/ui'
import { blogPosts, CATEGORY_COLORS } from './BlogPage'

// Editorial fallback copy. This intentionally avoids invented impact metrics,
// customer quotes, or claims about payment providers that are not live.
function generateBody(post: (typeof blogPosts)[number]): string[] {
  return [
    post.excerpt,
    `For campaign creators, ${post.category.toLowerCase()} begins with a specific goal, evidence that supporters can assess, and a realistic explanation of how funds will be used. Avoid promises that cannot be measured or verified.`,
    'Publish updates when circumstances, budgets, or timelines change. A useful update identifies what happened, what evidence is available, and what the campaign will do next.',
    'Supporters should review the campaign story, organizer details, verification state, and recent activity before contributing. A platform review is one signal, not a guarantee of outcome.',
    'UbuntuFund currently records wallet-backed contributions in Ghanaian cedis. External payment and payout methods remain unavailable until their production adapters and compliance checks are complete.',
    'Good fundraising communication is concrete, respectful, and accountable. Protect personal information, obtain consent for sensitive images, and keep records that can support later review.',
  ]
}

function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const post = blogPosts.find((p) => p.slug === slug)

  const navigate = useNavigate()

  if (!post) {
    return (
      <Container maxWidth="md" sx={{ py: 10 }}>
        <ItemNotFound
          itemType="Blog post"
          message="The blog post you're looking for doesn't exist or has been moved."
          onBack={() => navigate('/blog')}
          backLabel="Back to Blog"
        />
      </Container>
    )
  }

  const accent = CATEGORY_COLORS[post.category] || '#2E3D2F'
  const bodyParagraphs = generateBody(post)
  const relatedPosts = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 3)

  return (
    <Box component="article" sx={{ pb: 10 }}>
      {/* Hero image */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: 280, md: 420 },
          overflow: 'hidden',
        }}
      >
        <Box
          component="img"
          src={post.image}
          alt={post.title}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)',
          }}
        />

        {/* Back button */}
        <Button
          component={RouterLink}
          to="/blog"
          startIcon={<ArrowBackIcon />}
          sx={{
            position: 'absolute',
            top: 24,
            left: 24,
            color: '#fff',
            bgcolor: 'rgba(28,38,29,0.72)',
            borderRadius: SHAPE.sm,
            fontWeight: 600,
            fontSize: '0.85rem',
            transition: 'background-color 200ms ease',
            '&:hover': { bgcolor: 'rgba(28,38,29,0.88)' },
          }}
        >
          Back to Blog
        </Button>

        {/* Category badge on image */}
        <Chip
          label={post.category}
          size="small"
          sx={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            bgcolor: accent,
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.75rem',
          }}
        />
      </Box>

      <Container maxWidth="md" sx={{ mt: -6, position: 'relative', zIndex: 1 }}>
        {/* Main content card */}
        <Box
          sx={{
            bgcolor: 'background.paper',
            borderRadius: SHAPE.card,
            p: { xs: 3, md: 5 },
            boxShadow: 'var(--neu-raised)',
          }}
        >
          {/* Title */}
          <Typography
            variant="h3"
            sx={{
              fontWeight: 900,
              lineHeight: 1.2,
              mb: 3,
              fontSize: { xs: '1.6rem', sm: '2rem', md: '2.4rem' },
            }}
          >
            {post.title}
          </Typography>

          {/* Meta row */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 3,
              mb: 4,
            }}
          >
            {/* Author */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar
                sx={{
                  width: 44,
                  height: 44,
                  bgcolor: accent,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                }}
              >
                {post.author.avatar}
              </Avatar>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2 }}>
                  {post.author.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {post.author.role}
                </Typography>
              </Box>
            </Box>

            <Divider orientation="vertical" flexItem />

            {/* Date */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
              <CalendarTodayIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2">{post.date}</Typography>
            </Box>

            {/* Read time */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
              <AccessTimeIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2">{post.readTime} min read</Typography>
            </Box>
          </Box>

          {/* Kente divider */}
          <Box
            sx={{
              height: 3,
              borderRadius: SHAPE.bar,
              mb: 4,
              background: `repeating-linear-gradient(
                90deg,
                #2E3D2F 0px, #2E3D2F 12px,
                #C7A24A 12px, #C7A24A 24px,
                #8D6E63 24px, #8D6E63 36px,
                #1C261D 36px, #1C261D 48px
              )`,
              opacity: 0.6,
            }}
          />

          {/* Body content */}
          <Box sx={{ maxWidth: 680, mx: 'auto' }}>
            {bodyParagraphs.map((paragraph, i) => {
              // Make the 4th paragraph (quote) styled differently
              if (i === 3) {
                return (
                  <Box
                    key={i}
                    sx={{
                      my: 4,
                      pl: 3,
                      borderLeft: `4px solid ${accent}`,
                      py: 1,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '1.1rem',
                        fontStyle: 'italic',
                        lineHeight: 1.8,
                        color: 'text.primary',
                        fontWeight: 500,
                      }}
                    >
                      {paragraph}
                    </Typography>
                  </Box>
                )
              }

              return (
                <Typography
                  key={i}
                  sx={{
                    fontSize: '1.05rem',
                    lineHeight: 1.9,
                    color: 'text.secondary',
                    mb: 3,
                    ...(i === 0 && {
                      fontSize: '1.15rem',
                      color: 'text.primary',
                      fontWeight: 500,
                    }),
                  }}
                >
                  {paragraph}
                </Typography>
              )
            })}
          </Box>

          {/* Tags / share section */}
          <Divider sx={{ my: 4 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              Tags:
            </Typography>
            <Chip
              label={post.category}
              size="small"
              sx={{
                bgcolor: `${accent}14`,
                color: accent,
                fontWeight: 600,
                border: `1px solid ${accent}30`,
              }}
            />
            <Chip
              label="Ghana"
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            <Chip
              label="Crowdfunding"
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          </Box>
        </Box>

        {/* Related posts */}
        <Box sx={{ mt: 8 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>
            More from UbuntuFund
          </Typography>
          <Grid container spacing={3}>
            {relatedPosts.map((related) => {
              const relAccent = CATEGORY_COLORS[related.category] || '#2E3D2F'
              return (
                <Grid key={related.slug} size={{ xs: 12, sm: 4 }}>
                  <Box
                    component={RouterLink}
                    to={`/blog/${related.slug}`}
                    sx={{
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'block',
                      borderRadius: SHAPE.card,
                      overflow: 'hidden',
                      bgcolor: 'background.paper',
                      boxShadow: 'var(--neu-raised)',
                      transition: 'border-color 0.3s ease',
                      '&:hover': {
                        borderColor: relAccent,
                      },
                    }}
                  >
                    <Box
                      component="img"
                      src={related.image}
                      alt={related.title}
                      sx={{ width: '100%', height: 160, objectFit: 'cover' }}
                    />
                    <Box sx={{ p: 2.5 }}>
                      <Chip
                        label={related.category}
                        size="small"
                        sx={{
                          mb: 1,
                          height: 22,
                          bgcolor: `${relAccent}14`,
                          color: relAccent,
                          fontWeight: 700,
                          fontSize: '0.65rem',
                        }}
                      />
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          lineHeight: 1.35,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {related.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        {related.readTime} min read · {related.date}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              )
            })}
          </Grid>
        </Box>
      </Container>
    </Box>
  )
}

export default BlogDetailPage
