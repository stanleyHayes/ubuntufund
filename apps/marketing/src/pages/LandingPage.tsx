import Box from '@mui/material/Box'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import HeroSection from '../components/sections/HeroSection'
import StatsSection from '../components/sections/StatsSection'
import HowItWorksSection from '../components/sections/HowItWorksSection'
import FeaturesSection from '../components/sections/FeaturesSection'
import CampaignTypesSection from '../components/sections/CampaignTypesSection'
import TestimonialsSection from '../components/sections/TestimonialsSection'
import OrganizationsSection from '../components/sections/OrganizationsSection'
import CTASection from '../components/sections/CTASection'
import { useSeo } from '@/lib/seo'

function LandingPage() {
  useSeo({
    title: "Ujimora - Ghana's Trust Infrastructure for Giving",
    description: "Ghana's crowdfunding platform built on trust: verified campaigns, transparent contribution records, and cedi-first giving. Together, we fund what matters.",
    path: '/',
    type: 'website',
  })

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <Box component="main" sx={{ flex: 1 }}>
        <HeroSection />
        <StatsSection />
        <HowItWorksSection />
        <FeaturesSection />
        <CampaignTypesSection />
        <TestimonialsSection />
        <OrganizationsSection />
        <CTASection />
      </Box>
      <Footer />
    </Box>
  )
}

export default LandingPage
