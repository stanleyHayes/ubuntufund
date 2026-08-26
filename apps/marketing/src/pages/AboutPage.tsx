import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import PublicRoundedIcon from '@mui/icons-material/PublicRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { SHAPE } from '@ubuntu-fund/ui'
import { InternalPageHero } from '../components/InternalPageHero'
import { useContent } from '../hooks/useContent'

interface TeamMember { name: string; role: string; initials: string; bio: string }

const ABOUT_FALLBACK = {
  hero: { title: 'Together, We Rise', subtitle: "UbuntuFund is Ghana's trust infrastructure for giving — connecting people with transparent community fundraising records." },
  mission: { eyebrow: 'Our mission', title: 'Make community fundraising easier to trust', body: 'We give campaign organizers a clear place to explain a need, document progress, and keep supporters informed. Donors can review the same campaign history before and after they contribute.' },
  vision: { eyebrow: 'Our direction', title: 'A stronger public record for generosity', body: 'We are building toward a Ghanaian giving ecosystem where campaign claims, reviews, contributions, updates, and operational decisions form one accountable record.' },
  philosophy: { eyebrow: 'The Ubuntu philosophy', quote: 'I am because we are', body: 'Ubuntu describes our interdependence: individual wellbeing grows through the wellbeing of the community. The product reflects that idea by making support visible, shared, and accountable.' },
  team: [{ name: 'UbuntuFund Team', role: 'Launch team', initials: 'UF', bio: 'Named leadership profiles will be published after owner verification and consent.' }] as TeamMember[],
}

const OPERATING_MODEL = [
  { number: '01', title: 'A campaign creates a record', body: 'The organizer states the purpose, target, timeline, and story in one public campaign history.', icon: <HistoryRoundedIcon /> },
  { number: '02', title: 'Review adds context', body: 'Verification and administrative review help people understand what has and has not been checked.', icon: <FactCheckRoundedIcon /> },
  { number: '03', title: 'Support stays traceable', body: 'Wallet-backed contribution records connect giving activity to the campaign that received it.', icon: <VolunteerActivismRoundedIcon /> },
  { number: '04', title: 'Updates preserve accountability', body: 'Campaign updates and operational records keep the story visible after the initial appeal.', icon: <AccountBalanceRoundedIcon /> },
]

const COMMITMENTS = [
  ['Truth before theatre', 'We do not present unverified integrations, impact numbers, addresses, or response promises as established facts.'],
  ['Local context matters', 'Cedi-first records, Ghana-focused workflows, and clear operational boundaries shape the product from the start.'],
  ['A record should endure', 'Campaign histories, reviews, comments, and audit trails should explain what happened without erasing useful context.'],
]

function AboutPage() {
  const about = useContent('about', ABOUT_FALLBACK)
  return (
    <Box component="main" sx={{ flex: 1, bgcolor: 'background.default', pb: { xs: 8, md: 12 } }}>
      <InternalPageHero eyebrow="About UbuntuFund" title={about.hero.title} description={about.hero.subtitle} icon={<PublicRoundedIcon />} panelLabel="Built in Ghana" panelTitle="Giving infrastructure shaped around local communities." panelBody="Cedi-first records. Human review. Transparent campaign histories." primaryAction={{ label: 'How trust works', href: '/how-it-works' }} secondaryAction={{ label: 'Talk to our team', href: '/contact' }} />

      <Container maxWidth="lg" sx={{ mt: { xs: 6, md: 10 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,.8fr) minmax(0,1.2fr)' }, gap: { xs: 4, md: 8 }, alignItems: 'start' }}>
          <Box sx={{ position: { md: 'sticky' }, top: { md: 92 } }}>
            <Typography variant="overline" color="secondary.dark">Why we exist</Typography>
            <Typography component="h2" sx={{ mt: 1.5, fontSize: { xs: '2.25rem', md: '3.4rem' }, fontWeight: 900, lineHeight: 1.02, letterSpacing: '-.045em', textWrap: 'balance' }}>Giving already happens. Trust needs better infrastructure.</Typography>
            <Typography sx={{ mt: 3, maxWidth: 500, color: 'text.secondary', fontSize: { xs: '1rem', md: '1.08rem' }, lineHeight: 1.8 }}>Families, associations, faith communities, organizers, and supporters already mobilize around urgent needs. UbuntuFund is being built to give that activity a clearer shared record—from the first campaign statement to the latest update.</Typography>
          </Box>
          <Stack spacing={3}>
            <Box
              component="figure"
              sx={{ m: 0, position: 'relative', overflow: 'hidden', minHeight: { xs: 280, md: 360 }, borderRadius: SHAPE.card, boxShadow: 'var(--neu-raised)' }}
            >
              <Box component="img" src="/images/about/community-planning.jpg" alt="A Ghanaian community group planning a shared project together" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <Box component="figcaption" sx={{ position: 'absolute', left: 18, right: 18, bottom: 18, bgcolor: 'rgba(36,49,38,.9)', color: '#F2EFEA', borderRadius: SHAPE.sm, px: 2, py: 1.35, backdropFilter: 'blur(8px)', fontSize: '.78rem', lineHeight: 1.5 }}>
                Strong campaigns begin with a shared understanding of the need, the plan, and who is responsible.
              </Box>
            </Box>
            {[about.mission, about.vision].map((item, index) => (
              <Box key={item.title} sx={{ bgcolor: 'var(--neu-surface)', boxShadow: index === 0 ? 'var(--neu-raised)' : 'var(--neu-subtle)', borderRadius: SHAPE.card, p: { xs: 3, md: 4.5 } }}>
                <Typography sx={{ color: index === 0 ? 'primary.main' : 'secondary.dark', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase' }}>{item.eyebrow}</Typography>
                <Typography component="h3" sx={{ mt: 1.5, fontSize: { xs: '1.45rem', md: '1.8rem' }, fontWeight: 850, lineHeight: 1.2 }}>{item.title}</Typography>
                <Typography sx={{ mt: 2, color: 'text.secondary', lineHeight: 1.8 }}>{item.body}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Container>

      <Box component="section" sx={{ mt: { xs: 9, md: 13 }, py: { xs: 8, md: 11 }, bgcolor: '#243126', color: '#F2EFEA' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '.65fr 1.35fr' }, gap: { xs: 5, md: 8 } }}>
            <Box>
              <Typography variant="overline" sx={{ color: '#DCC07E' }}>How the model works</Typography>
              <Typography component="h2" sx={{ mt: 1.5, fontSize: { xs: '2rem', md: '2.8rem' }, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-.035em' }}>One history, shared by everyone involved.</Typography>
              <Typography sx={{ mt: 2.5, color: 'rgba(242,239,234,.64)', lineHeight: 1.75 }}>The product is designed around continuity instead of a collection of disconnected screens.</Typography>
              <Box component="figure" sx={{ m: 0, mt: 4, overflow: 'hidden', borderRadius: SHAPE.card, boxShadow: '8px 9px 22px rgba(0,0,0,.4), -6px -6px 16px rgba(94,143,114,.12)' }}>
                <Box component="img" src="/images/about/project-verification.jpg" alt="A Ghanaian project organizer recording progress at a community water site" sx={{ display: 'block', width: '100%', height: { xs: 300, md: 360 }, objectFit: 'cover', objectPosition: 'center 38%' }} />
                <Typography component="figcaption" sx={{ px: 2.5, py: 2, color: 'rgba(242,239,234,.68)', fontSize: '.78rem', lineHeight: 1.55 }}>Progress becomes more useful when it is documented where the work happens.</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)' }, gap: 2 }}>
              {OPERATING_MODEL.map((item) => (
                <Box key={item.number} sx={{ bgcolor: '#243126', boxShadow: '7px 7px 17px rgba(0,0,0,.36), -6px -6px 15px rgba(94,143,114,.13)', borderRadius: SHAPE.card, p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#DCC07E' }}>
                    <Box sx={{ width: 46, height: 46, display: 'grid', placeItems: 'center', borderRadius: SHAPE.sm, boxShadow: '4px 4px 10px rgba(0,0,0,.32), -4px -4px 10px rgba(94,143,114,.13)', '& svg': { fontSize: 23 } }}>{item.icon}</Box>
                    <Typography sx={{ fontWeight: 900, opacity: .28 }}>{item.number}</Typography>
                  </Box>
                  <Typography component="h3" sx={{ mt: 3, fontSize: '1.15rem', fontWeight: 800 }}>{item.title}</Typography>
                  <Typography sx={{ mt: 1.25, color: 'rgba(242,239,234,.58)', fontSize: '.88rem', lineHeight: 1.65 }}>{item.body}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: { xs: 9, md: 13 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.15fr .85fr' }, gap: { xs: 4, md: 8 }, alignItems: 'stretch' }}>
          <Box>
            <Typography variant="overline" color="secondary.dark">What guides us</Typography>
            <Typography component="h2" sx={{ mt: 1.5, fontSize: { xs: '2rem', md: '2.8rem' }, fontWeight: 900, letterSpacing: '-.035em' }}>Three commitments, visible in the product.</Typography>
            <Stack spacing={2} sx={{ mt: 4 }}>
              {COMMITMENTS.map(([title, body], index) => (
                <Box key={title} sx={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 2, alignItems: 'start', p: 2.5, borderRadius: SHAPE.card, boxShadow: index === 0 ? 'var(--neu-subtle)' : 'var(--neu-inset)' }}>
                  <Typography sx={{ fontWeight: 900, color: 'secondary.dark', fontVariantNumeric: 'tabular-nums' }}>0{index + 1}</Typography>
                  <Box><Typography sx={{ fontWeight: 800 }}>{title}</Typography><Typography sx={{ mt: .65, color: 'text.secondary', lineHeight: 1.65 }}>{body}</Typography></Box>
                </Box>
              ))}
            </Stack>
          </Box>
          <Box sx={{ bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised)', borderRadius: SHAPE.card, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Box component="img" src="/images/about/shared-progress.jpg" alt="Ghanaian community members reviewing photographs of project progress" sx={{ width: '100%', height: { xs: 245, md: 285 }, objectFit: 'cover', display: 'block' }} />
            <Box sx={{ p: { xs: 3.5, md: 5 }, pt: { xs: 3, md: 4 } }}>
            <Box>
              <Box sx={{ width: 58, height: 58, display: 'grid', placeItems: 'center', borderRadius: SHAPE.sm, boxShadow: 'var(--neu-subtle)', color: 'primary.main' }}><GroupsRoundedIcon /></Box>
              <Typography variant="overline" color="secondary.dark" sx={{ display: 'block', mt: 4 }}>{about.philosophy.eyebrow}</Typography>
              <Typography sx={{ mt: 1, fontSize: { xs: '2rem', md: '2.6rem' }, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-.04em' }}>&ldquo;{about.philosophy.quote}&rdquo;</Typography>
              <Typography sx={{ mt: 3, color: 'text.secondary', lineHeight: 1.8 }}>{about.philosophy.body}</Typography>
            </Box>
            <Box sx={{ mt: 5, pt: 3, boxShadow: 'inset 0 8px 12px -14px rgba(72,62,43,.8)' }}>
              <Typography sx={{ fontWeight: 800 }}>{about.team[0]?.name ?? 'UbuntuFund Team'}</Typography>
              <Typography sx={{ mt: .5, color: 'text.secondary', fontSize: '.85rem' }}>{about.team[0]?.bio ?? ABOUT_FALLBACK.team[0].bio}</Typography>
            </Box>
            </Box>
          </Box>
        </Box>
        <Box sx={{ mt: { xs: 8, md: 11 }, textAlign: 'center', maxWidth: 720, mx: 'auto' }}>
          <Typography component="h2" sx={{ fontSize: { xs: '1.8rem', md: '2.5rem' }, fontWeight: 900 }}>Help shape a clearer way to give.</Typography>
          <Typography sx={{ mt: 2, color: 'text.secondary', lineHeight: 1.7 }}>Ask about the launch model, organization verification, or the safeguards being built into campaign records.</Typography>
          <Button href="/contact" variant="contained" color="secondary" sx={{ mt: 3.5 }}>Talk to the team</Button>
        </Box>
      </Container>
    </Box>
  )
}

export default AboutPage
