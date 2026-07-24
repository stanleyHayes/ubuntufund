import type { AnalyticsRepositoryPort } from '../../domain/ports/outbound/AnalyticsRepositoryPort.js';
import type { PlatformOverviewRecord } from '../../domain/ports/outbound/AnalyticsRepositoryPort.js';

export class GetPlatformOverviewUseCase {
  constructor(private readonly analyticsRepo: AnalyticsRepositoryPort) {}

  async execute(): Promise<PlatformOverviewRecord> {
    return this.analyticsRepo.getOverview();
  }
}
