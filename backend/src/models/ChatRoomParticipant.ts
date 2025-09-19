import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ChatRoom } from './ChatRoom';
import { User } from './User';
import { Message } from './Message';

export enum ParticipantRole {
  MEMBER = 'member',
  ADMIN = 'admin',
}

export enum NotificationLevel {
  ALL = 'all',
  MENTIONS = 'mentions',
  NONE = 'none',
}

@Entity('chat_room_participants')
@Unique(['chatRoomId', 'userId'])
export class ChatRoomParticipant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'chat_room_id' })
  chatRoomId!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({
    type: 'enum',
    enum: ParticipantRole,
    default: ParticipantRole.MEMBER,
  })
  role!: ParticipantRole;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt?: Date;

  @Column({ name: 'last_read_message_id', nullable: true })
  lastReadMessageId?: string;

  @Column({
    name: 'notification_level',
    type: 'enum',
    enum: NotificationLevel,
    default: NotificationLevel.ALL,
  })
  notificationLevel!: NotificationLevel;

  @Column({ name: 'is_muted', default: false })
  isMuted!: boolean;

  // Relationships
  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'chat_room_id' })
  chatRoom!: ChatRoom;

  @ManyToOne(() => User, (user) => user.participantRooms, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'last_read_message_id' })
  lastReadMessage?: Message;

  // Business methods
  isActive(): boolean {
    return !this.leftAt;
  }

  isAdmin(): boolean {
    return this.role === ParticipantRole.ADMIN;
  }

  isMember(): boolean {
    return this.role === ParticipantRole.MEMBER;
  }

  leave(): void {
    this.leftAt = new Date();
  }

  rejoin(): void {
    this.leftAt = undefined;
    this.joinedAt = new Date();
  }

  promoteToAdmin(): void {
    this.role = ParticipantRole.ADMIN;
  }

  demoteToMember(): void {
    this.role = ParticipantRole.MEMBER;
  }

  mute(): void {
    this.isMuted = true;
  }

  unmute(): void {
    this.isMuted = false;
  }

  setNotificationLevel(level: NotificationLevel): void {
    this.notificationLevel = level;
  }

  markMessageAsRead(message: Message): void {
    this.lastReadMessageId = message.id;
    this.lastReadMessage = message;
  }

  hasUnreadMessages(latestMessageId?: string): boolean {
    if (!latestMessageId) return false;
    if (!this.lastReadMessageId) return true;
    return this.lastReadMessageId !== latestMessageId;
  }

  shouldReceiveNotification(message: Message): boolean {
    if (this.isMuted) return false;

    switch (this.notificationLevel) {
      case NotificationLevel.NONE:
        return false;
      case NotificationLevel.MENTIONS:
        // Check if user is mentioned in message content
        return message.content?.includes(`@${this.user.username}`) || false;
      case NotificationLevel.ALL:
      default:
        return true;
    }
  }

  canModerateRoom(): boolean {
    return this.isAdmin() || this.chatRoom?.createdById === this.userId;
  }

  static createParticipant(
    user: User,
    chatRoom: ChatRoom,
    role: ParticipantRole = ParticipantRole.MEMBER
  ): Partial<ChatRoomParticipant> {
    return {
      user,
      chatRoom,
      role,
      notificationLevel: NotificationLevel.ALL,
      isMuted: false,
    };
  }

  static createAdmin(user: User, chatRoom: ChatRoom): Partial<ChatRoomParticipant> {
    return this.createParticipant(user, chatRoom, ParticipantRole.ADMIN);
  }
}