import { AppDataSource } from '../config/database';
import { User, UserRole } from '../models/User';
import { Message } from '../models/Message';
import { ChatRoom } from '../models/ChatRoom';
import { ChatRoomParticipant } from '../models/ChatRoomParticipant';
import Redis from 'ioredis';

export interface ModerationAction {
  id: string;
  type: ModerationActionType;
  targetUserId: string;
  moderatorId: string;
  reason: string;
  duration?: number; // in minutes
  roomId?: string;
  messageId?: string;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export enum ModerationActionType {
  WARN = 'warn',
  MUTE = 'mute',
  KICK = 'kick',
  BAN = 'ban',
  MESSAGE_DELETE = 'message_delete',
  MESSAGE_FLAG = 'message_flag',
  ROOM_LOCK = 'room_lock',
  ROOM_UNLOCK = 'room_unlock',
}

export interface ModerationQuery {
  type?: ModerationActionType;
  targetUserId?: string;
  moderatorId?: string;
  roomId?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreateModerationActionData {
  type: ModerationActionType;
  targetUserId: string;
  reason: string;
  duration?: number;
  roomId?: string;
  messageId?: string;
}

export class ModerationService {
  private userRepository = AppDataSource.getRepository(User);
  private messageRepository = AppDataSource.getRepository(Message);
  private chatRoomRepository = AppDataSource.getRepository(ChatRoom);
  private participantRepository = AppDataSource.getRepository(ChatRoomParticipant);
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
  }

  async createModerationAction(
    moderatorId: string,
    data: CreateModerationActionData
  ): Promise<ModerationAction> {
    const moderator = await this.userRepository.findOne({ where: { id: moderatorId } });
    if (!moderator || !moderator.isModerator()) {
      throw new Error('Only moderators can perform moderation actions');
    }

    const targetUser = await this.userRepository.findOne({ where: { id: data.targetUserId } });
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Prevent moderators from moderating other moderators
    if (targetUser.isModerator() && data.type !== ModerationActionType.WARN) {
      throw new Error('Cannot moderate other moderators');
    }

    // Validate room and message if provided
    if (data.roomId) {
      const room = await this.chatRoomRepository.findOne({ where: { id: data.roomId } });
      if (!room) {
        throw new Error('Room not found');
      }
    }

    if (data.messageId) {
      const message = await this.messageRepository.findOne({
        where: { id: data.messageId },
        relations: ['sender', 'chatRoom'],
      });
      if (!message) {
        throw new Error('Message not found');
      }
      if (data.roomId && message.chatRoomId !== data.roomId) {
        throw new Error('Message does not belong to specified room');
      }
    }

    // Create moderation action
    const actionId = this.generateActionId();
    const action: ModerationAction = {
      id: actionId,
      type: data.type,
      targetUserId: data.targetUserId,
      moderatorId,
      reason: data.reason,
      duration: data.duration,
      roomId: data.roomId,
      messageId: data.messageId,
      createdAt: new Date(),
      expiresAt: data.duration ? new Date(Date.now() + data.duration * 60 * 1000) : undefined,
      isActive: true,
    };

    // Store in Redis
    await this.redis.set(`moderation:action:${actionId}`, JSON.stringify(action));
    await this.redis.sadd('moderation:actions', actionId);
    await this.redis.sadd(`moderation:user:${data.targetUserId}`, actionId);

    if (data.roomId) {
      await this.redis.sadd(`moderation:room:${data.roomId}`, actionId);
    }

    // Set expiration if applicable
    if (action.expiresAt) {
      await this.redis.expireat(`moderation:action:${actionId}`, Math.floor(action.expiresAt.getTime() / 1000));
    }

    // Execute the moderation action
    await this.executeModerationAction(action);

    // Log the action
    await this.logModerationAction(action);

    return action;
  }

  async getModerationAction(actionId: string): Promise<ModerationAction | null> {
    const actionData = await this.redis.get(`moderation:action:${actionId}`);
    if (!actionData) {
      return null;
    }

    const action = JSON.parse(actionData) as ModerationAction;
    action.createdAt = new Date(action.createdAt);
    action.expiresAt = action.expiresAt ? new Date(action.expiresAt) : undefined;

    return action;
  }

  async getUserModerationActions(userId: string, query: ModerationQuery = {}): Promise<ModerationAction[]> {
    const actionIds = await this.redis.smembers(`moderation:user:${userId}`);
    const actions: ModerationAction[] = [];

    for (const actionId of actionIds) {
      const action = await this.getModerationAction(actionId);
      if (action && this.matchesQuery(action, query)) {
        actions.push(action);
      }
    }

    return actions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getRoomModerationActions(roomId: string, query: ModerationQuery = {}): Promise<ModerationAction[]> {
    const actionIds = await this.redis.smembers(`moderation:room:${roomId}`);
    const actions: ModerationAction[] = [];

    for (const actionId of actionIds) {
      const action = await this.getModerationAction(actionId);
      if (action && this.matchesQuery(action, query)) {
        actions.push(action);
      }
    }

    return actions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async isUserMuted(userId: string, roomId?: string): Promise<boolean> {
    const actions = await this.getUserModerationActions(userId, {
      type: ModerationActionType.MUTE,
      active: true,
      roomId,
    });

    return actions.some(action => this.isActionActive(action));
  }

  async isUserBanned(userId: string, roomId?: string): Promise<boolean> {
    const actions = await this.getUserModerationActions(userId, {
      type: ModerationActionType.BAN,
      active: true,
      roomId,
    });

    return actions.some(action => this.isActionActive(action));
  }

  async isRoomLocked(roomId: string): Promise<boolean> {
    const actions = await this.getRoomModerationActions(roomId, {
      type: ModerationActionType.ROOM_LOCK,
      active: true,
    });

    return actions.some(action => this.isActionActive(action));
  }

  async flagMessage(
    messageId: string,
    flaggedBy: string,
    reason: string
  ): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender', 'chatRoom'],
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Check if user has access to this message
    if (!message.chatRoom.isParticipant(flaggedBy)) {
      throw new Error('Access denied');
    }

    // Store flag in Redis
    const flagId = this.generateActionId();
    const flag = {
      id: flagId,
      messageId,
      flaggedBy,
      reason,
      createdAt: new Date(),
    };

    await this.redis.set(`flag:${flagId}`, JSON.stringify(flag));
    await this.redis.sadd(`flags:message:${messageId}`, flagId);
    await this.redis.sadd('flags:pending', flagId);

    // Increment flag count for the message
    await this.redis.incr(`flag_count:${messageId}`);

    // Auto-moderate if threshold is reached
    const flagCount = await this.redis.get(`flag_count:${messageId}`);
    const threshold = parseInt(process.env.AUTO_MODERATE_THRESHOLD || '3');

    if (parseInt(flagCount || '0') >= threshold) {
      await this.autoModerateMessage(messageId);
    }
  }

  async revokeModerationAction(actionId: string, revokedBy: string): Promise<void> {
    const revoker = await this.userRepository.findOne({ where: { id: revokedBy } });
    if (!revoker || !revoker.isModerator()) {
      throw new Error('Only moderators can revoke actions');
    }

    const action = await this.getModerationAction(actionId);
    if (!action) {
      throw new Error('Moderation action not found');
    }

    if (!action.isActive) {
      throw new Error('Action is already revoked');
    }

    // Mark as inactive
    action.isActive = false;
    await this.redis.set(`moderation:action:${actionId}`, JSON.stringify(action));

    // Reverse the action effects
    await this.reverseModerationAction(action);

    // Log the revocation
    await this.logModerationAction({
      ...action,
      id: this.generateActionId(),
      type: ModerationActionType.WARN, // Use WARN as a generic revocation type
      moderatorId: revokedBy,
      reason: `Revoked action ${actionId}: ${action.reason}`,
      createdAt: new Date(),
    });
  }

  async cleanupExpiredActions(): Promise<number> {
    const now = Date.now();
    const actionIds = await this.redis.smembers('moderation:actions');
    let cleanedCount = 0;

    for (const actionId of actionIds) {
      const action = await this.getModerationAction(actionId);
      if (action && action.expiresAt && action.expiresAt.getTime() < now && action.isActive) {
        // Mark as inactive
        action.isActive = false;
        await this.redis.set(`moderation:action:${actionId}`, JSON.stringify(action));

        // Reverse the action effects
        await this.reverseModerationAction(action);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  private async executeModerationAction(action: ModerationAction): Promise<void> {
    switch (action.type) {
      case ModerationActionType.KICK:
        await this.kickUserFromRoom(action.targetUserId, action.roomId!);
        break;

      case ModerationActionType.BAN:
        await this.banUserFromRoom(action.targetUserId, action.roomId!, action.duration);
        break;

      case ModerationActionType.MESSAGE_DELETE:
        await this.deleteMessage(action.messageId!);
        break;

      case ModerationActionType.ROOM_LOCK:
        await this.lockRoom(action.roomId!);
        break;

      case ModerationActionType.ROOM_UNLOCK:
        await this.unlockRoom(action.roomId!);
        break;

      case ModerationActionType.MUTE:
      case ModerationActionType.WARN:
      case ModerationActionType.MESSAGE_FLAG:
        // These are passive actions that don't require immediate execution
        break;
    }
  }

  private async reverseModerationAction(action: ModerationAction): Promise<void> {
    switch (action.type) {
      case ModerationActionType.BAN:
        // Remove ban - user can rejoin if they want
        break;

      case ModerationActionType.ROOM_LOCK:
        await this.unlockRoom(action.roomId!);
        break;

      case ModerationActionType.MUTE:
      case ModerationActionType.KICK:
      case ModerationActionType.WARN:
      case ModerationActionType.MESSAGE_DELETE:
      case ModerationActionType.MESSAGE_FLAG:
      case ModerationActionType.ROOM_UNLOCK:
        // These actions cannot be easily reversed
        break;
    }
  }

  private async kickUserFromRoom(userId: string, roomId: string): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: { userId, chatRoomId: roomId, leftAt: null as any },
    });

    if (participant) {
      participant.leave();
      await this.participantRepository.save(participant);
    }
  }

  private async banUserFromRoom(userId: string, roomId: string, durationMinutes?: number): Promise<void> {
    // First kick the user
    await this.kickUserFromRoom(userId, roomId);

    // Add to banned list
    const banKey = `ban:${roomId}:${userId}`;
    await this.redis.set(banKey, Date.now());

    if (durationMinutes) {
      await this.redis.expire(banKey, durationMinutes * 60);
    }
  }

  private async deleteMessage(messageId: string): Promise<void> {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (message) {
      message.softDelete();
      await this.messageRepository.save(message);
    }
  }

  private async lockRoom(roomId: string): Promise<void> {
    await this.redis.set(`room_lock:${roomId}`, Date.now());
  }

  private async unlockRoom(roomId: string): Promise<void> {
    await this.redis.del(`room_lock:${roomId}`);
  }

  private async autoModerateMessage(messageId: string): Promise<void> {
    // Auto-delete flagged message
    await this.deleteMessage(messageId);

    // Create auto-moderation action
    const action: ModerationAction = {
      id: this.generateActionId(),
      type: ModerationActionType.MESSAGE_DELETE,
      targetUserId: 'system',
      moderatorId: 'system',
      reason: 'Auto-moderated due to multiple flags',
      messageId,
      createdAt: new Date(),
      isActive: true,
    };

    await this.redis.set(`moderation:action:${action.id}`, JSON.stringify(action));
    await this.logModerationAction(action);
  }

  private async logModerationAction(action: ModerationAction): Promise<void> {
    const logEntry = {
      ...action,
      timestamp: Date.now(),
    };

    await this.redis.lpush('moderation:log', JSON.stringify(logEntry));
    await this.redis.ltrim('moderation:log', 0, 999); // Keep last 1000 entries
  }

  private matchesQuery(action: ModerationAction, query: ModerationQuery): boolean {
    if (query.type && action.type !== query.type) return false;
    if (query.targetUserId && action.targetUserId !== query.targetUserId) return false;
    if (query.moderatorId && action.moderatorId !== query.moderatorId) return false;
    if (query.roomId && action.roomId !== query.roomId) return false;
    if (query.active !== undefined && this.isActionActive(action) !== query.active) return false;

    return true;
  }

  private isActionActive(action: ModerationAction): boolean {
    if (!action.isActive) return false;
    if (action.expiresAt && action.expiresAt.getTime() < Date.now()) return false;
    return true;
  }

  private generateActionId(): string {
    return `mod_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  async getModerationStats(): Promise<{
    totalActions: number;
    actionsByType: Record<ModerationActionType, number>;
    activeActions: number;
    recentActions: number;
  }> {
    const actionIds = await this.redis.smembers('moderation:actions');
    const actions: ModerationAction[] = [];

    for (const actionId of actionIds) {
      const action = await this.getModerationAction(actionId);
      if (action) {
        actions.push(action);
      }
    }

    const actionsByType = {} as Record<ModerationActionType, number>;
    Object.values(ModerationActionType).forEach(type => {
      actionsByType[type] = 0;
    });

    let activeActions = 0;
    let recentActions = 0;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    actions.forEach(action => {
      actionsByType[action.type]++;
      if (this.isActionActive(action)) {
        activeActions++;
      }
      if (action.createdAt.getTime() > oneDayAgo) {
        recentActions++;
      }
    });

    return {
      totalActions: actions.length,
      actionsByType,
      activeActions,
      recentActions,
    };
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}