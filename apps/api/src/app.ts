import { createOrganizationTeamRoutes } from './infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.js'
import { AutomaticPayoutService } from './infrastructure/adapters/outbound/payments/AutomaticPayoutService.js'
import { automaticPayoutRoutes } from './infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.js'
import { PayoutTransferControlUseCase } from './application/use-cases/PayoutTransferControlUseCase.js'
import { createAdminActionRoutes } from './infrastructure/adapters/inbound/http/routes/adminActionRoutes.js'
import { MongoWalletPayoutRepository } from './infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.js'
import { PayoutAccountService } from './application/services/PayoutAccountService.js'
import { MongoPayoutAccountRepository } from './infrastructure/adapters/outbound/persistence/MongoPayoutAccountRepository.js'
import { createPayoutAccountRoutes } from './infrastructure/adapters/inbound/http/routes/payoutAccountRoutes.js'
import { VerifyCreatorTipUseCase } from './application/use-cases/VerifyCreatorTipUseCase.js'
import { ResendOwnerNotifications } from './infrastructure/adapters/outbound/ResendOwnerNotifications.js'
import { GetCampaignPayoutOptionsUseCase } from './application/use-cases/GetCampaignPayoutOptionsUseCase.js'
import { DonationOwnerNotifier } from './application/services/DonationOwnerNotifier.js'
import { AiWritingService } from './application/services/AiWritingService.js'
import { OpenAiWritingProvider } from './infrastructure/adapters/outbound/ai/OpenAiWritingProvider.js'
import { createAiWritingRoutes } from './infrastructure/adapters/inbound/http/routes/aiWritingRoutes.js'
import { BitnobCryptoProvider } from './infrastructure/adapters/outbound/crypto/BitnobCryptoProvider.js'
import { WalletTopUpService } from './infrastructure/adapters/outbound/payments/WalletTopUpService.js'
import { GetKYCStatsUseCase } from './application/use-cases/GetKYCStatsUseCase.js'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

import { config } from './infrastructure/config/index.js'
import { logger } from './infrastructure/logging/logger.js'

// Outbound adapters (repositories)
import { MongoCampaignRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignRepository.js'
import { MongoUserRepository } from './infrastructure/adapters/outbound/persistence/MongoUserRepository.js'
import { MongoDonationRepository } from './infrastructure/adapters/outbound/persistence/MongoDonationRepository.js'
import { MongoWalletRepository } from './infrastructure/adapters/outbound/persistence/MongoWalletRepository.js'
import { MongoWalletTransactionRepository } from './infrastructure/adapters/outbound/persistence/MongoWalletTransactionRepository.js'
import { MongoProfileRepository } from './infrastructure/adapters/outbound/persistence/MongoProfileRepository.js'
import { MongoCampaignUpdateRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignUpdateRepository.js'
import { MongoCampaignCommentRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignCommentRepository.js'
import { MongoShareRepository } from './infrastructure/adapters/outbound/persistence/MongoShareRepository.js'
import { MongoReportRepository } from './infrastructure/adapters/outbound/persistence/MongoReportRepository.js'
import { MongoAdminReportRepository } from './infrastructure/adapters/outbound/persistence/MongoAdminReportRepository.js'
import { MongoLeaderboardRepository } from './infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.js'
import { MongoNotificationRepository } from './infrastructure/adapters/outbound/persistence/MongoNotificationRepository.js'
import { MongoOrganizationRepository } from './infrastructure/adapters/outbound/persistence/MongoOrganizationRepository.js'
import { MongoRefundRepository } from './infrastructure/adapters/outbound/persistence/MongoRefundRepository.js'
import { MongoKYCRepository } from './infrastructure/adapters/outbound/persistence/MongoKYCRepository.js'
import { CloudinaryUploader } from './infrastructure/adapters/outbound/media/CloudinaryUploader.js'
import { MongoCollaborationRepository } from './infrastructure/adapters/outbound/persistence/MongoCollaborationRepository.js'
import { MongoSubscriptionRepository } from './infrastructure/adapters/outbound/persistence/MongoSubscriptionRepository.js'
import { MongoPaymentProviderRepository } from './infrastructure/adapters/outbound/persistence/MongoPaymentProviderRepository.js'
import { MongoSubscriptionPlanRepository } from './infrastructure/adapters/outbound/persistence/MongoSubscriptionPlanRepository.js'
import { MongoDisputeRepository } from './infrastructure/adapters/outbound/persistence/MongoDisputeRepository.js'
import { MongoAdminUserRepository } from './infrastructure/adapters/outbound/persistence/MongoAdminUserRepository.js'
import { MongoAnalyticsRepository } from './infrastructure/adapters/outbound/persistence/MongoAnalyticsRepository.js'
import { MongoNewsletterSubscriptionRepository } from './infrastructure/adapters/outbound/persistence/MongoNewsletterSubscriptionRepository.js'
import { MongoSiteContentRepository } from './infrastructure/adapters/outbound/persistence/MongoSiteContentRepository.js'
import { MongoShortLinkRepository } from './infrastructure/adapters/outbound/persistence/MongoShortLinkRepository.js'
import { MongoLiveSessionRepository } from './infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.js'
import { MongoLedgerRepository } from './infrastructure/adapters/outbound/persistence/MongoLedgerRepository.js'
import { MongoCampaignBalanceRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.js'
import { MongoDonationIntentRepository } from './infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.js'
import { MongoPaymentAttemptRepository } from './infrastructure/adapters/outbound/persistence/MongoPaymentAttemptRepository.js'
import { MongoOutboxRepository } from './infrastructure/adapters/outbound/persistence/MongoOutboxRepository.js'
import { MongoTransferRecipientRepository } from './infrastructure/adapters/outbound/persistence/MongoTransferRecipientRepository.js'
import { MongoPayoutRepository } from './infrastructure/adapters/outbound/persistence/MongoPayoutRepository.js'
import { MongoAuditLogRepository } from './infrastructure/adapters/outbound/persistence/MongoAuditLogRepository.js'
import { MongoCampaignSplitRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignSplitRepository.js'
import { MongoCampaignBeneficiaryBalanceRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignBeneficiaryBalanceRepository.js'
import { MongoCampaignBeneficiaryAccrualRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignBeneficiaryAccrualRepository.js'
import { MongoBeneficiaryRecipientRepository } from './infrastructure/adapters/outbound/persistence/MongoBeneficiaryRecipientRepository.js'
import { MongoBeneficiaryPayoutRepository } from './infrastructure/adapters/outbound/persistence/MongoBeneficiaryPayoutRepository.js'
import { MongoCouponRepository } from './infrastructure/adapters/outbound/persistence/MongoCouponRepository.js'
import { MongoCouponRedemptionRepository } from './infrastructure/adapters/outbound/persistence/MongoCouponRedemptionRepository.js'
import { MongoSubscriptionCheckoutRepository } from './infrastructure/adapters/outbound/persistence/MongoSubscriptionCheckoutRepository.js'
import { MongoAffiliateRepository } from './infrastructure/adapters/outbound/persistence/MongoAffiliateRepository.js'
import { MongoAffiliateReferralRepository } from './infrastructure/adapters/outbound/persistence/MongoAffiliateReferralRepository.js'
import { MongoAffiliateCommissionRepository } from './infrastructure/adapters/outbound/persistence/MongoAffiliateCommissionRepository.js'
import { MongoAffiliateBalanceRepository } from './infrastructure/adapters/outbound/persistence/MongoAffiliateBalanceRepository.js'
import { MongoAffiliatePayoutRepository } from './infrastructure/adapters/outbound/persistence/MongoAffiliatePayoutRepository.js'

// Outbound adapters (payment gateway)
import { PaystackGateway } from './infrastructure/adapters/outbound/payments/PaystackGateway.js'
import { FlutterwaveGateway } from './infrastructure/adapters/outbound/payments/FlutterwaveGateway.js'
import type { PaymentGatewayPort } from './domain/ports/outbound/PaymentGatewayPort.js'

// Application services
import { AuthTokenService } from './application/services/AuthTokenService.js'
import { QrCodeService } from './application/services/QrCodeService.js'
import { RealtimeDonationProjector } from './application/services/RealtimeDonationProjector.js'
import { FeePolicy } from './application/services/FeePolicy.js'
import { PlanLimitsService } from './application/services/PlanLimitsService.js'
import { PlanService } from './application/services/PlanService.js'
import { CouponService } from './application/services/CouponService.js'
import { AffiliateCommissionService } from './application/services/AffiliateCommissionService.js'
import { CampaignLedgerProjector } from './application/services/CampaignLedgerProjector.js'
import { OutboxDispatcher } from './application/services/OutboxDispatcher.js'
import { eventBus } from './infrastructure/realtime/EventBus.js'

// Use cases — auth & campaigns & wallet
import { RegisterUserUseCase } from './application/use-cases/RegisterUserUseCase.js'
import { LoginUserUseCase } from './application/use-cases/LoginUserUseCase.js'
import { ChangePasswordUseCase } from './application/use-cases/ChangePasswordUseCase.js'
import {
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
} from './application/use-cases/ForgotPasswordUseCase.js'
import { CreateCampaignUseCase } from './application/use-cases/CreateCampaignUseCase.js'
import { GetCampaignUseCase } from './application/use-cases/GetCampaignUseCase.js'
import { GetCampaignBySlugUseCase } from './application/use-cases/GetCampaignBySlugUseCase.js'
import { SetCampaignSlugUseCase } from './application/use-cases/SetCampaignSlugUseCase.js'
import { DonateToCampaignUseCase } from './application/use-cases/DonateToCampaignUseCase.js'
import { PostDonationJournalUseCase } from './application/use-cases/PostDonationJournalUseCase.js'
import { SettleDonationUseCase } from './application/use-cases/SettleDonationUseCase.js'
import { CreateDonationIntentUseCase } from './application/use-cases/CreateDonationIntentUseCase.js'
import { HandlePaystackWebhookUseCase } from './application/use-cases/HandlePaystackWebhookUseCase.js'
import { HandleFlutterwaveWebhookUseCase } from './application/use-cases/HandleFlutterwaveWebhookUseCase.js'
import { ReconcilePaymentsUseCase } from './application/use-cases/ReconcilePaymentsUseCase.js'
import { ReconcilePayoutsUseCase } from './application/use-cases/ReconcilePayoutsUseCase.js'
import { ProcessRefundUseCase } from './application/use-cases/ProcessRefundUseCase.js'
import { RecordPaymentAttemptUseCase } from './application/use-cases/RecordPaymentAttemptUseCase.js'
import { HandlePayoutWebhookUseCase } from './application/use-cases/HandlePayoutWebhookUseCase.js'
import { ListBanksUseCase } from './application/use-cases/ListBanksUseCase.js'
import { CreatePayoutRecipientUseCase } from './application/use-cases/CreatePayoutRecipientUseCase.js'
import { RequestPayoutUseCase } from './application/use-cases/RequestPayoutUseCase.js'
import { CampaignSplitUseCase } from './application/use-cases/CampaignSplitUseCase.js'
import { SplitAccrualService } from './application/services/SplitAccrualService.js'
import { BeneficiaryPayoutUseCase } from './application/use-cases/BeneficiaryPayoutUseCase.js'
import { HandleBeneficiaryPayoutWebhookUseCase } from './application/use-cases/HandleBeneficiaryPayoutWebhookUseCase.js'
import { ApprovePayoutUseCase } from './application/use-cases/ApprovePayoutUseCase.js'
import { ListCampaignPayoutsUseCase } from './application/use-cases/ListCampaignPayoutsUseCase.js'
import { ListPayoutsUseCase } from './application/use-cases/ListPayoutsUseCase.js'
import { GetDonationIntentPublicUseCase } from './application/use-cases/GetDonationIntentPublicUseCase.js'
import { VerifyDonationIntentUseCase } from './application/use-cases/VerifyDonationIntentUseCase.js'
import { AddDonationMessageUseCase } from './application/use-cases/AddDonationMessageUseCase.js'
import { CreateShortLinkUseCase } from './application/use-cases/CreateShortLinkUseCase.js'
import { ResolveShortLinkUseCase } from './application/use-cases/ResolveShortLinkUseCase.js'
import { ListCampaignQrCodesUseCase } from './application/use-cases/ListCampaignQrCodesUseCase.js'

// Use cases — live sessions
import { LiveVideoService } from './infrastructure/adapters/outbound/video/LiveVideoService.js'
import { GetActiveLiveSessionUseCase } from './application/use-cases/GetActiveLiveSessionUseCase.js'
import { StartLiveSessionUseCase } from './application/use-cases/StartLiveSessionUseCase.js'
import { EndLiveSessionUseCase } from './application/use-cases/EndLiveSessionUseCase.js'
import { UpdateLiveSessionPrivacyUseCase } from './application/use-cases/UpdateLiveSessionPrivacyUseCase.js'
import { RotateOverlayTokenUseCase } from './application/use-cases/RotateOverlayTokenUseCase.js'
import { GetLiveSessionPublicUseCase } from './application/use-cases/GetLiveSessionPublicUseCase.js'
import { GetLiveSessionOverlayUseCase } from './application/use-cases/GetLiveSessionOverlayUseCase.js'

// Use cases — profile
import { GetProfileUseCase } from './application/use-cases/GetProfileUseCase.js'
import { UpdateProfileUseCase } from './application/use-cases/UpdateProfileUseCase.js'
import { GetPublicUserProfileUseCase } from './application/use-cases/GetPublicUserProfileUseCase.js'
import { DeleteAccountUseCase } from './application/use-cases/DeleteAccountUseCase.js'

// Use cases — campaign updates
import { CreateCampaignUpdateUseCase } from './application/use-cases/CreateCampaignUpdateUseCase.js'
import { GetCampaignUpdatesUseCase } from './application/use-cases/GetCampaignUpdatesUseCase.js'
import { UpdateCampaignUpdateUseCase } from './application/use-cases/UpdateCampaignUpdateUseCase.js'
import { DeleteCampaignUpdateUseCase } from './application/use-cases/DeleteCampaignUpdateUseCase.js'
import { PinCampaignUpdateUseCase } from './application/use-cases/PinCampaignUpdateUseCase.js'
import { CampaignCommentUseCases } from './application/use-cases/CampaignCommentUseCases.js'

// Use cases — share/report, donations, leaderboard, notifications
import { ShareCampaignUseCase } from './application/use-cases/ShareCampaignUseCase.js'
import { ReportCampaignUseCase } from './application/use-cases/ReportCampaignUseCase.js'
import { ListRecentDonationsUseCase } from './application/use-cases/ListRecentDonationsUseCase.js'
import { ListMyDonationsUseCase } from './application/use-cases/ListMyDonationsUseCase.js'
import { GetDonationUseCase } from './application/use-cases/GetDonationUseCase.js'
import { ListCampaignDonationsUseCase } from './application/use-cases/ListCampaignDonationsUseCase.js'
import { GetLeaderboardUseCase } from './application/use-cases/GetLeaderboardUseCase.js'
import { GetLeaderboardStatsUseCase } from './application/use-cases/GetLeaderboardStatsUseCase.js'
import { GetMyNotificationsUseCase } from './application/use-cases/GetMyNotificationsUseCase.js'
import { MarkNotificationAsReadUseCase } from './application/use-cases/MarkNotificationAsReadUseCase.js'
import { MarkAllNotificationsAsReadUseCase } from './application/use-cases/MarkAllNotificationsAsReadUseCase.js'
import { GetUnreadNotificationCountUseCase } from './application/use-cases/GetUnreadNotificationCountUseCase.js'

// Use cases — organizations, refunds, kyc, collaborations, subscriptions
import { GetOrganizationUseCase } from './application/use-cases/GetOrganizationUseCase.js'
import { RequestRefundUseCase } from './application/use-cases/RequestRefundUseCase.js'
import { ListMyRefundsUseCase } from './application/use-cases/ListMyRefundsUseCase.js'
import { SubmitKYCIdentityUseCase } from './application/use-cases/SubmitKYCIdentityUseCase.js'
import { GetKYCStatusUseCase } from './application/use-cases/GetKYCStatusUseCase.js'
import { GetPendingKYCUseCase } from './application/use-cases/GetPendingKYCUseCase.js'
import { ApproveKYCUseCase } from './application/use-cases/ApproveKYCUseCase.js'
import { RejectKYCUseCase } from './application/use-cases/RejectKYCUseCase.js'
import { InviteCollaboratorUseCase } from './application/use-cases/InviteCollaboratorUseCase.js'
import { RemoveCollaboratorUseCase } from './application/use-cases/RemoveCollaboratorUseCase.js'
import { ListCampaignCollaboratorsUseCase } from './application/use-cases/ListCampaignCollaboratorsUseCase.js'
import { ListMyCollaborationInvitationsUseCase } from './application/use-cases/ListMyCollaborationInvitationsUseCase.js'
import { RespondToCollaborationUseCase } from './application/use-cases/RespondToCollaborationUseCase.js'
import { GetMySubscriptionUseCase } from './application/use-cases/GetMySubscriptionUseCase.js'
import { SubscribeUseCase } from './application/use-cases/SubscribeUseCase.js'
import { UpgradeSubscriptionUseCase } from './application/use-cases/UpgradeSubscriptionUseCase.js'
import { CancelSubscriptionUseCase } from './application/use-cases/CancelSubscriptionUseCase.js'
import { ListSubscriptionsUseCase } from './application/use-cases/ListSubscriptionsUseCase.js'

// Use cases — coupons (admin CRUD + authed preview)
import { CreateCouponUseCase } from './application/use-cases/CreateCouponUseCase.js'
import { UpdateCouponUseCase } from './application/use-cases/UpdateCouponUseCase.js'
import { ListCouponsUseCase } from './application/use-cases/ListCouponsUseCase.js'
import { GetCouponUseCase } from './application/use-cases/GetCouponUseCase.js'
import { DeleteCouponUseCase } from './application/use-cases/DeleteCouponUseCase.js'
import { PreviewCouponUseCase } from './application/use-cases/PreviewCouponUseCase.js'

// Use cases — paid-subscription checkout rail
import { CreateSubscriptionCheckoutUseCase } from './application/use-cases/CreateSubscriptionCheckoutUseCase.js'
import { GetSubscriptionCheckoutUseCase } from './application/use-cases/GetSubscriptionCheckoutUseCase.js'
import { SettleSubscriptionUseCase } from './application/use-cases/SettleSubscriptionUseCase.js'

// Use cases — affiliate/referral program
import { EnrollAffiliateUseCase } from './application/use-cases/EnrollAffiliateUseCase.js'
import { UpdateAffiliateReferralCodeUseCase } from './application/use-cases/UpdateAffiliateReferralCodeUseCase.js'
import { GetAffiliateDashboardUseCase } from './application/use-cases/GetAffiliateDashboardUseCase.js'
import { ListMyAffiliateReferralsUseCase } from './application/use-cases/ListMyAffiliateReferralsUseCase.js'
import { ListMyAffiliateCommissionsUseCase } from './application/use-cases/ListMyAffiliateCommissionsUseCase.js'
import { SetAffiliatePayoutRecipientUseCase } from './application/use-cases/SetAffiliatePayoutRecipientUseCase.js'
import { RequestAffiliatePayoutUseCase } from './application/use-cases/RequestAffiliatePayoutUseCase.js'
import { ApproveAffiliatePayoutUseCase } from './application/use-cases/ApproveAffiliatePayoutUseCase.js'
import { HandleAffiliatePayoutWebhookUseCase } from './application/use-cases/HandleAffiliatePayoutWebhookUseCase.js'
import { MongoCreatorProfileRepository } from './infrastructure/adapters/outbound/persistence/MongoCreatorProfileRepository.js'
import { MongoCreatorBalanceRepository } from './infrastructure/adapters/outbound/persistence/MongoCreatorBalanceRepository.js'
import { MongoTipRepository } from './infrastructure/adapters/outbound/persistence/MongoTipRepository.js'
import { SaveCreatorProfileUseCase } from './application/use-cases/SaveCreatorProfileUseCase.js'
import { GetCreatorByHandleUseCase } from './application/use-cases/GetCreatorByHandleUseCase.js'
import { CreateTipIntentUseCase } from './application/use-cases/CreateTipIntentUseCase.js'
import { HandleTipWebhookUseCase } from './application/use-cases/HandleTipWebhookUseCase.js'
import { MongoCreatorPayoutRepository } from './infrastructure/adapters/outbound/persistence/MongoCreatorPayoutRepository.js'
import { RequestCreatorWithdrawalUseCase } from './application/use-cases/RequestCreatorWithdrawalUseCase.js'
import { HandleCreatorPayoutWebhookUseCase } from './application/use-cases/HandleCreatorPayoutWebhookUseCase.js'
import { createCreatorRoutes } from './infrastructure/adapters/inbound/http/routes/creatorRoutes.js'
import { MongoCommercialConfigRepository } from './infrastructure/adapters/outbound/persistence/MongoCommercialConfigRepository.js'
import { CommercialConfigService } from './application/services/CommercialConfigService.js'
import { createCommercialConfigRoutes } from './infrastructure/adapters/inbound/http/routes/commercialConfigRoutes.js'
import { ListAffiliatesUseCase } from './application/use-cases/ListAffiliatesUseCase.js'
import { GetAffiliateDetailUseCase } from './application/use-cases/GetAffiliateDetailUseCase.js'
import { SetAffiliateCommissionRateUseCase } from './application/use-cases/SetAffiliateCommissionRateUseCase.js'
import { UpdateAffiliateStatusUseCase } from './application/use-cases/UpdateAffiliateStatusUseCase.js'
import { ListAffiliatePayoutsUseCase } from './application/use-cases/ListAffiliatePayoutsUseCase.js'
import { MatureAffiliateCommissionsUseCase } from './application/use-cases/MatureAffiliateCommissionsUseCase.js'

// Use cases — payment providers, moderation, admin
import { ListPlansUseCase } from './application/use-cases/ListPlansUseCase.js'
import { UpdatePlanUseCase } from './application/use-cases/UpdatePlanUseCase.js'
import { CreatePlanUseCase } from './application/use-cases/CreatePlanUseCase.js'
import { ListPaymentProvidersUseCase } from './application/use-cases/ListPaymentProvidersUseCase.js'
import { GetEnabledPaymentProvidersUseCase } from './application/use-cases/GetEnabledPaymentProvidersUseCase.js'
import { TogglePaymentProviderUseCase } from './application/use-cases/TogglePaymentProviderUseCase.js'
import { GetDisputeUseCase } from './application/use-cases/GetDisputeUseCase.js'
import { ResolveDisputeUseCase } from './application/use-cases/ResolveDisputeUseCase.js'
import { ListReportsUseCase } from './application/use-cases/ListReportsUseCase.js'
import { ReviewReportUseCase } from './application/use-cases/ReviewReportUseCase.js'
import { ReviewCampaignUseCase } from './application/use-cases/ReviewCampaignUseCase.js'
import { ListUsersUseCase } from './application/use-cases/ListUsersUseCase.js'
import { GetAdminUserUseCase } from './application/use-cases/GetAdminUserUseCase.js'
import { SetComplianceLimitUseCase } from './application/use-cases/SetComplianceLimitUseCase.js'
import { GetPlatformOverviewUseCase } from './application/use-cases/GetPlatformOverviewUseCase.js'
import { SubscribeNewsletterUseCase } from './application/use-cases/SubscribeNewsletterUseCase.js'
import { ListNewsletterSubscribersUseCase } from './application/use-cases/ListNewsletterSubscribersUseCase.js'

// Use cases — site content (headless CMS) & uploads
import { ListSiteContentUseCase } from './application/use-cases/ListSiteContentUseCase.js'
import { GetSiteContentUseCase } from './application/use-cases/GetSiteContentUseCase.js'
import { UpsertSiteContentUseCase } from './application/use-cases/UpsertSiteContentUseCase.js'
import { SignCloudinaryUploadUseCase } from './application/use-cases/SignCloudinaryUploadUseCase.js'

// Inbound adapters (controllers, middleware, routes)
import { AuthController } from './infrastructure/adapters/inbound/http/controllers/AuthController.js'
import { CampaignController } from './infrastructure/adapters/inbound/http/controllers/CampaignController.js'
import { ShortLinkController } from './infrastructure/adapters/inbound/http/controllers/ShortLinkController.js'
import { LiveSessionController } from './infrastructure/adapters/inbound/http/controllers/LiveSessionController.js'
import { RealtimeController } from './infrastructure/adapters/inbound/http/controllers/RealtimeController.js'
import { WalletController } from './infrastructure/adapters/inbound/http/controllers/WalletController.js'
import { ProfileController } from './infrastructure/adapters/inbound/http/controllers/ProfileController.js'
import { CampaignUpdateController } from './infrastructure/adapters/inbound/http/controllers/CampaignUpdateController.js'
import { CampaignCommentController } from './infrastructure/adapters/inbound/http/controllers/CampaignCommentController.js'
import { ShareReportController } from './infrastructure/adapters/inbound/http/controllers/ShareReportController.js'
import { DonationController } from './infrastructure/adapters/inbound/http/controllers/DonationController.js'
import { DonationIntentController } from './infrastructure/adapters/inbound/http/controllers/DonationIntentController.js'
import { PaystackWebhookController } from './infrastructure/adapters/inbound/http/controllers/PaystackWebhookController.js'
import { FlutterwaveWebhookController } from './infrastructure/adapters/inbound/http/controllers/FlutterwaveWebhookController.js'
import { AdminPaymentsController } from './infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.js'
import { PayoutController } from './infrastructure/adapters/inbound/http/controllers/PayoutController.js'
import { CampaignSplitController } from './infrastructure/adapters/inbound/http/controllers/CampaignSplitController.js'
import { BeneficiaryPayoutController } from './infrastructure/adapters/inbound/http/controllers/BeneficiaryPayoutController.js'
import { LeaderboardController } from './infrastructure/adapters/inbound/http/controllers/LeaderboardController.js'
import { NotificationController } from './infrastructure/adapters/inbound/http/controllers/NotificationController.js'
import { OrganizationController } from './infrastructure/adapters/inbound/http/controllers/OrganizationController.js'
import { RefundController } from './infrastructure/adapters/inbound/http/controllers/RefundController.js'
import { KYCController } from './infrastructure/adapters/inbound/http/controllers/KYCController.js'
import { CollaborationController } from './infrastructure/adapters/inbound/http/controllers/CollaborationController.js'
import { SubscriptionController } from './infrastructure/adapters/inbound/http/controllers/SubscriptionController.js'
import { CouponController } from './infrastructure/adapters/inbound/http/controllers/CouponController.js'
import { AffiliateController } from './infrastructure/adapters/inbound/http/controllers/AffiliateController.js'
import { PaymentProviderController } from './infrastructure/adapters/inbound/http/controllers/PaymentProviderController.js'
import { PlanController } from './infrastructure/adapters/inbound/http/controllers/PlanController.js'
import { DisputeController } from './infrastructure/adapters/inbound/http/controllers/DisputeController.js'
import { AdminReportController } from './infrastructure/adapters/inbound/http/controllers/AdminReportController.js'
import { CampaignModerationController } from './infrastructure/adapters/inbound/http/controllers/CampaignModerationController.js'
import { AdminUserController } from './infrastructure/adapters/inbound/http/controllers/AdminUserController.js'
import { AnalyticsController } from './infrastructure/adapters/inbound/http/controllers/AnalyticsController.js'
import { NewsletterController } from './infrastructure/adapters/inbound/http/controllers/NewsletterController.js'
import { SiteContentController } from './infrastructure/adapters/inbound/http/controllers/SiteContentController.js'
import { UploadController } from './infrastructure/adapters/inbound/http/controllers/UploadController.js'
import { AuditLogController } from './infrastructure/adapters/inbound/http/controllers/AuditLogController.js'
import { TestimonialController } from './infrastructure/adapters/inbound/http/controllers/TestimonialController.js'
import { ContactController } from './infrastructure/adapters/inbound/http/controllers/ContactController.js'

import {
  createAuthMiddleware,
  createOptionalAuthMiddleware,
} from './infrastructure/adapters/inbound/middleware/authMiddleware.js'
import { requireAdmin } from './infrastructure/adapters/inbound/middleware/requireRole.js'
import { errorHandler } from './infrastructure/adapters/inbound/middleware/errorHandler.js'
import { requestLogger } from './infrastructure/adapters/inbound/middleware/requestLogger.js'
import { apiRateLimiter } from './infrastructure/adapters/inbound/middleware/rateLimiter.js'
import { auditMutation } from './infrastructure/adapters/inbound/middleware/auditMutation.js'

import { createAuthRoutes } from './infrastructure/adapters/inbound/http/routes/authRoutes.js'
import { createCampaignRoutes } from './infrastructure/adapters/inbound/http/routes/campaignRoutes.js'
import { createSitemapRoutes } from './infrastructure/adapters/inbound/http/routes/sitemapRoutes.js'
import {
  createCampaignQrRoutes,
  createShortLinkPublicRoutes,
} from './infrastructure/adapters/inbound/http/routes/shortLinkRoutes.js'
import {
  createCampaignLiveSessionRoutes,
  createLiveSessionRoutes,
} from './infrastructure/adapters/inbound/http/routes/liveSessionRoutes.js'
import { createWalletRoutes } from './infrastructure/adapters/inbound/http/routes/walletRoutes.js'
import { createProfileRoutes } from './infrastructure/adapters/inbound/http/routes/profileRoutes.js'
import { createUserRoutes } from './infrastructure/adapters/inbound/http/routes/userRoutes.js'
import { createCampaignUpdateRoutes } from './infrastructure/adapters/inbound/http/routes/campaignUpdateRoutes.js'
import { createCampaignCommentRoutes } from './infrastructure/adapters/inbound/http/routes/campaignCommentRoutes.js'
import { createShareReportRoutes } from './infrastructure/adapters/inbound/http/routes/shareReportRoutes.js'
import { createDonationRoutes } from './infrastructure/adapters/inbound/http/routes/donationRoutes.js'
import {
  createDonationIntentRoutes,
  createDonationMessageRoutes,
} from './infrastructure/adapters/inbound/http/routes/donationIntentRoutes.js'
import { createPaystackWebhookRoutes } from './infrastructure/adapters/inbound/http/routes/paystackWebhookRoutes.js'
import { createFlutterwaveWebhookRoutes } from './infrastructure/adapters/inbound/http/routes/flutterwaveWebhookRoutes.js'
import { createAdminPaymentsRoutes } from './infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.js'
// ── Crypto donation rail (Crypto Donations plan) ────────────────────────────
import type { CryptoPaymentProviderPort } from './domain/ports/outbound/CryptoPaymentProviderPort.js'
import { MockCryptoProvider } from './infrastructure/adapters/outbound/crypto/MockCryptoProvider.js'
import { MongoCryptoQuoteRepository } from './infrastructure/adapters/outbound/persistence/MongoCryptoQuoteRepository.js'
import { MongoCryptoWebhookEventRepository } from './infrastructure/adapters/outbound/persistence/MongoCryptoWebhookEventRepository.js'
import { GetCryptoAssetsUseCase } from './application/use-cases/GetCryptoAssetsUseCase.js'
import { CreateCryptoQuoteUseCase } from './application/use-cases/CreateCryptoQuoteUseCase.js'
import { CreateCryptoDepositUseCase } from './application/use-cases/CreateCryptoDepositUseCase.js'
import { HandleCryptoWebhookUseCase } from './application/use-cases/HandleCryptoWebhookUseCase.js'
import { ReconcileCryptoUseCase } from './application/use-cases/ReconcileCryptoUseCase.js'
import { CryptoController } from './infrastructure/adapters/inbound/http/controllers/CryptoController.js'
import { CryptoWebhookController } from './infrastructure/adapters/inbound/http/controllers/CryptoWebhookController.js'
import { createCryptoRoutes } from './infrastructure/adapters/inbound/http/routes/cryptoRoutes.js'
import { createCryptoDonationRoutes } from './infrastructure/adapters/inbound/http/routes/cryptoDonationRoutes.js'
import { createCryptoWebhookRoutes } from './infrastructure/adapters/inbound/http/routes/cryptoWebhookRoutes.js'
import { createCryptoAdminRoutes } from './infrastructure/adapters/inbound/http/routes/cryptoAdminRoutes.js'
import {
  createBankRoutes,
  createCampaignPayoutRoutes,
  createPayoutRoutes,
} from './infrastructure/adapters/inbound/http/routes/payoutRoutes.js'
import { createCampaignSplitRoutes } from './infrastructure/adapters/inbound/http/routes/campaignSplitRoutes.js'
import {
  createCampaignBeneficiaryPayoutRoutes,
  createBeneficiaryPayoutRoutes,
} from './infrastructure/adapters/inbound/http/routes/beneficiaryPayoutRoutes.js'
import { createCampaignDonationRoutes } from './infrastructure/adapters/inbound/http/routes/campaignDonationRoutes.js'
import { createLeaderboardRoutes } from './infrastructure/adapters/inbound/http/routes/leaderboardRoutes.js'
import { createNotificationRoutes } from './infrastructure/adapters/inbound/http/routes/notificationRoutes.js'
import { createOrganizationRoutes } from './infrastructure/adapters/inbound/http/routes/organizationRoutes.js'
import { createRefundRoutes } from './infrastructure/adapters/inbound/http/routes/refundRoutes.js'
import { createKYCRoutes } from './infrastructure/adapters/inbound/http/routes/kycRoutes.js'
import { createCampaignCollaboratorRoutes } from './infrastructure/adapters/inbound/http/routes/campaignCollaboratorRoutes.js'
import { createCollaborationRoutes } from './infrastructure/adapters/inbound/http/routes/collaborationRoutes.js'
import { createSubscriptionRoutes } from './infrastructure/adapters/inbound/http/routes/subscriptionRoutes.js'
import { createCouponRoutes } from './infrastructure/adapters/inbound/http/routes/couponRoutes.js'
import {
  createAffiliateRoutes,
  createAdminAffiliateRoutes,
} from './infrastructure/adapters/inbound/http/routes/affiliateRoutes.js'
import { createPaymentProviderRoutes } from './infrastructure/adapters/inbound/http/routes/paymentProviderRoutes.js'
import { createPlanRoutes } from './infrastructure/adapters/inbound/http/routes/planRoutes.js'
import { createDisputeRoutes } from './infrastructure/adapters/inbound/http/routes/disputeRoutes.js'
import { createAdminReportRoutes } from './infrastructure/adapters/inbound/http/routes/adminReportRoutes.js'
import { createCampaignModerationRoutes } from './infrastructure/adapters/inbound/http/routes/campaignModerationRoutes.js'
import { createAdminUserRoutes } from './infrastructure/adapters/inbound/http/routes/adminUserRoutes.js'
import { createAnalyticsRoutes } from './infrastructure/adapters/inbound/http/routes/analyticsRoutes.js'
import { createNewsletterRoutes } from './infrastructure/adapters/inbound/http/routes/newsletterRoutes.js'
import { createContentRoutes } from './infrastructure/adapters/inbound/http/routes/contentRoutes.js'
import { createUploadRoutes } from './infrastructure/adapters/inbound/http/routes/uploadRoutes.js'
import { createAuditLogRoutes } from './infrastructure/adapters/inbound/http/routes/auditLogRoutes.js'
import { createRbacRoutes } from './infrastructure/adapters/inbound/http/routes/rbacRoutes.js'
import { createTestimonialRoutes } from './infrastructure/adapters/inbound/http/routes/testimonialRoutes.js'
import { createContactRoutes } from './infrastructure/adapters/inbound/http/routes/contactRoutes.js'

/**
 * Assemble the fully-wired Express application (no listening, no DB
 * connection). Exported separately from bootstrap so integration tests can
 * exercise the real route graph with supertest.
 */
export function createApp(): express.Express {
  // ── Outbound adapters ────────────────────────────────────────────────
  const campaignRepo = new MongoCampaignRepository()
  const userRepo = new MongoUserRepository()
  const donationRepo = new MongoDonationRepository()
  const walletRepo = new MongoWalletRepository()
  const walletTxRepo = new MongoWalletTransactionRepository()
  const profileRepo = new MongoProfileRepository()
  const campaignUpdateRepo = new MongoCampaignUpdateRepository()
  const campaignCommentRepo = new MongoCampaignCommentRepository()
  const shareRepo = new MongoShareRepository()
  const reportRepo = new MongoReportRepository()
  const adminReportRepo = new MongoAdminReportRepository()
  const leaderboardRepo = new MongoLeaderboardRepository()
  const notificationRepo = new MongoNotificationRepository()
  const organizationRepo = new MongoOrganizationRepository()
  const refundRepo = new MongoRefundRepository()
  const kycRepo = new MongoKYCRepository()
  // Server-side signed image/PDF upload proxy (KYC docs, campaign covers, etc.):
  // browser → API → Cloudinary, so uploads are same-origin and never blocked by
  // a client ad-blocker, and the Cloudinary secret stays server-side.
  const cloudinaryUploader = new CloudinaryUploader(config.cloudinary)
  const collaborationRepo = new MongoCollaborationRepository()
  const subscriptionRepo = new MongoSubscriptionRepository()
  const paymentProviderRepo = new MongoPaymentProviderRepository()
  const subscriptionPlanRepo = new MongoSubscriptionPlanRepository()
  // Seed the plan matrix once at startup (idempotent — only inserts a tier's row
  // when absent, never overwriting admin edits). Fire-and-forget; a seed failure
  // is logged and PlanService still falls back to the code-defined defaults.
  void subscriptionPlanRepo
    .seedDefaults()
    .catch((error) => logger.error({ err: error }, 'subscription plan seed failed'))
  const disputeRepo = new MongoDisputeRepository()
  const adminUserRepo = new MongoAdminUserRepository()
  const analyticsRepo = new MongoAnalyticsRepository()
  const newsletterRepo = new MongoNewsletterSubscriptionRepository()
  const siteContentRepo = new MongoSiteContentRepository()
  const shortLinkRepo = new MongoShortLinkRepository()
  const liveSessionRepo = new MongoLiveSessionRepository()
  const ledgerRepo = new MongoLedgerRepository()
  const campaignBalanceRepo = new MongoCampaignBalanceRepository()
  const donationIntentRepo = new MongoDonationIntentRepository()
  const paymentAttemptRepo = new MongoPaymentAttemptRepository()
  const outboxRepo = new MongoOutboxRepository()
  const transferRecipientRepo = new MongoTransferRecipientRepository()
  const payoutRepo = new MongoPayoutRepository()
  const auditLogRepo = new MongoAuditLogRepository()
  const campaignSplitRepo = new MongoCampaignSplitRepository()
  const couponRepo = new MongoCouponRepository()
  const couponRedemptionRepo = new MongoCouponRedemptionRepository()
  const subscriptionCheckoutRepo = new MongoSubscriptionCheckoutRepository()
  const affiliateRepo = new MongoAffiliateRepository()
  const affiliateReferralRepo = new MongoAffiliateReferralRepository()
  const affiliateCommissionRepo = new MongoAffiliateCommissionRepository()
  const affiliateBalanceRepo = new MongoAffiliateBalanceRepository()
  const affiliatePayoutRepo = new MongoAffiliatePayoutRepository()

  // Paystack payment gateway (behind the swappable PaymentGatewayPort). Absent
  // credentials leave it disabled — the Paystack rail returns 501 and the
  // wallet rail keeps working.
  const paymentGateway = new PaystackGateway({
    secretKey: config.paystack.secretKey,
    publicKey: config.paystack.publicKey,
    publicWebUrl: config.publicWebUrl,
  })
  // Flutterwave — secondary diaspora-card rail. Inert (isConfigured → false)
  // until a secret key is supplied; enabling also requires PAYMENTS_FLUTTERWAVE_ENABLED.
  const flutterwaveGateway = new FlutterwaveGateway({
    secretKey: config.flutterwave.secretKey,
    publicKey: config.flutterwave.publicKey,
    webhookHash: config.flutterwave.webhookHash,
    publicWebUrl: config.publicWebUrl,
  })
  // Hosted gateways keyed by provider; the router/use-case pick by provider.
  const gatewayRegistry = new Map<string, PaymentGatewayPort>([
    ['paystack', paymentGateway],
    ['flutterwave', flutterwaveGateway],
  ])

  // ── Services ─────────────────────────────────────────────────────────
  const tokenService = new AuthTokenService(config.jwtSecret, config.jwtRefreshSecret)
  const authMiddleware = createAuthMiddleware(tokenService)
  const optionalAuthMiddleware = createOptionalAuthMiddleware(tokenService)
  const qrCodeService = new QrCodeService()
  // Projects successful donations onto the in-process realtime event bus and
  // bumps live-session stats — shared by the wallet rail (today) and the later
  // hosted-payment phases.
  const realtimeDonationProjector = new RealtimeDonationProjector(
    eventBus,
    campaignRepo,
    liveSessionRepo,
    userRepo,
  )
  // Ledger + donation-intent settlement wiring. The fee policy computes the
  // wallet-rail money split; the projector moves campaign totals + balances
  // through the ledger; the outbox dispatcher turns settled donations into
  // realtime/receipt side-effects durably (swept again on boot).
  const feePolicy = new FeePolicy(config.fees)
  // DB-backed, admin-editable plans (pricing/limits/benefits). The single source
  // the rest of the app reads plans through; falls back to SUBSCRIPTION_PLANS.
  const planService = new PlanService(subscriptionPlanRepo)
  // Resolves a user's subscription plan and enforces its limits (active-campaign
  // count, goal cap, plan feature gates) + the plan-based platform fee rate.
  const planLimitsService = new PlanLimitsService(subscriptionRepo, campaignRepo, planService)
  // Coupon validation/pricing for the paid-subscription checkout rail.
  const couponService = new CouponService(couponRepo, couponRedemptionRepo)
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
    },
  )
  // Split-proceeds accrual (spec §17): distributes a settled donation's
  // beneficiary-net across the active split's per-beneficiary buckets. Behind
  // the splitProceedsEnabled flag (default off, pending Ghana legal §6).
  const campaignBeneficiaryBalanceRepo = new MongoCampaignBeneficiaryBalanceRepository()
  const campaignBeneficiaryAccrualRepo = new MongoCampaignBeneficiaryAccrualRepository()
  const beneficiaryRecipientRepo = new MongoBeneficiaryRecipientRepository()
  const beneficiaryPayoutRepo = new MongoBeneficiaryPayoutRepository()
  // Per-beneficiary payout settlement (spec §17): the signed `bpay-` transfer
  // webhook moves the beneficiary + mirrored campaign buckets to terminal state.
  const handleBeneficiaryPayoutWebhookUseCase = new HandleBeneficiaryPayoutWebhookUseCase(
    beneficiaryPayoutRepo,
    campaignBeneficiaryBalanceRepo,
    campaignBalanceRepo,
    ledgerRepo,
  )
  const splitAccrualService = new SplitAccrualService(
    config.splitProceedsEnabled,
    campaignSplitRepo,
    campaignBeneficiaryBalanceRepo,
    campaignBeneficiaryAccrualRepo,
  )
  const campaignLedgerProjector = new CampaignLedgerProjector(
    campaignRepo,
    campaignBalanceRepo,
    ledgerRepo,
    splitAccrualService,
  )
  const outboxDispatcher = new OutboxDispatcher(
    outboxRepo,
    realtimeDonationProjector,
    new DonationOwnerNotifier(
      campaignRepo,
      notificationRepo,
      new ResendOwnerNotifications(
        process.env.RESEND_API_KEY ?? '',
        process.env.FROM_EMAIL ?? '',
        config.publicWebUrl,
        process.env.REPLY_TO_EMAIL || undefined,
      ),
    ),
  )

  if (config.nodeEnv === 'production') {
    let sweeping = false
    const notificationTimer = setInterval(async () => {
      if (sweeping) return
      sweeping = true
      try {
        await outboxDispatcher.sweepPending()
      } catch (err) {
        logger.error({ err }, 'notification outbox retry failed')
      } finally {
        sweeping = false
      }
    }, 60_000)
    notificationTimer.unref()
  }

  // ── Use cases ────────────────────────────────────────────────────────
  const registerUserUseCase = new RegisterUserUseCase(
    userRepo,
    walletRepo,
    tokenService,
    // Optional referral capture: a `?ref=` code on signup links the new user to
    // the referrer's affiliate.
    affiliateRepo,
    affiliateReferralRepo,
  )
  const loginUserUseCase = new LoginUserUseCase(userRepo, tokenService)
  const changePasswordUseCase = new ChangePasswordUseCase(userRepo, tokenService)
  const forgotPasswordUseCase = new ForgotPasswordUseCase(userRepo)
  const resetPasswordUseCase = new ResetPasswordUseCase(userRepo, tokenService)

  const createCampaignUseCase = new CreateCampaignUseCase(
    campaignRepo,
    userRepo,
    planLimitsService,
    config.campaigns,
  )
  const getCampaignUseCase = new GetCampaignUseCase(campaignRepo, donationRepo)
  const getCampaignBySlugUseCase = new GetCampaignBySlugUseCase(
    campaignRepo,
    config.publicWebUrl,
    donationRepo,
  )
  const setCampaignSlugUseCase = new SetCampaignSlugUseCase(campaignRepo)

  // Donation-intent rail: guest-capable checkout backed by the immutable
  // ledger. settleDonation() is the seam Phase 4 (Paystack) also calls.
  const postDonationJournalUseCase = new PostDonationJournalUseCase(ledgerRepo)
  const settleDonationUseCase = new SettleDonationUseCase(
    donationIntentRepo,
    donationRepo,
    postDonationJournalUseCase,
    campaignLedgerProjector,
    outboxRepo,
    outboxDispatcher,
  )
  // ── Crypto donation rail (Crypto Donations plan) ─────────────────────────
  // A provider-neutral second rail, OFF by default (config.crypto.enabled). The
  // built-in sandbox `mock` provider implements the full CryptoPaymentProvider
  // port so dev/tests run quote→deposit→confirm→settle end-to-end without an
  // external account; real adapters (Yellow Card / Paychant / Bitnob) drop in
  // behind the same port. Crypto settles through the shared SettleDonation seam,
  // so campaign totals, beneficiary splits, fees, ledger and receipts are reused
  // unchanged — and the fiat (Paystack) flow is untouched.
  const cryptoQuoteRepo = new MongoCryptoQuoteRepository()
  const cryptoWebhookEventRepo = new MongoCryptoWebhookEventRepository()
  const mockCryptoProvider = new MockCryptoProvider(
    config.crypto.mockWebhookSecret,
    config.crypto.quoteTtlSeconds,
  )
  const bitnobCryptoProvider = new BitnobCryptoProvider({
    clientId: process.env.BITNOB_CLIENT_ID ?? '',
    clientSecret: process.env.BITNOB_CLIENT_SECRET ?? '',
    webhookSecret: process.env.BITNOB_WEBHOOK_SECRET ?? '',
    baseUrl: 'https://api.bitnob.com',
    networks: (process.env.BITNOB_ALLOWED_NETWORKS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    quoteTtlSeconds: config.crypto.quoteTtlSeconds,
  })
  const cryptoProvidersByName = new Map<string, CryptoPaymentProviderPort>([
    [bitnobCryptoProvider.provider, bitnobCryptoProvider],
  ])
  if (process.env.NODE_ENV !== 'production') cryptoProvidersByName.set('mock', mockCryptoProvider)
  const configuredCryptoProvider = cryptoProvidersByName.get(config.crypto.primaryProvider)
  if (!configuredCryptoProvider && config.crypto.enabled)
    throw new Error('Unknown or unsafe CRYPTO_PRIMARY_PROVIDER. Production cannot use mock crypto.')
  const primaryCryptoProvider = configuredCryptoProvider ?? bitnobCryptoProvider
  const cryptoFallbackProviders = (process.env.CRYPTO_FALLBACK_PROVIDERS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => {
      const provider = cryptoProvidersByName.get(name)
      if (!provider) throw new Error('Unknown or unsafe CRYPTO_FALLBACK_PROVIDERS entry')
      return provider
    })
  const getCryptoAssetsUseCase = new GetCryptoAssetsUseCase(
    primaryCryptoProvider,
    config.crypto,
    cryptoFallbackProviders,
  )
  const createCryptoQuoteUseCase = new CreateCryptoQuoteUseCase(
    primaryCryptoProvider,
    config.crypto,
    campaignRepo,
    cryptoQuoteRepo,
    cryptoFallbackProviders,
  )
  const createCryptoDepositUseCase = new CreateCryptoDepositUseCase(
    primaryCryptoProvider,
    config.crypto,
    campaignRepo,
    cryptoQuoteRepo,
    donationIntentRepo,
    cryptoProvidersByName,
  )
  const handleCryptoWebhookUseCase = new HandleCryptoWebhookUseCase(
    cryptoProvidersByName,
    donationIntentRepo,
    cryptoWebhookEventRepo,
    campaignRepo,
    feePolicy,
    planLimitsService,
    settleDonationUseCase,
  )
  const reconcileCryptoUseCase = new ReconcileCryptoUseCase(
    donationIntentRepo,
    cryptoProvidersByName,
    handleCryptoWebhookUseCase,
  )
  const cryptoController = new CryptoController(
    getCryptoAssetsUseCase,
    createCryptoQuoteUseCase,
    createCryptoDepositUseCase,
  )
  const cryptoWebhookController = new CryptoWebhookController(handleCryptoWebhookUseCase)

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
    gatewayRegistry,
  )
  const donateToCampaignUseCase = new DonateToCampaignUseCase(createDonationIntentUseCase)
  // Payout settlement: the signed transfer webhook moves an approved payout to
  // its terminal state and clears the campaign balance/ledger accordingly.
  const handlePayoutWebhookUseCase = new HandlePayoutWebhookUseCase(
    payoutRepo,
    campaignBalanceRepo,
    ledgerRepo,
  )
  // Affiliate payout settlement: the signed transfer webhook moves an approved
  // affiliate payout (aff- reference) to its terminal state and reconciles the
  // affiliate balance buckets accordingly.
  const handleAffiliatePayoutWebhookUseCase = new HandleAffiliatePayoutWebhookUseCase(
    affiliatePayoutRepo,
    affiliateBalanceRepo,
  )
  // Paid-subscription settlement seam: activates the subscription, redeems any
  // coupon, and awards the one-time affiliate commission. Called by the signed
  // webhook (real charge) and inline for a coupon-zeroed checkout.
  const settleSubscriptionUseCase = new SettleSubscriptionUseCase(
    subscriptionCheckoutRepo,
    subscriptionRepo,
    couponRepo,
    couponRedemptionRepo,
    affiliateCommissionService,
  )
  // Paystack settlement: the signed webhook is the authoritative rail that
  // calls settleDonation() with the provider's real fee breakdown, settles
  // approved campaign/affiliate payouts on transfer.* events, settles paid
  // subscriptions on sub- charges, and claws back affiliate commission on a
  // subscription refund.
  // Creator tip-jar (buy-me-a-coffee): a self-contained rail — tips collect via
  // the shared payment gateway (`tip-` reference) and credit a per-creator
  // balance; withdrawal reuses the transfer rail.
  const creatorProfileRepo = new MongoCreatorProfileRepository()
  const creatorBalanceRepo = new MongoCreatorBalanceRepository()
  const tipRepo = new MongoTipRepository()
  const saveCreatorProfileUseCase = new SaveCreatorProfileUseCase(
    creatorProfileRepo,
    creatorBalanceRepo,
    planLimitsService,
  )
  const getCreatorByHandleUseCase = new GetCreatorByHandleUseCase(
    creatorProfileRepo,
    tipRepo,
    planLimitsService,
    userRepo,
    profileRepo,
  )
  const createTipIntentUseCase = new CreateTipIntentUseCase(
    creatorProfileRepo,
    tipRepo,
    creatorBalanceRepo,
    paymentGateway,
    planLimitsService,
  )
  const handleTipWebhookUseCase = new HandleTipWebhookUseCase(tipRepo, creatorBalanceRepo)
  const creatorPayoutRepo = new MongoCreatorPayoutRepository()
  const payoutAccounts = new PayoutAccountService(
    new MongoPayoutAccountRepository(),
    paymentGateway,
    planLimitsService,
  )
  const requestCreatorWithdrawalUseCase = new RequestCreatorWithdrawalUseCase(
    creatorPayoutRepo,
    creatorBalanceRepo,
    paymentGateway,
    planLimitsService,
    payoutAccounts,
    new MongoWalletPayoutRepository(),
  )
  const handleCreatorPayoutWebhookUseCase = new HandleCreatorPayoutWebhookUseCase(
    creatorPayoutRepo,
    creatorBalanceRepo,
  )

  const walletTopUps = new WalletTopUpService(
    paymentGateway,
    config.payments.paystackEnabled,
    config.paystack.secretKey.startsWith('sk_live_') ? 'live' : 'test',
  )
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
    affiliateCommissionService,
    handleBeneficiaryPayoutWebhookUseCase,
    handleTipWebhookUseCase,
    handleCreatorPayoutWebhookUseCase,
    walletTopUps,
  )
  // Flutterwave settlement: verifies the verif-hash, re-verifies the charge
  // server-side, then settles through the same donation seam as Paystack.
  const handleFlutterwaveWebhookUseCase = new HandleFlutterwaveWebhookUseCase(
    flutterwaveGateway,
    donationIntentRepo,
    paymentAttemptRepo,
    feePolicy,
    settleDonationUseCase,
    planLimitsService,
  )
  // Reconciliation (spec §13): re-verify stale PENDING hosted intents against
  // the provider and safely repair missed settlements.
  const reconcilePaymentsUseCase = new ReconcilePaymentsUseCase(
    gatewayRegistry,
    donationIntentRepo,
    paymentAttemptRepo,
    feePolicy,
    settleDonationUseCase,
    planLimitsService,
    // Creator tip-collect repair: re-credit SUCCEEDED-but-uncredited tips.
    tipRepo,
    handleTipWebhookUseCase,
  )
  // Admin-initiated, provider-integrated refund with compensating ledger (spec §14).
  const processRefundUseCase = new ProcessRefundUseCase(
    donationIntentRepo,
    campaignBalanceRepo,
    ledgerRepo,
    campaignLedgerProjector,
    gatewayRegistry,
  )
  // Payout reconciliation: repair payouts stuck in PROCESSING (a missed/delayed
  // transfer webhook) by re-verifying against the provider and driving the same
  // idempotent settlement handlers.
  const reconcilePayoutsUseCase = new ReconcilePayoutsUseCase(
    payoutRepo,
    beneficiaryPayoutRepo,
    affiliatePayoutRepo,
    handlePayoutWebhookUseCase,
    handleBeneficiaryPayoutWebhookUseCase,
    handleAffiliatePayoutWebhookUseCase,
    paymentGateway,
    handleCreatorPayoutWebhookUseCase,
    creatorPayoutRepo,
  )
  // Scheduled reconciliation sweep (spec §13). Production-only + flag-gated so
  // tests/dev never spawn it; unref'd so it can't hold the process open.
  if (config.payments.reconciliationEnabled && config.nodeEnv === 'production') {
    const RECONCILE_INTERVAL_MS = 5 * 60 * 1000
    // Guarded against overlap: a sweep that outruns the interval (a large stale
    // backlog, or a slow provider) would otherwise have a second pass select the
    // same payouts and re-drive their settlement concurrently with the first.
    let reconcileInFlight = false
    const timer = setInterval(() => {
      if (reconcileInFlight) {
        logger.warn('reconciliation sweep still running; skipping this tick')
        return
      }
      reconcileInFlight = true
      void (async () => {
        try {
          await walletTopUps
            .reconcile()
            .catch((err) => logger.error({ err }, 'wallet top-up reconciliation failed'))
          await reconcilePaymentsUseCase
            .reconcileStale({ olderThanMinutes: 30 })
            .catch((err) => logger.error({ err }, 'scheduled reconciliation failed'))
          await reconcilePayoutsUseCase
            .reconcileStale({ olderThanMinutes: 1 })
            .catch((err) => logger.error({ err }, 'scheduled payout reconciliation failed'))
          if (config.crypto.enabled) {
            await reconcileCryptoUseCase
              .reconcileStale({ olderThanMinutes: 30 })
              .catch((err) => logger.error({ err }, 'scheduled crypto reconciliation failed'))
          }
        } finally {
          reconcileInFlight = false
        }
      })()
    }, RECONCILE_INTERVAL_MS)
    timer.unref()
  }
  const recordPaymentAttemptUseCase = new RecordPaymentAttemptUseCase(
    donationIntentRepo,
    paymentAttemptRepo,
  )
  const getDonationIntentPublicUseCase = new GetDonationIntentPublicUseCase(donationIntentRepo)
  const addDonationMessageUseCase = new AddDonationMessageUseCase(donationRepo)

  // Payout rail: register recipients, request/approve payouts of cleared funds,
  // and disburse via Paystack Transfers. Guarded owner/admin; the transfer
  // webhook (above) settles the terminal state.
  const listBanksUseCase = new ListBanksUseCase(paymentGateway)
  const createPayoutRecipientUseCase = new CreatePayoutRecipientUseCase(
    campaignRepo,
    transferRecipientRepo,
    paymentGateway,
    payoutAccounts,
  )
  // ADR-5 (G6): versioned, effective-dated commercial config — overrides layered
  // over the env defaults, so behaviour is unchanged until an admin sets a value.
  const commercialConfigRepo = new MongoCommercialConfigRepository()
  const commercialConfigService = new CommercialConfigService(commercialConfigRepo, config.payouts)
  const requestPayoutUseCase = new RequestPayoutUseCase(
    campaignRepo,
    transferRecipientRepo,
    payoutRepo,
    campaignBalanceRepo,
    paymentGateway,
    config.payouts,
    campaignSplitRepo,
    config.splitProceedsEnabled,
    commercialConfigService,
  )
  const approvePayoutUseCase = new ApprovePayoutUseCase(
    payoutRepo,
    transferRecipientRepo,
    campaignBalanceRepo,
    paymentGateway,
    config.payouts,
    campaignRepo,
    new MongoWalletPayoutRepository(),
  )
  const listCampaignPayoutsUseCase = new ListCampaignPayoutsUseCase(campaignRepo, payoutRepo)
  const listPayoutsUseCase = new ListPayoutsUseCase(payoutRepo)

  const createShortLinkUseCase = new CreateShortLinkUseCase(
    shortLinkRepo,
    campaignRepo,
    config.publicWebUrl,
    config.publicApiUrl,
  )
  const resolveShortLinkUseCase = new ResolveShortLinkUseCase(shortLinkRepo, liveSessionRepo)
  const listCampaignQrCodesUseCase = new ListCampaignQrCodesUseCase(
    shortLinkRepo,
    campaignRepo,
    config.publicApiUrl,
  )

  const liveVideo = new LiveVideoService(config.liveVideo, liveSessionRepo, campaignRepo)
  const startLiveSessionUseCase = new StartLiveSessionUseCase(
    liveSessionRepo,
    campaignRepo,
    planLimitsService,
  )
  const endLiveSessionUseCase = new EndLiveSessionUseCase(liveSessionRepo, campaignRepo, liveVideo)
  const updateLiveSessionPrivacyUseCase = new UpdateLiveSessionPrivacyUseCase(
    liveSessionRepo,
    campaignRepo,
  )
  const rotateOverlayTokenUseCase = new RotateOverlayTokenUseCase(liveSessionRepo, campaignRepo)
  const getLiveSessionPublicUseCase = new GetLiveSessionPublicUseCase(liveSessionRepo, campaignRepo)
  const getLiveSessionOverlayUseCase = new GetLiveSessionOverlayUseCase(
    liveSessionRepo,
    campaignRepo,
    donationRepo,
    userRepo,
  )

  const getProfileUseCase = new GetProfileUseCase(userRepo, profileRepo, donationRepo, campaignRepo)
  const updateProfileUseCase = new UpdateProfileUseCase(userRepo, profileRepo)
  const getPublicUserProfileUseCase = new GetPublicUserProfileUseCase(userRepo, profileRepo)
  const deleteAccountUseCase = new DeleteAccountUseCase(userRepo, tokenService)

  const createCampaignUpdateUseCase = new CreateCampaignUpdateUseCase(
    campaignUpdateRepo,
    campaignRepo,
  )
  const getCampaignUpdatesUseCase = new GetCampaignUpdatesUseCase(campaignUpdateRepo, campaignRepo)
  const updateCampaignUpdateUseCase = new UpdateCampaignUpdateUseCase(campaignUpdateRepo, campaignRepo)
  const deleteCampaignUpdateUseCase = new DeleteCampaignUpdateUseCase(campaignUpdateRepo, campaignRepo)
  const pinCampaignUpdateUseCase = new PinCampaignUpdateUseCase(campaignUpdateRepo, campaignRepo)
  const campaignCommentUseCases = new CampaignCommentUseCases(
    campaignCommentRepo,
    campaignRepo,
    userRepo,
  )

  const shareCampaignUseCase = new ShareCampaignUseCase(shareRepo)
  const reportCampaignUseCase = new ReportCampaignUseCase(campaignRepo, reportRepo)

  const listRecentDonationsUseCase = new ListRecentDonationsUseCase(
    donationRepo,
    campaignRepo,
    userRepo,
  )
  const listMyDonationsUseCase = new ListMyDonationsUseCase(donationRepo, campaignRepo)
  const getDonationUseCase = new GetDonationUseCase(donationRepo, campaignRepo)
  const listCampaignDonationsUseCase = new ListCampaignDonationsUseCase(
    donationRepo,
    campaignRepo,
    userRepo,
  )

  const getLeaderboardUseCase = new GetLeaderboardUseCase(leaderboardRepo)
  const getLeaderboardStatsUseCase = new GetLeaderboardStatsUseCase(leaderboardRepo)

  const getMyNotificationsUseCase = new GetMyNotificationsUseCase(notificationRepo)
  const markNotificationAsReadUseCase = new MarkNotificationAsReadUseCase(notificationRepo)
  const markAllNotificationsAsReadUseCase = new MarkAllNotificationsAsReadUseCase(notificationRepo)
  const getUnreadNotificationCountUseCase = new GetUnreadNotificationCountUseCase(notificationRepo)

  const getOrganizationUseCase = new GetOrganizationUseCase(organizationRepo, campaignRepo)

  const requestRefundUseCase = new RequestRefundUseCase(refundRepo, donationRepo)
  const listMyRefundsUseCase = new ListMyRefundsUseCase(refundRepo, campaignRepo)

  const submitKYCIdentityUseCase = new SubmitKYCIdentityUseCase(kycRepo)
  const getKYCStatusUseCase = new GetKYCStatusUseCase(kycRepo)
  const getPendingKYCUseCase = new GetPendingKYCUseCase(kycRepo, userRepo)
  const approveKYCUseCase = new ApproveKYCUseCase(kycRepo, userRepo)
  const rejectKYCUseCase = new RejectKYCUseCase(kycRepo)

  const inviteCollaboratorUseCase = new InviteCollaboratorUseCase(
    campaignRepo,
    userRepo,
    collaborationRepo,
    planLimitsService,
  )
  const removeCollaboratorUseCase = new RemoveCollaboratorUseCase(campaignRepo, collaborationRepo)
  const listCampaignCollaboratorsUseCase = new ListCampaignCollaboratorsUseCase(
    campaignRepo,
    collaborationRepo,
  )
  const listMyCollaborationInvitationsUseCase = new ListMyCollaborationInvitationsUseCase(
    collaborationRepo,
    campaignRepo,
  )
  const respondToCollaborationUseCase = new RespondToCollaborationUseCase(
    collaborationRepo,
    campaignRepo,
    planLimitsService,
  )

  const getMySubscriptionUseCase = new GetMySubscriptionUseCase(subscriptionRepo)
  const subscribeUseCase = new SubscribeUseCase(subscriptionRepo)
  const upgradeSubscriptionUseCase = new UpgradeSubscriptionUseCase(subscriptionRepo)
  const cancelSubscriptionUseCase = new CancelSubscriptionUseCase(subscriptionRepo)
  const listSubscriptionsUseCase = new ListSubscriptionsUseCase(subscriptionRepo, userRepo)

  // Paid-subscription checkout rail (coupon-aware; settles via the webhook or,
  // when a coupon zeroes the price, inline via settleSubscriptionUseCase).
  const createSubscriptionCheckoutUseCase = new CreateSubscriptionCheckoutUseCase(
    subscriptionCheckoutRepo,
    couponRedemptionRepo,
    userRepo,
    couponService,
    paymentGateway,
    settleSubscriptionUseCase,
    planService,
  )
  const getSubscriptionCheckoutUseCase = new GetSubscriptionCheckoutUseCase(
    subscriptionCheckoutRepo,
    paymentGateway,
    settleSubscriptionUseCase,
  )

  // Coupons: admin CRUD + an authed pre-checkout preview.
  const createCouponUseCase = new CreateCouponUseCase(couponRepo)
  const updateCouponUseCase = new UpdateCouponUseCase(couponRepo)
  const listCouponsUseCase = new ListCouponsUseCase(couponRepo)
  const getCouponUseCase = new GetCouponUseCase(couponRepo)
  const deleteCouponUseCase = new DeleteCouponUseCase(couponRepo)
  const previewCouponUseCase = new PreviewCouponUseCase(couponService, planService)

  // Affiliate/referral program: owner surface + admin console + payout rail.
  const enrollAffiliateUseCase = new EnrollAffiliateUseCase(affiliateRepo, affiliateBalanceRepo)
  const updateAffiliateReferralCodeUseCase = new UpdateAffiliateReferralCodeUseCase(affiliateRepo)
  const getAffiliateDashboardUseCase = new GetAffiliateDashboardUseCase(
    affiliateRepo,
    affiliateBalanceRepo,
    affiliateCommissionRepo,
    affiliateReferralRepo,
    config.publicWebUrl,
  )
  const listMyAffiliateReferralsUseCase = new ListMyAffiliateReferralsUseCase(
    affiliateRepo,
    affiliateReferralRepo,
  )
  const listMyAffiliateCommissionsUseCase = new ListMyAffiliateCommissionsUseCase(
    affiliateRepo,
    affiliateCommissionRepo,
  )
  const setAffiliatePayoutRecipientUseCase = new SetAffiliatePayoutRecipientUseCase(
    affiliateRepo,
    paymentGateway,
  )
  const requestAffiliatePayoutUseCase = new RequestAffiliatePayoutUseCase(
    affiliateRepo,
    affiliatePayoutRepo,
    affiliateBalanceRepo,
    affiliateCommissionRepo,
    paymentGateway,
  )
  const approveAffiliatePayoutUseCase = new ApproveAffiliatePayoutUseCase(
    affiliatePayoutRepo,
    affiliateRepo,
    affiliateBalanceRepo,
    paymentGateway,
  )
  const listAffiliatesUseCase = new ListAffiliatesUseCase(affiliateRepo)
  const getAffiliateDetailUseCase = new GetAffiliateDetailUseCase(
    affiliateRepo,
    affiliateBalanceRepo,
    affiliateReferralRepo,
    affiliateCommissionRepo,
    affiliatePayoutRepo,
  )
  const setAffiliateCommissionRateUseCase = new SetAffiliateCommissionRateUseCase(affiliateRepo)
  const updateAffiliateStatusUseCase = new UpdateAffiliateStatusUseCase(affiliateRepo)
  const listAffiliatePayoutsUseCase = new ListAffiliatePayoutsUseCase(affiliatePayoutRepo)
  // Batch maturity sweep (held → available); exposed for a boot/cron sweep.
  const matureAffiliateCommissionsUseCase = new MatureAffiliateCommissionsUseCase(
    affiliateCommissionRepo,
    affiliateBalanceRepo,
  )

  const listPlansUseCase = new ListPlansUseCase(planService)
  const updatePlanUseCase = new UpdatePlanUseCase(subscriptionPlanRepo, auditLogRepo)
  const createPlanUseCase = new CreatePlanUseCase(subscriptionPlanRepo)
  const listPaymentProvidersUseCase = new ListPaymentProvidersUseCase(paymentProviderRepo)
  const getEnabledPaymentProvidersUseCase = new GetEnabledPaymentProvidersUseCase(
    paymentProviderRepo,
  )
  const togglePaymentProviderUseCase = new TogglePaymentProviderUseCase(paymentProviderRepo)

  const getDisputeUseCase = new GetDisputeUseCase(disputeRepo, campaignRepo, userRepo)
  const resolveDisputeUseCase = new ResolveDisputeUseCase(disputeRepo)
  const listReportsUseCase = new ListReportsUseCase(adminReportRepo, campaignRepo)
  const reviewReportUseCase = new ReviewReportUseCase(adminReportRepo)
  const reviewCampaignUseCase = new ReviewCampaignUseCase(campaignRepo)
  const listUsersUseCase = new ListUsersUseCase(adminUserRepo)
  const getAdminUserUseCase = new GetAdminUserUseCase(adminUserRepo)
  const setComplianceLimitUseCase = new SetComplianceLimitUseCase(userRepo, auditLogRepo)
  const getPlatformOverviewUseCase = new GetPlatformOverviewUseCase(analyticsRepo)
  const subscribeNewsletterUseCase = new SubscribeNewsletterUseCase(newsletterRepo)
  const listNewsletterSubscribersUseCase = new ListNewsletterSubscribersUseCase(newsletterRepo)

  const listSiteContentUseCase = new ListSiteContentUseCase(siteContentRepo)
  const getSiteContentUseCase = new GetSiteContentUseCase(siteContentRepo)
  const upsertSiteContentUseCase = new UpsertSiteContentUseCase(siteContentRepo)
  const signCloudinaryUploadUseCase = new SignCloudinaryUploadUseCase(config.cloudinary)

  // ── Controllers ──────────────────────────────────────────────────────
  const authController = new AuthController(
    registerUserUseCase,
    loginUserUseCase,
    tokenService,
    changePasswordUseCase,
    forgotPasswordUseCase,
    resetPasswordUseCase,
  )
  const campaignController = new CampaignController(
    createCampaignUseCase,
    getCampaignUseCase,
    donateToCampaignUseCase,
    getCampaignBySlugUseCase,
    setCampaignSlugUseCase,
    planLimitsService,
    userRepo,
    campaignRepo,
    config.splitProceedsEnabled,
  )
  const shortLinkController = new ShortLinkController(
    createShortLinkUseCase,
    listCampaignQrCodesUseCase,
    resolveShortLinkUseCase,
    shortLinkRepo,
    qrCodeService,
    config.publicApiUrl,
  )
  const liveSessionController = new LiveSessionController(
    startLiveSessionUseCase,
    endLiveSessionUseCase,
    updateLiveSessionPrivacyUseCase,
    rotateOverlayTokenUseCase,
    getLiveSessionPublicUseCase,
    getLiveSessionOverlayUseCase,
    new GetActiveLiveSessionUseCase(liveSessionRepo, campaignRepo),
    liveVideo,
  )
  const realtimeController = new RealtimeController(eventBus, campaignRepo, liveSessionRepo)
  const walletController = new WalletController(walletRepo, walletTxRepo, walletTopUps)
  const profileController = new ProfileController(
    getProfileUseCase,
    updateProfileUseCase,
    getPublicUserProfileUseCase,
    deleteAccountUseCase,
  )
  const campaignUpdateController = new CampaignUpdateController(
    createCampaignUpdateUseCase,
    getCampaignUpdatesUseCase,
    updateCampaignUpdateUseCase,
    deleteCampaignUpdateUseCase,
    pinCampaignUpdateUseCase,
  )
  const campaignCommentController = new CampaignCommentController(campaignCommentUseCases)
  const shareReportController = new ShareReportController(
    shareCampaignUseCase,
    reportCampaignUseCase,
  )
  const donationController = new DonationController(
    listRecentDonationsUseCase,
    listMyDonationsUseCase,
    getDonationUseCase,
    listCampaignDonationsUseCase,
  )
  const donationIntentController = new DonationIntentController(
    createDonationIntentUseCase,
    recordPaymentAttemptUseCase,
    getDonationIntentPublicUseCase,
    addDonationMessageUseCase,
    new VerifyDonationIntentUseCase(donationIntentRepo, reconcilePaymentsUseCase),
  )
  const paystackWebhookController = new PaystackWebhookController(handlePaystackWebhookUseCase)
  const flutterwaveWebhookController = new FlutterwaveWebhookController(
    handleFlutterwaveWebhookUseCase,
  )
  const adminPaymentsController = new AdminPaymentsController(
    donationIntentRepo,
    paymentAttemptRepo,
    reconcilePaymentsUseCase,
    processRefundUseCase,
    reconcilePayoutsUseCase,
  )
  const payoutController = new PayoutController(
    listBanksUseCase,
    createPayoutRecipientUseCase,
    requestPayoutUseCase,
    approvePayoutUseCase,
    listCampaignPayoutsUseCase,
    listPayoutsUseCase,
    new GetCampaignPayoutOptionsUseCase(
      campaignRepo,
      campaignBalanceRepo,
      transferRecipientRepo,
      commercialConfigService,
    ),
    new AutomaticPayoutService(approvePayoutUseCase, payoutRepo, config.payouts),
    new PayoutTransferControlUseCase(payoutRepo, paymentGateway, handlePayoutWebhookUseCase),
    payoutRepo,
  )
  // Split-proceeds: owner-managed, versioned beneficiary allocations (spec §17).
  const campaignSplitUseCase = new CampaignSplitUseCase(
    campaignRepo,
    campaignSplitRepo,
    campaignBeneficiaryBalanceRepo,
    campaignBeneficiaryAccrualRepo,
    planLimitsService,
    config.splitProceedsEnabled,
  )
  const campaignSplitController = new CampaignSplitController(campaignSplitUseCase)
  // Per-beneficiary payouts (spec §17, behind the split-proceeds flag): register
  // a beneficiary recipient, admin KYC-verify, request + admin-approve a `bpay-`
  // transfer of the beneficiary's cleared share.
  const beneficiaryPayoutUseCase = new BeneficiaryPayoutUseCase(
    config.splitProceedsEnabled,
    campaignRepo,
    campaignSplitRepo,
    campaignBeneficiaryBalanceRepo,
    campaignBalanceRepo,
    beneficiaryRecipientRepo,
    beneficiaryPayoutRepo,
    paymentGateway,
    config.payouts.dualApprovalAmount,
  )
  const beneficiaryPayoutController = new BeneficiaryPayoutController(beneficiaryPayoutUseCase)
  const leaderboardController = new LeaderboardController(
    getLeaderboardUseCase,
    getLeaderboardStatsUseCase,
  )
  const notificationController = new NotificationController(
    getMyNotificationsUseCase,
    markNotificationAsReadUseCase,
    markAllNotificationsAsReadUseCase,
    getUnreadNotificationCountUseCase,
  )
  const organizationController = new OrganizationController(getOrganizationUseCase)
  const refundController = new RefundController(requestRefundUseCase, listMyRefundsUseCase)
  const kycController = new KYCController(
    submitKYCIdentityUseCase,
    getKYCStatusUseCase,
    getPendingKYCUseCase,
    approveKYCUseCase,
    rejectKYCUseCase,
    new GetKYCStatsUseCase(kycRepo),
  )
  const collaborationController = new CollaborationController(
    inviteCollaboratorUseCase,
    removeCollaboratorUseCase,
    listCampaignCollaboratorsUseCase,
    listMyCollaborationInvitationsUseCase,
    respondToCollaborationUseCase,
  )
  const subscriptionController = new SubscriptionController(
    getMySubscriptionUseCase,
    subscribeUseCase,
    upgradeSubscriptionUseCase,
    cancelSubscriptionUseCase,
    listSubscriptionsUseCase,
    createSubscriptionCheckoutUseCase,
    getSubscriptionCheckoutUseCase,
  )
  const couponController = new CouponController(
    createCouponUseCase,
    listCouponsUseCase,
    getCouponUseCase,
    updateCouponUseCase,
    deleteCouponUseCase,
    previewCouponUseCase,
  )
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
    approveAffiliatePayoutUseCase,
    updateAffiliateReferralCodeUseCase,
  )
  const paymentProviderController = new PaymentProviderController(
    listPaymentProvidersUseCase,
    getEnabledPaymentProvidersUseCase,
    togglePaymentProviderUseCase,
  )
  const planController = new PlanController(listPlansUseCase, updatePlanUseCase, createPlanUseCase)
  const disputeController = new DisputeController(getDisputeUseCase, resolveDisputeUseCase)
  const adminReportController = new AdminReportController(listReportsUseCase, reviewReportUseCase)
  const campaignModerationController = new CampaignModerationController(reviewCampaignUseCase)
  const adminUserController = new AdminUserController(
    listUsersUseCase,
    getAdminUserUseCase,
    setComplianceLimitUseCase,
  )
  const analyticsController = new AnalyticsController(getPlatformOverviewUseCase)
  const newsletterController = new NewsletterController(
    subscribeNewsletterUseCase,
    listNewsletterSubscribersUseCase,
  )
  const siteContentController = new SiteContentController(
    listSiteContentUseCase,
    getSiteContentUseCase,
    upsertSiteContentUseCase,
  )
  const uploadController = new UploadController(signCloudinaryUploadUseCase)
  const auditLogController = new AuditLogController()
  const testimonialController = new TestimonialController()
  const contactController = new ContactController()

  // ── HTTP pipeline ────────────────────────────────────────────────────
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(
    cors({
      origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
      credentials: true,
    }),
  )

  // Paystack webhook — mounted BEFORE the JSON body parser so its handler
  // receives the raw request bytes the HMAC-SHA512 signature is verified
  // against. Its own express.raw parser applies only to this route.
  app.use('/api/v1/webhooks/paystack', createPaystackWebhookRoutes(paystackWebhookController))
  // Flutterwave webhook — likewise mounted BEFORE the JSON parser (raw bytes).
  app.use(
    '/api/v1/webhooks/flutterwave',
    createFlutterwaveWebhookRoutes(flutterwaveWebhookController),
  )
  // Crypto provider webhooks — raw body (its own parser) for signature checks.
  app.use('/api/v1/webhooks/crypto', createCryptoWebhookRoutes(cryptoWebhookController))

  // `verify` stashes the exact bytes so a route can check an HMAC over them.
  // Re-serialising the parsed object is not equivalent — key order and
  // whitespace change the digest.
  app.use(
    express.json({
      limit: '200kb',
      verify: (req, _res, buf) => {
        ;(req as express.Request & { rawBody?: Buffer }).rawBody = buf
      },
    }),
  )
  app.use(requestLogger)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  const api = express.Router()
  api.use(apiRateLimiter)
  api.use(auditMutation)

  api.use('/auth', createAuthRoutes(authController, authMiddleware))

  // The /campaigns resource is composed from sibling routers (Express
  // dispatches across routers sharing a prefix by method + path).
  api.use('/campaigns', createCampaignRoutes(campaignController, authMiddleware))
  api.use('/campaigns', createCampaignUpdateRoutes(campaignUpdateController, authMiddleware))
  api.use('/campaigns', createCampaignCommentRoutes(campaignCommentController, authMiddleware))
  api.use('/campaigns', createShareReportRoutes(shareReportController, authMiddleware))
  api.use('/campaigns', createCampaignDonationRoutes(donationController))
  api.use(
    '/campaigns',
    createCampaignCollaboratorRoutes(
      collaborationController,
      authMiddleware,
      optionalAuthMiddleware,
    ),
  )
  api.use(
    '/campaigns',
    createCampaignModerationRoutes(campaignModerationController, authMiddleware, requireAdmin),
  )
  api.use('/campaigns', createCampaignQrRoutes(shortLinkController, authMiddleware))
  api.use('/campaigns', createCampaignPayoutRoutes(payoutController, authMiddleware))
  api.use('/campaigns', createCampaignSplitRoutes(campaignSplitController, authMiddleware))
  // Crypto rail (Crypto Donations plan §17): public asset/network discovery +
  // campaign-scoped quote/deposit. OFF unless config.crypto.enabled.
  api.use('/payments/crypto', createCryptoRoutes(cryptoController))
  api.use('/campaigns', createCryptoDonationRoutes(cryptoController))
  api.use(
    '/campaigns',
    createCampaignBeneficiaryPayoutRoutes(
      beneficiaryPayoutController,
      authMiddleware,
      requireAdmin,
    ),
  )
  api.use(
    '/beneficiary-payouts',
    createBeneficiaryPayoutRoutes(beneficiaryPayoutController, authMiddleware, requireAdmin),
  )
  api.use(
    '/campaigns',
    createCampaignLiveSessionRoutes(liveSessionController, realtimeController, authMiddleware),
  )

  // Live sessions + real-time overlay/SSE surface.
  api.use(
    '/live-sessions',
    createLiveSessionRoutes(liveSessionController, realtimeController, authMiddleware),
  )

  api.use('/wallets', createWalletRoutes(walletController, authMiddleware))
  api.use('/profile', createProfileRoutes(profileController, authMiddleware))
  api.use('/users', createUserRoutes(profileController))
  api.use('/users', createAdminUserRoutes(adminUserController, authMiddleware, requireAdmin))
  api.use(
    '/admin',
    createAdminPaymentsRoutes(adminPaymentsController, authMiddleware, requireAdmin),
  )
  api.use('/admin', createCryptoAdminRoutes(reconcileCryptoUseCase, authMiddleware, requireAdmin))
  api.use('/donations', createDonationRoutes(donationController, authMiddleware))
  // Post-donation message endpoint, composed onto the /donations resource.
  api.use('/donations', createDonationMessageRoutes(donationIntentController, authMiddleware))
  // Guest-capable donation-intent + ledger rail.
  api.use(
    '/donation-intents',
    createDonationIntentRoutes(donationIntentController, optionalAuthMiddleware),
  )
  api.use('/payout-accounts', createPayoutAccountRoutes(payoutAccounts, authMiddleware))
  api.use('/leaderboard', createLeaderboardRoutes(leaderboardController))
  api.use(
    '/creators',
    createCreatorRoutes({
      planLimits: planLimitsService,
      saveProfile: saveCreatorProfileUseCase,
      getByHandle: getCreatorByHandleUseCase,
      createTip: createTipIntentUseCase,
      verifyTip: new VerifyCreatorTipUseCase(
        tipRepo,
        creatorProfileRepo,
        paymentGateway,
        handleTipWebhookUseCase,
      ),
      requestWithdrawal: requestCreatorWithdrawalUseCase,
      profileRepo: creatorProfileRepo,
      balanceRepo: creatorBalanceRepo,
      payoutRepo: creatorPayoutRepo,
      authMiddleware,
    }),
  )
  api.use(
    '/admin/commercial-config',
    createCommercialConfigRoutes({
      service: commercialConfigService,
      authMiddleware,
      requireAdmin,
    }),
  )
  api.use('/admin', createAdminActionRoutes(authMiddleware))
  api.use('/notifications', createNotificationRoutes(notificationController, authMiddleware))
  api.use('/organization-team', createOrganizationTeamRoutes(authMiddleware))
  api.use('/organizations', createOrganizationRoutes(organizationController))
  api.use('/refunds', createRefundRoutes(refundController, authMiddleware))
  api.use('/kyc', createKYCRoutes(kycController, authMiddleware, requireAdmin))
  api.use('/collaborations', createCollaborationRoutes(collaborationController, authMiddleware))
  api.use(
    '/subscriptions',
    createSubscriptionRoutes(subscriptionController, authMiddleware, requireAdmin),
  )
  // Coupons: admin CRUD (requireAdmin) + an authed pre-checkout preview.
  api.use('/coupons', createCouponRoutes(couponController, authMiddleware, requireAdmin))
  // Affiliate program: the owner surface (authed) + the admin console (admin).
  api.use('/affiliate', createAffiliateRoutes(affiliateController, authMiddleware))
  api.use(
    '/affiliates',
    createAdminAffiliateRoutes(affiliateController, authMiddleware, requireAdmin),
  )
  api.use(
    '/payment-providers',
    createPaymentProviderRoutes(paymentProviderController, authMiddleware, requireAdmin),
  )
  // Plans: authed display (GET) + admin edit of pricing/limits/benefits (PUT).
  api.use('/plans', createPlanRoutes(planController, authMiddleware, requireAdmin))
  // Payout rail: bank/telco directory (auth), plus the admin payout console.
  api.use('/banks', createBankRoutes(payoutController, authMiddleware))
  api.use(
    automaticPayoutRoutes(
      authMiddleware,
      new PayoutTransferControlUseCase(payoutRepo, paymentGateway, handlePayoutWebhookUseCase),
    ),
  )
  api.use('/payouts', createPayoutRoutes(payoutController, authMiddleware, requireAdmin))
  api.use('/disputes', createDisputeRoutes(disputeController, authMiddleware, requireAdmin))
  api.use('/reports', createAdminReportRoutes(adminReportController, authMiddleware, requireAdmin))
  api.use('/analytics', createAnalyticsRoutes(analyticsController, authMiddleware, requireAdmin))
  api.use('/newsletter', createNewsletterRoutes(newsletterController, authMiddleware, requireAdmin))
  api.use('/content', createContentRoutes(siteContentController, authMiddleware, requireAdmin))
  api.use('/uploads', createUploadRoutes(uploadController, cloudinaryUploader, authMiddleware))
  api.use('/audit', createAuditLogRoutes(auditLogController, authMiddleware, requireAdmin))
  api.use(
    '/ai-writing',
    createAiWritingRoutes(
      new AiWritingService(
        new OpenAiWritingProvider(config.aiWriting),
        config.aiWriting.dailyLimit,
        config.aiWriting.globalDailyLimit,
      ),
      authMiddleware,
      requireAdmin,
    ),
  )
  api.use('/rbac', createRbacRoutes(authMiddleware))
  api.use(
    '/testimonials',
    createTestimonialRoutes(testimonialController, authMiddleware, requireAdmin),
  )
  api.use('/contact', createContactRoutes(contactController, authMiddleware, requireAdmin))

  app.use('/api/v1', api)

  // Public short-link surface, mounted at the app root (outside /api/v1) so the
  // QR/redirect URLs stay short and shareable: GET /r/:code, /qr/:code.svg,
  // /qr/:code.png.
  // Served from the API because campaigns are dynamic; exposed at
  // app.ujimora.com/sitemap.xml via a rewrite, since a sitemap may only list
  // URLs on the host that serves it.
  app.use('/', createSitemapRoutes())
  app.use('/', createShortLinkPublicRoutes(shortLinkController))

  app.use(errorHandler)

  // Expose the outbox dispatcher so bootstrap can run a catch-up sweep on boot,
  // re-dispatching any donation side-effects left pending by a prior crash.
  app.locals.outboxDispatcher = outboxDispatcher

  // Expose the affiliate maturity sweep so bootstrap/cron can move held
  // commissions to available once their hold window elapses.
  app.locals.matureAffiliateCommissionsUseCase = matureAffiliateCommissionsUseCase

  return app
}
