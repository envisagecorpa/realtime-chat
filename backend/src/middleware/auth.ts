import { Request, Response, NextFunction } from 'express';
import { AuthService, JwtPayload } from '../services/AuthService';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
  userId: string;
  sessionId: string;
}

export class AuthMiddleware {
  private authService = new AuthService();

  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No valid authorization header provided' });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      // Validate token and get payload
      const payload = await this.authService.validateToken(token);

      // Attach user information to request
      (req as AuthenticatedRequest).user = payload;
      (req as AuthenticatedRequest).userId = payload.userId;
      (req as AuthenticatedRequest).sessionId = payload.sessionId;

      // Update session heartbeat
      await this.authService.updateSessionHeartbeat(payload.sessionId);

      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };

  // Optional authentication - doesn't fail if no token provided
  optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        if (token) {
          const payload = await this.authService.validateToken(token);
          (req as AuthenticatedRequest).user = payload;
          (req as AuthenticatedRequest).userId = payload.userId;
          (req as AuthenticatedRequest).sessionId = payload.sessionId;

          await this.authService.updateSessionHeartbeat(payload.sessionId);
        }
      }

      next();
    } catch (error) {
      // Continue without authentication for optional routes
      next();
    }
  };

  // Require moderator role
  requireModerator = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (authReq.user.role !== 'moderator') {
      res.status(403).json({ error: 'Moderator access required' });
      return;
    }

    next();
  };

  // Check if user is authenticated and get user info from token
  extractUserInfo = (req: Request): JwtPayload | null => {
    const authReq = req as AuthenticatedRequest;
    return authReq.user || null;
  };

  // Validate session for Socket.IO connections
  validateSocketAuth = async (token: string): Promise<JwtPayload> => {
    if (!token) {
      throw new Error('No token provided');
    }

    try {
      return await this.authService.validateToken(token);
    } catch (error) {
      throw new Error('Invalid token');
    }
  };
}

// Create singleton instance
export const authMiddleware = new AuthMiddleware();

// Export individual middleware functions for easier use
export const authenticate = authMiddleware.authenticate;
export const optionalAuthenticate = authMiddleware.optionalAuthenticate;
export const requireModerator = authMiddleware.requireModerator;
export const extractUserInfo = authMiddleware.extractUserInfo;
export const validateSocketAuth = authMiddleware.validateSocketAuth;