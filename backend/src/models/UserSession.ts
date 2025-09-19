import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';

export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  OFFLINE = 'offline',
}

interface DeviceInfo {
  device?: string;
  browser?: string;
  os?: string;
  version?: string;
}

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'socket_id' })
  socketId!: string;

  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo?: DeviceInfo;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @CreateDateColumn({ name: 'connected_at', type: 'timestamptz' })
  connectedAt!: Date;

  @UpdateDateColumn({ name: 'last_heartbeat', type: 'timestamptz' })
  lastHeartbeat!: Date;

  @Column({ name: 'disconnected_at', type: 'timestamptz', nullable: true })
  disconnectedAt?: Date;

  @Column({
    name: 'presence_status',
    type: 'enum',
    enum: PresenceStatus,
    default: PresenceStatus.ONLINE,
  })
  presenceStatus!: PresenceStatus;

  // Relationships
  @ManyToOne(() => User, (user) => user.sessions, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  // Business methods
  isActive(): boolean {
    return !this.disconnectedAt;
  }

  isOnline(): boolean {
    return this.isActive() && this.presenceStatus === PresenceStatus.ONLINE;
  }

  isAway(): boolean {
    return this.isActive() && this.presenceStatus === PresenceStatus.AWAY;
  }

  isOffline(): boolean {
    return !this.isActive() || this.presenceStatus === PresenceStatus.OFFLINE;
  }

  updateHeartbeat(): void {
    this.lastHeartbeat = new Date();
    if (this.presenceStatus === PresenceStatus.OFFLINE) {
      this.presenceStatus = PresenceStatus.ONLINE;
    }
  }

  setPresenceStatus(status: PresenceStatus): void {
    this.presenceStatus = status;
    this.updateHeartbeat();
  }

  markAsAway(): void {
    this.setPresenceStatus(PresenceStatus.AWAY);
  }

  markAsOnline(): void {
    this.setPresenceStatus(PresenceStatus.ONLINE);
  }

  disconnect(): void {
    this.disconnectedAt = new Date();
    this.presenceStatus = PresenceStatus.OFFLINE;
  }

  reconnect(newSocketId: string): void {
    this.socketId = newSocketId;
    this.disconnectedAt = undefined;
    this.presenceStatus = PresenceStatus.ONLINE;
    this.updateHeartbeat();
  }

  hasExpired(timeoutMinutes: number = 45): boolean {
    if (this.disconnectedAt) return true;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    const expiryTime = new Date(this.lastHeartbeat.getTime() + timeoutMs);
    return new Date() > expiryTime;
  }

  getConnectionDuration(): number {
    const endTime = this.disconnectedAt || new Date();
    return endTime.getTime() - this.connectedAt.getTime();
  }

  getDeviceName(): string {
    if (!this.deviceInfo) return 'Unknown Device';

    const { device, browser, os } = this.deviceInfo;
    const parts = [device, browser, os].filter(Boolean);
    return parts.join(' - ') || 'Unknown Device';
  }

  static createSession(
    user: User,
    socketId: string,
    ipAddress?: string,
    userAgent?: string,
    deviceInfo?: DeviceInfo
  ): Partial<UserSession> {
    return {
      user,
      socketId,
      ipAddress,
      userAgent,
      deviceInfo,
      presenceStatus: PresenceStatus.ONLINE,
    };
  }

  static findActiveSessionsForUser(sessions: UserSession[]): UserSession[] {
    return sessions.filter(session => session.isActive() && !session.hasExpired());
  }

  static getUserPresenceStatus(sessions: UserSession[]): PresenceStatus {
    const activeSessions = this.findActiveSessionsForUser(sessions);

    if (activeSessions.length === 0) {
      return PresenceStatus.OFFLINE;
    }

    // If any session is online, user is online
    if (activeSessions.some(session => session.isOnline())) {
      return PresenceStatus.ONLINE;
    }

    // If all active sessions are away, user is away
    if (activeSessions.every(session => session.isAway())) {
      return PresenceStatus.AWAY;
    }

    // Default to online if mixed states
    return PresenceStatus.ONLINE;
  }
}