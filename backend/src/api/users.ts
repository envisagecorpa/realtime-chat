import { Router, Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { PresenceService } from '../services/PresenceService';
import { authenticate, requireModerator, AuthenticatedRequest } from '../middleware/auth';
import { searchRateLimit } from '../middleware/rateLimiter';
import {
  createValidationChain,
  validateUserUpdate,
  validateUuidParam,
  validatePagination,
  validateSearch,
} from '../middleware/validation';
import { catchAsync } from '../middleware/errorHandler';
import { ResponseHelper } from '../utils/helpers';
import { appLogger } from '../utils/logger';

const router = Router();
const userService = new UserService();
const presenceService = new PresenceService();

// GET /api/users
router.get(
  '/',
  authenticate,
  ...createValidationChain(...validatePagination(), ...validateSearch()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { search, online, page = 1, limit = 20 } = req.query;

    const result = await userService.listUsers({
      search: search as string,
      online: online === 'true',
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    // Sanitize user data
    const sanitizedUsers = result.data.map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      lastSeen: user.lastSeen,
      createdAt: user.createdAt,
      isOnline: user.sessions && user.sessions.length > 0,
    }));

    ResponseHelper.paginated(
      res,
      sanitizedUsers,
      result.meta.page,
      result.meta.limit,
      result.meta.total,
      'Users retrieved successfully'
    );
  })
);

// GET /api/users/search
router.get(
  '/search',
  authenticate,
  searchRateLimit,
  ...createValidationChain(...validateSearch()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { q: searchTerm, limit = 10 } = req.query;

    if (!searchTerm) {
      return ResponseHelper.error(res, 'Search term is required', 400);
    }

    const users = await userService.searchUsers(
      searchTerm as string,
      parseInt(limit as string)
    );

    const sanitizedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      lastSeen: user.lastSeen,
      isOnline: false, // Would need to check presence service
    }));

    ResponseHelper.success(res, sanitizedUsers, 'Search results');
  })
);

// GET /api/users/online
router.get(
  '/online',
  authenticate,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const onlineUserIds = await presenceService.getOnlineUsers();

    // Get user details for online users
    const users = await Promise.all(
      onlineUserIds.map(async (userId) => {
        const user = await userService.getUserById(userId);
        const presence = await presenceService.getUserPresence(userId);

        return user ? {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          presence: presence ? {
            status: presence.status,
            lastSeen: presence.lastSeen,
            deviceInfo: presence.deviceInfo,
          } : null,
        } : null;
      })
    );

    const validUsers = users.filter(user => user !== null);

    ResponseHelper.success(res, validUsers, 'Online users retrieved');
  })
);

// GET /api/users/:userId
router.get(
  '/:userId',
  authenticate,
  ...createValidationChain(validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;

    const user = await userService.getUserById(userId);

    if (!user) {
      return ResponseHelper.error(res, 'User not found', 404);
    }

    const presence = await presenceService.getUserPresence(userId);

    const userData = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      lastSeen: user.lastSeen,
      createdAt: user.createdAt,
      presence: presence ? {
        status: presence.status,
        lastSeen: presence.lastSeen,
        deviceInfo: presence.deviceInfo,
      } : null,
    };

    // Add sensitive information only for self or moderators
    if (userId === req.userId || req.user.role === 'moderator') {
      (userData as any).email = user.email;
      (userData as any).updatedAt = user.updatedAt;
    }

    ResponseHelper.success(res, userData, 'User retrieved successfully');
  })
);

// PUT /api/users/:userId
router.put(
  '/:userId',
  authenticate,
  ...createValidationChain(validateUuidParam('userId'), ...validateUserUpdate()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;

    // Users can only update their own profile unless they're moderators
    if (userId !== req.userId && req.user.role !== 'moderator') {
      return ResponseHelper.error(res, 'Insufficient permissions', 403);
    }

    const updateData = req.body;

    const updatedUser = await userService.updateUser(userId, updateData);

    appLogger.logBusinessEvent('user_updated', {
      userId,
      updatedBy: req.userId,
      fields: Object.keys(updateData),
    });

    ResponseHelper.success(res, {
      id: updatedUser.id,
      username: updatedUser.username,
      displayName: updatedUser.displayName,
      email: updatedUser.email,
      role: updatedUser.role,
      lastSeen: updatedUser.lastSeen,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    }, 'User updated successfully');
  })
);

// GET /api/users/:userId/stats
router.get(
  '/:userId/stats',
  authenticate,
  ...createValidationChain(validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;

    // Users can only view their own stats unless they're moderators
    if (userId !== req.userId && req.user.role !== 'moderator') {
      return ResponseHelper.error(res, 'Insufficient permissions', 403);
    }

    const stats = await userService.getUserStats(userId);

    ResponseHelper.success(res, stats, 'User statistics retrieved');
  })
);

// POST /api/users/:userId/promote
router.post(
  '/:userId/promote',
  authenticate,
  requireModerator,
  ...createValidationChain(validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;

    const updatedUser = await userService.promoteToModerator(userId, req.userId);

    appLogger.logBusinessEvent('user_promoted', {
      userId,
      promotedBy: req.userId,
    });

    ResponseHelper.success(res, {
      id: updatedUser.id,
      username: updatedUser.username,
      displayName: updatedUser.displayName,
      role: updatedUser.role,
    }, 'User promoted to moderator');
  })
);

// POST /api/users/:userId/demote
router.post(
  '/:userId/demote',
  authenticate,
  requireModerator,
  ...createValidationChain(validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;

    const updatedUser = await userService.demoteFromModerator(userId, req.userId);

    appLogger.logBusinessEvent('user_demoted', {
      userId,
      demotedBy: req.userId,
    });

    ResponseHelper.success(res, {
      id: updatedUser.id,
      username: updatedUser.username,
      displayName: updatedUser.displayName,
      role: updatedUser.role,
    }, 'User demoted from moderator');
  })
);

// DELETE /api/users/:userId
router.delete(
  '/:userId',
  authenticate,
  requireModerator,
  ...createValidationChain(validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;

    await userService.deleteUser(userId, req.userId);

    appLogger.logBusinessEvent('user_deleted', {
      userId,
      deletedBy: req.userId,
    });

    ResponseHelper.success(res, null, 'User deleted successfully');
  })
);

// GET /api/users/:userId/presence
router.get(
  '/:userId/presence',
  authenticate,
  ...createValidationChain(validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;

    const presence = await presenceService.getUserPresence(userId);

    if (!presence) {
      return ResponseHelper.error(res, 'User presence not found', 404);
    }

    ResponseHelper.success(res, presence, 'User presence retrieved');
  })
);

// PUT /api/users/:userId/presence
router.put(
  '/:userId/presence',
  authenticate,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { status } = req.body;

    // Users can only update their own presence
    if (userId !== req.userId) {
      return ResponseHelper.error(res, 'Can only update your own presence', 403);
    }

    const validStatuses = ['online', 'away', 'offline'];
    if (!validStatuses.includes(status)) {
      return ResponseHelper.error(res, 'Invalid presence status', 400);
    }

    switch (status) {
      case 'online':
        await presenceService.setUserOnline(userId, req.sessionId);
        break;
      case 'away':
        await presenceService.setUserAway(userId);
        break;
      case 'offline':
        await presenceService.setUserOffline(userId);
        break;
    }

    ResponseHelper.success(res, { status }, 'Presence updated successfully');
  })
);

export default router;