import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';

/**
 * Scheduled sweep: an ACTIVE/FUNDED campaign whose end date has passed is
 * re-labelled EXPIRED, so discovery, the sitemap, analytics and the organiser's
 * own lists stop presenting it as open.
 *
 * Nothing about money depends on this label: donation eligibility already
 * checks the end date (`canReceiveDonation`), and plan slots are freed by
 * `countActiveByCreator` at the end date itself, so a missed or late sweep only
 * delays the label.
 */
export class ExpireEndedCampaignsUseCase {
  constructor(private readonly campaignRepo: Pick<CampaignRepositoryPort, 'expireEnded'>) {}

  execute(now: Date = new Date()): Promise<number> {
    return this.campaignRepo.expireEnded(now);
  }
}
