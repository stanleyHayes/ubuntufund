import { Suspense, useEffect } from 'react'
import { ThemeProvider, CssBaseline, GlobalStyles, Box } from '@mui/material'
import { BrowserRouter, Routes, Route, useLocation, Outlet } from 'react-router-dom'
import { scrollToHash } from '@/lib/scroll'
import { ubuntuFundTheme, ttSquaresFontFace, AfricanBanner } from '@ubuntu-fund/ui'
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
import AboutPage from './pages/AboutPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import ContactPage from './pages/ContactPage'
import PricingPage from './pages/PricingPage'
import BlogPage from './pages/BlogPage'
import BlogDetailPage from './pages/BlogDetailPage'
import HelpPage from './pages/HelpPage'
import RefundPolicyPage from './pages/RefundPolicyPage'
import ForOrganizationsPage from './pages/ForOrganizationsPage'
import NotFoundPage from './pages/NotFoundPage'
import SplashScreen from './components/SplashScreen'

const BANNER_CONFIG: Record<string, { title: string; subtitle?: string; description?: string; accentWord?: string; icon?: React.ReactNode }> = {
  '/about': {
    icon: <PublicIcon />,
    title: 'Our Story',
    subtitle: 'The mission behind UbuntuFund',
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
    description: 'Browse guides, FAQs, and resources to make the most of your UbuntuFund experience.',
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
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    // Hash links land on their section; plain route changes start at the top.
    if (hash) scrollToHash(hash.slice(1))
    else window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

function getBannerConfig(pathname: string) {
  if (BANNER_CONFIG[pathname]) return BANNER_CONFIG[pathname]
  if (pathname.startsWith('/blog/')) return BANNER_CONFIG['/blog']
  return { title: 'UbuntuFund', accentWord: 'Ubuntu' }
}

function InnerPageLayout() {
  const { pathname } = useLocation()
  const bannerProps = getBannerConfig(pathname)

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <AfricanBanner {...bannerProps} compact navbarOffset={64} />
      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
      <Footer />
    </Box>
  )
}

function App() {
  return (
    <ThemeProvider theme={ubuntuFundTheme}>
      <CssBaseline />
      <GlobalStyles styles={ttSquaresFontFace} />
      <Suspense fallback={<SplashScreen />}>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Landing page is fully self-contained — no banner */}
            <Route path="/" element={<LandingPage />} />
            {/* Inner pages get the banner */}
            <Route element={<InnerPageLayout />}>
              <Route path="/about" element={<AboutPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/blog/:slug" element={<BlogDetailPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/refund-policy" element={<RefundPolicyPage />} />
              <Route path="/for-organizations" element={<ForOrganizationsPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </Suspense>
    </ThemeProvider>
  )
}

export default App
