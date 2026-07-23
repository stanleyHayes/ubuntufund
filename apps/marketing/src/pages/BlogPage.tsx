import { useState } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import { Link as RouterLink } from 'react-router-dom'
import { SHAPE } from '@ubuntu-fund/ui'

// ─── Data ──────────────────────────────────────────────────

export interface BlogPost {
  slug: string
  title: string
  date: string
  category: string
  excerpt: string
  image: string
  readTime: number
  author: { name: string; avatar: string; role: string }
  featured?: boolean
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'mobile-money-revolutionizing-giving',
    title: 'How Mobile Money Is Revolutionizing Charitable Giving in East Africa',
    date: 'March 15, 2026',
    category: 'Trends',
    excerpt:
      'Mobile money platforms like M-Pesa have transformed how millions of Africans send and receive funds. Now, this same technology is making it easier than ever to support community causes and charitable campaigns across the continent.',
    image: 'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=800&h=500&fit=crop',
    readTime: 7,
    author: { name: 'Amina Okafor', avatar: 'AO', role: 'Head of Partnerships' },
    featured: true,
  },
  {
    slug: 'building-trust-verification-journey',
    title: 'Building Trust in African Crowdfunding: Our Verification Journey',
    date: 'March 1, 2026',
    category: 'Trust & Safety',
    excerpt:
      'Transparency is the foundation of successful crowdfunding. Learn how UbuntuFund developed its multi-layer verification system to ensure donors can give with confidence.',
    image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&h=400&fit=crop',
    readTime: 5,
    author: { name: 'Kwame Asante', avatar: 'KA', role: 'CTO' },
  },
  {
    slug: '5-campaigns-that-changed-communities',
    title: '5 Campaigns That Changed Communities: Stories from 2025',
    date: 'February 18, 2026',
    category: 'Impact',
    excerpt:
      'From a solar-powered classroom in rural Kenya to a women\'s cooperative in Senegal, these five campaigns demonstrate the transformative power of collective giving.',
    image: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=600&h=400&fit=crop',
    readTime: 9,
    author: { name: 'Fatou Diallo', avatar: 'FD', role: 'Impact Lead' },
  },
  {
    slug: 'rise-of-diaspora-giving',
    title: 'The Rise of Diaspora Giving: Connecting Africans Abroad with Home',
    date: 'February 5, 2026',
    category: 'Community',
    excerpt:
      'The African diaspora sends over $90 billion in remittances annually. A growing portion is being channeled through crowdfunding platforms to support education, healthcare, and infrastructure.',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&h=400&fit=crop',
    readTime: 6,
    author: { name: 'Tendai Moyo', avatar: 'TM', role: 'Community Manager' },
  },
  {
    slug: 'crowdfunding-for-education',
    title: 'Crowdfunding for Education: Bridging the Gap in African Schools',
    date: 'January 22, 2026',
    category: 'Education',
    excerpt:
      'Education campaigns are among the most successful on UbuntuFund, with an average success rate of 78%. Discover why education resonates so strongly with donors.',
    image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=400&fit=crop',
    readTime: 8,
    author: { name: 'Ngozi Eze', avatar: 'NE', role: 'Education Specialist' },
  },
  {
    slug: 'guide-successful-health-campaign',
    title: 'A Guide to Running a Successful Health Campaign',
    date: 'January 10, 2026',
    category: 'Guide',
    excerpt:
      'Health-related campaigns require special attention to detail, transparency, and urgency. This comprehensive guide covers everything from crafting your story to managing donor updates.',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=400&fit=crop',
    readTime: 12,
    author: { name: 'Dr. Yemi Adeyemi', avatar: 'YA', role: 'Health Advisor' },
  },
]

const CATEGORIES = ['All', 'Trends', 'Trust & Safety', 'Impact', 'Community', 'Education', 'Guide']

export const CATEGORY_COLORS: Record<string, string> = {
  Trends: '#2E7D32',
  'Trust & Safety': '#1565C0',
  Impact: '#E65100',
  Community: '#F9A825',
  Education: '#7B1FA2',
  Guide: '#00838F',
}

// ─── Kente Divider ─────────────────────────────────────────

function KenteDivider() {
  return (
    <Box
      sx={{
        height: 3,
        borderRadius: SHAPE.bar,
        background: `repeating-linear-gradient(
          90deg,
          #2E7D32 0px, #2E7D32 12px,
          #F9A825 12px, #F9A825 24px,
          #8D6E63 24px, #8D6E63 36px,
          #1B5E20 36px, #1B5E20 48px
        )`,
        opacity: 0.6,
      }}
    />
  )
}

// ─── Featured Hero Card ────────────────────────────────────

function FeaturedBlogCard({ post }: { post: BlogPost }) {
  const [hovered, setHovered] = useState(false)
  const accent = CATEGORY_COLORS[post.category] || '#2E7D32'

  return (
    <Box
      component={RouterLink}
      to={`/blog/${post.slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        borderRadius: SHAPE.card,
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid',
        borderColor: hovered ? accent : 'divider',
        transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered
          ? `0 24px 48px ${accent}18, 0 8px 24px rgba(0,0,0,0.06)`
          : '0 2px 12px rgba(0,0,0,0.04)',
        bgcolor: 'background.paper',
      }}
    >
      {/* Kente top accent */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          zIndex: 2,
          background: `repeating-linear-gradient(
            90deg,
            #2E7D32 0px, #2E7D32 20px,
            #F9A825 20px, #F9A825 40px,
            #8D6E63 40px, #8D6E63 60px,
            #1B5E20 60px, #1B5E20 80px
          )`,
        }}
      />

      {/* Image — trapezoid clip on desktop */}
      <Box
        sx={{
          position: 'relative',
          width: { xs: '100%', md: '55%' },
          minHeight: { xs: 240, md: 380 },
          overflow: 'hidden',
          flexShrink: 0,
          // Trapezoid: angled right edge on desktop
          clipPath: { xs: 'none', md: 'polygon(0 0, 92% 0, 100% 100%, 0 100%)' },
        }}
      >
        <Box
          component="img"
          src={post.image}
          alt={post.title}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
            transform: hovered ? 'scale(1.04)' : 'scale(1)',
          }}
        />

        {/* Gradient overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: {
              xs: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.5) 100%)',
              md: 'linear-gradient(90deg, transparent 30%, rgba(0,0,0,0.3) 100%)',
            },
          }}
        />

        {/* "Editor's Pick" badge */}
        <Box
          sx={{
            position: 'absolute',
            top: 20,
            left: 20,
            bgcolor: '#F9A825',
            color: '#1B5E20',
            px: 2,
            py: 0.5,
            borderRadius: SHAPE.sm,
            fontWeight: 800,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: 1,
            clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
          }}
        >
          Editor's Pick
        </Box>
      </Box>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          p: { xs: 3, md: 5 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Chip
            label={post.category}
            size="small"
            sx={{
              bgcolor: `${accent}14`,
              color: accent,
              fontWeight: 700,
              fontSize: '0.7rem',
              border: `1px solid ${accent}30`,
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <AccessTimeIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption">{post.readTime} min read</Typography>
          </Box>
        </Box>

        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            lineHeight: 1.25,
            mb: 2,
            fontSize: { xs: '1.5rem', md: '1.85rem' },
          }}
        >
          {post.title}
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ lineHeight: 1.8, mb: 3, maxWidth: 480 }}
        >
          {post.excerpt}
        </Typography>

        <Divider sx={{ mb: 2.5 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: accent, fontSize: '0.8rem', fontWeight: 700 }}>
              {post.author.avatar}
            </Avatar>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {post.author.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {post.date}
              </Typography>
            </Box>
          </Box>
          <Button
            endIcon={<ArrowForwardIcon />}
            sx={{
              fontWeight: 700,
              color: accent,
              '&:hover': { bgcolor: `${accent}08` },
            }}
          >
            Read
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

// ─── Regular Blog Card ─────────────────────────────────────

function BlogCard({ post, variant = 'vertical' }: { post: BlogPost; variant?: 'vertical' | 'horizontal' }) {
  const [hovered, setHovered] = useState(false)
  const accent = CATEGORY_COLORS[post.category] || '#2E7D32'

  if (variant === 'horizontal') {
    return (
      <Box
        component={RouterLink}
        to={`/blog/${post.slug}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'flex',
          gap: 2.5,
          cursor: 'pointer',
          p: 2,
          borderRadius: SHAPE.card,
          transition: 'all 0.3s ease',
          bgcolor: hovered ? 'rgba(46,125,50,0.02)' : 'transparent',
        }}
      >
        {/* Small thumbnail with rounded-corner notch */}
        <Box
          sx={{
            width: 100,
            height: 100,
            flexShrink: 0,
            borderRadius: SHAPE.card,
            overflow: 'hidden',
            clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)',
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
              transition: 'transform 0.4s ease',
              transform: hovered ? 'scale(1.08)' : 'scale(1)',
            }}
          />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: accent, flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: accent, fontWeight: 600 }}>
              {post.category}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              · {post.readTime} min
            </Typography>
          </Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              lineHeight: 1.35,
              mb: 0.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              transition: 'color 0.2s',
              color: hovered ? accent : 'text.primary',
            }}
          >
            {post.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {post.author.name} · {post.date}
          </Typography>
        </Box>
      </Box>
    )
  }

  // Vertical card
  return (
    <Box
      component={RouterLink}
      to={`/blog/${post.slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        textDecoration: 'none',
        color: 'inherit',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        borderRadius: SHAPE.card,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: hovered ? accent : 'divider',
        clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%)',
        transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        transform: hovered ? 'translateY(-6px)' : 'none',
        boxShadow: hovered
          ? `0 16px 32px ${accent}12, 0 4px 12px rgba(0,0,0,0.04)`
          : '0 1px 4px rgba(0,0,0,0.03)',
        // Accent triangle in the notched corner
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 34,
          height: 34,
          background: `linear-gradient(135deg, transparent 50%, ${accent}15 50%)`,
          pointerEvents: 'none',
        },
        position: 'relative',
      }}
    >
      {/* Image */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <Box
          component="img"
          src={post.image}
          alt={post.title}
          sx={{
            width: '100%',
            height: 200,
            objectFit: 'cover',
            transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
            transform: hovered ? 'scale(1.06)' : 'scale(1)',
          }}
        />

        {/* Bottom gradient */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.4))',
          }}
        />

        {/* Read time badge */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            color: '#fff',
            px: 1.25,
            py: 0.25,
            borderRadius: SHAPE.sm,
            fontSize: '0.7rem',
            fontWeight: 600,
          }}
        >
          <AccessTimeIcon sx={{ fontSize: 12 }} />
          {post.readTime} min
        </Box>

        {/* Category accent stripe on the left edge */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 4,
            height: '100%',
            bgcolor: accent,
          }}
        />
      </Box>

      {/* Content */}
      <Box sx={{ p: 2.5, pt: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Chip
            label={post.category}
            size="small"
            sx={{
              height: 22,
              bgcolor: `${accent}12`,
              color: accent,
              fontWeight: 700,
              fontSize: '0.65rem',
              border: `1px solid ${accent}25`,
            }}
          />
        </Box>

        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            lineHeight: 1.35,
            mb: 1,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            transition: 'color 0.25s',
            color: hovered ? accent : 'text.primary',
          }}
        >
          {post.title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            lineHeight: 1.6,
            mb: 2,
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {post.excerpt}
        </Typography>

        {/* Author row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 'auto' }}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: accent, fontSize: '0.65rem', fontWeight: 700 }}>
            {post.author.avatar}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', lineHeight: 1.2 }}>
              {post.author.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {post.date}
            </Typography>
          </Box>
          <ArrowForwardIcon
            sx={{
              fontSize: 16,
              color: accent,
              transition: 'transform 0.25s',
              transform: hovered ? 'translateX(3px)' : 'none',
            }}
          />
        </Box>
      </Box>
    </Box>
  )
}

// ─── Blog Page ─────────────────────────────────────────────

function BlogPage() {
  const [activeCategory, setActiveCategory] = useState('All')

  const featured = blogPosts.find((p) => p.featured)!
  const rest = blogPosts.filter((p) => !p.featured)

  const filtered =
    activeCategory === 'All' ? rest : rest.filter((p) => p.category === activeCategory)

  return (
    <Box component="main" sx={{ flex: 1, pt: { xs: 3, md: 5 }, pb: 10 }}>
      <Container maxWidth="lg">
        {/* Category filter pills */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            mb: 5,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat
            const color = cat === 'All' ? '#2E7D32' : CATEGORY_COLORS[cat] || '#2E7D32'
            return (
              <Chip
                key={cat}
                label={cat}
                onClick={() => setActiveCategory(cat)}
                variant={active ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  borderRadius: SHAPE.sm,
                  px: 0.5,
                  transition: 'all 0.2s ease',
                  ...(active
                    ? {
                        bgcolor: color,
                        color: '#fff',
                        borderColor: color,
                        '&:hover': { bgcolor: color },
                      }
                    : {
                        borderColor: `${color}40`,
                        color: 'text.secondary',
                        '&:hover': { bgcolor: `${color}08`, borderColor: color, color },
                      }),
                }}
              />
            )
          })}
        </Box>

        {/* Featured article — hero */}
        {activeCategory === 'All' && (
          <Box sx={{ mb: 6 }}>
            <FeaturedBlogCard post={featured} />
          </Box>
        )}

        {/* Section divider */}
        {activeCategory === 'All' && (
          <Box sx={{ mb: 5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                Latest Articles
              </Typography>
              <Box sx={{ flex: 1 }}>
                <KenteDivider />
              </Box>
            </Box>
          </Box>
        )}

        {/* Two-column layout: main grid + sidebar */}
        <Grid container spacing={4}>
          {/* Main content — card grid */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Grid container spacing={3}>
              {filtered.slice(0, 4).map((post, i) => (
                <Grid key={i} size={{ xs: 12, sm: 6 }}>
                  <BlogCard post={post} />
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Sidebar */}
          <Grid size={{ xs: 12, md: 4 }}>
            {/* Popular posts (horizontal compact cards) */}
            <Box
              sx={{
                bgcolor: 'background.paper',
                borderRadius: SHAPE.card,
                border: '1px solid',
                borderColor: 'divider',
                p: 3,
                mb: 3,
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
                Popular
              </Typography>
              <KenteDivider />
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {rest.slice(0, 3).map((post, i) => (
                  <BlogCard key={i} post={post} variant="horizontal" />
                ))}
              </Box>
            </Box>

            {/* Newsletter card */}
            <Box
              sx={{
                borderRadius: SHAPE.card,
                p: 3.5,
                background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)',
                color: '#fff',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Decorative circles */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -30,
                  right: -30,
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.1)',
                  pointerEvents: 'none',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -20,
                  left: -20,
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: 'rgba(249,168,37,0.1)',
                  pointerEvents: 'none',
                }}
              />

              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, position: 'relative' }}>
                Stay in the loop
              </Typography>
              <Typography variant="body2" sx={{ mb: 2.5, opacity: 0.85, lineHeight: 1.6, position: 'relative' }}>
                Get the latest stories from Africa's giving community, delivered to your inbox.
              </Typography>
              <Box
                component="input"
                placeholder="Your email"
                sx={{
                  width: '100%',
                  p: 1.5,
                  borderRadius: SHAPE.card,
                  border: '1px solid rgba(255,255,255,0.2)',
                  bgcolor: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '0.875rem',
                  outline: 'none',
                  mb: 1.5,
                  '&::placeholder': { color: 'rgba(255,255,255,0.5)' },
                  '&:focus': { borderColor: '#F9A825' },
                }}
              />
              <Button
                variant="contained"
                fullWidth
                sx={{
                  bgcolor: '#F9A825',
                  color: '#1B5E20',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#FDD835' },
                }}
              >
                Subscribe
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

export default BlogPage
