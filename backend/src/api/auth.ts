import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimiter';
import { createValidationChain, validateLogin } from '../middleware/validation';
import { catchAsync } from '../middleware/errorHandler';
import { ResponseHelper } from '../utils/helpers';
import { appLogger } from '../utils/logger';

const router = Router();
const authService = new AuthService();
const userService = new UserService();

// POST /api/auth/login
router.post(
  '/login',
  authRateLimit,
  ...createValidationChain(...validateLogin()),
  catchAsync(async (req: Request, res: Response) => {
    const { username, displayName, deviceInfo } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    appLogger.logAuthentication('login_attempt', undefined, ipAddress);

    try {
      const result = await authService.login(
        username,
        displayName,
        deviceInfo,
        ipAddress,
        userAgent
      );

      appLogger.logAuthentication('login_success', result.user.id, ipAddress);

      ResponseHelper.success(res, {
        user: {
          id: result.user.id,
          username: result.user.username,
          displayName: result.user.displayName,
          role: result.user.role,
          lastSeen: result.user.lastSeen,
          createdAt: result.user.createdAt,
        },
        token: result.token,
        session: {
          id: result.session.id,
          socketId: result.session.socketId,
          deviceInfo: result.session.deviceInfo,
          createdAt: result.session.createdAt,
        },
      }, 'Login successful');
    } catch (error) {
      appLogger.logAuthentication('login_failed', undefined, ipAddress, false);
      throw error;
    }
  })
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  authenticate,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const currentToken = req.headers.authorization?.substring(7); // Remove 'Bearer '

    if (!currentToken) {
      return ResponseHelper.error(res, 'No token provided', 400);
    }

    const newToken = await authService.refreshToken(currentToken);

    appLogger.logAuthentication('token_refresh', req.userId, req.ip);

    ResponseHelper.success(res, { token: newToken }, 'Token refreshed successfully');
  })
);

// POST /api/auth/logout
router.post(
  '/logout',
  authenticate,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const token = req.headers.authorization?.substring(7);

    if (token) {
      await authService.logout(token);
    }

    appLogger.logAuthentication('logout', req.userId, req.ip);

    ResponseHelper.success(res, null, 'Logged out successfully');
  })
);

// POST /api/auth/logout-all
router.post(
  '/logout-all',
  authenticate,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    await authService.logoutAllSessions(req.userId);

    appLogger.logAuthentication('logout_all_sessions', req.userId, req.ip);

    ResponseHelper.success(res, null, 'Logged out from all sessions');
  })
);

// GET /api/auth/me
router.get(
  '/me',
  authenticate,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const user = await userService.getUserById(req.userId);

    if (!user) {
      return ResponseHelper.error(res, 'User not found', 404);
    }

    ResponseHelper.success(res, {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      lastSeen: user.lastSeen,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isOnline: user.sessions && user.sessions.length > 0,
    }, 'User profile retrieved');
  })
);

// GET /api/auth/sessions
router.get(
  '/sessions',
  authenticate,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const sessions = await authService.getActiveSessions(req.userId);

    const sessionData = sessions.map(session => ({
      id: session.id,
      socketId: session.socketId,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      presenceStatus: session.presenceStatus,
      lastHeartbeat: session.lastHeartbeat,
      createdAt: session.createdAt,
      isCurrent: session.id === req.sessionId,
    }));

    ResponseHelper.success(res, sessionData, 'Active sessions retrieved');
  })
);

// DELETE /api/auth/sessions/:sessionId
router.delete(
  '/sessions/:sessionId',
  authenticate,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { sessionId } = req.params;

    // Verify the session belongs to the user
    const sessions = await authService.getActiveSessions(req.userId);
    const targetSession = sessions.find(s => s.id === sessionId);

    if (!targetSession) {
      return ResponseHelper.error(res, 'Session not found', 404);
    }

    // Prevent terminating current session
    if (sessionId === req.sessionId) {
      return ResponseHelper.error(res, 'Cannot terminate current session', 400);
    }

    // Terminate the session by updating it
    targetSession.disconnect();
    // Note: You'd need to save this through the session repository
    // This is a simplified implementation

    appLogger.logAuthentication('session_terminated', req.userId, req.ip);

    ResponseHelper.success(res, null, 'Session terminated');
  })
);

// GET /api/auth/validate
router.get(
  '/validate',
  authenticate,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    // If we reach here, the token is valid (middleware validated it)
    ResponseHelper.success(res, {
      valid: true,
      user: {
        id: req.user.userId,
        username: req.user.username,
        role: req.user.role,
        sessionId: req.user.sessionId,
      },
    }, 'Token is valid');
  })
);

export default router;