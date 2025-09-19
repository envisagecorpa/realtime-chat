import Redis from 'ioredis';
import { UserSession, PresenceStatus } from '../models/UserSession';
import { AppDataSource } from '../config/database';

export interface PresenceData {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
  deviceInfo?: any;
}

export interface TypingData {
  userId: string;
  roomId: string;
  isTyping: boolean;
  timestamp: Date;
}

export class PresenceService {
  private redis: Redis;
  private sessionRepository = AppDataSource.getRepository(UserSession);

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

  // User Presence Management
  async setUserOnline(userId: string, sessionId: string, deviceInfo?: any): Promise<void> {
    const multi = this.redis.multi();

    // Add to online users set
    multi.sadd('presence:online', userId);

    // Set detailed presence data
    multi.hset(`presence:user:${userId}`, {
      status: PresenceStatus.ONLINE,
      lastSeen: Date.now(),
      sessionId,
      deviceInfo: JSON.stringify(deviceInfo || {}),
    });

    // Set TTL for automatic cleanup (5 minutes)
    multi.expire(`presence:user:${userId}`, 300);

    await multi.exec();
  }

  async setUserAway(userId: string): Promise<void> {
    const multi = this.redis.multi();

    // Update status but keep in online set
    multi.hset(`presence:user:${userId}`, {
      status: PresenceStatus.AWAY,
      lastSeen: Date.now(),
    });

    multi.expire(`presence:user:${userId}`, 300);

    await multi.exec();
  }

  async setUserOffline(userId: string): Promise<void> {
    const multi = this.redis.multi();

    // Remove from online users
    multi.srem('presence:online', userId);

    // Update status
    multi.hset(`presence:user:${userId}`, {
      status: PresenceStatus.OFFLINE,
      lastSeen: Date.now(),
    });

    // Shorter TTL for offline status
    multi.expire(`presence:user:${userId}`, 60);

    await multi.exec();
  }

  async getUserPresence(userId: string): Promise<PresenceData | null> {
    const data = await this.redis.hgetall(`presence:user:${userId}`);

    if (!data.status) {
      return null;
    }

    return {
      userId,
      status: data.status as PresenceStatus,
      lastSeen: new Date(parseInt(data.lastSeen)),
      deviceInfo: data.deviceInfo ? JSON.parse(data.deviceInfo) : undefined,
    };
  }

  async getOnlineUsers(): Promise<string[]> {
    return await this.redis.smembers('presence:online');
  }

  async isUserOnline(userId: string): Promise<boolean> {
    return (await this.redis.sismember('presence:online', userId)) === 1;
  }

  async updateHeartbeat(userId: string): Promise<void> {
    const exists = await this.redis.exists(`presence:user:${userId}`);

    if (exists) {
      const multi = this.redis.multi();
      multi.hset(`presence:user:${userId}`, 'lastSeen', Date.now());
      multi.expire(`presence:user:${userId}`, 300);
      await multi.exec();
    } else {
      // User was offline, mark as online
      await this.setUserOnline(userId, 'unknown');
    }
  }

  // Typing Indicators
  async setTypingIndicator(userId: string, roomId: string): Promise<void> {
    const key = `typing:${roomId}:${userId}`;

    // Set typing indicator with 10 second TTL
    await this.redis.setex(key, 10, Date.now());
  }

  async removeTypingIndicator(userId: string, roomId: string): Promise<void> {
    const key = `typing:${roomId}:${userId}`;
    await this.redis.del(key);
  }

  async getTypingUsers(roomId: string): Promise<string[]> {
    const keys = await this.redis.keys(`typing:${roomId}:*`);
    return keys.map(key => key.split(':')[2]);
  }

  async isUserTyping(userId: string, roomId: string): Promise<boolean> {
    const key = `typing:${roomId}:${userId}`;
    return (await this.redis.exists(key)) === 1;
  }

  // Room Presence
  async addUserToRoom(userId: string, roomId: string): Promise<void> {
    await this.redis.sadd(`room:${roomId}:users`, userId);
  }

  async removeUserFromRoom(userId: string, roomId: string): Promise<void> {
    await this.redis.srem(`room:${roomId}:users`, userId);
  }

  async getRoomUsers(roomId: string): Promise<string[]> {
    return await this.redis.smembers(`room:${roomId}:users`);
  }

  async getOnlineRoomUsers(roomId: string): Promise<string[]> {
    // Get intersection of room users and online users
    const roomUsers = await this.getRoomUsers(roomId);
    const onlineUsers = await this.getOnlineUsers();

    return roomUsers.filter(userId => onlineUsers.includes(userId));
  }

  // Session Management
  async registerSession(userId: string, sessionId: string, socketId: string): Promise<void> {
    const multi = this.redis.multi();

    // Map session to user
    multi.set(`session:${sessionId}`, userId);
    multi.expire(`session:${sessionId}`, 86400); // 24 hours

    // Map socket to session
    multi.set(`socket:${socketId}`, sessionId);
    multi.expire(`socket:${socketId}`, 86400);

    // Add to user's sessions
    multi.sadd(`user:${userId}:sessions`, sessionId);
    multi.expire(`user:${userId}:sessions`, 86400);

    await multi.exec();
  }

  async unregisterSession(sessionId: string): Promise<void> {
    const userId = await this.redis.get(`session:${sessionId}`);

    if (userId) {
      const multi = this.redis.multi();

      // Remove session mapping
      multi.del(`session:${sessionId}`);

      // Remove from user's sessions
      multi.srem(`user:${userId}:sessions`, sessionId);

      // Check if user has other active sessions
      multi.scard(`user:${userId}:sessions`);

      const results = await multi.exec();
      const sessionCount = results?.[2]?.[1] as number;

      // If no more sessions, mark user offline
      if (sessionCount === 0) {
        await this.setUserOffline(userId);
      }
    }
  }

  async getSessionUser(sessionId: string): Promise<string | null> {
    return await this.redis.get(`session:${sessionId}`);
  }

  async getUserSessions(userId: string): Promise<string[]> {
    return await this.redis.smembers(`user:${userId}:sessions`);
  }

  // Bulk Operations
  async bulkUpdatePresence(userUpdates: Array<{ userId: string; status: PresenceStatus }>): Promise<void> {
    const multi = this.redis.multi();

    for (const update of userUpdates) {
      multi.hset(`presence:user:${update.userId}`, {
        status: update.status,
        lastSeen: Date.now(),
      });

      if (update.status === PresenceStatus.ONLINE) {
        multi.sadd('presence:online', update.userId);
        multi.expire(`presence:user:${update.userId}`, 300);
      } else if (update.status === PresenceStatus.OFFLINE) {
        multi.srem('presence:online', update.userId);
        multi.expire(`presence:user:${update.userId}`, 60);
      }
    }

    await multi.exec();
  }

  // Cleanup Operations
  async cleanupExpiredPresence(): Promise<number> {
    const onlineUsers = await this.getOnlineUsers();
    let cleanedCount = 0;

    for (const userId of onlineUsers) {
      const presence = await this.getUserPresence(userId);

      if (!presence) {
        await this.redis.srem('presence:online', userId);
        cleanedCount++;
        continue;
      }

      // Check if presence is expired (5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      if (presence.lastSeen.getTime() < fiveMinutesAgo) {
        await this.setUserOffline(userId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  async cleanupExpiredTyping(): Promise<number> {
    const pattern = 'typing:*:*';
    const keys = await this.redis.keys(pattern);

    let cleanedCount = 0;
    for (const key of keys) {
      const timestamp = await this.redis.get(key);

      if (timestamp) {
        const tenSecondsAgo = Date.now() - 10 * 1000;
        if (parseInt(timestamp) < tenSecondsAgo) {
          await this.redis.del(key);
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  }

  // Statistics
  async getPresenceStats(): Promise<{
    onlineUsers: number;
    totalPresenceRecords: number;
    activeTypingIndicators: number;
  }> {
    const [onlineCount, presenceKeys, typingKeys] = await Promise.all([
      this.redis.scard('presence:online'),
      this.redis.keys('presence:user:*'),
      this.redis.keys('typing:*:*'),
    ]);

    return {
      onlineUsers: onlineCount,
      totalPresenceRecords: presenceKeys.length,
      activeTypingIndicators: typingKeys.length,
    };
  }

  // Event Publishing
  async publishPresenceChange(userId: string, status: PresenceStatus, roomIds?: string[]): Promise<void> {
    const presenceData = {
      userId,
      status,
      timestamp: new Date().toISOString(),
    };

    if (roomIds && roomIds.length > 0) {
      // Publish to specific rooms
      for (const roomId of roomIds) {
        await this.redis.publish(`presence:${roomId}`, JSON.stringify(presenceData));
      }
    } else {
      // Publish globally
      await this.redis.publish('presence:global', JSON.stringify(presenceData));
    }
  }

  async publishTypingIndicator(userId: string, roomId: string, isTyping: boolean): Promise<void> {
    const typingData = {
      userId,
      roomId,
      isTyping,
      timestamp: new Date().toISOString(),
    };

    await this.redis.publish(`typing:${roomId}`, JSON.stringify(typingData));
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}