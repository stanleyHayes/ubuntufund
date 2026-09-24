import { hasCurrentLegalAcceptance, LEGAL_ACCEPTANCE_VERSION, type LegalAcceptanceInput, type LegalAcceptanceRecord } from '@ubuntu-fund/types';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Timestamp acknowledgement with the message's payment record, before provider calls. */
export function messageAgreement(message?: string, acceptance?: LegalAcceptanceInput): LegalAcceptanceRecord | undefined {
  if (message !== undefined && (typeof message !== 'string' || message.length > 1000)) throw new AppError('Enter a message of at most 1000 characters.', 400);
  if (!message?.trim()) return undefined;
  if (!hasCurrentLegalAcceptance(acceptance)) throw new AppError('Accept the current content terms and confirm you are at least 18 before posting a public message.', 428);
  return { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true, acceptedAt: new Date() };
}

/** Public attribution needs acknowledgement even when only a name is submitted. */
export function donationContentAgreement(input: { message?: string; donorName?: string; isAnonymous?: boolean; legalAcceptance?: LegalAcceptanceInput }): LegalAcceptanceRecord | undefined {
  const contentAgreement = messageAgreement(input.message, input.legalAcceptance)
    ?? messageAgreement(input.isAnonymous ? undefined : input.donorName, input.legalAcceptance);
  if (contentAgreement || input.legalAcceptance === undefined) return contentAgreement;
  // Preserve explicit checkout consent even without public content. Never infer
  // acceptance from anonymity, an empty message or account-level signup consent.
  if (!hasCurrentLegalAcceptance(input.legalAcceptance)) throw new AppError('Accept the current terms and confirm you are at least 18.', 428);
  return { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true, acceptedAt: new Date() };
}
