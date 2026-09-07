import { GetKYCStatsUseCase } from './application/use-cases/GetKYCStatsUseCase.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './infrastructure/config/index.js';
import { logger } from './infrastructure/logging/logger.js';

// Outbound adapters (repositories)
import { MongoCampaignRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignRepository.js';
import { MongoUserRepository } from './infrastructure/adapters/outbound/persistence/MongoUserRepository.js';
import { MongoDonationRepository } from './infrastructure/adapters/outbound/persistence/MongoDonationRepository.js';
import { MongoWalletRepository } from './infrastructure/adapters/outbound/persistence/MongoWalletRepository.js';
import { MongoWalletTransactionRepository } from './infrastructure/adapters/outbound/persistence/MongoWalletTransactionRepository.js';
import { MongoProfileRepository } from './infrastructure/adapters/outbound/persistence/MongoProfileRepository.js';
import { MongoCampaignUpdateRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignUpdateRepository.js';
import { MongoCampaignCommentRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignCommentRepository.js';
import { MongoShareRepository } from './infrastructure/adapters/outbound/persistence/MongoShareRepository.js';
import { MongoReportRepository } from './infrastructure/adapters/outbound/persistence/MongoReportRepository.js';
import { MongoAdminReportRepository } from './infrastructure/adapters/outbound/persistence/MongoAdminReportRepository.js';
import { MongoLeaderboardRepository } from './infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.js';
import { MongoNotificationRepository } from './infrastructure/adapters/outbound/persistence/MongoNotificationRepository.js';
import { MongoOrganizationRepository } from './infrastructure/adapters/outbound/persistence/MongoOrganizationRepository.js';
import { MongoRefundRepository } from './infrastructure/adapters/outbound/persistence/MongoRefundRepository.js';
import { MongoKYCRepository } from './infrastructure/adapters/outbound/persistence/MongoKYCRepository.js';
import { MongoCollaborationRepository } from './infrastructure/adapters/outbound/persistence/MongoCollaborationRepository.js';
import { MongoSubscriptionRepository } from './infrastructure/adapters/outbound/persistence/MongoSubscriptionRepository.js';
import { MongoPaymentProviderRepository } from './infrastructure/adapters/outbound/persistence/MongoPaymentProviderRepository.js';
import { MongoSubscriptionPlanRepository } from './infrastructure/adapters/outbound/persistence/MongoSubscriptionPlanRepository.js';
import { MongoDisputeRepository } from './infrastructure/adapters/outbound/persistence/MongoDisputeRepository.js';
import { MongoAdminUserRepository } from './infrastructure/adapters/outbound/persistence/MongoAdminUserRepository.js';
import { MongoAnalyticsRepository } from './infrastructure/adapters/outbound/persistence/MongoAnalyticsRepository.js';
import { MongoNewsletterSubscriptionRepository } from './infrastructure/adapters/outbound/persistence/MongoNewsletterSubscriptionRepository.js';
import { MongoSiteContentRepository } from './infrastructure/adapters/outbound/persistence/MongoSiteContentRepository.js';
import { MongoShortLinkRepository } from './infrastructure/adapters/outbound/persistence/MongoShortLinkRepository.js';
import { MongoLiveSessionRepository } from './infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.js';
import { MongoLedgerRepository } from './infrastructure/adapters/outbound/persistence/MongoLedgerRepository.js';
import { MongoCampaignBalanceRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.js';
import { MongoDonationIntentRepository } from './infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.js';
import { MongoPaymentAttemptRepository } from './infrastructure/adapters/outbound/persistence/MongoPaymentAttemptRepository.js';
import { MongoOutboxRepository } from './infrastructure/adapters/outbound/persistence/MongoOutboxRepository.js';
import { MongoTransferRecipientRepository } from './infrastructure/adapters/outbound/persistence/MongoTransferRecipientRepository.js';
import { MongoPayoutRepository } from './infrastructure/adapters/outbound/persistence/MongoPayoutRepository.js';
import { MongoCouponRepository } from './infrastructure/adapters/outbound/persistence/MongoCouponRepository.js';
import { MongoCouponRedemptionRepository } from './infrastructure/adapters/outbound/persistence/MongoCouponRedemptionRepository.js';
import { MongoSubscriptionCheckoutRepository } from './infrastructure/adapters/outbound/persistence/MongoSubscriptionCheckoutRepository.js';
import { MongoAffiliateRepository } from './infrastructure/adapters/outbound/persistence/MongoAffiliateRepository.js';
import { MongoAffiliateReferralRepository } from './infrastructure/adapters/outbound/persistence/MongoAffiliateReferralRepository.js';
import { MongoAffiliateCommissionRepository } from './infrastructure/adapters/outbound/persistence/MongoAffiliateCommissionRepository.js';
import { MongoAffiliateBalanceRepository } from './infrastructure/adapters/outbound/persistence/MongoAffiliateBalanceRepository.js';
import { MongoAffiliatePayoutRepository } from './infrastructure/adapters/outbound/persistence/MongoAffiliatePayoutRepository.js';

// Outbound adapters (payment gateway)
import { PaystackGateway } from './infrastructure/adapters/outbound/payments/PaystackGateway.js';
import { FlutterwaveGateway } from './infrastructure/adapters/outbound/payments/FlutterwaveGateway.js';
import type { PaymentGatewayPort } from './domain/ports/outbound/PaymentGatewayPort.js';

// Application services
import { AuthTokenService } from './application/services/AuthTokenService.js';
import { QrCodeService } from './application/services/QrCodeService.js';
import { RealtimeDonationProjector } from './application/services/RealtimeDonationProjector.js';
import { FeePolicy } from './application/services/FeePolicy.js';
import { PlanLimitsService } from './application/services/PlanLimitsService.js';
import { PlanService } from './application/services/PlanService.js';
import { CouponService } from './application/services/CouponService.js';
import { AffiliateCommissionService } from './application/services/AffiliateCommissionService.js';
import { CampaignLedgerProjector } from './application/services/CampaignLedgerProjector.js';
import { OutboxDispatcher } from './application/services/OutboxDispatcher.js';
import { eventBus } from './infrastructure/realtime/EventBus.js';

// Use cases — auth & campaigns & wallet
import { RegisterUserUseCase } from './application/use-cases/RegisterUserUseCase.js';
import { LoginUserUseCase } from './application/use-cases/LoginUserUseCase.js';
import { ChangePasswordUseCase } from './application/use-cases/ChangePasswordUseCase.js';
import {
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
} from './application/use-cases/ForgotPasswordUseCase.js';
import { CreateCampaignUseCase } from './application/use-cases/CreateCampaignUseCase.js';
import { GetCampaignUseCase } from './application/use-cases/GetCampaignUseCase.js';
import { GetCampaignBySlugUseCase } from './application/use-cases/GetCampaignBySlugUseCase.js';
import { SetCampaignSlugUseCase } from './application/use-cases/SetCampaignSlugUseCase.js';
import { DonateToCampaignUseCase } from './application/use-cases/DonateToCampaignUseCase.js';
import { PostDonationJournalUseCase } from './application/use-cases/PostDonationJournalUseCase.js';
import { SettleDonationUseCase } from './application/use-cases/SettleDonationUseCase.js';
import { CreateDonationIntentUseCase } from './application/use-cases/CreateDonationIntentUseCase.js';
import { HandlePaystackWebhookUseCase } from './application/use-cases/HandlePaystackWebhookUseCase.js';
import { HandleFlutterwaveWebhookUseCase } from './application/use-cases/HandleFlutterwaveWebhookUseCase.js';
import { ReconcilePaymentsUseCase } from './application/use-cases/ReconcilePaymentsUseCase.js';
import { ProcessRefundUseCase } from './application/use-cases/ProcessRefundUseCase.js';
import { RecordPaymentAttemptUseCase } from './application/use-cases/RecordPaymentAttemptUseCase.js';
import { HandlePayoutWebhookUseCase } from './application/use-cases/HandlePayoutWebhookUseCase.js';
import { ListBanksUseCase } from './application/use-cases/ListBanksUseCase.js';
import { CreatePayoutRecipientUseCase } from './application/use-cases/CreatePayoutRecipientUseCase.js';
import { RequestPayoutUseCase } from './application/use-cases/RequestPayoutUseCase.js';
import { ApprovePayoutUseCase } from './application/use-cases/ApprovePayoutUseCase.js';
import { ListCampaignPayoutsUseCase } from './application/use-cases/ListCampaignPayoutsUseCase.js';
import { ListPayoutsUseCase } from './application/use-cases/ListPayoutsUseCase.js';
import { GetDonationIntentPublicUseCase } from './application/use-cases/GetDonationIntentPublicUseCase.js';
import { AddDonationMessageUseCase } from './application/use-cases/AddDonationMessageUseCase.js';
import { CreateShortLinkUseCase } from './application/use-cases/CreateShortLinkUseCase.js';
import { ResolveShortLinkUseCase } from './application/use-cases/ResolveShortLinkUseCase.js';
import { ListCampaignQrCodesUseCase } from './application/use-cases/ListCampaignQrCodesUseCase.js';

// Use cases — live sessions
import { StartLiveSessionUseCase } from './application/use-cases/StartLiveSessionUseCase.js';
import { EndLiveSessionUseCase } from './application/use-cases/EndLiveSessionUseCase.js';
import { UpdateLiveSessionPrivacyUseCase } from './application/use-cases/UpdateLiveSessionPrivacyUseCase.js';
import { RotateOverlayTokenUseCase } from './application/use-cases/RotateOverlayTokenUseCase.js';
import { GetLiveSessionPublicUseCase } from './application/use-cases/GetLiveSessionPublicUseCase.js';
import { GetLiveSessionOverlayUseCase } from './application/use-cases/GetLiveSessionOverlayUseCase.js';

// Use cases — profile
import { GetProfileUseCase } from './application/use-cases/GetProfileUseCase.js';
import { UpdateProfileUseCase } from './application/use-cases/UpdateProfileUseCase.js';
import { GetPublicUserProfileUseCase } from './application/use-cases/GetPublicUserProfileUseCase.js';
import { DeleteAccountUseCase } from './application/use-cases/DeleteAccountUseCase.js';

// Use cases — campaign updates
import { CreateCampaignUpdateUseCase } from './application/use-cases/CreateCampaignUpdateUseCase.js';
import { GetCampaignUpdatesUseCase } from './application/use-cases/GetCampaignUpdatesUseCase.js';
import { UpdateCampaignUpdateUseCase } from './application/use-cases/UpdateCampaignUpdateUseCase.js';
import { DeleteCampaignUpdateUseCase } from './application/use-cases/DeleteCampaignUpdateUseCase.js';
import { PinCampaignUpdateUseCase } from './application/use-cases/PinCampaignUpdateUseCase.js';
import { CampaignCommentUseCases } from './application/use-cases/CampaignCommentUseCases.js';

// Use cases — share/report, donations, leaderboard, notifications
import { ShareCampaignUseCase } from './application/use-cases/ShareCampaignUseCase.js';
import { ReportCampaignUseCase } from './application/use-cases/ReportCampaignUseCase.js';
import { ListRecentDonationsUseCase } from './application/use-cases/ListRecentDonationsUseCase.js';
import { ListMyDonationsUseCase } from './application/use-cases/ListMyDonationsUseCase.js';
import { GetDonationUseCase } from './application/use-cases/GetDonationUseCase.js';
import { ListCampaignDonationsUseCase } from './application/use-cases/ListCampaignDonationsUseCase.js';
import { GetLeaderboardUseCase } from './application/use-cases/GetLeaderboardUseCase.js';
import { GetLeaderboardStatsUseCase } from './application/use-cases/GetLeaderboardStatsUseCase.js';
import { GetMyNotificationsUseCase } from './application/use-cases/GetMyNotificationsUseCase.js';
import { MarkNotificationAsReadUseCase } from './application/use-cases/MarkNotificationAsReadUseCase.js';
import { MarkAllNotificationsAsReadUseCase } from './application/use-cases/MarkAllNotificationsAsReadUseCase.js';
import { GetUnreadNotificationCountUseCase } from './application/use-cases/GetUnreadNotificationCountUseCase.js';

// Use cases — organizations, refunds, kyc, collaborations, subscriptions
import { GetOrganizationUseCase } from './application/use-cases/GetOrganizationUseCase.js';
import { RequestRefundUseCase } from './application/use-cases/RequestRefundUseCase.js';
import { ListMyRefundsUseCase } from './application/use-cases/ListMyRefundsUseCase.js';
import { SubmitKYCIdentityUseCase } from './application/use-cases/SubmitKYCIdentityUseCase.js';
import { GetKYCStatusUseCase } from './application/use-cases/GetKYCStatusUseCase.js';
import { GetPendingKYCUseCase } from './application/use-cases/GetPendingKYCUseCase.js';
import { ApproveKYCUseCase } from './application/use-cases/ApproveKYCUseCase.js';
import { RejectKYCUseCase } from './application/use-cases/RejectKYCUseCase.js';
import { InviteCollaboratorUseCase } from './application/use-cases/InviteCollaboratorUseCase.js';
import { RemoveCollaboratorUseCase } from './application/use-cases/RemoveCollaboratorUseCase.js';
import { ListCampaignCollaboratorsUseCase } from './application/use-cases/ListCampaignCollaboratorsUseCase.js';
import { ListMyCollaborationInvitationsUseCase } from './application/use-cases/ListMyCollaborationInvitationsUseCase.js';
import { RespondToCollaborationUseCase } from './application/use-cases/RespondToCollaborationUseCase.js';
import { GetMySubscriptionUseCase } from './application/use-cases/GetMySubscriptionUseCase.js';
import { SubscribeUseCase } from './application/use-cases/SubscribeUseCase.js';
import { UpgradeSubscriptionUseCase } from './application/use-cases/UpgradeSubscriptionUseCase.js';
import { CancelSubscriptionUseCase } from './application/use-cases/CancelSubscriptionUseCase.js';
import { ListSubscriptionsUseCase } from './application/use-cases/ListSubscriptionsUseCase.js';

// Use cases — coupons (admin CRUD + authed preview)
import { CreateCouponUseCase } from './application/use-cases/CreateCouponUseCase.js';
import { UpdateCouponUseCase } from './application/use-cases/UpdateCouponUseCase.js';
import { ListCouponsUseCase } from './application/use-cases/ListCouponsUseCase.js';
import { GetCouponUseCase } from './application/use-cases/GetCouponUseCase.js';
import { DeleteCouponUseCase } from './application/use-cases/DeleteCouponUseCase.js';
import { PreviewCouponUseCase } from './application/use-cases/PreviewCouponUseCase.js';

// Use cases — paid-subscription checkout rail
import { CreateSubscriptionCheckoutUseCase } from './application/use-cases/CreateSubscriptionCheckoutUseCase.js';
import { GetSubscriptionCheckoutUseCase } from './application/use-cases/GetSubscriptionCheckoutUseCase.js';
import { SettleSubscriptionUseCase } from './application/use-cases/SettleSubscriptionUseCase.js';

// Use cases — affiliate/referral program
import { EnrollAffiliateUseCase } from './application/use-cases/EnrollAffiliateUseCase.js';
import { GetAffiliateDashboardUseCase } from './application/use-cases/GetAffiliateDashboardUseCase.js';
import { ListMyAffiliateReferralsUseCase } from './application/use-cases/ListMyAffiliateReferralsUseCase.js';
import { ListMyAffiliateCommissionsUseCase } from './application/use-cases/ListMyAffiliateCommissionsUseCase.js';
import { SetAffiliatePayoutRecipientUseCase } from './application/use-cases/SetAffiliatePayoutRecipientUseCase.js';
import { RequestAffiliatePayoutUseCase } from './application/use-cases/RequestAffiliatePayoutUseCase.js';
import { ApproveAffiliatePayoutUseCase } from './application/use-cases/ApproveAffiliatePayoutUseCase.js';
import { HandleAffiliatePayoutWebhookUseCase } from './application/use-cases/HandleAffiliatePayoutWebhookUseCase.js';
import { ListAffiliatesUseCase } from './application/use-cases/ListAffiliatesUseCase.js';
import { GetAffiliateDetailUseCase } from './application/use-cases/GetAffiliateDetailUseCase.js';
import { SetAffiliateCommissionRateUseCase } from './application/use-cases/SetAffiliateCommissionRateUseCase.js';
import { UpdateAffiliateStatusUseCase } from './application/use-cases/UpdateAffiliateStatusUseCase.js';
import { ListAffiliatePayoutsUseCase } from './application/use-cases/ListAffiliatePayoutsUseCase.js';
import { MatureAffiliateCommissionsUseCase } from './application/use-cases/MatureAffiliateCommissionsUseCase.js';

// Use cases — payment providers, moderation, admin
import { ListPlansUseCase } from './application/use-cases/ListPlansUseCase.js';
import { UpdatePlanUseCase } from './application/use-cases/UpdatePlanUseCase.js';
import { ListPaymentProvidersUseCase } from './application/use-cases/ListPaymentProvidersUseCase.js';
import { GetEnabledPaymentProvidersUseCase } from './application/use-cases/GetEnabledPaymentProvidersUseCase.js';
import { TogglePaymentProviderUseCase } from './application/use-cases/TogglePaymentProviderUseCase.js';
import { GetDisputeUseCase } from './application/use-cases/GetDisputeUseCase.js';
import { ResolveDisputeUseCase } from './application/use-cases/ResolveDisputeUseCase.js';
import { ListReportsUseCase } from './application/use-cases/ListReportsUseCase.js';
import { ReviewReportUseCase } from './application/use-cases/ReviewReportUseCase.js';
import { ReviewCampaignUseCase } from './application/use-cases/ReviewCampaignUseCase.js';
import { ListUsersUseCase } from './application/use-cases/ListUsersUseCase.js';
import { GetAdminUserUseCase } from './application/use-cases/GetAdminUserUseCase.js';
import { GetPlatformOverviewUseCase } from './application/use-cases/GetPlatformOverviewUseCase.js';
import { SubscribeNewsletterUseCase } from './application/use-cases/SubscribeNewsletterUseCase.js';
import { ListNewsletterSubscribersUseCase } from './application/use-cases/ListNewsletterSubscribersUseCase.js';

// Use cases — site content (headless CMS) & uploads
import { ListSiteContentUseCase } from './application/use-cases/ListSiteContentUseCase.js';
import { GetSiteContentUseCase } from './application/use-cases/GetSiteContentUseCase.js';
import { UpsertSiteContentUseCase } from './application/use-cases/UpsertSiteContentUseCase.js';
import { SignCloudinaryUploadUseCase } from './application/use-cases/SignCloudinaryUploadUseCase.js';

// Inbound adapters (controllers, middleware, routes)
import { AuthController } from './infrastructure/adapters/inbound/http/controllers/AuthController.js';
import { CampaignController } from './infrastructure/adapters/inbound/http/controllers/CampaignController.js';
import { ShortLinkController } from './infrastructure/adapters/inbound/http/controllers/ShortLinkController.js';
import { LiveSessionController } from './infrastructure/adapters/inbound/http/controllers/LiveSessionController.js';
import { RealtimeController } from './infrastructure/adapters/inbound/http/controllers/RealtimeController.js';
import { WalletController } from './infrastructure/adapters/inbound/http/controllers/WalletController.js';
import { ProfileController } from './infrastructure/adapters/inbound/http/controllers/ProfileController.js';
import { CampaignUpdateController } from './infrastructure/adapters/inbound/http/controllers/CampaignUpdateController.js';
import { CampaignCommentController } from './infrastructure/adapters/inbound/http/controllers/CampaignCommentController.js';
import { ShareReportController } from './infrastructure/adapters/inbound/http/controllers/ShareReportController.js';
import { DonationController } from './infrastructure/adapters/inbound/http/controllers/DonationController.js';
import { DonationIntentController } from './infrastructure/adapters/inbound/http/controllers/DonationIntentController.js';
import { PaystackWebhookController } from './infrastructure/adapters/inbound/http/controllers/PaystackWebhookController.js';
import { FlutterwaveWebhookController } from './infrastructure/adapters/inbound/http/controllers/FlutterwaveWebhookController.js';
import { AdminPaymentsController } from './infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.js';
import { PayoutController } from './infrastructure/adapters/inbound/http/controllers/PayoutController.js';
import { LeaderboardController } from './infrastructure/adapters/inbound/http/controllers/LeaderboardController.js';
import { NotificationController } from './infrastructure/adapters/inbound/http/controllers/NotificationController.js';
import { OrganizationController } from './infrastructure/adapters/inbound/http/controllers/OrganizationController.js';
import { RefundController } from './infrastructure/adapters/inbound/http/controllers/RefundController.js';
import { KYCController } from './infrastructure/adapters/inbound/http/controllers/KYCController.js';
import { CollaborationController } from './infrastructure/adapters/inbound/http/controllers/CollaborationController.js';
import { SubscriptionController } from './infrastructure/adapters/inbound/http/controllers/SubscriptionController.js';
import { CouponController } from './infrastructure/adapters/inbound/http/controllers/CouponController.js';
import { AffiliateController } from './infrastructure/adapters/inbound/http/controllers/AffiliateController.js';
import { PaymentProviderController } from './infrastructure/adapters/inbound/http/controllers/PaymentProviderController.js';
import { PlanController } from './infrastructure/adapters/inbound/http/controllers/PlanController.js';
import { DisputeController } from './infrastructure/adapters/inbound/http/controllers/DisputeController.js';
import { AdminReportController } from './infrastructure/adapters/inbound/http/controllers/AdminReportController.js';
import { CampaignModerationController } from './infrastructure/adapters/inbound/http/controllers/CampaignModerationController.js';
import { AdminUserController } from './infrastructure/adapters/inbound/http/controllers/AdminUserController.js';
import { AnalyticsController } from './infrastructure/adapters/inbound/http/controllers/AnalyticsController.js';
import { NewsletterController } from './infrastructure/adapters/inbound/http/controllers/NewsletterController.js';
import { SiteContentController } from './infrastructure/adapters/inbound/http/controllers/SiteContentController.js';
import { UploadController } from './infrastructure/adapters/inbound/http/controllers/UploadController.js';
import { AuditLogController } from './infrastructure/adapters/inbound/http/controllers/AuditLogController.js';
import { TestimonialController } from './infrastructure/adapters/inbound/http/controllers/TestimonialController.js';
import { ContactController } from './infrastructure/adapters/inbound/http/controllers/ContactController.js';

import {
  createAuthMiddleware,
  createOptionalAuthMiddleware,
} from './infrastructure/adapters/inbound/middleware/authMiddleware.js';
import { requireAdmin } from './infrastructure/adapters/inbound/middleware/requireRole.js';
import { errorHandler } from './infrastructure/adapters/inbound/middleware/errorHandler.js';
import { requestLogger } from './infrastructure/adapters/inbound/middleware/requestLogger.js';
import { apiRateLimiter } from './infrastructure/adapters/inbound/middleware/rateLimiter.js';
import { auditMutation } from './infrastructure/adapters/inbound/middleware/auditMutation.js';

import { createAuthRoutes } from './infrastructure/adapters/inbound/http/routes/authRoutes.js';
import { createCampaignRoutes } from './infrastructure/adapters/inbound/http/routes/campaignRoutes.js';
import {
  createCampaignQrRoutes,
  createShortLinkPublicRoutes,
} from './infrastructure/adapters/inbound/http/routes/shortLinkRoutes.js';
import {
  createCampaignLiveSessionRoutes,
  createLiveSessionRoutes,
} from './infrastructure/adapters/inbound/http/routes/liveSessionRoutes.js';
import { createWalletRoutes } from './infrastructure/adapters/inbound/http/routes/walletRoutes.js';
import { createProfileRoutes } from './infrastructure/adapters/inbound/http/routes/profileRoutes.js';
import { createUserRoutes } from './infrastructure/adapters/inbound/http/routes/userRoutes.js';
import { createCampaignUpdateRoutes } from './infrastructure/adapters/inbound/http/routes/campaignUpdateRoutes.js';
import { createCampaignCommentRoutes } from './infrastructure/adapters/inbound/http/routes/campaignCommentRoutes.js';
import { createShareReportRoutes } from './infrastructure/adapters/inbound/http/routes/shareReportRoutes.js';
import { createDonationRoutes } from './infrastructure/adapters/inbound/http/routes/donationRoutes.js';
import {
  createDonationIntentRoutes,
  createDonationMessageRoutes,
} from './infrastructure/adapters/inbound/http/routes/donationIntentRoutes.js';
import { createPaystackWebhookRoutes } from './infrastructure/adapters/inbound/http/routes/paystackWebhookRoutes.js';
import { createFlutterwaveWebhookRoutes } from './infrastructure/adapters/inbound/http/routes/flutterwaveWebhookRoutes.js';
import { createAdminPaymentsRoutes } from './infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.js';
import {
  createBankRoutes,
  createCampaignPayoutRoutes,
  createPayoutRoutes,
} from './infrastructure/adapters/inbound/http/routes/payoutRoutes.js';
import { createCampaignDonationRoutes } from './infrastructure/adapters/inbound/http/routes/campaignDonationRoutes.js';
import { createLeaderboardRoutes } from './infrastructure/adapters/inbound/http/routes/leaderboardRoutes.js';
import { createNotificationRoutes } from './infrastructure/adapters/inbound/http/routes/notificationRoutes.js';
import { createOrganizationRoutes } from './infrastructure/adapters/inbound/http/routes/organizationRoutes.js';
import { createRefundRoutes } from './infrastructure/adapters/inbound/http/routes/refundRoutes.js';
import { createKYCRoutes } from './infrastructure/adapters/inbound/http/routes/kycRoutes.js';
import { createCampaignCollaboratorRoutes } from './infrastructure/adapters/inbound/http/routes/campaignCollaboratorRoutes.js';
import { createCollaborationRoutes } from './infrastructure/adapters/inbound/http/routes/collaborationRoutes.js';
import { createSubscriptionRoutes } from './infrastructure/adapters/inbound/http/routes/subscriptionRoutes.js';
import { createCouponRoutes } from './infrastructure/adapters/inbound/http/routes/couponRoutes.js';
import {
  createAffiliateRoutes,
  createAdminAffiliateRoutes,
} from './infrastructure/adapters/inbound/http/routes/affiliateRoutes.js';
import { createPaymentProviderRoutes } from './infrastructure/adapters/inbound/http/routes/paymentProviderRoutes.js';
import { createPlanRoutes } from './infrastructure/adapters/inbound/http/routes/planRoutes.js';
import { createDisputeRoutes } from './infrastructure/adapters/inbound/http/routes/disputeRoutes.js';
import { createAdminReportRoutes } from './infrastructure/adapters/inbound/http/routes/adminReportRoutes.js';
import { createCampaignModerationRoutes } from './infrastructure/adapters/inbound/http/routes/campaignModerationRoutes.js';
import { createAdminUserRoutes } from './infrastructure/adapters/inbound/http/routes/adminUserRoutes.js';
import { createAnalyticsRoutes } from './infrastructure/adapters/inbound/http/routes/analyticsRoutes.js';
import { createNewsletterRoutes } from './infrastructure/adapters/inbound/http/routes/newsletterRoutes.js';
import { createContentRoutes } from './infrastructure/adapters/inbound/http/routes/contentRoutes.js';
import { createUploadRoutes } from './infrastructure/adapters/inbound/http/routes/uploadRoutes.js';
import { createAuditLogRoutes } from './infrastructure/adapters/inbound/http/routes/auditLogRoutes.js';
import { createRbacRoutes } from './infrastructure/adapters/inbound/http/routes/rbacRoutes.js';
import { createTestimonialRoutes } from './infrastructure/adapters/inbound/http/routes/testimonialRoutes.js';
import { createContactRoutes } from './infrastructure/adapters/inbound/http/routes/contactRoutes.js';

/**
 * Assemble the fully-wired Express application (no listening, no DB
 * connection). Exported separately from bootstrap so integration tests can
 * exercise the real route graph with supertest.
 */
export function createApp(): express.Express {
  // ── Outbound adapters ────────────────────────────────────────────────
  const campaignRepo = new MongoCampaignRepository();
  const userRepo = new MongoUserRepository();
  const donationRepo = new MongoDonationRepository();
  const walletRepo = new MongoWalletRepository();
  const walletTxRepo = new MongoWalletTransactionRepository();
  const profileRepo = new MongoProfileRepository();
  const campaignUpdateRepo = new MongoCampaignUpdateRepository();
  const campaignCommentRepo = new MongoCampaignCommentRepository();
  const shareRepo = new MongoShareRepository();
  const reportRepo = new MongoReportRepository();
  const adminReportRepo = new MongoAdminReportRepository();
  const leaderboardRepo = new MongoLeaderboardRepository();
  const notificationRepo = new MongoNotificationRepository();
  const organizationRepo = new MongoOrganizationRepository();
  const refundRepo = new MongoRefundRepository();
  const kycRepo = new MongoKYCRepository();
  const collaborationRepo = new MongoCollaborationRepository();
  const subscriptionRepo = new MongoSubscriptionRepository();
  const paymentProviderRepo = new MongoPaymentProviderRepository();
  const subscriptionPlanRepo = new MongoSubscriptionPlanRepository();
  // Seed the plan matrix once at startup (idempotent — only inserts a tier's row
  // when absent, never overwriting admin edits). Fire-and-forget; a seed failure
  // is logged and PlanService still falls back to the code-defined defaults.
  void subscriptionPlanRepo
    .seedDefaults()
    .catch((error) => logger.error({ err: error }, 'subscription plan seed failed'));
  const disputeRepo = new MongoDisputeRepository();
  const adminUserRepo = new MongoAdminUserRepository();
  const analyticsRepo = new MongoAnalyticsRepository();
  const newsletterRepo = new MongoNewsletterSubscriptionRepository();
  const siteContentRepo = new MongoSiteContentRepository();
  const shortLinkRepo = new MongoShortLinkRepository();
  const liveSessionRepo = new MongoLiveSessionRepository();
  const ledgerRepo = new MongoLedgerRepository();
  const campaignBalanceRepo = new MongoCampaignBalanceRepository();
  const donationIntentRepo = new MongoDonationIntentRepository();
  const paymentAttemptRepo = new MongoPaymentAttemptRepository();
  const outboxRepo = new MongoOutboxRepository();
  const transferRecipientRepo = new MongoTransferRecipientRepository();
  const payoutRepo = new MongoPayoutRepository();
  const couponRepo = new MongoCouponRepository();
  const couponRedemptionRepo = new MongoCouponRedemptionRepository();
  const subscriptionCheckoutRepo = new MongoSubscriptionCheckoutRepository();
  const affiliateRepo = new MongoAffiliateRepository();
  const affiliateReferralRepo = new MongoAffiliateReferralRepository();
  const affiliateCommissionRepo = new MongoAffiliateCommissionRepository();
  const affiliateBalanceRepo = new MongoAffiliateBalanceRepository();
  const affiliatePayoutRepo = new MongoAffiliatePayoutRepository();

  // Paystack payment gateway (behind the swappable PaymentGatewayPort). Absent
  // credentials leave it disabled — the Paystack rail returns 501 and the
  // wallet rail keeps working.
  const paymentGateway = new PaystackGateway({
    secretKey: config.paystack.secretKey,
    publicKey: config.paystack.publicKey,
    publicWebUrl: config.publicWebUrl,
  });
  // Flutterwave — secondary diaspora-card rail. Inert (isConfigured → false)
  // until a secret key is supplied; enabling also requires PAYMENTS_FLUTTERWAVE_ENABLED.
  const flutterwaveGateway = new FlutterwaveGateway({
    secretKey: config.flutterwave.secretKey,
    publicKey: config.flutterwave.publicKey,
    webhookHash: config.flutterwave.webhookHash,
    publicWebUrl: config.publicWebUrl,
  });
  // Hosted gateways keyed by provider; the router/use-case pick by provider.
  const gatewayRegistry = new Map<string, PaymentGatewayPort>([
    ['paystack', paymentGateway],
    ['flutterwave', flutterwaveGateway],
  ]);

  // ── Services ─────────────────────────────────────────────────────────
  const tokenService = new AuthTokenService(config.jwtSecret, config.jwtRefreshSecret);
  const authMiddleware = createAuthMiddleware(tokenService);
  const optionalAuthMiddleware = createOptionalAuthMiddleware(tokenService);
  const qrCodeService = new QrCodeService();
  // Projects successful donations onto the in-process realtime event bus and
  // bumps live-session stats — shared by the wallet rail (today) and the later
  // hosted-payment phases.
  const realtimeDonationProjector = new RealtimeDonationProjector(
    eventBus,
    campaignRepo,
    liveSessionRepo,
    userRepo
  );
  // Ledger + donation-intent settlement wiring. The fee policy computes the
  // wallet-rail money split; the projector moves campaign totals + balances
  // through the ledger; the outbox dispatcher turns settled donations into
  // realtime/receipt side-effects durably (swept again on boot).
  const feePolicy = new FeePolicy(config.fees);
  // DB-backed, admin-editable plans (pricing/limits/benefits). The single source
  // the rest of the app reads plans through; falls back to SUBSCRIPTION_PLANS.
  const planService = new PlanService(subscriptionPlanRepo);
  // Resolves a user's subscription plan and enforces its limits (active-campaign
  // count, goal cap, plan feature gates) + the plan-based platform fee rate.
  const planLimitsService = new PlanLimitsService(
    subscriptionRepo,
    campaignRepo,
    planService
  );
  // Coupon validation/pricing for the paid-subscription checkout rail.
  const couponService = new CouponService(couponRepo, couponRedemptionRepo);
  // Awards + claws back the one-time referral commission on a referee's first
  // paid subscription (rate + hold window from config.affiliate).
  const affiliateCommissionService = new AffiliateCommissionService(
    affiliateRepo,
    affiliateReferralRepo,
    affiliateCommissionRepo,
    affiliateBalanceRepo,
    {
      commissionPercent: config.affiliate.commissionPercent,
      holdDays: config.affiliate.holdDays,
    }
  );
  const campaignLedgerProjector = new CampaignLedgerProjector(
    campaignRepo,
    campaignBalanceRepo,
    ledgerRepo
  );
  const outboxDispatcher = new OutboxDispatcher(
    outboxRepo,
    realtimeDonationProjector
  );

  // ── Use cases ────────────────────────────────────────────────────────
  const registerUserUseCase = new RegisterUserUseCase(
    userRepo,
    walletRepo,
    tokenService,
    // Optional referral capture: a `?ref=` code on signup links the new user to
    // the referrer's affiliate.
    affiliateRepo,
    affiliateReferralRepo
  );
  const loginUserUseCase = new LoginUserUseCase(userRepo, tokenService);
  const changePasswordUseCase = new ChangePasswordUseCase(userRepo, tokenService);
  const forgotPasswordUseCase = new ForgotPasswordUseCase(userRepo);
  const resetPasswordUseCase = new ResetPasswordUseCase(userRepo, tokenService);

  const createCampaignUseCase = new CreateCampaignUseCase(campaignRepo, userRepo, planLimitsService);
  const getCampaignUseCase = new GetCampaignUseCase(campaignRepo, donationRepo);
  const getCampaignBySlugUseCase = new GetCampaignBySlugUseCase(
    campaignRepo,
    config.publicWebUrl,
    donationRepo
  );
  const setCampaignSlugUseCase = new SetCampaignSlugUseCase(campaignRepo);
  const donateToCampaignUseCase = new DonateToCampaignUseCase(
    campaignRepo,
    donationRepo,
    walletRepo,
    walletTxRepo,
    realtimeDonationProjector
  );

  // Donation-intent rail: guest-capable checkout backed by the immutable
  // ledger. settleDonation() is the seam Phase 4 (Paystack) also calls.
  const postDonationJournalUseCase = new PostDonationJournalUseCase(ledgerRepo);
  const settleDonationUseCase = new SettleDonationUseCase(
    donationIntentRepo,
    donationRepo,
    postDonationJournalUseCase,
    campaignLedgerProjector,
    outboxRepo,
    outboxDispatcher
  );
  const createDonationIntentUseCase = new CreateDonationIntentUseCase(
    campaignRepo,
    liveSessionRepo,
    walletRepo,
    donationIntentRepo,
    feePolicy,
    settleDonationUseCase,
    paymentGateway,
    planLimitsService,
    walletTxRepo,
    paymentAttemptRepo,
    config.payments,
    gatewayRegistry
  );
  // Payout settlement: the signed transfer webhook moves an approved payout to
  // its terminal state and clears the campaign balance/ledger accordingly.
  const handlePayoutWebhookUseCase = new HandlePayoutWebhookUseCase(
    payoutRepo,
    campaignBalanceRepo,
    ledgerRepo
  );
  // Affiliate payout settlement: the signed transfer webhook moves an approved
  // affiliate payout (aff- reference) to its terminal state and reconciles the
  // affiliate balance buckets accordingly.
  const handleAffiliatePayoutWebhookUseCase =
    new HandleAffiliatePayoutWebhookUseCase(
      affiliatePayoutRepo,
      affiliateBalanceRepo
    );
  // Paid-subscription settlement seam: activates the subscription, redeems any
  // coupon, and awards the one-time affiliate commission. Called by the signed
  // webhook (real charge) and inline for a coupon-zeroed checkout.
  const settleSubscriptionUseCase = new SettleSubscriptionUseCase(
    subscriptionCheckoutRepo,
    subscriptionRepo,
    couponRepo,
    couponRedemptionRepo,
    affiliateCommissionService
  );
  // Paystack settlement: the signed webhook is the authoritative rail that
  // calls settleDonation() with the provider's real fee breakdown, settles
  // approved campaign/affiliate payouts on transfer.* events, settles paid
  // subscriptions on sub- charges, and claws back affiliate commission on a
  // subscription refund.
  const handlePaystackWebhookUseCase = new HandlePaystackWebhookUseCase(
    paymentGateway,
    donationIntentRepo,
    paymentAttemptRepo,
    feePolicy,
    settleDonationUseCase,
    planLimitsService,
    handlePayoutWebhookUseCase,
    subscriptionCheckoutRepo,
    settleSubscriptionUseCase,
    handleAffiliatePayoutWebhookUseCase,
    affiliateCommissionService
  );
  // Flutterwave settlement: verifies the verif-hash, re-verifies the charge
  // server-side, then settles through the same donation seam as Paystack.
  const handleFlutterwaveWebhookUseCase = new HandleFlutterwaveWebhookUseCase(
    flutterwaveGateway,
    donationIntentRepo,
    paymentAttemptRepo,
    feePolicy,
    settleDonationUseCase,
    planLimitsService
  );
  // Reconciliation (spec §13): re-verify stale PENDING hosted intents against
  // the provider and safely repair missed settlements.
  const reconcilePaymentsUseCase = new ReconcilePaymentsUseCase(
    gatewayRegistry,
    donationIntentRepo,
    paymentAttemptRepo,
    feePolicy,
    settleDonationUseCase,
    planLimitsService
  );
  // Admin-initiated, provider-integrated refund with compensating ledger (spec §14).
  const processRefundUseCase = new ProcessRefundUseCase(
    donationIntentRepo,
    campaignBalanceRepo,
    ledgerRepo,
    campaignLedgerProjector,
    gatewayRegistry
  );
  const recordPaymentAttemptUseCase = new RecordPaymentAttemptUseCase(
    donationIntentRepo,
    paymentAttemptRepo
  );
  const getDonationIntentPublicUseCase = new GetDonationIntentPublicUseCase(
    donationIntentRepo
  );
  const addDonationMessageUseCase = new AddDonationMessageUseCase(donationRepo);

  // Payout rail: register recipients, request/approve payouts of cleared funds,
  // and disburse via Paystack Transfers. Guarded owner/admin; the transfer
  // webhook (above) settles the terminal state.
  const listBanksUseCase = new ListBanksUseCase(paymentGateway);
  const createPayoutRecipientUseCase = new CreatePayoutRecipientUseCase(
    campaignRepo,
    transferRecipientRepo,
    paymentGateway
  );
  const requestPayoutUseCase = new RequestPayoutUseCase(
    campaignRepo,
    transferRecipientRepo,
    payoutRepo,
    campaignBalanceRepo,
    paymentGateway
  );
  const approvePayoutUseCase = new ApprovePayoutUseCase(
    payoutRepo,
    transferRecipientRepo,
    campaignBalanceRepo,
    paymentGateway
  );
  const listCampaignPayoutsUseCase = new ListCampaignPayoutsUseCase(
    campaignRepo,
    payoutRepo
  );
  const listPayoutsUseCase = new ListPayoutsUseCase(payoutRepo);

  const createShortLinkUseCase = new CreateShortLinkUseCase(
    shortLinkRepo,
    campaignRepo,
    config.publicWebUrl,
    config.publicApiUrl
  );
  const resolveShortLinkUseCase = new ResolveShortLinkUseCase(
    shortLinkRepo,
    liveSessionRepo
  );
  const listCampaignQrCodesUseCase = new ListCampaignQrCodesUseCase(
    shortLinkRepo,
    campaignRepo,
    config.publicApiUrl
  );

  const startLiveSessionUseCase = new StartLiveSessionUseCase(
    liveSessionRepo,
    campaignRepo,
    planLimitsService
  );
  const endLiveSessionUseCase = new EndLiveSessionUseCase(
    liveSessionRepo,
    campaignRepo
  );
  const updateLiveSessionPrivacyUseCase = new UpdateLiveSessionPrivacyUseCase(
    liveSessionRepo,
    campaignRepo
  );
  const rotateOverlayTokenUseCase = new RotateOverlayTokenUseCase(
    liveSessionRepo,
    campaignRepo
  );
  const getLiveSessionPublicUseCase = new GetLiveSessionPublicUseCase(
    liveSessionRepo
  );
  const getLiveSessionOverlayUseCase = new GetLiveSessionOverlayUseCase(
    liveSessionRepo,
    campaignRepo,
    donationRepo,
    userRepo
  );

  const getProfileUseCase = new GetProfileUseCase(userRepo, profileRepo, donationRepo, campaignRepo);
  const updateProfileUseCase = new UpdateProfileUseCase(userRepo, profileRepo);
  const getPublicUserProfileUseCase = new GetPublicUserProfileUseCase(userRepo, profileRepo);
  const deleteAccountUseCase = new DeleteAccountUseCase(userRepo, tokenService);

  const createCampaignUpdateUseCase = new CreateCampaignUpdateUseCase(campaignUpdateRepo, campaignRepo);
  const getCampaignUpdatesUseCase = new GetCampaignUpdatesUseCase(campaignUpdateRepo, campaignRepo);
  const updateCampaignUpdateUseCase = new UpdateCampaignUpdateUseCase(campaignUpdateRepo);
  const deleteCampaignUpdateUseCase = new DeleteCampaignUpdateUseCase(campaignUpdateRepo);
  const pinCampaignUpdateUseCase = new PinCampaignUpdateUseCase(campaignUpdateRepo);
  const campaignCommentUseCases = new CampaignCommentUseCases(campaignCommentRepo, campaignRepo, userRepo);

  const shareCampaignUseCase = new ShareCampaignUseCase(shareRepo);
  const reportCampaignUseCase = new ReportCampaignUseCase(campaignRepo, reportRepo);

  const listRecentDonationsUseCase = new ListRecentDonationsUseCase(donationRepo, campaignRepo, userRepo);
  const listMyDonationsUseCase = new ListMyDonationsUseCase(donationRepo, campaignRepo);
  const getDonationUseCase = new GetDonationUseCase(donationRepo, campaignRepo);
  const listCampaignDonationsUseCase = new ListCampaignDonationsUseCase(donationRepo, campaignRepo, userRepo);

  const getLeaderboardUseCase = new GetLeaderboardUseCase(leaderboardRepo);
  const getLeaderboardStatsUseCase = new GetLeaderboardStatsUseCase(leaderboardRepo);

  const getMyNotificationsUseCase = new GetMyNotificationsUseCase(notificationRepo);
  const markNotificationAsReadUseCase = new MarkNotificationAsReadUseCase(notificationRepo);
  const markAllNotificationsAsReadUseCase = new MarkAllNotificationsAsReadUseCase(notificationRepo);
  const getUnreadNotificationCountUseCase = new GetUnreadNotificationCountUseCase(notificationRepo);

  const getOrganizationUseCase = new GetOrganizationUseCase(organizationRepo, campaignRepo);

  const requestRefundUseCase = new RequestRefundUseCase(refundRepo, donationRepo);
  const listMyRefundsUseCase = new ListMyRefundsUseCase(refundRepo, campaignRepo);

  const submitKYCIdentityUseCase = new SubmitKYCIdentityUseCase(kycRepo);
  const getKYCStatusUseCase = new GetKYCStatusUseCase(kycRepo);
  const getPendingKYCUseCase = new GetPendingKYCUseCase(kycRepo, userRepo);
  const approveKYCUseCase = new ApproveKYCUseCase(kycRepo, userRepo);
  const rejectKYCUseCase = new RejectKYCUseCase(kycRepo);

  const inviteCollaboratorUseCase = new InviteCollaboratorUseCase(campaignRepo, userRepo, collaborationRepo, planLimitsService);
  const removeCollaboratorUseCase = new RemoveCollaboratorUseCase(campaignRepo, collaborationRepo);
  const listCampaignCollaboratorsUseCase = new ListCampaignCollaboratorsUseCase(campaignRepo, collaborationRepo);
  const listMyCollaborationInvitationsUseCase = new ListMyCollaborationInvitationsUseCase(collaborationRepo, campaignRepo);
  const respondToCollaborationUseCase = new RespondToCollaborationUseCase(collaborationRepo);

  const getMySubscriptionUseCase = new GetMySubscriptionUseCase(subscriptionRepo);
  const subscribeUseCase = new SubscribeUseCase(subscriptionRepo);
  const upgradeSubscriptionUseCase = new UpgradeSubscriptionUseCase(subscriptionRepo);
  const cancelSubscriptionUseCase = new CancelSubscriptionUseCase(subscriptionRepo);
  const listSubscriptionsUseCase = new ListSubscriptionsUseCase(subscriptionRepo, userRepo);

  // Paid-subscription checkout rail (coupon-aware; settles via the webhook or,
  // when a coupon zeroes the price, inline via settleSubscriptionUseCase).
  const createSubscriptionCheckoutUseCase = new CreateSubscriptionCheckoutUseCase(
    subscriptionCheckoutRepo,
    couponRedemptionRepo,
    userRepo,
    couponService,
    paymentGateway,
    settleSubscriptionUseCase,
    planService
  );
  const getSubscriptionCheckoutUseCase = new GetSubscriptionCheckoutUseCase(
    subscriptionCheckoutRepo
  );

  // Coupons: admin CRUD + an authed pre-checkout preview.
  const createCouponUseCase = new CreateCouponUseCase(couponRepo);
  const updateCouponUseCase = new UpdateCouponUseCase(couponRepo);
  const listCouponsUseCase = new ListCouponsUseCase(couponRepo);
  const getCouponUseCase = new GetCouponUseCase(couponRepo);
  const deleteCouponUseCase = new DeleteCouponUseCase(couponRepo);
  const previewCouponUseCase = new PreviewCouponUseCase(couponService, planService);

  // Affiliate/referral program: owner surface + admin console + payout rail.
  const enrollAffiliateUseCase = new EnrollAffiliateUseCase(
    affiliateRepo,
    affiliateBalanceRepo
  );
  const getAffiliateDashboardUseCase = new GetAffiliateDashboardUseCase(
    affiliateRepo,
    affiliateBalanceRepo,
    affiliateCommissionRepo,
    affiliateReferralRepo,
    config.publicWebUrl
  );
  const listMyAffiliateReferralsUseCase = new ListMyAffiliateReferralsUseCase(
    affiliateRepo,
    affiliateReferralRepo
  );
  const listMyAffiliateCommissionsUseCase =
    new ListMyAffiliateCommissionsUseCase(
      affiliateRepo,
      affiliateCommissionRepo
    );
  const setAffiliatePayoutRecipientUseCase =
    new SetAffiliatePayoutRecipientUseCase(affiliateRepo, paymentGateway);
  const requestAffiliatePayoutUseCase = new RequestAffiliatePayoutUseCase(
    affiliateRepo,
    affiliatePayoutRepo,
    affiliateBalanceRepo,
    affiliateCommissionRepo,
    paymentGateway
  );
  const approveAffiliatePayoutUseCase = new ApproveAffiliatePayoutUseCase(
    affiliatePayoutRepo,
    affiliateRepo,
    affiliateBalanceRepo,
    paymentGateway
  );
  const listAffiliatesUseCase = new ListAffiliatesUseCase(affiliateRepo);
  const getAffiliateDetailUseCase = new GetAffiliateDetailUseCase(
    affiliateRepo,
    affiliateBalanceRepo,
    affiliateReferralRepo,
    affiliateCommissionRepo,
    affiliatePayoutRepo
  );
  const setAffiliateCommissionRateUseCase =
    new SetAffiliateCommissionRateUseCase(affiliateRepo);
  const updateAffiliateStatusUseCase = new UpdateAffiliateStatusUseCase(
    affiliateRepo
  );
  const listAffiliatePayoutsUseCase = new ListAffiliatePayoutsUseCase(
    affiliatePayoutRepo
  );
  // Batch maturity sweep (held → available); exposed for a boot/cron sweep.
  const matureAffiliateCommissionsUseCase = new MatureAffiliateCommissionsUseCase(
    affiliateCommissionRepo,
    affiliateBalanceRepo
  );

  const listPlansUseCase = new ListPlansUseCase(planService);
  const updatePlanUseCase = new UpdatePlanUseCase(subscriptionPlanRepo);
  const listPaymentProvidersUseCase = new ListPaymentProvidersUseCase(paymentProviderRepo);
  const getEnabledPaymentProvidersUseCase = new GetEnabledPaymentProvidersUseCase(paymentProviderRepo);
  const togglePaymentProviderUseCase = new TogglePaymentProviderUseCase(paymentProviderRepo);

  const getDisputeUseCase = new GetDisputeUseCase(disputeRepo, campaignRepo, userRepo);
  const resolveDisputeUseCase = new ResolveDisputeUseCase(disputeRepo);
  const listReportsUseCase = new ListReportsUseCase(adminReportRepo, campaignRepo);
  const reviewReportUseCase = new ReviewReportUseCase(adminReportRepo);
  const reviewCampaignUseCase = new ReviewCampaignUseCase(campaignRepo);
  const listUsersUseCase = new ListUsersUseCase(adminUserRepo);
  const getAdminUserUseCase = new GetAdminUserUseCase(adminUserRepo);
  const getPlatformOverviewUseCase = new GetPlatformOverviewUseCase(analyticsRepo);
  const subscribeNewsletterUseCase = new SubscribeNewsletterUseCase(newsletterRepo);
  const listNewsletterSubscribersUseCase = new ListNewsletterSubscribersUseCase(newsletterRepo);

  const listSiteContentUseCase = new ListSiteContentUseCase(siteContentRepo);
  const getSiteContentUseCase = new GetSiteContentUseCase(siteContentRepo);
  const upsertSiteContentUseCase = new UpsertSiteContentUseCase(siteContentRepo);
  const signCloudinaryUploadUseCase = new SignCloudinaryUploadUseCase(config.cloudinary);

  // ── Controllers ──────────────────────────────────────────────────────
  const authController = new AuthController(
    registerUserUseCase,
    loginUserUseCase,
    tokenService,
    changePasswordUseCase,
    forgotPasswordUseCase,
    resetPasswordUseCase
  );
  const campaignController = new CampaignController(
    createCampaignUseCase,
    getCampaignUseCase,
    donateToCampaignUseCase,
    getCampaignBySlugUseCase,
    setCampaignSlugUseCase
  );
  const shortLinkController = new ShortLinkController(
    createShortLinkUseCase,
    listCampaignQrCodesUseCase,
    resolveShortLinkUseCase,
    shortLinkRepo,
    qrCodeService,
    config.publicApiUrl
  );
  const liveSessionController = new LiveSessionController(
    startLiveSessionUseCase,
    endLiveSessionUseCase,
    updateLiveSessionPrivacyUseCase,
    rotateOverlayTokenUseCase,
    getLiveSessionPublicUseCase,
    getLiveSessionOverlayUseCase
  );
  const realtimeController = new RealtimeController(
    eventBus,
    campaignRepo,
    liveSessionRepo
  );
  const walletController = new WalletController(walletRepo, walletTxRepo);
  const profileController = new ProfileController(
    getProfileUseCase,
    updateProfileUseCase,
    getPublicUserProfileUseCase,
    deleteAccountUseCase
  );
  const campaignUpdateController = new CampaignUpdateController(
    createCampaignUpdateUseCase,
    getCampaignUpdatesUseCase,
    updateCampaignUpdateUseCase,
    deleteCampaignUpdateUseCase,
    pinCampaignUpdateUseCase
  );
  const campaignCommentController = new CampaignCommentController(campaignCommentUseCases);
  const shareReportController = new ShareReportController(shareCampaignUseCase, reportCampaignUseCase);
  const donationController = new DonationController(
    listRecentDonationsUseCase,
    listMyDonationsUseCase,
    getDonationUseCase,
    listCampaignDonationsUseCase
  );
  const donationIntentController = new DonationIntentController(
    createDonationIntentUseCase,
    recordPaymentAttemptUseCase,
    getDonationIntentPublicUseCase,
    addDonationMessageUseCase
  );
  const paystackWebhookController = new PaystackWebhookController(
    handlePaystackWebhookUseCase
  );
  const flutterwaveWebhookController = new FlutterwaveWebhookController(
    handleFlutterwaveWebhookUseCase
  );
  const adminPaymentsController = new AdminPaymentsController(
    donationIntentRepo,
    paymentAttemptRepo,
    reconcilePaymentsUseCase,
    processRefundUseCase
  );
  const payoutController = new PayoutController(
    listBanksUseCase,
    createPayoutRecipientUseCase,
    requestPayoutUseCase,
    approvePayoutUseCase,
    listCampaignPayoutsUseCase,
    listPayoutsUseCase
  );
  const leaderboardController = new LeaderboardController(getLeaderboardUseCase, getLeaderboardStatsUseCase);
  const notificationController = new NotificationController(
    getMyNotificationsUseCase,
    markNotificationAsReadUseCase,
    markAllNotificationsAsReadUseCase,
    getUnreadNotificationCountUseCase
  );
  const organizationController = new OrganizationController(getOrganizationUseCase);
  const refundController = new RefundController(requestRefundUseCase, listMyRefundsUseCase);
  const kycController = new KYCController(
    submitKYCIdentityUseCase,
    getKYCStatusUseCase,
    getPendingKYCUseCase,
    approveKYCUseCase,
    rejectKYCUseCase,
    new GetKYCStatsUseCase(kycRepo)
  );
  const collaborationController = new CollaborationController(
    inviteCollaboratorUseCase,
    removeCollaboratorUseCase,
    listCampaignCollaboratorsUseCase,
    listMyCollaborationInvitationsUseCase,
    respondToCollaborationUseCase
  );
  const subscriptionController = new SubscriptionController(
    getMySubscriptionUseCase,
    subscribeUseCase,
    upgradeSubscriptionUseCase,
    cancelSubscriptionUseCase,
    listSubscriptionsUseCase,
    createSubscriptionCheckoutUseCase,
    getSubscriptionCheckoutUseCase
  );
  const couponController = new CouponController(
    createCouponUseCase,
    listCouponsUseCase,
    getCouponUseCase,
    updateCouponUseCase,
    deleteCouponUseCase,
    previewCouponUseCase
  );
  const affiliateController = new AffiliateController(
    enrollAffiliateUseCase,
    getAffiliateDashboardUseCase,
    listMyAffiliateReferralsUseCase,
    listMyAffiliateCommissionsUseCase,
    setAffiliatePayoutRecipientUseCase,
    requestAffiliatePayoutUseCase,
    listAffiliatesUseCase,
    getAffiliateDetailUseCase,
    setAffiliateCommissionRateUseCase,
    updateAffiliateStatusUseCase,
    listAffiliatePayoutsUseCase,
    approveAffiliatePayoutUseCase
  );
  const paymentProviderController = new PaymentProviderController(
    listPaymentProvidersUseCase,
    getEnabledPaymentProvidersUseCase,
    togglePaymentProviderUseCase
  );
  const planController = new PlanController(listPlansUseCase, updatePlanUseCase);
  const disputeController = new DisputeController(getDisputeUseCase, resolveDisputeUseCase);
  const adminReportController = new AdminReportController(listReportsUseCase, reviewReportUseCase);
  const campaignModerationController = new CampaignModerationController(reviewCampaignUseCase);
  const adminUserController = new AdminUserController(
    listUsersUseCase,
    getAdminUserUseCase
  );
  const analyticsController = new AnalyticsController(getPlatformOverviewUseCase);
  const newsletterController = new NewsletterController(
    subscribeNewsletterUseCase,
    listNewsletterSubscribersUseCase
  );
  const siteContentController = new SiteContentController(
    listSiteContentUseCase,
    getSiteContentUseCase,
    upsertSiteContentUseCase
  );
  const uploadController = new UploadController(signCloudinaryUploadUseCase);
  const auditLogController = new AuditLogController();
  const testimonialController = new TestimonialController();
  const contactController = new ContactController();

  // ── HTTP pipeline ────────────────────────────────────────────────────
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
      credentials: true,
    })
  );

  // Paystack webhook — mounted BEFORE the JSON body parser so its handler
  // receives the raw request bytes the HMAC-SHA512 signature is verified
  // against. Its own express.raw parser applies only to this route.
  app.use(
    '/api/v1/webhooks/paystack',
    createPaystackWebhookRoutes(paystackWebhookController)
  );
  // Flutterwave webhook — likewise mounted BEFORE the JSON parser (raw bytes).
  app.use(
    '/api/v1/webhooks/flutterwave',
    createFlutterwaveWebhookRoutes(flutterwaveWebhookController)
  );

  app.use(express.json({ limit: '200kb' }));
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const api = express.Router();
  api.use(apiRateLimiter);
  api.use(auditMutation);

  api.use('/auth', createAuthRoutes(authController, authMiddleware));

  // The /campaigns resource is composed from sibling routers (Express
  // dispatches across routers sharing a prefix by method + path).
  api.use('/campaigns', createCampaignRoutes(campaignController, authMiddleware));
  api.use('/campaigns', createCampaignUpdateRoutes(campaignUpdateController, authMiddleware));
  api.use('/campaigns', createCampaignCommentRoutes(campaignCommentController, authMiddleware));
  api.use('/campaigns', createShareReportRoutes(shareReportController, authMiddleware));
  api.use('/campaigns', createCampaignDonationRoutes(donationController));
  api.use(
    '/campaigns',
    createCampaignCollaboratorRoutes(collaborationController, authMiddleware, optionalAuthMiddleware)
  );
  api.use('/campaigns', createCampaignModerationRoutes(campaignModerationController, authMiddleware, requireAdmin));
  api.use('/campaigns', createCampaignQrRoutes(shortLinkController, authMiddleware));
  api.use('/campaigns', createCampaignPayoutRoutes(payoutController, authMiddleware));
  api.use(
    '/campaigns',
    createCampaignLiveSessionRoutes(liveSessionController, realtimeController, authMiddleware)
  );

  // Live sessions + real-time overlay/SSE surface.
  api.use(
    '/live-sessions',
    createLiveSessionRoutes(liveSessionController, realtimeController, authMiddleware)
  );

  api.use('/wallets', createWalletRoutes(walletController, authMiddleware));
  api.use('/profile', createProfileRoutes(profileController, authMiddleware));
  api.use('/users', createUserRoutes(profileController));
  api.use('/users', createAdminUserRoutes(adminUserController, authMiddleware, requireAdmin));
  api.use('/admin', createAdminPaymentsRoutes(adminPaymentsController, authMiddleware, requireAdmin));
  api.use('/donations', createDonationRoutes(donationController, authMiddleware));
  // Post-donation message endpoint, composed onto the /donations resource.
  api.use('/donations', createDonationMessageRoutes(donationIntentController, authMiddleware));
  // Guest-capable donation-intent + ledger rail.
  api.use('/donation-intents', createDonationIntentRoutes(donationIntentController, optionalAuthMiddleware));
  api.use('/leaderboard', createLeaderboardRoutes(leaderboardController));
  api.use('/notifications', createNotificationRoutes(notificationController, authMiddleware));
  api.use('/organizations', createOrganizationRoutes(organizationController));
  api.use('/refunds', createRefundRoutes(refundController, authMiddleware));
  api.use('/kyc', createKYCRoutes(kycController, authMiddleware, requireAdmin));
  api.use('/collaborations', createCollaborationRoutes(collaborationController, authMiddleware));
  api.use('/subscriptions', createSubscriptionRoutes(subscriptionController, authMiddleware, requireAdmin));
  // Coupons: admin CRUD (requireAdmin) + an authed pre-checkout preview.
  api.use('/coupons', createCouponRoutes(couponController, authMiddleware, requireAdmin));
  // Affiliate program: the owner surface (authed) + the admin console (admin).
  api.use('/affiliate', createAffiliateRoutes(affiliateController, authMiddleware));
  api.use('/affiliates', createAdminAffiliateRoutes(affiliateController, authMiddleware, requireAdmin));
  api.use('/payment-providers', createPaymentProviderRoutes(paymentProviderController, authMiddleware, requireAdmin));
  // Plans: authed display (GET) + admin edit of pricing/limits/benefits (PUT).
  api.use('/plans', createPlanRoutes(planController, authMiddleware, requireAdmin));
  // Payout rail: bank/telco directory (auth), plus the admin payout console.
  api.use('/banks', createBankRoutes(payoutController, authMiddleware));
  api.use('/payouts', createPayoutRoutes(payoutController, authMiddleware, requireAdmin));
  api.use('/disputes', createDisputeRoutes(disputeController, authMiddleware, requireAdmin));
  api.use('/reports', createAdminReportRoutes(adminReportController, authMiddleware, requireAdmin));
  api.use('/analytics', createAnalyticsRoutes(analyticsController, authMiddleware, requireAdmin));
  api.use('/newsletter', createNewsletterRoutes(newsletterController, authMiddleware, requireAdmin));
  api.use('/content', createContentRoutes(siteContentController, authMiddleware, requireAdmin));
  api.use('/uploads', createUploadRoutes(uploadController, authMiddleware));
  api.use('/audit', createAuditLogRoutes(auditLogController, authMiddleware, requireAdmin));
  api.use('/rbac', createRbacRoutes(authMiddleware));
  api.use('/testimonials', createTestimonialRoutes(testimonialController, authMiddleware, requireAdmin));
  api.use('/contact', createContactRoutes(contactController, authMiddleware, requireAdmin));

  app.use('/api/v1', api);

  // Public short-link surface, mounted at the app root (outside /api/v1) so the
  // QR/redirect URLs stay short and shareable: GET /r/:code, /qr/:code.svg,
  // /qr/:code.png.
  app.use('/', createShortLinkPublicRoutes(shortLinkController));

  app.use(errorHandler);

  // Expose the outbox dispatcher so bootstrap can run a catch-up sweep on boot,
  // re-dispatching any donation side-effects left pending by a prior crash.
  app.locals.outboxDispatcher = outboxDispatcher;

  // Expose the affiliate maturity sweep so bootstrap/cron can move held
  // commissions to available once their hold window elapses.
  app.locals.matureAffiliateCommissionsUseCase = matureAffiliateCommissionsUseCase;

  return app;
}
