import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import PublicRoundedIcon from '@mui/icons-material/PublicRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import Box from '@mui/material/Box'
import Avatar from '@mui/material/Avatar'
import GitHubIcon from '@mui/icons-material/GitHub'
import LinkedInIcon from '@mui/icons-material/LinkedIn'
import InstagramIcon from '@mui/icons-material/Instagram'
import XIcon from '@mui/icons-material/X'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { STANLEY_PROFILE } from '../data/leadership'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { SHAPE } from '@ubuntu-fund/ui'
import { InternalPageHero } from '../components/InternalPageHero'
import { useContent } from '../hooks/useContent'

interface TeamMember { name: string; role: string; initials: string; bio: string; image?: string; website?: string; companyUrl?: string; socials?: { label: string; href: string }[] }

const SOCIAL_ICONS = { LinkedIn: LinkedInIcon, GitHub: GitHubIcon, X: XIcon, Instagram: InstagramIcon }

const ABOUT_FALLBACK = {
  hero: { title: 'Together, we fund what matters', subtitle: "Ujimora is Ghana's trust infrastructure for giving — connecting people with transparent community fundraising records." },
  mission: { eyebrow: 'Our mission', title: 'Make community fundraising easier to trust', body: 'We give campaign organizers a clear place to explain a need, document progress, and keep supporters informed. Donors can review the same campaign history before and after they contribute.' },
  vision: { eyebrow: 'Our direction', title: 'A stronger public record for generosity', body: 'We are building toward a Ghanaian giving ecosystem where campaign claims, reviews, contributions, updates, and operational decisions form one accountable record.' },
  philosophy: { eyebrow: 'The Ujima philosophy', quote: 'We build together', body: 'Ujima — collective work and responsibility — describes our interdependence: individual wellbeing grows through shared work on behalf of the community. The product reflects that idea by making support visible, shared, and accountable.' },
  team: [STANLEY_PROFILE] as TeamMember[],
}

const OPERATING_MODEL = [
  { number: '01', title: 'A campaign creates a record', body: 'The organizer states the purpose, target, timeline, and story in one public campaign history.', icon: <HistoryRoundedIcon />, details: ['Purpose & story', 'Goal & timeline'] },
  { number: '02', title: 'Review adds context', body: 'Verification and administrative review help people understand what has and has not been checked.', icon: <FactCheckRoundedIcon />, details: ['Identity verification', 'Campaign review'] },
  { number: '03', title: 'Support stays traceable', body: 'Contribution records connect each donation to the campaign that received it.', icon: <VolunteerActivismRoundedIcon />, details: ['Donation history', 'Campaign totals'] },
  { number: '04', title: 'Updates preserve accountability', body: 'Campaign updates and operational records keep the story visible after the initial appeal.', icon: <AccountBalanceRoundedIcon />, details: ['Progress updates', 'Supporter comments'] },
]

const COMMITMENTS = [
  { label: 'Clarity', title: 'Trust starts with the facts.', body: 'Clear campaign details and honest review information help you decide who and what to support.', detail: 'Know what has been checked.', icon: <FactCheckRoundedIcon /> },
  { label: 'Community', title: 'Built around the way we give.', body: 'Ghanaian communities are at the heart of Ujimora, from cedi-first records to the shared responsibility behind every cause.', detail: 'Local needs. Collective effort.', icon: <PublicRoundedIcon /> },
  { label: 'Continuity', title: 'The story stays in view.', body: 'Campaign updates, contribution history, and supporter conversations keep progress connected to the original promise.', detail: 'Follow the story beyond your donation.', icon: <HistoryRoundedIcon /> },
]

function AboutPage() {
  const about = useContent('about', ABOUT_FALLBACK)
  const cmsLeader = about.team?.[0]
  // Older CMS records still contain the launch placeholder.
  const leader = !cmsLeader || cmsLeader.name === 'Ujimora Team' ? STANLEY_PROFILE : cmsLeader
  return (
    <Box component="main" sx={{ flex: 1, bgcolor: 'background.default', pb: { xs: 8, md: 12 } }}>
      <InternalPageHero eyebrow="About Ujimora" title={about.hero.title} description={about.hero.subtitle} icon={<PublicRoundedIcon />} panelLabel="Built in Ghana" panelTitle="Giving infrastructure shaped around local communities." panelBody="Cedi-first records. Human review. Transparent campaign histories." primaryAction={{ label: 'How trust works', href: '#operating-model' }} secondaryAction={{ label: 'Talk to our team', href: '/contact' }} />

      <Container maxWidth="lg" sx={{ mt: { xs: 6, md: 10 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,.8fr) minmax(0,1.2fr)' }, gap: { xs: 4, md: 8 }, alignItems: 'start' }}>
          <Box sx={{ position: { md: 'sticky' }, top: { md: 92 } }}>
            <Typography variant="overline" color="secondary.dark">Why we exist</Typography>
            <Typography component="h2" sx={{ mt: 1.5, fontSize: { xs: '2.25rem', md: '3.4rem' }, fontWeight: 900, lineHeight: 1.02, letterSpacing: '-.045em', textWrap: 'balance' }}>Giving already happens. Trust needs better infrastructure.</Typography>
            <Typography sx={{ mt: 3, maxWidth: 500, color: 'text.secondary', fontSize: { xs: '1rem', md: '1.08rem' }, lineHeight: 1.8 }}>Families, associations, faith communities, organizers, and supporters already mobilize around urgent needs. Ujimora is being built to give that activity a clearer shared record—from the first campaign statement to the latest update.</Typography>
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

      <Box component="section" id="operating-model" aria-labelledby="operating-model-title" sx={{ scrollMarginTop: 80, mt: { xs: 9, md: 13 }, py: { xs: 8, md: 11 }, bgcolor: '#243126', color: '#F2EFEA' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '.85fr 1.15fr' }, gap: { xs: 5, md: 7 }, alignItems: 'start' }}>
            <Box>
              <Typography variant="overline" sx={{ color: '#DCC07E' }}>How the model works</Typography>
              <Typography component="h2" id="operating-model-title" sx={{ mt: 1.5, fontSize: { xs: '2rem', md: '2.8rem' }, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-.035em' }}>One history, shared by everyone involved.</Typography>
              <Typography sx={{ mt: 2.5, color: 'rgba(242,239,234,.64)', lineHeight: 1.75 }}>From the first appeal to the latest update, follow four connected steps that keep the purpose, the people, and the progress in view.</Typography>
              <Box component="figure" sx={{ m: 0, mt: 4, overflow: 'hidden', borderRadius: SHAPE.card, boxShadow: 'var(--forest-raised)' }}>
                <Box component="img" src="/images/about/project-verification.jpg" alt="A Ghanaian project organizer recording progress at a community water site" sx={{ display: 'block', width: '100%', height: { xs: 300, md: 360 }, objectFit: 'cover', objectPosition: 'center 38%' }} />
                <Typography component="figcaption" sx={{ px: 2.5, py: 2, color: 'rgba(242,239,234,.68)', fontSize: '.78rem', lineHeight: 1.55 }}>Progress becomes more useful when it is documented where the work happens.</Typography>
              </Box>
            </Box>
            <Box component="ol" aria-label="The four steps of a campaign record" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 2 }}>
              {OPERATING_MODEL.map((item) => (
                <Box component="li" key={item.number} sx={{
                  display: 'grid', gridTemplateColumns: { xs: '38px minmax(0,1fr)', sm: '48px minmax(0,1fr)' },
                  gap: { xs: 2, sm: 2.5 }, bgcolor: '#243126', boxShadow: 'var(--forest-raised)',
                  borderRadius: SHAPE.card, p: { xs: 2.5, sm: 3 },
                  '[data-skin="minimal"] &': { border: '1px solid rgba(242,239,234,.16)' },
                  '[data-skin="glassmorphism"] &': { bgcolor: 'rgba(255,255,255,.04)', border: '1px solid rgba(242,239,234,.14)', backdropFilter: 'var(--neu-backdrop)' },
                }}>
                  <Box sx={{ textAlign: 'center', color: '#DCC07E' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '.7rem', letterSpacing: '.12em', mb: 1.25 }}>{item.number}</Typography>
                    <Box sx={{ height: { xs: 38, sm: 48 }, display: 'grid', placeItems: 'center', borderRadius: SHAPE.sm, boxShadow: 'var(--forest-subtle)', '& svg': { fontSize: 23 } }}>{item.icon}</Box>
                  </Box>
                  <Box>
                    <Typography component="h3" sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' }, fontWeight: 800, lineHeight: 1.35 }}>{item.title}</Typography>
                    <Typography sx={{ mt: 1, color: 'rgba(242,239,234,.74)', fontSize: '.88rem', lineHeight: 1.65 }}>{item.body}</Typography>
                    <Box component="ul" aria-label="What this includes" sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', listStyle: 'none', p: 0, m: 0, mt: 1.75 }}>
                      {item.details.map(detail => <Box component="li" key={detail} sx={{ display: 'flex', alignItems: 'center', gap: .8, color: '#DCC07E', fontSize: '.72rem', '&::before': { content: '\"\"', width: 4, height: 4, borderRadius: '50%', bgcolor: 'currentColor' } }}>{detail}</Box>)}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: { xs: 9, md: 13 } }}>
        <Box component="section" id="commitments" aria-labelledby="commitments-title" sx={{ scrollMarginTop: 90, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.15fr .85fr' }, gap: { xs: 4, md: 7 }, alignItems: 'start' }}>
          <Box>
            <Typography variant="overline" color="secondary.dark">What guides us</Typography>
            <Typography component="h2" id="commitments-title" sx={{ mt: 1.5, maxWidth: 550, fontSize: { xs: '2rem', md: '2.8rem' }, fontWeight: 900, lineHeight: 1.12, letterSpacing: '-.035em' }}>Giving feels better when the principles are clear.</Typography>
            <Box component="ul" sx={{ mt: 4, mb: 0, p: { xs: 2.5, sm: 3.5 }, listStyle: 'none', bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised)', border: 'var(--neu-border)', backdropFilter: 'var(--neu-backdrop)', borderRadius: SHAPE.card }}>
              {COMMITMENTS.map((item, index) => (
                <Box component="li" key={item.label} sx={{ py: 3, '&:first-of-type': { pt: 0 }, '&:last-of-type': { pb: 0 }, '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box sx={{ width: 42, height: 42, display: 'grid', placeItems: 'center', color: 'secondary.dark', borderRadius: SHAPE.sm, boxShadow: 'var(--neu-subtle)' }}>{item.icon}</Box>
                    <Typography variant="overline" sx={{ color: 'text.secondary', flex: 1 }}>{item.label}</Typography>
                    <Typography aria-hidden="true" sx={{ color: 'text.secondary', fontSize: '.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>0{index + 1}</Typography>
                  </Box>
                  <Typography component="h3" sx={{ fontSize: { xs: '1.25rem', sm: '1.4rem' }, fontWeight: 800, lineHeight: 1.3 }}>{item.title}</Typography>
                  <Typography sx={{ mt: 1, color: 'text.secondary', lineHeight: 1.7, fontSize: '.93rem' }}>{item.body}</Typography>
                  <Typography sx={{ mt: 1.5, color: 'secondary.dark', fontWeight: 700, fontSize: '.78rem' }}>{item.detail}</Typography>
                </Box>
              ))}
            </Box>
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

            </Box>
          </Box>
        </Box>
        <Box component="section" id="leadership" aria-labelledby="leadership-name" sx={{ mt: { xs: 7, md: 10 }, scrollMarginTop: 90, bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised)', border: 'var(--neu-border)', backdropFilter: 'var(--neu-backdrop)', borderRadius: SHAPE.card, overflow: 'hidden', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,.85fr) minmax(0,1.4fr)' } }}>
          <Avatar variant="square" src={leader.image} alt={leader.name} sx={{ width: '100%', height: { xs: 300, sm: 380, md: '100%' }, minHeight: { md: 500 }, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: '5rem', '& img': { objectPosition: '50% 35%' } }}>{leader.initials}</Avatar>
          <Box sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
            <Typography variant="overline" color="text.secondary">The person behind the platform</Typography>
            <Typography component="h2" id="leadership-name" sx={{ mt: 1.5, fontSize: { xs: '2rem', md: '2.6rem' }, fontWeight: 900, letterSpacing: '-.035em', lineHeight: 1.12 }}>{leader.name}</Typography>
            <Typography sx={{ mt: 1.5, color: 'primary.main', fontWeight: 600, fontSize: '.9rem' }}>{leader.role}</Typography>
            <Typography sx={{ mt: 2.5, color: 'text.secondary', lineHeight: 1.8 }}>{leader.bio}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mt: 3 }}>
              {[
                { title: 'Explore my work', description: 'Personal portfolio', href: leader.website },
                { title: 'Meet NeuroDyne', description: 'Software & digital infrastructure', href: leader.companyUrl },
              ].filter(link => link.href).map(link => (
                <Box component="a" key={link.title} href={link.href} target="_blank" rel="noopener noreferrer" sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: SHAPE.sm, color: 'text.primary', textDecoration: 'none', '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 } }}>
                  <Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 750, fontSize: '.88rem' }}>{link.title}</Typography><Typography sx={{ mt: .5, color: 'text.secondary', fontSize: '.72rem', lineHeight: 1.5 }}>{link.description}</Typography></Box>
                  <OpenInNewRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                </Box>
              ))}
            </Box>
            <Box component="nav" aria-label="Stanley's social profiles" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, borderTop: '1px solid', borderColor: 'divider', mt: 3, pt: 2.5 }}>
              <Typography sx={{ color: 'text.secondary', fontSize: '.75rem', mr: .5 }}>Connect</Typography>
              {leader.socials?.map(social => {
                const Icon = SOCIAL_ICONS[social.label as keyof typeof SOCIAL_ICONS] ?? OpenInNewRoundedIcon
                return <Box component="a" key={social.label} href={social.href} aria-label={`${leader.name} on ${social.label}`} title={social.label} target="_blank" rel="noopener noreferrer" sx={{ display: 'grid', placeItems: 'center', width: 44, height: 44, color: 'primary.main', borderRadius: SHAPE.sm, bgcolor: 'action.hover', '&:hover': { bgcolor: 'primary.main', color: 'primary.contrastText' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 } }}><Icon sx={{ fontSize: 21 }} /></Box>
              })}
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
