import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './infrastructure/config/index.js';

// Outbound adapters (repositories)
import { MongoCampaignRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignRepository.js';
import { MongoUserRepository } from './infrastructure/adapters/outbound/persistence/MongoUserRepository.js';
import { MongoDonationRepository } from './infrastructure/adapters/outbound/persistence/MongoDonationRepository.js';
import { MongoWalletRepository } from './infrastructure/adapters/outbound/persistence/MongoWalletRepository.js';
import { MongoWalletTransactionRepository } from './infrastructure/adapters/outbound/persistence/MongoWalletTransactionRepository.js';
import { MongoProfileRepository } from './infrastructure/adapters/outbound/persistence/MongoProfileRepository.js';
import { MongoCampaignUpdateRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignUpdateRepository.js';
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
import { MongoDisputeRepository } from './infrastructure/adapters/outbound/persistence/MongoDisputeRepository.js';
import { MongoAdminUserRepository } from './infrastructure/adapters/outbound/persistence/MongoAdminUserRepository.js';
import { MongoAnalyticsRepository } from './infrastructure/adapters/outbound/persistence/MongoAnalyticsRepository.js';

// Application services
import { AuthTokenService } from './application/services/AuthTokenService.js';

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
import { DonateToCampaignUseCase } from './application/use-cases/DonateToCampaignUseCase.js';

// Use cases — profile
import { GetProfileUseCase } from './application/use-cases/GetProfileUseCase.js';
import { UpdateProfileUseCase } from './application/use-cases/UpdateProfileUseCase.js';
import { GetPublicUserProfileUseCase } from './application/use-cases/GetPublicUserProfileUseCase.js';

// Use cases — campaign updates
import { CreateCampaignUpdateUseCase } from './application/use-cases/CreateCampaignUpdateUseCase.js';
import { GetCampaignUpdatesUseCase } from './application/use-cases/GetCampaignUpdatesUseCase.js';
import { UpdateCampaignUpdateUseCase } from './application/use-cases/UpdateCampaignUpdateUseCase.js';
import { DeleteCampaignUpdateUseCase } from './application/use-cases/DeleteCampaignUpdateUseCase.js';
import { PinCampaignUpdateUseCase } from './application/use-cases/PinCampaignUpdateUseCase.js';

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

// Use cases — payment providers, moderation, admin
import { ListPaymentProvidersUseCase } from './application/use-cases/ListPaymentProvidersUseCase.js';
import { GetEnabledPaymentProvidersUseCase } from './application/use-cases/GetEnabledPaymentProvidersUseCase.js';
import { TogglePaymentProviderUseCase } from './application/use-cases/TogglePaymentProviderUseCase.js';
import { GetDisputeUseCase } from './application/use-cases/GetDisputeUseCase.js';
import { ResolveDisputeUseCase } from './application/use-cases/ResolveDisputeUseCase.js';
import { ListReportsUseCase } from './application/use-cases/ListReportsUseCase.js';
import { ReviewReportUseCase } from './application/use-cases/ReviewReportUseCase.js';
import { ReviewCampaignUseCase } from './application/use-cases/ReviewCampaignUseCase.js';
import { ListUsersUseCase } from './application/use-cases/ListUsersUseCase.js';
import { GetPlatformOverviewUseCase } from './application/use-cases/GetPlatformOverviewUseCase.js';

// Inbound adapters (controllers, middleware, routes)
import { AuthController } from './infrastructure/adapters/inbound/http/controllers/AuthController.js';
import { CampaignController } from './infrastructure/adapters/inbound/http/controllers/CampaignController.js';
import { WalletController } from './infrastructure/adapters/inbound/http/controllers/WalletController.js';
import { ProfileController } from './infrastructure/adapters/inbound/http/controllers/ProfileController.js';
import { CampaignUpdateController } from './infrastructure/adapters/inbound/http/controllers/CampaignUpdateController.js';
import { ShareReportController } from './infrastructure/adapters/inbound/http/controllers/ShareReportController.js';
import { DonationController } from './infrastructure/adapters/inbound/http/controllers/DonationController.js';
import { LeaderboardController } from './infrastructure/adapters/inbound/http/controllers/LeaderboardController.js';
import { NotificationController } from './infrastructure/adapters/inbound/http/controllers/NotificationController.js';
import { OrganizationController } from './infrastructure/adapters/inbound/http/controllers/OrganizationController.js';
import { RefundController } from './infrastructure/adapters/inbound/http/controllers/RefundController.js';
import { KYCController } from './infrastructure/adapters/inbound/http/controllers/KYCController.js';
import { CollaborationController } from './infrastructure/adapters/inbound/http/controllers/CollaborationController.js';
import { SubscriptionController } from './infrastructure/adapters/inbound/http/controllers/SubscriptionController.js';
import { PaymentProviderController } from './infrastructure/adapters/inbound/http/controllers/PaymentProviderController.js';
import { DisputeController } from './infrastructure/adapters/inbound/http/controllers/DisputeController.js';
import { AdminReportController } from './infrastructure/adapters/inbound/http/controllers/AdminReportController.js';
import { CampaignModerationController } from './infrastructure/adapters/inbound/http/controllers/CampaignModerationController.js';
import { AdminUserController } from './infrastructure/adapters/inbound/http/controllers/AdminUserController.js';
import { AnalyticsController } from './infrastructure/adapters/inbound/http/controllers/AnalyticsController.js';

import {
  createAuthMiddleware,
  createOptionalAuthMiddleware,
} from './infrastructure/adapters/inbound/middleware/authMiddleware.js';
import { requireAdmin } from './infrastructure/adapters/inbound/middleware/requireRole.js';
import { errorHandler } from './infrastructure/adapters/inbound/middleware/errorHandler.js';
import { requestLogger } from './infrastructure/adapters/inbound/middleware/requestLogger.js';
import { apiRateLimiter } from './infrastructure/adapters/inbound/middleware/rateLimiter.js';

import { createAuthRoutes } from './infrastructure/adapters/inbound/http/routes/authRoutes.js';
import { createCampaignRoutes } from './infrastructure/adapters/inbound/http/routes/campaignRoutes.js';
import { createWalletRoutes } from './infrastructure/adapters/inbound/http/routes/walletRoutes.js';
import { createProfileRoutes } from './infrastructure/adapters/inbound/http/routes/profileRoutes.js';
import { createUserRoutes } from './infrastructure/adapters/inbound/http/routes/userRoutes.js';
import { createCampaignUpdateRoutes } from './infrastructure/adapters/inbound/http/routes/campaignUpdateRoutes.js';
import { createShareReportRoutes } from './infrastructure/adapters/inbound/http/routes/shareReportRoutes.js';
import { createDonationRoutes } from './infrastructure/adapters/inbound/http/routes/donationRoutes.js';
import { createCampaignDonationRoutes } from './infrastructure/adapters/inbound/http/routes/campaignDonationRoutes.js';
import { createLeaderboardRoutes } from './infrastructure/adapters/inbound/http/routes/leaderboardRoutes.js';
import { createNotificationRoutes } from './infrastructure/adapters/inbound/http/routes/notificationRoutes.js';
import { createOrganizationRoutes } from './infrastructure/adapters/inbound/http/routes/organizationRoutes.js';
import { createRefundRoutes } from './infrastructure/adapters/inbound/http/routes/refundRoutes.js';
import { createKYCRoutes } from './infrastructure/adapters/inbound/http/routes/kycRoutes.js';
import { createCampaignCollaboratorRoutes } from './infrastructure/adapters/inbound/http/routes/campaignCollaboratorRoutes.js';
import { createCollaborationRoutes } from './infrastructure/adapters/inbound/http/routes/collaborationRoutes.js';
import { createSubscriptionRoutes } from './infrastructure/adapters/inbound/http/routes/subscriptionRoutes.js';
import { createPaymentProviderRoutes } from './infrastructure/adapters/inbound/http/routes/paymentProviderRoutes.js';
import { createDisputeRoutes } from './infrastructure/adapters/inbound/http/routes/disputeRoutes.js';
import { createAdminReportRoutes } from './infrastructure/adapters/inbound/http/routes/adminReportRoutes.js';
import { createCampaignModerationRoutes } from './infrastructure/adapters/inbound/http/routes/campaignModerationRoutes.js';
import { createAdminUserRoutes } from './infrastructure/adapters/inbound/http/routes/adminUserRoutes.js';
import { createAnalyticsRoutes } from './infrastructure/adapters/inbound/http/routes/analyticsRoutes.js';

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
  const disputeRepo = new MongoDisputeRepository();
  const adminUserRepo = new MongoAdminUserRepository();
  const analyticsRepo = new MongoAnalyticsRepository();

  // ── Services ─────────────────────────────────────────────────────────
  const tokenService = new AuthTokenService(config.jwtSecret, config.jwtRefreshSecret);
  const authMiddleware = createAuthMiddleware(tokenService);
  const optionalAuthMiddleware = createOptionalAuthMiddleware(tokenService);

  // ── Use cases ────────────────────────────────────────────────────────
  const registerUserUseCase = new RegisterUserUseCase(userRepo, walletRepo, tokenService);
  const loginUserUseCase = new LoginUserUseCase(userRepo, tokenService);
  const changePasswordUseCase = new ChangePasswordUseCase(userRepo, tokenService);
  const forgotPasswordUseCase = new ForgotPasswordUseCase(userRepo);
  const resetPasswordUseCase = new ResetPasswordUseCase(userRepo, tokenService);

  const createCampaignUseCase = new CreateCampaignUseCase(campaignRepo, userRepo);
  const getCampaignUseCase = new GetCampaignUseCase(campaignRepo, donationRepo);
  const donateToCampaignUseCase = new DonateToCampaignUseCase(
    campaignRepo,
    donationRepo,
    walletRepo,
    walletTxRepo
  );

  const getProfileUseCase = new GetProfileUseCase(userRepo, profileRepo, donationRepo, campaignRepo);
  const updateProfileUseCase = new UpdateProfileUseCase(userRepo, profileRepo);
  const getPublicUserProfileUseCase = new GetPublicUserProfileUseCase(userRepo, profileRepo);

  const createCampaignUpdateUseCase = new CreateCampaignUpdateUseCase(campaignUpdateRepo, campaignRepo);
  const getCampaignUpdatesUseCase = new GetCampaignUpdatesUseCase(campaignUpdateRepo, campaignRepo);
  const updateCampaignUpdateUseCase = new UpdateCampaignUpdateUseCase(campaignUpdateRepo);
  const deleteCampaignUpdateUseCase = new DeleteCampaignUpdateUseCase(campaignUpdateRepo);
  const pinCampaignUpdateUseCase = new PinCampaignUpdateUseCase(campaignUpdateRepo);

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

  const inviteCollaboratorUseCase = new InviteCollaboratorUseCase(campaignRepo, userRepo, collaborationRepo);
  const removeCollaboratorUseCase = new RemoveCollaboratorUseCase(campaignRepo, collaborationRepo);
  const listCampaignCollaboratorsUseCase = new ListCampaignCollaboratorsUseCase(campaignRepo, collaborationRepo);
  const listMyCollaborationInvitationsUseCase = new ListMyCollaborationInvitationsUseCase(collaborationRepo, campaignRepo);
  const respondToCollaborationUseCase = new RespondToCollaborationUseCase(collaborationRepo);

  const getMySubscriptionUseCase = new GetMySubscriptionUseCase(subscriptionRepo);
  const subscribeUseCase = new SubscribeUseCase(subscriptionRepo);
  const upgradeSubscriptionUseCase = new UpgradeSubscriptionUseCase(subscriptionRepo);
  const cancelSubscriptionUseCase = new CancelSubscriptionUseCase(subscriptionRepo);

  const listPaymentProvidersUseCase = new ListPaymentProvidersUseCase(paymentProviderRepo);
  const getEnabledPaymentProvidersUseCase = new GetEnabledPaymentProvidersUseCase(paymentProviderRepo);
  const togglePaymentProviderUseCase = new TogglePaymentProviderUseCase(paymentProviderRepo);

  const getDisputeUseCase = new GetDisputeUseCase(disputeRepo, campaignRepo, userRepo);
  const resolveDisputeUseCase = new ResolveDisputeUseCase(disputeRepo);
  const listReportsUseCase = new ListReportsUseCase(adminReportRepo, campaignRepo);
  const reviewReportUseCase = new ReviewReportUseCase(adminReportRepo);
  const reviewCampaignUseCase = new ReviewCampaignUseCase(campaignRepo);
  const listUsersUseCase = new ListUsersUseCase(adminUserRepo);
  const getPlatformOverviewUseCase = new GetPlatformOverviewUseCase(analyticsRepo);

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
    donateToCampaignUseCase
  );
  const walletController = new WalletController(walletRepo, walletTxRepo);
  const profileController = new ProfileController(
    getProfileUseCase,
    updateProfileUseCase,
    getPublicUserProfileUseCase
  );
  const campaignUpdateController = new CampaignUpdateController(
    createCampaignUpdateUseCase,
    getCampaignUpdatesUseCase,
    updateCampaignUpdateUseCase,
    deleteCampaignUpdateUseCase,
    pinCampaignUpdateUseCase
  );
  const shareReportController = new ShareReportController(shareCampaignUseCase, reportCampaignUseCase);
  const donationController = new DonationController(
    listRecentDonationsUseCase,
    listMyDonationsUseCase,
    getDonationUseCase,
    listCampaignDonationsUseCase
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
    rejectKYCUseCase
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
    cancelSubscriptionUseCase
  );
  const paymentProviderController = new PaymentProviderController(
    listPaymentProvidersUseCase,
    getEnabledPaymentProvidersUseCase,
    togglePaymentProviderUseCase
  );
  const disputeController = new DisputeController(getDisputeUseCase, resolveDisputeUseCase);
  const adminReportController = new AdminReportController(listReportsUseCase, reviewReportUseCase);
  const campaignModerationController = new CampaignModerationController(reviewCampaignUseCase);
  const adminUserController = new AdminUserController(listUsersUseCase);
  const analyticsController = new AnalyticsController(getPlatformOverviewUseCase);

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
  app.use(express.json({ limit: '200kb' }));
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const api = express.Router();
  api.use(apiRateLimiter);

  api.use('/auth', createAuthRoutes(authController, authMiddleware));

  // The /campaigns resource is composed from sibling routers (Express
  // dispatches across routers sharing a prefix by method + path).
  api.use('/campaigns', createCampaignRoutes(campaignController, authMiddleware));
  api.use('/campaigns', createCampaignUpdateRoutes(campaignUpdateController, authMiddleware));
  api.use('/campaigns', createShareReportRoutes(shareReportController, authMiddleware));
  api.use('/campaigns', createCampaignDonationRoutes(donationController));
  api.use(
    '/campaigns',
    createCampaignCollaboratorRoutes(collaborationController, authMiddleware, optionalAuthMiddleware)
  );
  api.use('/campaigns', createCampaignModerationRoutes(campaignModerationController, authMiddleware, requireAdmin));

  api.use('/wallets', createWalletRoutes(walletController, authMiddleware));
  api.use('/profile', createProfileRoutes(profileController, authMiddleware));
  api.use('/users', createUserRoutes(profileController));
  api.use('/users', createAdminUserRoutes(adminUserController, authMiddleware, requireAdmin));
  api.use('/donations', createDonationRoutes(donationController, authMiddleware));
  api.use('/leaderboard', createLeaderboardRoutes(leaderboardController));
  api.use('/notifications', createNotificationRoutes(notificationController, authMiddleware));
  api.use('/organizations', createOrganizationRoutes(organizationController));
  api.use('/refunds', createRefundRoutes(refundController, authMiddleware));
  api.use('/kyc', createKYCRoutes(kycController, authMiddleware, requireAdmin));
  api.use('/collaborations', createCollaborationRoutes(collaborationController, authMiddleware));
  api.use('/subscriptions', createSubscriptionRoutes(subscriptionController, authMiddleware));
  api.use('/payment-providers', createPaymentProviderRoutes(paymentProviderController, authMiddleware, requireAdmin));
  api.use('/disputes', createDisputeRoutes(disputeController, authMiddleware, requireAdmin));
  api.use('/reports', createAdminReportRoutes(adminReportController, authMiddleware, requireAdmin));
  api.use('/analytics', createAnalyticsRoutes(analyticsController, authMiddleware));

  app.use('/api/v1', api);
  app.use(errorHandler);

  return app;
}
