import { TipModel, type TipDocument } from '../../src/infrastructure/database/models/TipModel.js';
import { tipContentVersion } from '../../src/domain/entities/tipPublicContent.js';
/** Fixtures for tests of already-reviewed public tips, not a production approval path. */
export function createReviewedTip(input: Partial<TipDocument>) {
  return TipModel.create({ ...input, publicContentStatus: 'approved', publicContentFingerprint: tipContentVersion(input) });
}
