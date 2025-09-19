import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Length, IsOptional, Min, Max } from 'class-validator';
import { User } from './User';
import { Message } from './Message';
import { ChatRoomParticipant } from './ChatRoomParticipant';

export enum RoomType {
  DIRECT = 'direct',
  GROUP = 'group',
  PUBLIC = 'public',
}

@Entity('chat_rooms')
export class ChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  @Length(1, 100)
  name!: string;

  @Column({
    type: 'enum',
    enum: RoomType,
  })
  type!: RoomType;

  @Column({ length: 500, nullable: true })
  @IsOptional()
  @Length(1, 500)
  description?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'max_participants', default: 100 })
  @Min(2)
  @Max(500)
  maxParticipants!: number;

  @Column({ name: 'created_by_id' })
  createdById!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // Relationships
  @ManyToOne(() => User, (user) => user.createdRooms, { eager: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User;

  @OneToMany(() => Message, (message) => message.chatRoom)
  messages!: Message[];

  @OneToMany(() => ChatRoomParticipant, (participant) => participant.chatRoom, {
    cascade: true,
  })
  participants!: ChatRoomParticipant[];

  // Computed properties
  get participantCount(): number {
    return this.participants?.filter(p => !p.leftAt).length || 0;
  }

  get activeParticipants(): ChatRoomParticipant[] {
    return this.participants?.filter(p => !p.leftAt) || [];
  }

  // Business methods
  isDirectMessage(): boolean {
    return this.type === RoomType.DIRECT;
  }

  isGroupChat(): boolean {
    return this.type === RoomType.GROUP;
  }

  isPublicRoom(): boolean {
    return this.type === RoomType.PUBLIC;
  }

  canAddParticipant(): boolean {
    return this.participantCount < this.maxParticipants;
  }

  isParticipant(userId: string): boolean {
    return this.activeParticipants.some(p => p.userId === userId);
  }

  isAdmin(userId: string): boolean {
    const participant = this.activeParticipants.find(p => p.userId === userId);
    return participant?.isAdmin() || this.createdById === userId;
  }

  generateDirectMessageName(user1: User, user2: User): string {
    return `${user1.username} & ${user2.username}`;
  }

  static createDirectMessage(user1: User, user2: User): Partial<ChatRoom> {
    return {
      name: `${user1.username} & ${user2.username}`,
      type: RoomType.DIRECT,
      maxParticipants: 2,
      createdBy: user1,
      isActive: true,
    };
  }

  static createGroupChat(name: string, creator: User, description?: string): Partial<ChatRoom> {
    return {
      name,
      type: RoomType.GROUP,
      description,
      createdBy: creator,
      maxParticipants: 100,
      isActive: true,
    };
  }

  static createPublicRoom(name: string, creator: User, description?: string): Partial<ChatRoom> {
    return {
      name,
      type: RoomType.PUBLIC,
      description,
      createdBy: creator,
      maxParticipants: 500,
      isActive: true,
    };
  }
}