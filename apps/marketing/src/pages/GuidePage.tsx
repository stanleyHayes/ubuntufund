import { Fragment, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ChurchRoundedIcon from '@mui/icons-material/ChurchRounded'
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import FlightTakeoffRoundedIcon from '@mui/icons-material/FlightTakeoffRounded'
import HolidayVillageRoundedIcon from '@mui/icons-material/HolidayVillageRounded'
import LocalFloristRoundedIcon from '@mui/icons-material/LocalFloristRounded'
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import PercentRoundedIcon from '@mui/icons-material/PercentRounded'
import PhoneIphoneRoundedIcon from '@mui/icons-material/PhoneIphoneRounded'
import PublicRoundedIcon from '@mui/icons-material/PublicRounded'
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { SHAPE, breadcrumbList, faqPage } from '@ubuntu-fund/ui'
import { InternalPageHero } from '../components/InternalPageHero'
import { MarketingFacts } from '../components/MarketingFacts'
import { useSeo, SITE_ORIGIN } from '@/lib/seo'
import { guideHead } from '@/lib/pageSeo'
import {
  GUIDE_BY_PATH,
  GUIDES_INDEX,
  SITE_PAGE_NAMES,
  copySegments,
  headingId,
  plainText,
  type FactIcon,
  type Guide,
  type GuideAction,
  type GuideIcon,
} from '@/data/guides'

const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL || 'https://app.ujimora.com'

const ACTION_HREF: Record<GuideAction, string> = {
  start: `${WEB_APP_URL}/campaigns/new`,
  explore: `${WEB_APP_URL}/explore`,
  pricing: '/pricing',
  organizations: '/for-organizations',
  contact: '/contact',
  trust: '/trust-and-safety',
}

export const GUIDE_ICONS: Record<GuideIcon, ReactNode> = {
  public: <PublicRoundedIcon />,
  timeline: <TimelineRoundedIcon />,
  flag: <FlagRoundedIcon />,
  medical: <LocalHospitalRoundedIcon />,
  funeral: <LocalFloristRoundedIcon />,
  school: <SchoolRoundedIcon />,
  church: <ChurchRoundedIcon />,
  community: <HolidayVillageRoundedIcon />,
  emergency: <WarningAmberRoundedIcon />,
  flight: <FlightTakeoffRoundedIcon />,
  phone: <PhoneIphoneRoundedIcon />,
  shield: <ShieldRoundedIcon />,
  compare: <CompareArrowsRoundedIcon />,
}

const FACT_ICONS: Record<FactIcon, ReactNode> = {
  payments: <PaymentsRoundedIcon />,
  phone: <PhoneIphoneRoundedIcon />,
  percent: <PercentRoundedIcon />,
  verified: <VerifiedUserRoundedIcon />,
  bank: <AccountBalanceRoundedIcon />,
  campaign: <CampaignRoundedIcon />,
  qr: <QrCode2RoundedIcon />,
  flight: <FlightTakeoffRoundedIcon />,
}

/** Guide copy with its [text](/path) links rendered as links. */
export function Copy({ text }: { text: string }) {
  return (
    <>
      {copySegments(text).map((segment, index) => {
        if (!('href' in segment)) return <Fragment key={index}>{segment.text}</Fragment>
        const external = /^https?:\/\//.test(segment.href)
        return external
          ? <Link key={index} href={segment.href} target="_blank" rel="noopener noreferrer">{segment.label}</Link>
          : <Link key={index} href={segment.href}>{segment.label}</Link>
      })}
    </>
  )
}

const paragraphSx = { color: 'text.secondary', lineHeight: 1.8, fontSize: { xs: '1rem', md: '1.05rem' }, mb: 2 } as const

function Bullets({ items }: { items: string[] }) {
  return (
    <Box component="ul" sx={{ m: 0, mb: 2.5, pl: 0, listStyle: 'none', display: 'grid', gap: 1.25 }}>
      {items.map((item) => (
        <Box component="li" key={item} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <CheckCircleRoundedIcon aria-hidden sx={{ color: 'primary.main', fontSize: 20, mt: '3px', flexShrink: 0 }} />
          <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}><Copy text={item} /></Typography>
        </Box>
      ))}
    </Box>
  )
}

/** Related reading: other guides, or site pages such as pricing. */
export function RelatedLinks({ paths, heading = 'Related guides' }: { paths: string[]; heading?: string }) {
  const items = paths
    .map((path) => {
      const guide = GUIDE_BY_PATH[path]
      return guide ? { path, name: guide.name, summary: guide.summary } : SITE_PAGE_NAMES[path] ? { path, name: SITE_PAGE_NAMES[path], summary: '' } : null
    })
    .filter((item): item is { path: string; name: string; summary: string } => !!item)
  if (!items.length) return null
  return (
    <Box component="section" aria-labelledby="related-guides" sx={{ mt: { xs: 7, md: 9 } }}>
      <Typography id="related-guides" variant="h4" component="h2" sx={{ mb: 3, fontWeight: 800 }}>{heading}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
        {items.map((item) => (
          <Box
            component="a"
            key={item.path}
            href={item.path}
            sx={{
              display: 'flex', flexDirection: 'column', gap: .75, p: 2.5, borderRadius: SHAPE.card,
              bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-subtle)', border: 'var(--neu-border)',
              color: 'text.primary', textDecoration: 'none', transition: 'box-shadow .2s ease, transform .2s ease',
              '&:hover': { boxShadow: 'var(--neu-raised)', transform: 'translateY(-2px)' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 },
            }}
          >
            <Typography component="span" sx={{ fontWeight: 750, display: 'flex', alignItems: 'center', gap: 1 }}>
              {item.name}
              <ArrowForwardRoundedIcon aria-hidden sx={{ fontSize: 18, color: 'primary.main' }} />
            </Typography>
            {item.summary && <Typography component="span" sx={{ color: 'text.secondary', fontSize: '.9rem', lineHeight: 1.6 }}>{item.summary}</Typography>}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export default function GuidePage({ guide }: { guide: Guide }) {
  useSeo({
    ...guideHead(guide),
    jsonLd: [
      breadcrumbList(SITE_ORIGIN, [{ name: 'Home', path: '/' }, { name: 'Guides', path: GUIDES_INDEX.path }, { name: guide.name }]),
      // The questions and answers below, word for word.
      faqPage(guide.faqs.map((faq) => ({ question: faq.question, answer: plainText(faq.answer) }))),
    ],
  })

  const contents = [
    ...(guide.checklist ? [guide.checklist.heading] : []),
    ...guide.sections.map((section) => section.heading),
    ...(guide.steps ? [guide.steps.heading] : []),
    'Questions people ask',
  ]

  return (
    <>
      <InternalPageHero
        eyebrow={guide.eyebrow}
        title={guide.h1}
        description={guide.lead}
        icon={GUIDE_ICONS[guide.icon]}
        panelLabel={guide.panel.label}
        panelTitle={guide.panel.title}
        panelBody={guide.panel.body}
        primaryAction={{ label: guide.primaryAction.label, href: ACTION_HREF[guide.primaryAction.action] }}
        secondaryAction={guide.secondaryAction && { label: guide.secondaryAction.label, href: ACTION_HREF[guide.secondaryAction.action] }}
      />
      {guide.facts && (
        <MarketingFacts
          label={`${guide.name}: key facts`}
          items={guide.facts.map((fact) => ({ value: fact.value, label: fact.label, icon: FACT_ICONS[fact.icon] }))}
        />
      )}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 280px' }, gap: { xs: 5, md: 8 }, alignItems: 'start' }}>
          <Box component="article" sx={{ minWidth: 0, maxWidth: 760 }}>
            {guide.checklist && (
              <Box component="section" id={headingId(guide.checklist.heading)} sx={{ mb: 6, p: { xs: 3, md: 4 }, borderRadius: SHAPE.card, bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-subtle)', border: 'var(--neu-border)', scrollMarginTop: 96 }}>
                <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 800 }}>{guide.checklist.heading}</Typography>
                <Bullets items={guide.checklist.items} />
              </Box>
            )}

            {guide.sections.map((section) => (
              <Box component="section" key={section.heading} id={headingId(section.heading)} sx={{ mb: 6, scrollMarginTop: 96 }}>
                <Typography variant="h4" component="h2" sx={{ mb: 2.5, fontWeight: 800, fontSize: { xs: '1.6rem', md: '2rem' } }}>{section.heading}</Typography>
                {section.paragraphs?.map((paragraph) => <Typography key={paragraph} sx={paragraphSx}><Copy text={paragraph} /></Typography>)}
                {section.bullets && <Bullets items={section.bullets} />}
                {section.after?.map((paragraph) => <Typography key={paragraph} sx={paragraphSx}><Copy text={paragraph} /></Typography>)}
              </Box>
            ))}

            {guide.steps && (
              <Box component="section" id={headingId(guide.steps.heading)} sx={{ mb: 6, scrollMarginTop: 96 }}>
                <Typography variant="h4" component="h2" sx={{ mb: 3, fontWeight: 800, fontSize: { xs: '1.6rem', md: '2rem' } }}>{guide.steps.heading}</Typography>
                <Box component="ol" sx={{ m: 0, pl: 3 }}>
                  {guide.steps.items.map((step) => (
                    <Box component="li" key={step.title} sx={{ pl: 1, pb: 2.5, mb: 2.5, borderBottom: '1px solid', borderColor: 'divider', '&::marker': { color: 'primary.main', fontWeight: 800 } }}>
                      <Typography component="h3" variant="h6" sx={{ mb: .75 }}>{step.title}</Typography>
                      <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}><Copy text={step.body} /></Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {guide.callout && (
              <Box sx={{ bgcolor: '#1C261D', color: '#F5F2EA', p: { xs: 3, md: 5 }, borderRadius: SHAPE.card, mb: 6, '& a': { color: '#DCC07E' } }}>
                <Typography variant="h5" component="h2" sx={{ color: '#DCC07E', mb: 1.5, fontWeight: 800 }}>{guide.callout.heading}</Typography>
                <Typography sx={{ color: '#D4DBD0', lineHeight: 1.8 }}><Copy text={guide.callout.body} /></Typography>
              </Box>
            )}

            <Box component="section" id={headingId('Questions people ask')} sx={{ scrollMarginTop: 96 }}>
              <Typography variant="h4" component="h2" sx={{ mb: 3, fontWeight: 800, fontSize: { xs: '1.6rem', md: '2rem' } }}>Questions people ask</Typography>
              {guide.faqs.map((faq) => (
                <Box key={faq.question} sx={{ py: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography component="h3" variant="h6" sx={{ mb: 1, fontWeight: 750 }}>{faq.question}</Typography>
                  <Typography sx={{ color: 'text.secondary', lineHeight: 1.8 }}><Copy text={faq.answer} /></Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box component="aside" aria-label="In this guide" sx={{ position: { md: 'sticky' }, top: { md: 96 }, display: 'grid', gap: 3 }}>
            <Box component="nav" aria-labelledby="guide-contents" sx={{ display: { xs: 'none', md: 'block' } }}>
              <Typography id="guide-contents" variant="overline" color="text.secondary">In this guide</Typography>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, mt: 1, p: 0, display: 'grid', gap: .75 }}>
                {contents.map((heading) => (
                  <Box component="li" key={heading}>
                    <Link href={`#${headingId(heading)}`} underline="hover" sx={{ color: 'text.secondary', fontSize: '.9rem', lineHeight: 1.5 }}>{heading}</Link>
                  </Box>
                ))}
              </Box>
            </Box>
            <Box sx={{ p: 3, borderRadius: SHAPE.card, bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised)', border: 'var(--neu-border)' }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>{guide.primaryAction.label}</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '.9rem', lineHeight: 1.6, mb: 2 }}>Donations in cedis by mobile money or card. Organizers verify before they start.</Typography>
              <Button variant="contained" fullWidth href={ACTION_HREF[guide.primaryAction.action]} endIcon={<ArrowForwardRoundedIcon />}>{guide.primaryAction.label}</Button>
            </Box>
          </Box>
        </Box>

        <RelatedLinks paths={guide.related} />

        <Typography sx={{ mt: 6, color: 'text.secondary', fontSize: '.9rem' }}>
          More in the <Link href={GUIDES_INDEX.path}>fundraising guides</Link>. Questions? Visit the <Link href="/help">help center</Link> or <Link href="/contact">contact us</Link>.
        </Typography>
      </Container>
    </>
  )
}
