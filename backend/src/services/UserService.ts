import { AppDataSource } from '../config/database';
import { User, UserRole } from '../models/User';
import { UserSession, PresenceStatus } from '../models/UserSession';

export interface UserListQuery {
  search?: string;
  online?: boolean;
  page?: number;
  limit?: number;
}

export interface UserListResult {
  data: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface UserUpdateData {
  displayName?: string;
  email?: string;
}

export class UserService {
  private userRepository = AppDataSource.getRepository(User);
  private sessionRepository = AppDataSource.getRepository(UserSession);

  async getUserById(id: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['sessions'],
    });

    if (user) {
      // Attach computed online status
      user.sessions = await this.getActiveSessions(id);
    }

    return user;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { username },
      relations: ['sessions'],
    });

    if (user) {
      user.sessions = await this.getActiveSessions(id);
    }

    return user;
  }

  async listUsers(query: UserListQuery = {}): Promise<UserListResult> {
    const {
      search,
      online,
      page = 1,
      limit = 20,
    } = query;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.sessions', 'session', 'session.disconnectedAt IS NULL');

    // Apply search filter
    if (search) {
      queryBuilder.where(
        '(LOWER(user.username) LIKE LOWER(:search) OR LOWER(user.displayName) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }

    // Apply online filter
    if (online !== undefined) {
      if (online) {
        queryBuilder.andWhere('session.id IS NOT NULL');
        queryBuilder.andWhere('session.lastHeartbeat > :heartbeatThreshold', {
          heartbeatThreshold: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
        });
      } else {
        queryBuilder.andWhere('session.id IS NULL');
      }
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Order by username
    queryBuilder.orderBy('user.username', 'ASC');

    const users = await queryBuilder.getMany();

    const totalPages = Math.ceil(total / limit);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async updateUser(userId: string, updateData: UserUpdateData): Promise<User> {
    const user = await this.getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Validate and update fields
    if (updateData.displayName !== undefined) {
      if (updateData.displayName.length > 100) {
        throw new Error('Display name too long');
      }
      user.displayName = updateData.displayName || undefined;
    }

    if (updateData.email !== undefined) {
      if (updateData.email && !this.isValidEmail(updateData.email)) {
        throw new Error('Invalid email format');
      }
      user.email = updateData.email || undefined;
    }

    return await this.userRepository.save(user);
  }

  async getUserPresenceStatus(userId: string): Promise<PresenceStatus> {
    const sessions = await this.getActiveSessions(userId);
    return UserSession.getUserPresenceStatus(sessions);
  }

  async getOnlineUsers(): Promise<User[]> {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.sessions', 'session')
      .where('session.disconnectedAt IS NULL')
      .andWhere('session.lastHeartbeat > :threshold', {
        threshold: new Date(Date.now() - 45 * 60 * 1000),
      })
      .getMany();

    return users;
  }

  async searchUsers(searchTerm: string, limit: number = 10): Promise<User[]> {
    if (!searchTerm.trim()) {
      return [];
    }

    return await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.username) LIKE LOWER(:search)', { search: `%${searchTerm}%` })
      .orWhere('LOWER(user.displayName) LIKE LOWER(:search)', { search: `%${searchTerm}%` })
      .orderBy('user.username', 'ASC')
      .limit(limit)
      .getMany();
  }

  async promoteToModerator(userId: string, promotedBy: string): Promise<User> {
    const promoter = await this.getUserById(promotedBy);
    if (!promoter?.isModerator()) {
      throw new Error('Only moderators can promote users');
    }

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isModerator()) {
      throw new Error('User is already a moderator');
    }

    user.role = UserRole.MODERATOR;
    return await this.userRepository.save(user);
  }

  async demoteFromModerator(userId: string, demotedBy: string): Promise<User> {
    const demoter = await this.getUserById(demotedBy);
    if (!demoter?.isModerator()) {
      throw new Error('Only moderators can demote users');
    }

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isModerator()) {
      throw new Error('User is not a moderator');
    }

    if (user.id === demotedBy) {
      throw new Error('Cannot demote yourself');
    }

    user.role = UserRole.MEMBER;
    return await this.userRepository.save(user);
  }

  async getUserStats(userId: string): Promise<{
    totalMessages: number;
    roomsJoined: number;
    filesUploaded: number;
    lastActive: Date | null;
  }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.sentMessages', 'message')
      .leftJoinAndSelect('user.participantRooms', 'participant')
      .leftJoinAndSelect('user.uploadedFiles', 'file')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new Error('User not found');
    }

    return {
      totalMessages: user.sentMessages?.length || 0,
      roomsJoined: user.participantRooms?.filter(p => p.isActive()).length || 0,
      filesUploaded: user.uploadedFiles?.length || 0,
      lastActive: user.lastSeen,
    };
  }

  async blockUser(userId: string, blockedBy: string, reason: string, durationMinutes?: number): Promise<void> {
    const moderator = await this.getUserById(blockedBy);
    if (!moderator?.isModerator()) {
      throw new Error('Only moderators can block users');
    }

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isModerator()) {
      throw new Error('Cannot block moderators');
    }

    // TODO: Implement blocking logic
    // This would typically involve:
    // 1. Adding to a blocked_users table
    // 2. Disconnecting all user sessions
    // 3. Preventing login for the duration
    // 4. Logging the moderation action

    console.log(`User ${userId} blocked by ${blockedBy} for: ${reason}`);
  }

  private async getActiveSessions(userId: string): Promise<UserSession[]> {
    const sessions = await this.sessionRepository.find({
      where: { userId },
    });

    return UserSession.findActiveSessionsForUser(sessions);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async deleteUser(userId: string, deletedBy: string): Promise<void> {
    const deleter = await this.getUserById(deletedBy);
    if (!deleter?.isModerator()) {
      throw new Error('Only moderators can delete users');
    }

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isModerator() && user.id !== deletedBy) {
      throw new Error('Cannot delete other moderators');
    }

    // TODO: Implement proper user deletion
    // This should handle:
    // 1. Anonymizing or transferring messages
    // 2. Removing from all rooms
    // 3. Deleting sessions
    // 4. Handling file uploads

    await this.userRepository.remove(user);
  }

  async getUsersTypingInRoom(roomId: string): Promise<User[]> {
    // This would be implemented with Redis to track typing indicators
    // For now, return empty array
    return [];
  }
}