import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { IsEmail, IsOptional, Length, Matches } from 'class-validator';
import { Message } from './Message';
import { ChatRoom } from './ChatRoom';
import { ChatRoomParticipant } from './ChatRoomParticipant';
import { UserSession } from './UserSession';
import { FileAttachment } from './FileAttachment';

export enum UserRole {
  MEMBER = 'member',
  MODERATOR = 'moderator',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 50 })
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain alphanumeric characters and underscores' })
  username!: string;

  @Column({ name: 'display_name', length: 100, nullable: true })
  @IsOptional()
  @Length(1, 100)
  displayName?: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.MEMBER,
  })
  role!: UserRole;

  @Column({ name: 'last_seen', type: 'timestamptz', nullable: true })
  lastSeen?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // Relationships
  @OneToMany(() => Message, (message) => message.sender)
  sentMessages!: Message[];

  @OneToMany(() => ChatRoom, (chatRoom) => chatRoom.createdBy)
  createdRooms!: ChatRoom[];

  @OneToMany(() => ChatRoomParticipant, (participant) => participant.user)
  participantRooms!: ChatRoomParticipant[];

  @OneToMany(() => UserSession, (session) => session.user)
  sessions!: UserSession[];

  @OneToMany(() => FileAttachment, (attachment) => attachment.uploadedBy)
  uploadedFiles!: FileAttachment[];

  // Computed properties
  get isOnline(): boolean {
    // This will be computed from active sessions
    return this.sessions?.some(session => !session.disconnectedAt) || false;
  }

  // Business methods
  isModerator(): boolean {
    return this.role === UserRole.MODERATOR;
  }

  canModerate(targetUser: User): boolean {
    return this.isModerator() && targetUser.id !== this.id;
  }

  updateLastSeen(): void {
    this.lastSeen = new Date();
  }
}