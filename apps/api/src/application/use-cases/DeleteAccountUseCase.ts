import type { AccountErasurePort } from '../../domain/ports/outbound/AccountErasurePort.js';
import type {
  AccountClosureBlocker,
  AccountClosureCheck,
  AccountClosureCheckPort,
} from '../../domain/ports/outbound/AccountClosureCheckPort.js';
import type { StepUpAuthPort } from '../../domain/ports/outbound/StepUpAuthPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { AuthTokenService } from '../services/AuthTokenService.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface AccountClosureCredentials {
  password?: string;
  code?: string;
}

export interface AccountClosurePreview extends AccountClosureCheck {
  canClose: boolean;
  /** Why closure is blocked, in the same words DELETE /profile returns. */
  message?: string;
}

function formatAmount(amount: number, currency?: string): string {
  const value = Math.abs(amount) >= 0.01 ? amount.toFixed(2) : String(amount);
  return `${currency ?? 'GHS'} ${value}`;
}

function describeBlocker(blocker: AccountClosureBlocker): string {
  const amount = formatAmount(blocker.amount ?? 0, blocker.currency);
  switch (blocker.kind) {
    case 'wallet_balance': return `${amount} in your Ujimora wallet`;
    case 'campaign_balance': return `${amount} raised by your campaigns that has not been paid out`;
    case 'beneficiary_balance': return `${amount} held for your campaign beneficiaries`;
    case 'creator_balance': return `${amount} in creator tips not yet withdrawn`;
    case 'affiliate_balance': return `${amount} in affiliate earnings not yet paid out`;
    case 'pending_payout': {
      const count = blocker.count ?? 1;
      return `${count} payout${count === 1 ? '' : 's'} still being processed`;
    }
  }
}

export function describeClosureBlockers(blockers: AccountClosureBlocker[]): string {
  return `Your account can’t be closed yet. First withdraw or resolve: ${blockers.map(describeBlocker).join('; ')}. `
    + 'If you can’t, contact support@ujimora.com and we’ll help you close your account.';
}

function describeStaffBlocker(blocker: AccountClosureBlocker): string {
  const amount = formatAmount(blocker.amount ?? 0, blocker.currency);
  switch (blocker.kind) {
    case 'wallet_balance': return `${amount} in the member's Ujimora wallet`;
    case 'campaign_balance': return `${amount} raised by their campaigns that has not been paid out`;
    case 'beneficiary_balance': return `${amount} held for their campaign beneficiaries`;
    case 'creator_balance': return `${amount} in creator tips not yet withdrawn`;
    case 'affiliate_balance': return `${amount} in affiliate earnings not yet paid out`;
    case 'pending_payout': {
      const count = blocker.count ?? 1;
      return `${count} payout${count === 1 ? '' : 's'} still being processed`;
    }
  }
}

/** The same blockers, worded for staff closing an account on the holder's behalf. */
export function describeStaffClosureBlockers(blockers: AccountClosureBlocker[]): string {
  return `This account can’t be closed yet. Outstanding: ${blockers.map(describeStaffBlocker).join('; ')}. `
    + 'Pay out, refund or otherwise resolve these with finance first, then close the account. Nothing was changed.';
}

export class DeleteAccountUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly tokenService: AuthTokenService,
    private readonly erasure?: AccountErasurePort,
    private readonly closureCheck?: AccountClosureCheckPort,
    private readonly stepUp?: StepUpAuthPort
  ) {}

  /** What closing the account would strand or end, so clients can explain it before asking. */
  async preview(userId: string): Promise<AccountClosurePreview> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError('Account not found', 404);
    const check = this.closureCheck ? await this.closureCheck.check(userId) : { blockers: [], openCampaigns: 0 };
    return {
      ...check,
      canClose: check.blockers.length === 0,
      ...(check.blockers.length ? { message: describeClosureBlockers(check.blockers) } : {}),
    };
  }

  /**
   * Staff-assisted closure for a holder who cannot sign in. Staff verify the
   * request out of band (the admin route records how), so there is no member
   * password to step up with. Every other guard still applies: money or
   * payouts outstanding block closure, and closure uses the same erasure and
   * session revocation as self-service deletion. Only the admin route calls
   * this; member-facing routes use `execute`.
   */
  async closeForStaff(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError('Account not found', 404);
    await this.assertNothingOutstanding(userId, describeStaffClosureBlockers);
    await this.close(userId);
  }

  async execute(userId: string, credentials: AccountClosureCredentials = {}): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError('Account not found', 404);

    if (this.stepUp) {
      // A stolen access token alone must not be enough to close the account.
      if (!credentials.password) {
        throw new AppError(
          'Enter your current password to delete your account. If you are not asked for it, update the Ujimora app or delete your account from Settings at app.ujimora.com.',
          400,
          { password: ['required'] }
        );
      }
      try {
        await this.stepUp.verifyStepUp(userId, credentials.password, credentials.code);
      } catch (error) {
        // Wrong reauthentication input is recoverable within the current session;
        // a 401 would make clients discard a still-valid session.
        if (error instanceof AppError && error.statusCode === 401) throw new AppError(error.message, 400, error.errors);
        throw error;
      }
    }

    await this.assertNothingOutstanding(userId, describeClosureBlockers);
    await this.close(userId);
  }

  private async assertNothingOutstanding(userId: string, describe: (blockers: AccountClosureBlocker[]) => string): Promise<void> {
    if (!this.closureCheck) return;
    const { blockers } = await this.closureCheck.check(userId);
    if (blockers.length) {
      throw new AppError(describe(blockers), 409, { accountClosure: blockers.map(blocker => blocker.kind) });
    }
  }

  private async close(userId: string): Promise<void> {
    if (this.erasure) await this.erasure.request(userId);
    else await this.userRepo.delete(userId);
    this.tokenService.revokeAllTokens(userId);
  }
}
