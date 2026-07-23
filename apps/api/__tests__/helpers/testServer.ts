import express from 'express';
import { createAuthMiddleware } from '../../src/infrastructure/adapters/inbound/middleware/authMiddleware.js';
import { authRateLimiter, apiRateLimiter, donationRateLimiter, aiRateLimiter } from '../../src/infrastructure/adapters/inbound/middleware/rateLimiter.js';
import { errorHandler } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';
import { createApiRouter } from '../../src/infrastructure/adapters/inbound/http/routes/index.js';
import { MPesaWebhookController } from '../../src/infrastructure/adapters/inbound/http/controllers/MPesaWebhookController.js';
import { AuthTokenService } from '../../src/application/services/AuthTokenService.js';
import { EmailService } from '../../src/application/services/EmailService.js';
import { PaymentGatewayFactory } from '../../src/application/services/PaymentGatewayFactory.js';
import { AuditService } from '../../src/application/services/AuditService.js';
import { NotificationDispatcher } from '../../src/application/services/NotificationDispatcher.js';
import { EventBus } from '../../src/application/services/EventBus.js';
import { InMemoryCacheService } from '../../src/infrastructure/cache/index.js';

// Repositories
import { MongoCampaignRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.js';
import { MongoUserRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserRepository.js';
import { MongoDonationRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoDonationRepository.js';
import { MongoWalletRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoWalletRepository.js';
import { MongoCommentRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCommentRepository.js';
import { MongoDisputeRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoDisputeRepository.js';
import { MongoNotificationRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoNotificationRepository.js';
import { MongoEscrowRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoEscrowRepository.js';
import { MongoMilestoneRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoMilestoneRepository.js';
import { MongoReportRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoReportRepository.js';
import { MongoRefundRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoRefundRepository.js';
import { MongoVerificationRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoVerificationRepository.js';
import { MongoLikeRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoLikeRepository.js';
import { MongoFollowRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoFollowRepository.js';
import { MongoShareRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoShareRepository.js';
import { MongoAuditLogRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAuditLogRepository.js';
import { MongoLeaderboardRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.js';
import { MongoSubscriptionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionRepository.js';
import { MongoCollaborationRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCollaborationRepository.js';
import { MongoCampaignLimitRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignLimitRepository.js';
import { MongoCampaignMediaRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignMediaRepository.js';
import { MongoPaymentProviderRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoPaymentProviderRepository.js';
import { MongoWalletTransactionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoWalletTransactionRepository.js';

// Use cases
import { RegisterUserUseCase } from '../../src/application/use-cases/RegisterUserUseCase.js';
import { LoginUserUseCase } from '../../src/application/use-cases/LoginUserUseCase.js';
import { CreateCampaignUseCase } from '../../src/application/use-cases/CreateCampaignUseCase.js';
import { GetCampaignUseCase } from '../../src/application/use-cases/GetCampaignUseCase.js';
import { DonateToCampaignUseCase } from '../../src/application/use-cases/DonateToCampaignUseCase.js';
import { SearchCampaignsUseCase } from '../../src/application/use-cases/SearchCampaignsUseCase.js';
import { ReviewCampaignUseCase } from '../../src/application/use-cases/ReviewCampaignUseCase.js';
import { UpdateCampaignUseCase } from '../../src/application/use-cases/UpdateCampaignUseCase.js';
import { DeleteCampaignUseCase } from '../../src/application/use-cases/DeleteCampaignUseCase.js';
import { ApproveCampaignUseCase } from '../../src/application/use-cases/ApproveCampaignUseCase.js';
import { AddCommentUseCase } from '../../src/application/use-cases/AddCommentUseCase.js';
import { GetCommentsUseCase } from '../../src/application/use-cases/GetCommentsUseCase.js';
import { LikeCampaignUseCase } from '../../src/application/use-cases/LikeCampaignUseCase.js';
import { FollowUserUseCase } from '../../src/application/use-cases/FollowUserUseCase.js';
import { ShareCampaignUseCase } from '../../src/application/use-cases/ShareCampaignUseCase.js';
import { CreateDisputeUseCase } from '../../src/application/use-cases/CreateDisputeUseCase.js';
import { ResolveDisputeUseCase } from '../../src/application/use-cases/ResolveDisputeUseCase.js';
import { CreateReportUseCase } from '../../src/application/use-cases/CreateReportUseCase.js';
import { ReviewReportUseCase } from '../../src/application/use-cases/ReviewReportUseCase.js';
import { RequestRefundUseCase } from '../../src/application/use-cases/RequestRefundUseCase.js';
import { ProcessCampaignRefundsUseCase } from '../../src/application/use-cases/ProcessCampaignRefundsUseCase.js';
import { SubmitVerificationUseCase } from '../../src/application/use-cases/SubmitVerificationUseCase.js';
import { ApproveVerificationUseCase } from '../../src/application/use-cases/ApproveVerificationUseCase.js';
import { RejectVerificationUseCase } from '../../src/application/use-cases/RejectVerificationUseCase.js';
import { CreateEscrowUseCase } from '../../src/application/use-cases/CreateEscrowUseCase.js';
import { ReleaseMilestoneUseCase } from '../../src/application/use-cases/ReleaseMilestoneUseCase.js';
import { GetNotificationsUseCase } from '../../src/application/use-cases/GetNotificationsUseCase.js';
import { CreateNotificationUseCase } from '../../src/application/use-cases/CreateNotificationUseCase.js';
import { GetLeaderboardUseCase } from '../../src/application/use-cases/GetLeaderboardUseCase.js';
import { UpdateLeaderboardUseCase } from '../../src/application/use-cases/UpdateLeaderboardUseCase.js';
import { GetAnalyticsUseCase } from '../../src/application/use-cases/GetAnalyticsUseCase.js';
import { InviteCollaboratorUseCase } from '../../src/application/use-cases/InviteCollaboratorUseCase.js';
import { RespondToCollaborationUseCase } from '../../src/application/use-cases/RespondToCollaborationUseCase.js';
import { RemoveCollaboratorUseCase } from '../../src/application/use-cases/RemoveCollaboratorUseCase.js';
import { GetCollaborationsUseCase } from '../../src/application/use-cases/GetCollaborationsUseCase.js';
import { GetSubscriptionUseCase } from '../../src/application/use-cases/GetSubscriptionUseCase.js';
import { SubscribeUseCase } from '../../src/application/use-cases/SubscribeUseCase.js';
import { CancelSubscriptionUseCase } from '../../src/application/use-cases/CancelSubscriptionUseCase.js';
import { CheckSubscriptionLimitsUseCase } from '../../src/application/use-cases/CheckSubscriptionLimitsUseCase.js';
import { ManageSubscriptionPlansUseCase } from '../../src/application/use-cases/ManageSubscriptionPlansUseCase.js';
import { ListPaymentProvidersUseCase } from '../../src/application/use-cases/ListPaymentProvidersUseCase.js';
import { GetEnabledPaymentProvidersUseCase } from '../../src/application/use-cases/GetEnabledPaymentProvidersUseCase.js';
import { TogglePaymentProviderUseCase } from '../../src/application/use-cases/TogglePaymentProviderUseCase.js';
import { UpdatePaymentProviderConfigUseCase } from '../../src/application/use-cases/UpdatePaymentProviderConfigUseCase.js';
import { SeedPaymentProvidersUseCase } from '../../src/application/use-cases/SeedPaymentProvidersUseCase.js';
import { ManageTestimonialsUseCase } from '../../src/application/use-cases/ManageTestimonialsUseCase.js';
import { RbacUseCase } from '../../src/application/use-cases/RbacUseCase.js';
import { SubscribeNewsletterUseCase } from '../../src/application/use-cases/SubscribeNewsletterUseCase.js';
import { SubmitContactUseCase } from '../../src/application/use-cases/SubmitContactUseCase.js';
import { DepositUseCase } from '../../src/application/use-cases/DepositUseCase.js';
import { WithdrawUseCase } from '../../src/application/use-cases/WithdrawUseCase.js';
import { TransferUseCase } from '../../src/application/use-cases/TransferUseCase.js';

// Controllers
import { AuthController } from '../../src/infrastructure/adapters/inbound/http/controllers/AuthController.js';
import { CampaignController } from '../../src/infrastructure/adapters/inbound/http/controllers/CampaignController.js';
import { WalletController } from '../../src/infrastructure/adapters/inbound/http/controllers/WalletController.js';
import { CommentController } from '../../src/infrastructure/adapters/inbound/http/controllers/CommentController.js';
import { DisputeController } from '../../src/infrastructure/adapters/inbound/http/controllers/DisputeController.js';
import { NotificationController } from '../../src/infrastructure/adapters/inbound/http/controllers/NotificationController.js';
import { RefundController } from '../../src/infrastructure/adapters/inbound/http/controllers/RefundController.js';
import { VerificationController } from '../../src/infrastructure/adapters/inbound/http/controllers/VerificationController.js';
import { SocialController } from '../../src/infrastructure/adapters/inbound/http/controllers/SocialController.js';
import { EscrowController } from '../../src/infrastructure/adapters/inbound/http/controllers/EscrowController.js';
import { LeaderboardController } from '../../src/infrastructure/adapters/inbound/http/controllers/LeaderboardController.js';
import { ReportController } from '../../src/infrastructure/adapters/inbound/http/controllers/ReportController.js';
import { AnalyticsController } from '../../src/infrastructure/adapters/inbound/http/controllers/AnalyticsController.js';
import { ProfileController } from '../../src/infrastructure/adapters/inbound/http/controllers/ProfileController.js';
import { SubscriptionController } from '../../src/infrastructure/adapters/inbound/http/controllers/SubscriptionController.js';
import { RbacController } from '../../src/infrastructure/adapters/inbound/http/controllers/RbacController.js';
import { NewsletterController } from '../../src/infrastructure/adapters/inbound/http/controllers/NewsletterController.js';
import { ContactController } from '../../src/infrastructure/adapters/inbound/http/controllers/ContactController.js';
import { CollaborationController } from '../../src/infrastructure/adapters/inbound/http/controllers/CollaborationController.js';
import { OrganizationController } from '../../src/infrastructure/adapters/inbound/http/controllers/OrganizationController.js';
import { DonationController } from '../../src/infrastructure/adapters/inbound/http/controllers/DonationController.js';
import { UserController } from '../../src/infrastructure/adapters/inbound/http/controllers/UserController.js';
import { TestimonialController } from '../../src/infrastructure/adapters/inbound/http/controllers/TestimonialController.js';
import { PaymentProviderController } from '../../src/infrastructure/adapters/inbound/http/controllers/PaymentProviderController.js';
import { AiWritingController } from '../../src/infrastructure/adapters/inbound/http/controllers/AiWritingController.js';
import { StripeWebhookController } from '../../src/infrastructure/adapters/inbound/http/controllers/StripeWebhookController.js';
import { createStripeWebhookRoutes } from '../../src/infrastructure/adapters/inbound/http/routes/stripeWebhookRoutes.js';
import { AiWritingService } from '../../src/application/services/AiWritingService.js';
import { MongoAiUsageRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAiUsageRepository.js';

class MockEmailService extends EmailService {
  override async sendInvitation() { return { success: true }; }
  override async sendPasswordReset() { return { success: true }; }
  override async sendDonationReceipt() { return { success: true }; }
  override async sendCampaignFunded() { return { success: true }; }
  override async sendMilestoneReached() { return { success: true }; }
  override async sendDisputeOpened() { return { success: true }; }
  override async sendDisputeResolved() { return { success: true }; }
  override async sendVerificationApproved() { return { success: true }; }
  override async sendVerificationRejected() { return { success: true }; }
  override async sendWelcome() { return { success: true }; }
  override async sendCampaignApproved() { return { success: true }; }
  override async sendCampaignRejected() { return { success: true }; }
  override async sendCampaignBlocked() { return { success: true }; }
}

export async function createTestApp() {
  const app = express();

  // M-Pesa test env vars
  process.env.MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'test_key';
  process.env.MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'test_secret';
  process.env.MPESA_PASSKEY = process.env.MPESA_PASSKEY || 'test_passkey';
  process.env.MPESA_SHORT_CODE = process.env.MPESA_SHORT_CODE || '174379';
  process.env.MPESA_ENVIRONMENT = process.env.MPESA_ENVIRONMENT || 'sandbox';

  app.use(express.json({ limit: '10kb' }));

  // Repositories
  const campaignRepo = new MongoCampaignRepository();
  const userRepo = new MongoUserRepository();
  const donationRepo = new MongoDonationRepository();
  const walletRepo = new MongoWalletRepository();
  const commentRepo = new MongoCommentRepository();
  const disputeRepo = new MongoDisputeRepository();
  const notificationRepo = new MongoNotificationRepository();
  const escrowRepo = new MongoEscrowRepository();
  const milestoneRepo = new MongoMilestoneRepository();
  const reportRepo = new MongoReportRepository();
  const refundRepo = new MongoRefundRepository();
  const verificationRepo = new MongoVerificationRepository();
  const likeRepo = new MongoLikeRepository();
  const followRepo = new MongoFollowRepository();
  const shareRepo = new MongoShareRepository();
  const auditLogRepo = new MongoAuditLogRepository();
  const leaderboardRepo = new MongoLeaderboardRepository();
  const subscriptionRepo = new MongoSubscriptionRepository();
  const collaborationRepo = new MongoCollaborationRepository();
  const campaignLimitRepo = new MongoCampaignLimitRepository();
  const campaignMediaRepo = new MongoCampaignMediaRepository();
  const paymentProviderRepo = new MongoPaymentProviderRepository();
  const walletTransactionRepo = new MongoWalletTransactionRepository();

  // Services
  const tokenService = new AuthTokenService('test-jwt-secret', 'test-refresh-secret');
  const auditService = new AuditService(auditLogRepo);
  const notificationDispatcher = new NotificationDispatcher(notificationRepo);
  const emailService = new MockEmailService();
  const eventBus = new EventBus();
  const cacheService = new InMemoryCacheService();
  const paymentGatewayFactory = new PaymentGatewayFactory();

  // Use Cases: Auth & Campaign
  const registerUserUseCase = new RegisterUserUseCase(userRepo, walletRepo, tokenService, eventBus);
  const loginUserUseCase = new LoginUserUseCase(userRepo, tokenService);
  const createCampaignUseCase = new CreateCampaignUseCase(campaignRepo, userRepo, subscriptionRepo, campaignLimitRepo);
  const getCampaignUseCase = new GetCampaignUseCase(campaignRepo, donationRepo, userRepo);
  const donateToCampaignUseCase = new DonateToCampaignUseCase(campaignRepo, donationRepo, walletRepo, userRepo, paymentProviderRepo, paymentGatewayFactory, emailService, walletTransactionRepo, eventBus);
  const searchCampaignsUseCase = new SearchCampaignsUseCase(campaignRepo);
  const reviewCampaignUseCase = new ReviewCampaignUseCase(campaignRepo, userRepo, emailService, eventBus);
  const updateCampaignUseCase = new UpdateCampaignUseCase(campaignRepo, userRepo);
  const deleteCampaignUseCase = new DeleteCampaignUseCase(campaignRepo, userRepo, campaignMediaRepo);
  const approveCampaignUseCase = new ApproveCampaignUseCase(campaignRepo, userRepo);

  // Use Cases: Social
  const addCommentUseCase = new AddCommentUseCase(commentRepo, campaignRepo);
  const getCommentsUseCase = new GetCommentsUseCase(commentRepo);
  const likeCampaignUseCase = new LikeCampaignUseCase(likeRepo, campaignRepo);
  const followUserUseCase = new FollowUserUseCase(followRepo, userRepo);
  const shareCampaignUseCase = new ShareCampaignUseCase(shareRepo);

  // Use Cases: Disputes & Reports
  const createDisputeUseCase = new CreateDisputeUseCase(disputeRepo, campaignRepo, userRepo, emailService);
  const resolveDisputeUseCase = new ResolveDisputeUseCase(disputeRepo, campaignRepo, userRepo, emailService);
  const createReportUseCase = new CreateReportUseCase(reportRepo, campaignRepo);
  const reviewReportUseCase = new ReviewReportUseCase(reportRepo, campaignRepo, userRepo);

  // Use Cases: Refunds
  const requestRefundUseCase = new RequestRefundUseCase(refundRepo, donationRepo, walletRepo);
  const processCampaignRefundsUseCase = new ProcessCampaignRefundsUseCase(refundRepo, donationRepo, walletRepo, campaignRepo);

  // Use Cases: Verification
  const submitVerificationUseCase = new SubmitVerificationUseCase(verificationRepo, userRepo);
  const approveVerificationUseCase = new ApproveVerificationUseCase(verificationRepo, userRepo, emailService, eventBus);
  const rejectVerificationUseCase = new RejectVerificationUseCase(verificationRepo, userRepo, emailService);

  // Use Cases: Escrow & Milestones
  const createEscrowUseCase = new CreateEscrowUseCase(escrowRepo, campaignRepo);
  const releaseMilestoneUseCase = new ReleaseMilestoneUseCase(milestoneRepo, escrowRepo, walletRepo, campaignRepo, userRepo, emailService, eventBus);

  // Use Cases: Notifications
  const getNotificationsUseCase = new GetNotificationsUseCase(notificationRepo);
  const createNotificationUseCase = new CreateNotificationUseCase(notificationRepo);

  // Use Cases: Leaderboard & Analytics
  const getLeaderboardUseCase = new GetLeaderboardUseCase(leaderboardRepo);
  const updateLeaderboardUseCase = new UpdateLeaderboardUseCase(leaderboardRepo);
  const getAnalyticsUseCase = new GetAnalyticsUseCase(campaignRepo, donationRepo, userRepo, disputeRepo);

  // Use Cases: Collaboration
  const inviteCollaboratorUseCase = new InviteCollaboratorUseCase(collaborationRepo, campaignRepo, userRepo, subscriptionRepo);
  const respondToCollaborationUseCase = new RespondToCollaborationUseCase(collaborationRepo);
  const removeCollaboratorUseCase = new RemoveCollaboratorUseCase(collaborationRepo, campaignRepo);
  const getCollaborationsUseCase = new GetCollaborationsUseCase(collaborationRepo, campaignRepo);

  // Use Cases: Subscription
  const getSubscriptionUseCase = new GetSubscriptionUseCase(subscriptionRepo);
  const subscribeUseCase = new SubscribeUseCase(subscriptionRepo);
  const cancelSubscriptionUseCase = new CancelSubscriptionUseCase(subscriptionRepo);
  const checkSubscriptionLimitsUseCase = new CheckSubscriptionLimitsUseCase(subscriptionRepo, campaignRepo);
  const listPaymentProvidersUseCase = new ListPaymentProvidersUseCase(paymentProviderRepo);
  const getEnabledPaymentProvidersUseCase = new GetEnabledPaymentProvidersUseCase(paymentProviderRepo);
  const togglePaymentProviderUseCase = new TogglePaymentProviderUseCase(paymentProviderRepo);
  const updatePaymentProviderConfigUseCase = new UpdatePaymentProviderConfigUseCase(paymentProviderRepo);
  const seedPaymentProvidersUseCase = new SeedPaymentProvidersUseCase();
  const managePlansUseCase = new ManageSubscriptionPlansUseCase();

  // Event Bus Subscribers
  eventBus.subscribe('donation.completed', async (event) => {
    await createNotificationUseCase.execute({
      userId: (event.payload as { creatorId: string }).creatorId,
      type: 'donation_received',
      title: 'New donation received',
      message: `${(event.payload as { donorName: string }).donorName} donated ${(event.payload as { amount: number }).amount} ${(event.payload as { currency: string }).currency}`,
      referenceType: 'campaign',
      referenceId: (event.payload as { campaignId: string }).campaignId,
    });
  });

  eventBus.subscribe('campaign.funded', async (event) => {
    const creator = await userRepo.findById((event.payload as { creatorId: string }).creatorId);
    if (creator) {
      await emailService.sendCampaignFunded({
        to: creator.email.toString(),
        name: creator.name,
        campaignTitle: (event.payload as { campaignTitle: string }).campaignTitle,
        goalAmount: (event.payload as { goalAmount: number }).goalAmount,
        raisedAmount: (event.payload as { raisedAmount: number }).raisedAmount,
        currency: (event.payload as { currency: string }).currency,
      });
    }
  });

  eventBus.subscribe('campaign.approved', async (event) => {
    const creator = await userRepo.findById((event.payload as { creatorId: string }).creatorId);
    if (creator) {
      await emailService.sendCampaignApproved({
        to: creator.email.toString(),
        name: creator.name,
        campaignTitle: (event.payload as { campaignTitle: string }).campaignTitle,
      });
    }
  });

  eventBus.subscribe('user.registered', async (event) => {
    await createNotificationUseCase.execute({
      userId: (event.payload as { userId: string }).userId,
      type: 'general',
      title: 'Welcome to UbuntuFund',
      message: 'Start by creating your first campaign or exploring causes to support.',
    });
  });

  eventBus.subscribe('milestone.released', async (event) => {
    const creator = await userRepo.findById((event.payload as { creatorId: string }).creatorId);
    if (creator) {
      await emailService.sendMilestoneReached({
        to: creator.email.toString(),
        name: creator.name,
        campaignTitle: (event.payload as { campaignTitle: string }).campaignTitle,
        milestoneTitle: (event.payload as { milestoneTitle: string }).milestoneTitle,
        milestoneAmount: (event.payload as { milestoneAmount: number }).milestoneAmount,
        currency: (event.payload as { currency: string }).currency,
      });
    }
  });

  // Controllers
  const authController = new AuthController(registerUserUseCase, loginUserUseCase, tokenService);
  const campaignController = new CampaignController(createCampaignUseCase, getCampaignUseCase, donateToCampaignUseCase, searchCampaignsUseCase, reviewCampaignUseCase, updateCampaignUseCase, deleteCampaignUseCase, approveCampaignUseCase);
  const depositUseCase = new DepositUseCase(walletRepo, walletTransactionRepo);
  const withdrawUseCase = new WithdrawUseCase(walletRepo, walletTransactionRepo, paymentGatewayFactory);
  const transferUseCase = new TransferUseCase(walletRepo, walletTransactionRepo);
  const walletController = new WalletController(walletRepo, walletTransactionRepo, depositUseCase, withdrawUseCase, transferUseCase);
  const commentController = new CommentController(addCommentUseCase, getCommentsUseCase, commentRepo);
  const disputeController = new DisputeController(createDisputeUseCase, resolveDisputeUseCase, disputeRepo);
  const notificationController = new NotificationController(getNotificationsUseCase);
  const refundController = new RefundController(requestRefundUseCase, refundRepo);
  const verificationController = new VerificationController(submitVerificationUseCase, approveVerificationUseCase, rejectVerificationUseCase, verificationRepo);
  const socialController = new SocialController(likeCampaignUseCase, followUserUseCase, shareCampaignUseCase);
  const escrowController = new EscrowController(createEscrowUseCase, releaseMilestoneUseCase, escrowRepo);
  const leaderboardController = new LeaderboardController(getLeaderboardUseCase);
  const reportController = new ReportController(createReportUseCase, reviewReportUseCase);
  const analyticsController = new AnalyticsController(getAnalyticsUseCase);
  const profileController = new ProfileController(userRepo);
  const subscriptionController = new SubscriptionController(
    getSubscriptionUseCase,
    subscribeUseCase,
    cancelSubscriptionUseCase,
    checkSubscriptionLimitsUseCase,
    managePlansUseCase
  );

  const collaborationController = new CollaborationController(
    inviteCollaboratorUseCase,
    respondToCollaborationUseCase,
    removeCollaboratorUseCase,
    getCollaborationsUseCase
  );
  const organizationController = new OrganizationController(userRepo, campaignRepo);
  const donationController = new DonationController(donationRepo);
  const userController = new UserController(userRepo);

  // Use Cases: Testimonials
  const manageTestimonialsUseCase = new ManageTestimonialsUseCase();
  const testimonialController = new TestimonialController(manageTestimonialsUseCase);
  const paymentProviderController = new PaymentProviderController(
    listPaymentProvidersUseCase,
    getEnabledPaymentProvidersUseCase,
    togglePaymentProviderUseCase,
    updatePaymentProviderConfigUseCase,
    paymentProviderRepo
  );

  // Use Cases: Newsletter & Contact
  const subscribeNewsletterUseCase = new SubscribeNewsletterUseCase();
  const submitContactUseCase = new SubmitContactUseCase();

  // RBAC
  const rbacUseCase = new RbacUseCase();
  const newsletterController = new NewsletterController(subscribeNewsletterUseCase);
  const contactController = new ContactController(submitContactUseCase);
  const rbacController = new RbacController(rbacUseCase, registerUserUseCase, emailService);

  // AI Writing
  const aiUsageRepo = new MongoAiUsageRepository();
  const aiWritingService = new AiWritingService();
  const aiWritingController = new AiWritingController(aiWritingService, aiUsageRepo);

  // Reset rate limiters for tests
  (authRateLimiter as unknown as { reset: () => void }).reset();
  (apiRateLimiter as unknown as { reset: () => void }).reset();
  (donationRateLimiter as unknown as { reset: () => void }).reset();
  (aiRateLimiter as unknown as { reset: () => void }).reset();

  // Middleware
  const authMiddleware = createAuthMiddleware(tokenService);

  const apiRouter = createApiRouter({
    authController,
    campaignController,
    walletController,
    commentController,
    disputeController,
    notificationController,
    refundController,
    verificationController,
    socialController,
    escrowController,
    leaderboardController,
    reportController,
    analyticsController,
    profileController,
    subscriptionController,
    rbacController,
    newsletterController,
    contactController,
    collaborationController,
    organizationController,
    donationController,
    userController,
    testimonialController,
    paymentProviderController,
    aiWritingController,
    sseController: { subscribe: () => {}, getCampaignUpdates: () => {} } as any,
    pushNotificationController: { register: () => {}, unregister: () => {}, sendToUser: () => {}, broadcast: () => {} } as any,
    kycController: { submitIdentity: () => {}, submitBusiness: () => {}, submitAddress: () => {}, getStatus: () => {}, review: () => {}, listPending: () => {}, getById: () => {}, requestAdditional: () => {} } as any,
    shareController: { getShare: () => {}, recordShare: () => {} } as any,
    ogController: { getCampaignOG: () => {} } as any,
    campaignUpdateController: { getForCampaign: () => {}, create: () => {}, update: () => {}, delete: () => {}, pin: () => {} } as any,
    authMiddleware,
  });

  // M-Pesa webhook (public — no auth)
  const mpesaWebhookController = new MPesaWebhookController();
  app.post('/webhooks/mpesa', mpesaWebhookController.handleWebhook);

  app.use('/api/v1', apiRouter);
  app.use(errorHandler);

  return { app, tokenService };
}
