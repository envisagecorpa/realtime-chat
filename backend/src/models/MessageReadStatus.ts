import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Message } from './Message';
import { User } from './User';

@Entity('message_read_status')
export class MessageReadStatus {
  @PrimaryColumn({ name: 'message_id' })
  messageId!: string;

  @PrimaryColumn({ name: 'user_id' })
  userId!: string;

  @CreateDateColumn({ name: 'read_at', type: 'timestamptz' })
  readAt!: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt?: Date;

  // Relationships
  @ManyToOne(() => Message, (message) => message.readStatus, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'message_id' })
  message!: Message;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  // Business methods
  markAsDelivered(): void {
    if (!this.deliveredAt) {
      this.deliveredAt = new Date();
    }
  }

  markAsRead(): void {
    this.readAt = new Date();
    this.markAsDelivered(); // Ensure delivered is also set
  }

  isDelivered(): boolean {
    return !!this.deliveredAt;
  }

  isRead(): boolean {
    return !!this.readAt;
  }

  getDeliveryDelay(): number | null {
    if (!this.deliveredAt) return null;
    return this.deliveredAt.getTime() - this.message.createdAt.getTime();
  }

  getReadDelay(): number | null {
    if (!this.readAt || !this.deliveredAt) return null;
    return this.readAt.getTime() - this.deliveredAt.getTime();
  }

  static createDeliveryStatus(message: Message, user: User): Partial<MessageReadStatus> {
    return {
      message,
      user,
      deliveredAt: new Date(),
    };
  }

  static createReadStatus(message: Message, user: User): Partial<MessageReadStatus> {
    const now = new Date();
    return {
      message,
      user,
      deliveredAt: now,
      readAt: now,
    };
  }
}