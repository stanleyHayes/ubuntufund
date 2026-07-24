import type { CampaignUpdateType } from '@ubuntu-fund/types';

export interface CampaignUpdateProps {
  id: string;
  campaignId: string;
  authorId: string;
  title: string;
  content: string;
  type: CampaignUpdateType;
  mediaUrls: string[];
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignUpdateEdits {
  title?: string;
  content?: string;
  type?: CampaignUpdateType;
  mediaUrls?: string[];
}

export class CampaignUpdateEntity {
  private props: CampaignUpdateProps;

  constructor(props: CampaignUpdateProps) {
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get authorId(): string {
    return this.props.authorId;
  }
  get title(): string {
    return this.props.title;
  }
  get content(): string {
    return this.props.content;
  }
  get type(): CampaignUpdateType {
    return this.props.type;
  }
  get mediaUrls(): string[] {
    return [...this.props.mediaUrls];
  }
  get isPinned(): boolean {
    return this.props.isPinned;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  applyEdits(edits: CampaignUpdateEdits): void {
    if (edits.title !== undefined) {
      this.props.title = edits.title;
    }
    if (edits.content !== undefined) {
      this.props.content = edits.content;
    }
    if (edits.type !== undefined) {
      this.props.type = edits.type;
    }
    if (edits.mediaUrls !== undefined) {
      this.props.mediaUrls = edits.mediaUrls;
    }
    this.props.updatedAt = new Date();
  }

  pin(): void {
    this.props.isPinned = true;
    this.props.updatedAt = new Date();
  }

  unpin(): void {
    this.props.isPinned = false;
    this.props.updatedAt = new Date();
  }

  toPlain(): CampaignUpdateProps {
    return { ...this.props };
  }
}
