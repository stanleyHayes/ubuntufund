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
import DisputesPage from './pages/DisputesPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import VerificationsPage from './pages/VerificationsPage'
import KYCReviewPage from './pages/KYCReviewPage'
import AuditLogPage from './pages/AuditLogPage'
import SubscriptionsPage from './pages/SubscriptionsPage'
import ManagePlansPage from './pages/ManagePlansPage'
import CreatePlanPage from './pages/CreatePlanPage'
import EditPlanPage from './pages/EditPlanPage'
import RolesPage from './pages/RolesPage'
import CreateRolePage from './pages/CreateRolePage'
import EditRolePage from './pages/EditRolePage'
import DisputeDetailPage from './pages/DisputeDetailPage'
import InviteUserPage from './pages/InviteUserPage'
import NewsletterPage from './pages/NewsletterPage'
import ContactSubmissionsPage from './pages/ContactSubmissionsPage'
import TestimonialsPage from './pages/TestimonialsPage'
import PaymentProvidersPage from './pages/PaymentProvidersPage'
import AdminProfilePage from './pages/AdminProfilePage'
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
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  {
    path: '/',
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
      { path: 'plans/new', element: <RequirePermission resource={Resource.PLANS} action={Action.CREATE}><CreatePlanPage /></RequirePermission> },
      { path: 'plans/:tier/edit', element: <RequirePermission resource={Resource.PLANS} action={Action.UPDATE}><EditPlanPage /></RequirePermission> },
      { path: 'roles', element: <RequirePermission resource={Resource.ROLES}><RolesPage /></RequirePermission> },
      { path: 'roles/new', element: <RequirePermission resource={Resource.ROLES} action={Action.CREATE}><CreateRolePage /></RequirePermission> },
      { path: 'roles/:id/edit', element: <RequirePermission resource={Resource.ROLES} action={Action.UPDATE}><EditRolePage /></RequirePermission> },
      { path: 'invite', element: <RequirePermission resource={Resource.USERS} action={Action.CREATE}><InviteUserPage /></RequirePermission> },
      { path: 'newsletter', element: <RequirePermission resource={Resource.NEWSLETTER}><NewsletterPage /></RequirePermission> },
      { path: 'contact-submissions', element: <RequirePermission resource={Resource.CONTACT_SUBMISSIONS}><ContactSubmissionsPage /></RequirePermission> },
      { path: 'testimonials', element: <RequirePermission resource={Resource.TESTIMONIALS}><TestimonialsPage /></RequirePermission> },
      { path: 'payment-providers', element: <RequirePermission resource={Resource.PAYMENT_PROVIDERS}><PaymentProvidersPage /></RequirePermission> },
      { path: 'ai-usage', element: <AiUsagePage /> },
      { path: 'content/stats', element: <RequirePermission resource={Resource.CONTENT}><ContentStatsPage /></RequirePermission> },
      { path: 'content/faq', element: <RequirePermission resource={Resource.CONTENT}><ContentFaqPage /></RequirePermission> },
      { path: 'content/about', element: <RequirePermission resource={Resource.CONTENT}><ContentAboutPage /></RequirePermission> },
      { path: 'content/contact', element: <RequirePermission resource={Resource.CONTENT}><ContentContactPage /></RequirePermission> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
