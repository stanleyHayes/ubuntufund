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

function describeBlocker(blocker: AccountClosureBlocker, whose: 'your' | 'their'): string {
  const amount = formatAmount(blocker.amount ?? 0, blocker.currency);
  switch (blocker.kind) {
    case 'wallet_balance': return `${amount} in ${whose} Ujimora wallet`;
    case 'campaign_balance': return `${amount} raised by ${whose} campaigns that has not been paid out`;
    case 'beneficiary_balance': return `${amount} held for ${whose} campaign beneficiaries`;
    case 'creator_balance': return `${amount} in creator tips not yet withdrawn`;
    case 'affiliate_balance': return `${amount} in affiliate earnings not yet paid out`;
    case 'pending_payout': {
      const count = blocker.count ?? 1;
      return `${count} payout${count === 1 ? '' : 's'} still being processed`;
    }
  }
}

export function describeClosureBlockers(blockers: AccountClosureBlocker[]): string {
  // Staff cannot override these blockers either (closing would strand the
  // money), so support helps the holder resolve them rather than closing.
  return `Your account can’t be closed yet. First withdraw or resolve: ${blockers.map(blocker => describeBlocker(blocker, 'your')).join('; ')}. `
    + 'If you can’t, contact support@ujimora.com and we’ll help you resolve it so your account can be closed.';
}

/** The same blockers, worded for staff closing an account on the holder's behalf. */
export function describeClosureBlockersForStaff(blockers: AccountClosureBlocker[]): string {
  return `This account can’t be closed while money is outstanding. The holder must first withdraw or resolve: ${blockers.map(blocker => describeBlocker(blocker, 'their')).join('; ')}. `
    + 'Closing now would strand it, so staff cannot override this.';
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

    await this.close(userId, describeClosureBlockers);
  }

  /**
   * Staff-assisted closure for a holder who cannot sign in. There is no
   * step-up: the holder is never asked for a password or code, and the admin
   * route has already fenced a current administrator, matched the typed
   * account email and taken a verification note. Only that route may call
   * this. The money blockers still apply, because staff closing an account
   * would strand a balance or an in-flight payout just the same.
   */
  async closeByStaff(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError('Account not found', 404);
    await this.close(userId, describeClosureBlockersForStaff);
  }

  private async close(userId: string, describe: (blockers: AccountClosureBlocker[]) => string): Promise<void> {
    if (this.closureCheck) {
      const { blockers } = await this.closureCheck.check(userId);
      if (blockers.length) {
        throw new AppError(describe(blockers), 409, { accountClosure: blockers.map(blocker => blocker.kind) });
      }
    }

    if (this.erasure) await this.erasure.request(userId);
    else await this.userRepo.delete(userId);
    this.tokenService.revokeAllTokens(userId);
  }
}
