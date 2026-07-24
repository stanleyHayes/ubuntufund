export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';

export interface DisputeRecord {
  id: string;
  campaignId: string;
  reporterId: string;
  assigneeId?: string;
  reason: string;
  description?: string;
  status: DisputeStatus;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DisputeListParams {
  status?: DisputeStatus;
  page?: number;
  pageSize?: number;
}

export interface DisputeResolution {
  status: DisputeStatus;
  resolution?: string;
  resolvedBy?: string;
}

export interface DisputeRepositoryPort {
  save(dispute: DisputeRecord): Promise<DisputeRecord>;
  findById(id: string): Promise<DisputeRecord | null>;
  findAll(
    params: DisputeListParams
  ): Promise<{ items: DisputeRecord[]; total: number }>;
  /**
   * Applies a status/resolution update. Returns the updated record, or null
   * when the dispute does not exist.
   */
  updateStatus(
    id: string,
    updates: DisputeResolution
  ): Promise<DisputeRecord | null>;
}
