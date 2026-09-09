import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { LEGAL_POLICIES, getPolicyBySlug } from '@ubuntu-fund/types/src/legal'

const surface = { bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised)', borderRadius: '24px' }
function Watermark() {
  return <Box component="svg" viewBox="0 0 260 180" aria-hidden="true" sx={{ position: 'absolute', right: -20, bottom: -20, width: 280, opacity: .1, pointerEvents: 'none' }}><g fill="none" stroke="currentColor" strokeWidth="5"><rect x="35" y="45" width="85" height="85" rx="10" transform="rotate(45 77 87)" /><circle cx="154" cy="87" r="60" /></g></Box>
}
export function LegalPage({ slug }: { slug?: string }) {
  const policy = slug ? getPolicyBySlug(slug) : undefined
  return <Container component="section" maxWidth="lg" sx={{ py: { xs: 4, md: 7 } }}>
    <Box sx={{ ...surface, position: 'relative', overflow: 'hidden', p: { xs: 3, md: 5 }, mb: 4 }}>
      <Watermark />
      <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '.16em' }}>Ujimora · Legal & trust</Typography>
      <Typography component="h1" variant="h3" sx={{ fontWeight: 800, maxWidth: 780, fontSize: { xs: '2rem', md: '3rem' }, my: 2 }}>{policy?.title ?? 'Know where you stand.'}</Typography>
      <Typography sx={{ color: 'text.secondary', maxWidth: 720, lineHeight: 1.8 }}>{policy?.description ?? 'Read the policies that guide giving, fundraising and using Ujimora. The same documents apply across our website and app.'}</Typography>
      {policy && <Stack direction="row" sx={{ mt: 3, gap: 2, flexWrap: 'wrap', alignItems: 'center' }}><Button component={Link} to="/legal" variant="outlined">All policies</Button><Typography variant="body2" color="text.secondary">Effective {policy.effectiveDate}</Typography></Stack>}
    </Box>
    {!policy ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>{LEGAL_POLICIES.map(item => <Box component={Link} to={item.route} key={item.slug} sx={{ ...surface, p: 3, color: 'text.primary', textDecoration: 'none', '&:hover, &:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}><Typography component="h2" variant="h6" fontWeight={700}>{item.navLabel} <span aria-hidden="true">↗</span></Typography><Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>{item.summary}</Typography></Box>)}</Box> :
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr)' }, gap: 4, alignItems: 'start' }}>
        <Box component="nav" aria-label="On this page" sx={{ ...surface, p: 3, position: { md: 'sticky' }, top: 96, maxHeight: { md: 'calc(100vh - 120px)' }, overflowY: 'auto' }}><Typography fontWeight={700} sx={{ mb: 2 }}>On this page</Typography>{policy.sections.map((section, index) => <Box component="a" href={`#section-${index}`} key={section.title} sx={{ display: 'block', color: 'text.secondary', fontSize: '.9rem', py: .8, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{section.title}</Box>)}</Box>
        <Box component="article" sx={{ ...surface, p: { xs: 3, md: 5 }, minWidth: 0 }}>
          <Typography sx={{ lineHeight: 1.9, mb: 5 }}>{policy.introduction}</Typography>
          {policy.sections.map((section, index) => <Box component="section" id={`section-${index}`} key={section.title} sx={{ mb: 5, scrollMarginTop: 110 }}><Typography component="h2" variant="h5" sx={{ fontWeight: 700, mb: 2 }}>{section.title}</Typography><Typography color="text.secondary" sx={{ whiteSpace: 'pre-line', lineHeight: 1.9, overflowWrap: 'anywhere' }}>{section.content}</Typography></Box>)}
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 3 }}><Typography variant="h6">Need clarification?</Typography><Typography sx={{ mt: 1, lineHeight: 1.8 }}>{policy.contact}</Typography><Button component={Link} to="/legal" sx={{ mt: 2 }}>Browse all policies</Button></Box>
        </Box>
      </Box>}
  </Container>
}
