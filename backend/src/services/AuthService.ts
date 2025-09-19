import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../models/User';
import { UserSession } from '../models/UserSession';

export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
  sessionId: string;
}

export interface LoginResult {
  user: User;
  token: string;
  session: UserSession;
}

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);
  private sessionRepository = AppDataSource.getRepository(UserSession);
  private jwtSecret = process.env.JWT_SECRET || 'default-secret';
  private jwtExpiration = process.env.JWT_EXPIRATION || '24h';

  async login(
    username: string,
    displayName?: string,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    // Validate username
    if (!this.isValidUsername(username)) {
      throw new Error('Invalid username format');
    }

    // Find or create user
    let user = await this.userRepository.findOne({ where: { username } });

    if (!user) {
      user = await this.createUser(username, displayName);
    } else if (displayName && !user.displayName) {
      // Update display name if provided and not set
      user.displayName = displayName;
      await this.userRepository.save(user);
    }

    // Create new session
    const socketId = this.generateSocketId();
    const session = await this.createSession(user, socketId, ipAddress, userAgent, deviceInfo);

    // Generate JWT token
    const token = this.generateToken(user, session);

    // Update user's last seen
    user.updateLastSeen();
    await this.userRepository.save(user);

    return { user, token, session };
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;

      // Verify session still exists and is active
      const session = await this.sessionRepository.findOne({
        where: { id: payload.sessionId },
        relations: ['user'],
      });

      if (!session || !session.isActive() || session.hasExpired()) {
        throw new Error('Session expired or invalid');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async getUserFromToken(token: string): Promise<User> {
    const payload = await this.validateToken(token);
    const user = await this.userRepository.findOne({ where: { id: payload.userId } });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async refreshToken(currentToken: string): Promise<string> {
    const payload = await this.validateToken(currentToken);
    const user = await this.userRepository.findOne({ where: { id: payload.userId } });
    const session = await this.sessionRepository.findOne({ where: { id: payload.sessionId } });

    if (!user || !session) {
      throw new Error('Invalid token refresh');
    }

    // Update session heartbeat
    session.updateHeartbeat();
    await this.sessionRepository.save(session);

    return this.generateToken(user, session);
  }

  async logout(token: string): Promise<void> {
    try {
      const payload = await this.validateToken(token);
      const session = await this.sessionRepository.findOne({ where: { id: payload.sessionId } });

      if (session) {
        session.disconnect();
        await this.sessionRepository.save(session);
      }
    } catch (error) {
      // Token might be invalid, but still try to clean up
    }
  }

  async logoutAllSessions(userId: string): Promise<void> {
    await this.sessionRepository.update(
      { userId, disconnectedAt: null as any },
      { disconnectedAt: new Date(), presenceStatus: 'offline' }
    );
  }

  async createSession(
    user: User,
    socketId: string,
    ipAddress?: string,
    userAgent?: string,
    deviceInfo?: any
  ): Promise<UserSession> {
    const session = this.sessionRepository.create(
      UserSession.createSession(user, socketId, ipAddress, userAgent, deviceInfo)
    );

    return await this.sessionRepository.save(session);
  }

  async updateSessionHeartbeat(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });

    if (session && session.isActive()) {
      session.updateHeartbeat();
      await this.sessionRepository.save(session);
    }
  }

  async getActiveSessions(userId: string): Promise<UserSession[]> {
    const sessions = await this.sessionRepository.find({
      where: { userId },
      relations: ['user'],
    });

    return UserSession.findActiveSessionsForUser(sessions);
  }

  async cleanupExpiredSessions(): Promise<number> {
    const expiredSessions = await this.sessionRepository
      .createQueryBuilder('session')
      .where('session.disconnectedAt IS NULL')
      .andWhere('session.lastHeartbeat < :expiredTime', {
        expiredTime: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
      })
      .getMany();

    for (const session of expiredSessions) {
      session.disconnect();
    }

    if (expiredSessions.length > 0) {
      await this.sessionRepository.save(expiredSessions);
    }

    return expiredSessions.length;
  }

  private async createUser(username: string, displayName?: string): Promise<User> {
    const user = this.userRepository.create({
      username,
      displayName,
      role: UserRole.MEMBER,
    });

    return await this.userRepository.save(user);
  }

  private generateToken(user: User, session: UserSession): string {
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      sessionId: session.id,
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiration });
  }

  private generateSocketId(): string {
    return `socket_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private isValidUsername(username: string): boolean {
    // Username must be 3-50 characters, alphanumeric and underscores only
    const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
    return usernameRegex.test(username);
  }

  // Rate limiting helpers
  private static loginAttempts = new Map<string, { count: number; lastAttempt: Date }>();

  static checkRateLimit(identifier: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
    const now = new Date();
    const attempts = this.loginAttempts.get(identifier);

    if (!attempts) {
      this.loginAttempts.set(identifier, { count: 1, lastAttempt: now });
      return true;
    }

    // Reset if window has passed
    if (now.getTime() - attempts.lastAttempt.getTime() > windowMs) {
      this.loginAttempts.set(identifier, { count: 1, lastAttempt: now });
      return true;
    }

    // Check if over limit
    if (attempts.count >= maxAttempts) {
      return false;
    }

    // Increment counter
    attempts.count++;
    attempts.lastAttempt = now;
    return true;
  }

  static clearRateLimit(identifier: string): void {
    this.loginAttempts.delete(identifier);
  }
}