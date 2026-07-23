import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { RequireAuth } from './components/auth/RequireAuth'

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })))
const CampaignDetailPage = lazy(() => import('./pages/CampaignDetailPage').then((m) => ({ default: m.CampaignDetailPage })))
const CreateCampaignPage = lazy(() => import('./pages/CreateCampaignPage').then((m) => ({ default: m.CreateCampaignPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const TermsPage = lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const MyDonationsPage = lazy(() => import('./pages/MyDonationsPage').then((m) => ({ default: m.MyDonationsPage })))
const RefundRequestPage = lazy(() => import('./pages/RefundRequestPage').then((m) => ({ default: m.RefundRequestPage })))
const MyRefundsPage = lazy(() => import('./pages/MyRefundsPage').then((m) => ({ default: m.MyRefundsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const MyCampaignsPage = lazy(() => import('./pages/MyCampaignsPage').then((m) => ({ default: m.MyCampaignsPage })))
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage').then((m) => ({ default: m.SubscriptionPage })))
const WalletPage = lazy(() => import('./pages/WalletPage').then((m) => ({ default: m.WalletPage })))
const ExplorePage = lazy(() => import('./pages/ExplorePage').then((m) => ({ default: m.ExplorePage })))
const OrganizationsPage = lazy(() => import('./pages/OrganizationsPage').then((m) => ({ default: m.OrganizationsPage })))
const OrganizationProfilePage = lazy(() => import('./pages/OrganizationProfilePage').then((m) => ({ default: m.OrganizationProfilePage })))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })))
const CollaborationInvitationsPage = lazy(() => import('./pages/CollaborationInvitationsPage').then((m) => ({ default: m.CollaborationInvitationsPage })))
const KYCPage = lazy(() => import('./pages/KYCPage').then((m) => ({ default: m.KYCPage })))

export const router = createBrowserRouter([
  // Auth pages — standalone immersive layout (no header/footer)
  { path: 'login', element: <LoginPage /> },
  { path: 'register', element: <RegisterPage /> },
  { path: 'forgot-password', element: <ForgotPasswordPage /> },
  // Main app — standard layout with header/footer
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'organizations', element: <OrganizationsPage /> },
      { path: 'organizations/:slug', element: <OrganizationProfilePage /> },
      { path: 'leaderboard', element: <LeaderboardPage /> },
      { path: 'campaigns/:id', element: <CampaignDetailPage /> },
      { path: 'campaigns/new', element: <RequireAuth><CreateCampaignPage /></RequireAuth> },
      { path: 'dashboard', element: <RequireAuth><DashboardPage /></RequireAuth> },
      { path: 'profile', element: <RequireAuth><ProfilePage /></RequireAuth> },
      { path: 'donations', element: <RequireAuth><MyDonationsPage /></RequireAuth> },
      { path: 'donations/refund/:donationId', element: <RequireAuth><RefundRequestPage /></RequireAuth> },
      { path: 'refunds', element: <RequireAuth><MyRefundsPage /></RequireAuth> },
      { path: 'settings', element: <RequireAuth><SettingsPage /></RequireAuth> },
      { path: 'my-campaigns', element: <RequireAuth><MyCampaignsPage /></RequireAuth> },
      { path: 'subscription', element: <RequireAuth><SubscriptionPage /></RequireAuth> },
      { path: 'wallet', element: <RequireAuth><WalletPage /></RequireAuth> },
      { path: 'invitations', element: <RequireAuth><CollaborationInvitationsPage /></RequireAuth> },
      { path: 'kyc', element: <RequireAuth><KYCPage /></RequireAuth> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
