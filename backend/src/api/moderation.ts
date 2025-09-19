import { Router, Request, Response } from 'express';
import { ModerationService } from '../services/ModerationService';
import { authenticate, requireModerator, AuthenticatedRequest } from '../middleware/auth';
import { moderationRateLimit } from '../middleware/rateLimiter';
import {
  createValidationChain,
  validateModerationAction,
  validateFlagMessage,
  validateUuidParam,
  validatePagination,
} from '../middleware/validation';
import { catchAsync } from '../middleware/errorHandler';
import { ResponseHelper } from '../utils/helpers';
import { appLogger } from '../utils/logger';

const router = Router();
const moderationService = new ModerationService();

// POST /api/moderation/actions
router.post(
  '/actions',
  authenticate,
  requireModerator,
  moderationRateLimit,
  ...createValidationChain(...validateModerationAction()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const actionData = req.body;

    const action = await moderationService.createModerationAction(req.userId, actionData);

    appLogger.logModeration(
      action.type,
      action.moderatorId,
      action.targetUserId,
      action.reason
    );

    ResponseHelper.success(res, {
      id: action.id,
      type: action.type,
      targetUserId: action.targetUserId,
      moderatorId: action.moderatorId,
      reason: action.reason,
      duration: action.duration,
      roomId: action.roomId,
      messageId: action.messageId,
      createdAt: action.createdAt,
      expiresAt: action.expiresAt,
      isActive: action.isActive,
    }, 'Moderation action created', 201);
  })
);

// GET /api/moderation/actions
router.get(
  '/actions',
  authenticate,
  requireModerator,
  ...createValidationChain(...validatePagination()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { type, targetUserId, roomId, active, limit = 20, offset = 0 } = req.query;

    // This would need to be implemented in ModerationService
    // For now, return empty array
    const actions: any[] = [];

    ResponseHelper.paginated(
      res,
      actions,
      Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
      parseInt(limit as string),
      0,
      'Moderation actions retrieved'
    );
  })
);

// GET /api/moderation/actions/:actionId
router.get(
  '/actions/:actionId',
  authenticate,
  requireModerator,
  ...createValidationChain(validateUuidParam('actionId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { actionId } = req.params;

    const action = await moderationService.getModerationAction(actionId);

    if (!action) {
      return ResponseHelper.error(res, 'Moderation action not found', 404);
    }

    ResponseHelper.success(res, action, 'Moderation action retrieved');
  })
);

// DELETE /api/moderation/actions/:actionId
router.delete(
  '/actions/:actionId',
  authenticate,
  requireModerator,
  ...createValidationChain(validateUuidParam('actionId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { actionId } = req.params;

    await moderationService.revokeModerationAction(actionId, req.userId);

    appLogger.logModeration('revoke_action', req.userId, actionId, 'Action revoked');

    ResponseHelper.success(res, null, 'Moderation action revoked');
  })
);

// GET /api/moderation/users/:userId/actions
router.get(
  '/users/:userId/actions',
  authenticate,
  requireModerator,
  ...createValidationChain(validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { type, active } = req.query;

    const actions = await moderationService.getUserModerationActions(userId, {
      type: type as any,
      active: active === 'true',
    });

    ResponseHelper.success(res, actions, 'User moderation actions retrieved');
  })
);

// GET /api/moderation/rooms/:roomId/actions
router.get(
  '/rooms/:roomId/actions',
  authenticate,
  requireModerator,
  ...createValidationChain(validateUuidParam('roomId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;
    const { type, active } = req.query;

    const actions = await moderationService.getRoomModerationActions(roomId, {
      type: type as any,
      active: active === 'true',
    });

    ResponseHelper.success(res, actions, 'Room moderation actions retrieved');
  })
);

// POST /api/moderation/messages/:messageId/flag
router.post(
  '/messages/:messageId/flag',
  authenticate,
  ...createValidationChain(...validateFlagMessage()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { messageId } = req.params;
    const { reason } = req.body;

    await moderationService.flagMessage(messageId, req.userId, reason);

    appLogger.logModeration('flag_message', req.userId, messageId, reason);

    ResponseHelper.success(res, null, 'Message flagged successfully', 201);
  })
);

// GET /api/moderation/users/:userId/status
router.get(
  '/users/:userId/status',
  authenticate,
  ...createValidationChain(validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { roomId } = req.query;

    const [isMuted, isBanned] = await Promise.all([
      moderationService.isUserMuted(userId, roomId as string),
      moderationService.isUserBanned(userId, roomId as string),
    ]);

    ResponseHelper.success(res, {
      userId,
      roomId: roomId || null,
      isMuted,
      isBanned,
      restrictions: {
        canSendMessages: !isMuted && !isBanned,
        canJoinRooms: !isBanned,
      },
    }, 'User moderation status retrieved');
  })
);

// GET /api/moderation/rooms/:roomId/status
router.get(
  '/rooms/:roomId/status',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;

    const isLocked = await moderationService.isRoomLocked(roomId);

    ResponseHelper.success(res, {
      roomId,
      isLocked,
      restrictions: {
        canSendMessages: !isLocked,
        canJoinRoom: !isLocked,
      },
    }, 'Room moderation status retrieved');
  })
);

// GET /api/moderation/stats
router.get(
  '/stats',
  authenticate,
  requireModerator,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await moderationService.getModerationStats();

    ResponseHelper.success(res, stats, 'Moderation statistics retrieved');
  })
);

// POST /api/moderation/users/:userId/warn
router.post(
  '/users/:userId/warn',
  authenticate,
  requireModerator,
  ...createValidationChain(validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { reason, roomId } = req.body;

    if (!reason) {
      return ResponseHelper.error(res, 'Reason is required', 400);
    }

    const action = await moderationService.createModerationAction(req.userId, {
      type: 'warn',
      targetUserId: userId,
      reason,
      roomId,
    });

    appLogger.logModeration('warn', req.userId, userId, reason);

    ResponseHelper.success(res, action, 'User warned successfully', 201);
  })
);

// POST /api/moderation/users/:userId/mute
router.post(
  '/users/:userId/mute',
  authenticate,
  requireModerator,
  ...createValidationChain(validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { reason, duration, roomId } = req.body;

    if (!reason) {
      return ResponseHelper.error(res, 'Reason is required', 400);
    }

    const action = await moderationService.createModerationAction(req.userId, {
      type: 'mute',
      targetUserId: userId,
      reason,
      duration: duration ? parseInt(duration) : undefined,
      roomId,
    });

    appLogger.logModeration('mute', req.userId, userId, reason);

    ResponseHelper.success(res, action, 'User muted successfully', 201);
  })
);

// POST /api/moderation/users/:userId/kick
router.post(
  '/users/:userId/kick',
  authenticate,
  requireModerator,
  ...createValidationChain(validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { reason, roomId } = req.body;

    if (!reason || !roomId) {
      return ResponseHelper.error(res, 'Reason and room ID are required', 400);
    }

    const action = await moderationService.createModerationAction(req.userId, {
      type: 'kick',
      targetUserId: userId,
      reason,
      roomId,
    });

    appLogger.logModeration('kick', req.userId, userId, reason);

    ResponseHelper.success(res, action, 'User kicked successfully', 201);
  })
);

// POST /api/moderation/users/:userId/ban
router.post(
  '/users/:userId/ban',
  authenticate,
  requireModerator,
  ...createValidationChain(validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { reason, duration, roomId } = req.body;

    if (!reason) {
      return ResponseHelper.error(res, 'Reason is required', 400);
    }

    const action = await moderationService.createModerationAction(req.userId, {
      type: 'ban',
      targetUserId: userId,
      reason,
      duration: duration ? parseInt(duration) : undefined,
      roomId,
    });

    appLogger.logModeration('ban', req.userId, userId, reason);

    ResponseHelper.success(res, action, 'User banned successfully', 201);
  })
);

// POST /api/moderation/rooms/:roomId/lock
router.post(
  '/rooms/:roomId/lock',
  authenticate,
  requireModerator,
  ...createValidationChain(validateUuidParam('roomId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return ResponseHelper.error(res, 'Reason is required', 400);
    }

    const action = await moderationService.createModerationAction(req.userId, {
      type: 'room_lock',
      targetUserId: 'system', // No specific target user for room actions
      reason,
      roomId,
    });

    appLogger.logModeration('room_lock', req.userId, roomId, reason);

    ResponseHelper.success(res, action, 'Room locked successfully', 201);
  })
);

// POST /api/moderation/rooms/:roomId/unlock
router.post(
  '/rooms/:roomId/unlock',
  authenticate,
  requireModerator,
  ...createValidationChain(validateUuidParam('roomId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return ResponseHelper.error(res, 'Reason is required', 400);
    }

    const action = await moderationService.createModerationAction(req.userId, {
      type: 'room_unlock',
      targetUserId: 'system',
      reason,
      roomId,
    });

    appLogger.logModeration('room_unlock', req.userId, roomId, reason);

    ResponseHelper.success(res, action, 'Room unlocked successfully', 201);
  })
);

export default router;