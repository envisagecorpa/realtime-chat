import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Length, IsOptional } from 'class-validator';
import { User } from './User';
import { ChatRoom } from './ChatRoom';
import { MessageReadStatus } from './MessageReadStatus';
import { FileAttachment } from './FileAttachment';

export enum MessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  FILE_ATTACHMENT = 'file_attachment',
}

export enum DeliveryStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @Length(1, 2000)
  content?: string;

  @Column({
    name: 'message_type',
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  messageType!: MessageType;

  @Column({ name: 'sender_id' })
  senderId!: string;

  @Column({ name: 'chat_room_id' })
  chatRoomId!: string;

  @Column({ name: 'parent_message_id', nullable: true })
  @IsOptional()
  parentMessageId?: string;

  @Column({
    name: 'delivery_status',
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.SENT,
  })
  deliveryStatus!: DeliveryStatus;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt?: Date;

  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  editedAt?: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @Column({ name: 'has_attachments', default: false })
  hasAttachments!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  // Relationships
  @ManyToOne(() => User, (user) => user.sentMessages, { eager: true })
  @JoinColumn({ name: 'sender_id' })
  sender!: User;

  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.messages)
  @JoinColumn({ name: 'chat_room_id' })
  chatRoom!: ChatRoom;

  @ManyToOne(() => Message, (message) => message.replies, { nullable: true })
  @JoinColumn({ name: 'parent_message_id' })
  parentMessage?: Message;

  @OneToMany(() => Message, (message) => message.parentMessage)
  replies!: Message[];

  @OneToMany(() => MessageReadStatus, (readStatus) => readStatus.message, {
    cascade: true,
  })
  readStatus!: MessageReadStatus[];

  @OneToMany(() => FileAttachment, (attachment) => attachment.message, {
    cascade: true,
  })
  attachments!: FileAttachment[];

  // Business methods
  isTextMessage(): boolean {
    return this.messageType === MessageType.TEXT;
  }

  isSystemMessage(): boolean {
    return this.messageType === MessageType.SYSTEM;
  }

  isFileAttachment(): boolean {
    return this.messageType === MessageType.FILE_ATTACHMENT;
  }

  isEdited(): boolean {
    return !!this.editedAt;
  }

  isDeleted(): boolean {
    return !!this.deletedAt;
  }

  canBeEdited(): boolean {
    if (this.isDeleted() || this.isSystemMessage()) {
      return false;
    }

    // Allow editing within 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.createdAt > fiveMinutesAgo;
  }

  canBeEditedBy(userId: string): boolean {
    return this.senderId === userId && this.canBeEdited();
  }

  canBeDeletedBy(userId: string): boolean {
    return this.senderId === userId && !this.isDeleted();
  }

  edit(newContent: string): void {
    if (!this.canBeEdited()) {
      throw new Error('Message cannot be edited');
    }

    if (!newContent.trim()) {
      throw new Error('Message content cannot be empty');
    }

    this.content = newContent.trim();
    this.editedAt = new Date();
  }

  softDelete(): void {
    this.deletedAt = new Date();
    this.content = null; // Clear content but keep metadata
  }

  markAsDelivered(): void {
    if (this.deliveryStatus === DeliveryStatus.SENT) {
      this.deliveryStatus = DeliveryStatus.DELIVERED;
      this.deliveredAt = new Date();
    }
  }

  markAsFailed(): void {
    this.deliveryStatus = DeliveryStatus.FAILED;
  }

  isReadBy(userId: string): boolean {
    return this.readStatus.some(status => status.userId === userId && status.readAt);
  }

  getReadByUsers(): string[] {
    return this.readStatus
      .filter(status => status.readAt)
      .map(status => status.userId);
  }

  static createTextMessage(
    content: string,
    sender: User,
    chatRoom: ChatRoom,
    parentMessage?: Message
  ): Partial<Message> {
    return {
      content: content.trim(),
      messageType: MessageType.TEXT,
      sender,
      chatRoom,
      parentMessage,
      deliveryStatus: DeliveryStatus.SENT,
    };
  }

  static createSystemMessage(
    content: string,
    chatRoom: ChatRoom,
    sender?: User
  ): Partial<Message> {
    return {
      content,
      messageType: MessageType.SYSTEM,
      chatRoom,
      sender: sender || chatRoom.createdBy,
      deliveryStatus: DeliveryStatus.DELIVERED,
    };
  }

  static createFileMessage(
    sender: User,
    chatRoom: ChatRoom,
    fileName: string
  ): Partial<Message> {
    return {
      content: `📎 Shared a file: ${fileName}`,
      messageType: MessageType.FILE_ATTACHMENT,
      sender,
      chatRoom,
      hasAttachments: true,
      deliveryStatus: DeliveryStatus.SENT,
    };
  }
}