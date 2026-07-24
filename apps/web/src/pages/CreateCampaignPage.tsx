import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { SHAPE } from '@ubuntu-fund/ui'
import { CampaignForm } from '@/components/campaigns/CampaignForm'

const FOREST = '#2E3D2F'
const SAGE = '#A8B5A0'
const INK = '#1A2E22'
const INK_SECONDARY = '#4A5A50'
const GOLD = '#C7A24A'
const GOLD_DARK = '#A07E33'
const DIVIDER = '#DAD7CD'

const ROADMAP = [
  { label: 'Basics', hint: 'Title, summary & category' },
  { label: 'Story', hint: 'The need, who it helps, a photo' },
  { label: 'Goal & timeline', hint: 'Your GH₵ target and deadline' },
  { label: 'Review', hint: 'Confirm, then send for review' },
]

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      component="span"
      sx={{
        display: 'block',
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        color: GOLD_DARK,
      }}
    >
      {children}
    </Typography>
  )
}

export function CreateCampaignPage() {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 4, md: 7 } }}>
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, 320px) 1fr' },
            gap: { xs: 3.5, md: 6 },
            alignItems: 'start',
          }}
        >
          {/* ---------------------------- Encouragement rail ---------------------------- */}
          <Box component="aside" sx={{ position: { md: 'sticky' }, top: { md: 32 } }}>
            <Eyebrow>Start a campaign</Eyebrow>
            <Typography
              component="h1"
              sx={{ mt: 1, fontWeight: 900, fontSize: { xs: '1.9rem', md: '2.2rem' }, lineHeight: 1.15, color: INK }}
            >
              Rally your community around what matters.
            </Typography>
            <Typography sx={{ mt: 2, color: INK_SECONDARY, lineHeight: 1.65, maxWidth: 420 }}>
              From Accra to Tamale, UbuntuFund helps everyday Ghanaians raise funds with trust built in — every cedi tracked,
              every donor thanked. Take it one step at a time; you can review everything before it goes live.
            </Typography>

            {/* Static roadmap — hidden on mobile where the stepper leads */}
            <Box sx={{ display: { xs: 'none', md: 'block' }, mt: 4 }}>
              <Eyebrow>What we&apos;ll cover</Eyebrow>
              <Box sx={{ mt: 1.75, display: 'grid', gap: 1.75 }}>
                {ROADMAP.map((r, i) => (
                  <Box key={r.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        mt: 0.2,
                        flex: '0 0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: SHAPE.sm,
                        border: `1.5px solid ${DIVIDER}`,
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: FOREST,
                      }}
                    >
                      {i + 1}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: INK }}>{r.label}</Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: INK_SECONDARY }}>{r.hint}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              <Box
                sx={{
                  mt: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: INK_SECONDARY,
                }}
              >
                <Box aria-hidden sx={{ width: 8, height: 8, bgcolor: GOLD, transform: 'rotate(45deg)' }} />
                <Box aria-hidden sx={{ width: 8, height: 8, bgcolor: SAGE, transform: 'rotate(45deg)' }} />
                One chain · Many hands · Ubuntu
              </Box>
            </Box>
          </Box>

          {/* ------------------------------- Wizard card ------------------------------- */}
          <Box
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid #E7E3D8',
              borderRadius: SHAPE.card,
              boxShadow: '0 12px 30px rgba(26, 46, 34, 0.06)',
              px: { xs: 2.5, sm: 4 },
              py: { xs: 3, sm: 4 },
            }}
          >
            <CampaignForm />
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
