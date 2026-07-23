import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './infrastructure/config/index.js';
import { connectDatabase } from './infrastructure/database/connection.js';

// Outbound adapters (repositories)
import { MongoCampaignRepository } from './infrastructure/adapters/outbound/persistence/MongoCampaignRepository.js';
import { MongoUserRepository } from './infrastructure/adapters/outbound/persistence/MongoUserRepository.js';
import { MongoDonationRepository } from './infrastructure/adapters/outbound/persistence/MongoDonationRepository.js';
import { MongoWalletRepository } from './infrastructure/adapters/outbound/persistence/MongoWalletRepository.js';

// Application services & use cases
import { AuthTokenService } from './application/services/AuthTokenService.js';
import { CreateCampaignUseCase } from './application/use-cases/CreateCampaignUseCase.js';
import { GetCampaignUseCase } from './application/use-cases/GetCampaignUseCase.js';
import { DonateToCampaignUseCase } from './application/use-cases/DonateToCampaignUseCase.js';
import { RegisterUserUseCase } from './application/use-cases/RegisterUserUseCase.js';
import { LoginUserUseCase } from './application/use-cases/LoginUserUseCase.js';

// Inbound adapters (controllers, middleware, routes)
import { CampaignController } from './infrastructure/adapters/inbound/http/controllers/CampaignController.js';
import { AuthController } from './infrastructure/adapters/inbound/http/controllers/AuthController.js';
import { WalletController } from './infrastructure/adapters/inbound/http/controllers/WalletController.js';
import { createAuthMiddleware } from './infrastructure/adapters/inbound/middleware/authMiddleware.js';
import { errorHandler } from './infrastructure/adapters/inbound/middleware/errorHandler.js';
import { createApiRouter } from './infrastructure/adapters/inbound/http/routes/index.js';

async function bootstrap(): Promise<void> {
  // Connect to database
  await connectDatabase(config.mongodbUri);

  // --- Wire up dependencies (manual DI) ---

  // Repositories
  const campaignRepo = new MongoCampaignRepository();
  const userRepo = new MongoUserRepository();
  const donationRepo = new MongoDonationRepository();
  const walletRepo = new MongoWalletRepository();

  // Application services
  const tokenService = new AuthTokenService(
    config.jwtSecret,
    config.jwtRefreshSecret
  );

  // Use cases
  const createCampaignUseCase = new CreateCampaignUseCase(
    campaignRepo,
    userRepo
  );
  const getCampaignUseCase = new GetCampaignUseCase(campaignRepo);
  const donateToCampaignUseCase = new DonateToCampaignUseCase(
    campaignRepo,
    donationRepo,
    walletRepo
  );
  const registerUserUseCase = new RegisterUserUseCase(
    userRepo,
    walletRepo,
    tokenService
  );
  const loginUserUseCase = new LoginUserUseCase(userRepo, tokenService);

  // Controllers
  const campaignController = new CampaignController(
    createCampaignUseCase,
    getCampaignUseCase,
    donateToCampaignUseCase
  );
  const authController = new AuthController(
    registerUserUseCase,
    loginUserUseCase,
    tokenService
  );
  const walletController = new WalletController(walletRepo);

  // Middleware
  const authMiddleware = createAuthMiddleware(tokenService);

  // --- Express app setup ---
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  const apiRouter = createApiRouter({
    authController,
    campaignController,
    walletController,
    authMiddleware,
  });
  app.use('/api/v1', apiRouter);

  // Global error handler (must be last)
  app.use(errorHandler);

  // Start server
  app.listen(config.port, () => {
    console.log(
      `Ubuntu Fund API running on port ${config.port} [${config.nodeEnv}]`
    );
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
