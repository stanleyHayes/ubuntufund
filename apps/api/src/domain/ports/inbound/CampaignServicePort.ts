import type {
  CreateCampaignInput,
  UpdateCampaignInput,
  CreateDonationInput,
  PaginationParams,
  PaginatedResponse,
  Campaign,
} from '@ubuntu-fund/types';

export interface CampaignServicePort {
  create(input: CreateCampaignInput, creatorId: string): Promise<Campaign>;
  getById(id: string): Promise<Campaign | null>;
  list(params: PaginationParams): Promise<PaginatedResponse<Campaign>>;
  update(id: string, input: UpdateCampaignInput, userId: string): Promise<Campaign>;
  donate(input: CreateDonationInput, donorId: string): Promise<void>;
  block(id: string, reason?: string): Promise<void>;
}
