import WalletsPage from './pages/WalletsPage'
import BlogPage from './pages/content/BlogPage'
import { lazy, Suspense } from 'react'
import { ReviewQueueSkeleton } from './components/ReviewQueueStates'
const BlogEditorPage = lazy(() => import('./pages/content/BlogEditorPage'))
import PublicationReviewsPage from './pages/PublicationReviewsPage'
import SafetyReportsPage from './pages/SafetyReportsPage'
import CampaignReportsPage from './pages/CampaignReportsPage'
import PrivacyRequestsPage from './pages/PrivacyRequestsPage'
import StoreBillingPage from './pages/StoreBillingPage'
import RefundOperationsPage from './pages/RefundOperationsPage'
import RefundRequestsPage from './pages/RefundRequestsPage'
import PaymentsPage from './pages/PaymentsPage'
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
      { path: 'publication-reviews', element: <RequirePermission resource={Resource.REPORTS}><PublicationReviewsPage /></RequirePermission> },
      { path: 'safety-reports', element: <RequirePermission resource={Resource.REPORTS}><SafetyReportsPage /></RequirePermission> },
      { path: 'campaign-reports', element: <RequirePermission resource={Resource.REPORTS}><CampaignReportsPage /></RequirePermission> },
      { path: 'privacy-requests', element: <RequirePermission resource={Resource.USERS}><PrivacyRequestsPage /></RequirePermission> },
      { path: 'users', element: <RequirePermission resource={Resource.USERS}><UsersPage /></RequirePermission> },
      { path: 'users/:id', element: <RequirePermission resource={Resource.USERS}><UserDetailPage /></RequirePermission> },
      { path: 'wallets', element: <RequirePermission resource={Resource.WALLETS}><WalletsPage /></RequirePermission> },
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
      { path: 'store-billing', element: <RequirePermission resource={Resource.SUBSCRIPTIONS}><StoreBillingPage /></RequirePermission> },
      { path: 'refund-recovery', element: <RequirePermission resource={Resource.DONATIONS}><RefundOperationsPage /></RequirePermission> },
      { path: 'refund-requests', element: <RequirePermission resource={Resource.DONATIONS}><RefundRequestsPage /></RequirePermission> },
      { path: 'payments', element: <RequirePermission resource={Resource.DONATIONS}><PaymentsPage /></RequirePermission> },
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
      { path: 'content/blog', element: <RequirePermission resource={Resource.CONTENT}><BlogPage /></RequirePermission> },
      { path: 'content/blog/:id', element: <RequirePermission resource={Resource.CONTENT}><Suspense fallback={<ReviewQueueSkeleton label="Loading article editor" />}><BlogEditorPage /></Suspense></RequirePermission> },
      { path: 'content/stats', element: <RequirePermission resource={Resource.CONTENT}><ContentStatsPage /></RequirePermission> },
      { path: 'content/faq', element: <RequirePermission resource={Resource.CONTENT}><ContentFaqPage /></RequirePermission> },
      { path: 'content/about', element: <RequirePermission resource={Resource.CONTENT}><ContentAboutPage /></RequirePermission> },
      { path: 'content/contact', element: <RequirePermission resource={Resource.CONTENT}><ContentContactPage /></RequirePermission> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
