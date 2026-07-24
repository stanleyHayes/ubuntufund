export interface NotificationProps {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: Date;
}

export class NotificationEntity {
  private props: NotificationProps;

  constructor(props: NotificationProps) {
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get title(): string {
    return this.props.title;
  }
  get body(): string {
    return this.props.body;
  }
  get type(): string {
    return this.props.type;
  }
  get read(): boolean {
    return this.props.read;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  markAsRead(): void {
    this.props.read = true;
  }

  toPlain(): NotificationProps {
    return { ...this.props };
  }
}
