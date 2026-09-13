import { z } from 'zod';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
export const legalAcceptanceSchema = z.object({
  version: z.literal(LEGAL_ACCEPTANCE_VERSION),
  acceptedTerms: z.literal(true),
  ageConfirmed: z.literal(true),
});
