import { Suspense } from 'react'
import { Box } from '@mui/material'
import { BrowserRouter, Routes, Route, useLocation, Outlet } from 'react-router-dom'
import PageTransitions from './components/PageTransitions'
import { AfricanBanner } from '@ubuntu-fund/ui'
import { ColorModeProvider } from '@/context/ColorModeContext'
import PublicIcon from '@mui/icons-material/Public'
import DiamondIcon from '@mui/icons-material/Diamond'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import ForumIcon from '@mui/icons-material/Forum'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import GavelIcon from '@mui/icons-material/Gavel'
import ShieldIcon from '@mui/icons-material/Shield'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import GroupsIcon from '@mui/icons-material/Groups'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import LandingPage from './pages/LandingPage'
import CryptoGuidePage from './pages/CryptoGuidePage'
import FeaturesPage from './pages/FeaturesPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import PricingPage from './pages/PricingPage'
import BlogPage from './pages/BlogPage'
import BlogDetailPage from './pages/BlogDetailPage'
import HelpPage from './pages/HelpPage'
import LegalIndexPage from './pages/LegalIndexPage'
import LegalPolicyPage from './pages/LegalPolicyPage'
import AffiliateProgramPage from './pages/AffiliateProgramPage'
import ForOrganizationsPage from './pages/ForOrganizationsPage'
import { LEGAL_POLICIES } from './data/legal'
import NotFoundPage from './pages/NotFoundPage'
import SplashScreen from './components/SplashScreen'

const BANNER_CONFIG: Record<string, { title: string; subtitle?: string; description?: string; accentWord?: string; icon?: React.ReactNode }> = {
  '/about': {
    icon: <PublicIcon />,
    title: 'Our Story',
    subtitle: 'The mission behind Ujimora',
    description: 'Born from the belief that collective action can transform communities across Ghana.',
    accentWord: 'Story',
  },
  '/pricing': {
    icon: <DiamondIcon />,
    title: 'Simple Pricing',
    subtitle: 'No hidden fees. No platform charges for personal campaigns.',
    description: 'We believe transparent giving starts with transparent pricing.',
    accentWord: 'Simple',
  },
  '/blog': {
    icon: <AutoStoriesIcon />,
    title: 'From the Community',
    subtitle: 'Stories, updates, and insights from across Ghana',
    description: 'Real voices, real impact — dispatches from the frontlines of collective giving.',
    accentWord: 'Community',
  },
  '/contact': {
    icon: <ForumIcon />,
    title: 'Get in Touch',
    subtitle: 'We would love to hear from you',
    description: 'Whether you have a question, feedback, or partnership idea — our team is here.',
    accentWord: 'Touch',
  },
  '/help': {
    icon: <SupportAgentIcon />,
    title: 'Help Center',
    subtitle: 'Find answers and get support',
    description: 'Browse guides, FAQs, and resources to make the most of your Ujimora experience.',
    accentWord: 'Help',
  },
  '/terms': {
    icon: <GavelIcon />,
    title: 'Terms of Service',
    description: 'The rules that govern how we work together on this platform.',
    accentWord: 'Terms',
  },
  '/privacy': {
    icon: <ShieldIcon />,
    title: 'Privacy Policy',
    description: 'How we collect, use, and protect your personal information.',
    accentWord: 'Privacy',
  },
  '/refund-policy': {
    icon: <SyncAltIcon />,
    title: 'Refund Policy',
    description: 'Our commitments to donors when campaigns don\'t go as planned.',
    accentWord: 'Refund',
  },
  '/for-organizations': {
    icon: <GroupsIcon />,
    title: 'For Organizations',
    subtitle: 'Enterprise tools for institutions and NGOs',
    description: 'Scale your fundraising with branded pages, analytics, and dedicated support.',
    accentWord: 'Organizations',
  },
}

/** Layout for inner pages (not landing). Navbar → Banner → Content → Footer. */
function getBannerConfig(pathname: string) {
  if (BANNER_CONFIG[pathname]) return BANNER_CONFIG[pathname]
  if (pathname.startsWith('/blog/')) return BANNER_CONFIG['/blog']
  return { title: 'Ujimora', accentWord: 'ora' }
}

function InnerPageLayout() {
  const { pathname } = useLocation()
  const bannerProps = getBannerConfig(pathname)
  const legalRoutes = ['/legal', ...LEGAL_POLICIES.map((p) => p.route)]
  const hasEditorialHero =
    ['/affiliates', '/crypto', '/features', '/about', '/blog', '/contact', '/pricing', '/help', '/for-organizations'].includes(pathname) ||
    legalRoutes.includes(pathname)

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      {!hasEditorialHero && <AfricanBanner {...bannerProps} compact navbarOffset={64} />}
      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
      <Footer />
    </Box>
  )
}

function App() {
  return (
    <ColorModeProvider>
      <Suspense fallback={<SplashScreen />}>
        <BrowserRouter>
          <PageTransitions>{location => (
          <Routes location={location}>
            {/* Landing page is fully self-contained — no banner */}
            <Route path="/" element={<LandingPage />} />
            {/* Inner pages get the banner */}
            <Route element={<InnerPageLayout />}>
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/crypto" element={<CryptoGuidePage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/blog/:slug" element={<BlogDetailPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/affiliates" element={<AffiliateProgramPage />} />
              <Route path="/for-organizations" element={<ForOrganizationsPage />} />
              {/* Legal & policy pages — hub + one route per policy, all sourced from data/legal */}
              <Route path="/legal" element={<LegalIndexPage />} />
              {LEGAL_POLICIES.map((policy) => (
                <Route
                  key={policy.slug}
                  path={policy.route}
                  element={<LegalPolicyPage slug={policy.slug} />}
                />
              ))}
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          )}</PageTransitions>
        </BrowserRouter>
      </Suspense>
    </ColorModeProvider>
  )
}

export default App
