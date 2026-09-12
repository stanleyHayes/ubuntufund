import RouteErrorPage from './components/RouteErrorPage'
import type { ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Resource, Action } from '@ubuntu-fund/types'
import AdminLayout from './components/layout/AdminLayout'
import AuthGuard from './components/AuthGuard'
import { useAdminPermissions } from './context/AdminPermissionContext'
import PermissionDenied from './components/PermissionDenied'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import DashboardPage from './pages/DashboardPage'
import OverviewPage from './pages/OverviewPage'
import CampaignsPage from './pages/CampaignsPage'
import CampaignDetailPage from './pages/CampaignDetailPage'
import UsersPage from './pages/UsersPage'
import UserDetailPage from './pages/UserDetailPage'
import DonationsPage from './pages/DonationsPage'
import PayoutsPage from './pages/PayoutsPage'
import DisputesPage from './pages/DisputesPage'
import ReportsPage from './pages/ReportsPage'
import VerificationsPage from './pages/VerificationsPage'
import KYCReviewPage from './pages/KYCReviewPage'
import AuditLogPage from './pages/AuditLogPage'
import SubscriptionsPage from './pages/SubscriptionsPage'
import ManagePlansPage from './pages/ManagePlansPage'
import CouponsPage from './pages/CouponsPage'
import CreateCouponPage from './pages/CreateCouponPage'
import AffiliatesPage from './pages/AffiliatesPage'
import AffiliateDetailPage from './pages/AffiliateDetailPage'
import RolesPage from './pages/RolesPage'
import DisputeDetailPage from './pages/DisputeDetailPage'
import NewsletterPage from './pages/NewsletterPage'
import ContactSubmissionsPage from './pages/ContactSubmissionsPage'
import TestimonialsPage from './pages/TestimonialsPage'
import PaymentProvidersPage from './pages/PaymentProvidersPage'
import AdminProfilePage from './pages/AdminProfilePage'
import SettingsPage from './pages/SettingsPage'
import AiUsagePage from './pages/AiUsagePage'
import ContentStatsPage from './pages/content/ContentStatsPage'
import ContentFaqPage from './pages/content/ContentFaqPage'
import ContentAboutPage from './pages/content/ContentAboutPage'
import ContentContactPage from './pages/content/ContentContactPage'
import NotFoundPage from './pages/NotFoundPage'

function RequirePermission({
  resource,
  action = Action.READ,
  children,
}: {
  resource: Resource
  action?: Action
  children: ReactNode
}) {
  const { can, isLoading } = useAdminPermissions()

  if (isLoading) return null
  if (!can(resource, action)) return <PermissionDenied />

  return <>{children}</>
}

export const router = createBrowserRouter([
  { path: '/login', errorElement: <RouteErrorPage />, element: <LoginPage /> },
  { path: '/forgot-password', errorElement: <RouteErrorPage />, element: <ForgotPasswordPage /> },
  {
    path: '/',
    errorElement: <RouteErrorPage />,
    element: (
      <AuthGuard>
        <AdminLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'overview', element: <RequirePermission resource={Resource.ANALYTICS}><OverviewPage /></RequirePermission> },
      { path: 'campaigns', element: <RequirePermission resource={Resource.CAMPAIGNS}><CampaignsPage /></RequirePermission> },
      { path: 'campaigns/:id', element: <RequirePermission resource={Resource.CAMPAIGNS}><CampaignDetailPage /></RequirePermission> },
      { path: 'users', element: <RequirePermission resource={Resource.USERS}><UsersPage /></RequirePermission> },
      { path: 'users/:id', element: <RequirePermission resource={Resource.USERS}><UserDetailPage /></RequirePermission> },
      { path: 'donations', element: <RequirePermission resource={Resource.DONATIONS}><DonationsPage /></RequirePermission> },
      { path: 'payouts', element: <RequirePermission resource={Resource.DONATIONS}><PayoutsPage /></RequirePermission> },
      { path: 'disputes', element: <RequirePermission resource={Resource.DISPUTES}><DisputesPage /></RequirePermission> },
      { path: 'disputes/:id', element: <RequirePermission resource={Resource.DISPUTES}><DisputeDetailPage /></RequirePermission> },
      { path: 'reports', element: <RequirePermission resource={Resource.ANALYTICS}><ReportsPage /></RequirePermission> },
      { path: 'profile', element: <AdminProfilePage /> },
      { path: 'settings', element: <RequirePermission resource={Resource.SETTINGS}><SettingsPage /></RequirePermission> },
      { path: 'verifications', element: <RequirePermission resource={Resource.VERIFICATIONS}><VerificationsPage /></RequirePermission> },
      { path: 'kyc-review', element: <RequirePermission resource={Resource.VERIFICATIONS}><KYCReviewPage /></RequirePermission> },
      { path: 'audit', element: <RequirePermission resource={Resource.AUDIT_LOG}><AuditLogPage /></RequirePermission> },
      { path: 'subscriptions', element: <RequirePermission resource={Resource.SUBSCRIPTIONS}><SubscriptionsPage /></RequirePermission> },
      { path: 'plans', element: <RequirePermission resource={Resource.PLANS}><ManagePlansPage /></RequirePermission> },
      { path: 'coupons/new', element: <RequirePermission resource={Resource.COUPONS} action={Action.CREATE}><CreateCouponPage /></RequirePermission> },
      { path: 'coupons', element: <RequirePermission resource={Resource.COUPONS}><CouponsPage /></RequirePermission> },
      { path: 'affiliates', element: <RequirePermission resource={Resource.AFFILIATES}><AffiliatesPage /></RequirePermission> },
      { path: 'affiliates/:id', element: <RequirePermission resource={Resource.AFFILIATES}><AffiliateDetailPage /></RequirePermission> },
      { path: 'roles', element: <RequirePermission resource={Resource.ROLES}><RolesPage /></RequirePermission> },
      { path: 'newsletter', element: <RequirePermission resource={Resource.NEWSLETTER}><NewsletterPage /></RequirePermission> },
      { path: 'contact-submissions', element: <RequirePermission resource={Resource.CONTACT_SUBMISSIONS}><ContactSubmissionsPage /></RequirePermission> },
      { path: 'testimonials', element: <RequirePermission resource={Resource.TESTIMONIALS}><TestimonialsPage /></RequirePermission> },
      { path: 'payment-providers', element: <RequirePermission resource={Resource.PAYMENT_PROVIDERS}><PaymentProvidersPage /></RequirePermission> },
      { path: 'ai-usage', element: <RequirePermission resource={Resource.ANALYTICS}><AiUsagePage /></RequirePermission> },
      { path: 'content/stats', element: <RequirePermission resource={Resource.CONTENT}><ContentStatsPage /></RequirePermission> },
      { path: 'content/faq', element: <RequirePermission resource={Resource.CONTENT}><ContentFaqPage /></RequirePermission> },
      { path: 'content/about', element: <RequirePermission resource={Resource.CONTENT}><ContentAboutPage /></RequirePermission> },
      { path: 'content/contact', element: <RequirePermission resource={Resource.CONTENT}><ContentContactPage /></RequirePermission> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
