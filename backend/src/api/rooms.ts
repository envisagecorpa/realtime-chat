import { Router, Request, Response } from 'express';
import { ChatRoomService } from '../services/ChatRoomService';
import { MessageService } from '../services/MessageService';
import { PresenceService } from '../services/PresenceService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { roomCreationRateLimit, searchRateLimit } from '../middleware/rateLimiter';
import {
  createValidationChain,
  validateCreateRoom,
  validateUpdateRoom,
  validateAddParticipant,
  validateDirectMessage,
  validateUuidParam,
  validatePagination,
  validateSearch,
} from '../middleware/validation';
import { catchAsync } from '../middleware/errorHandler';
import { ResponseHelper } from '../utils/helpers';
import { appLogger } from '../utils/logger';

const router = Router();
const chatRoomService = new ChatRoomService();
const messageService = new MessageService();
const presenceService = new PresenceService();

// GET /api/rooms
router.get(
  '/',
  authenticate,
  ...createValidationChain(...validatePagination()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { type, active = 'true' } = req.query;

    const rooms = await chatRoomService.getUserRooms(req.userId, {
      type: type as any,
      active: active === 'true',
    });

    // Enhance room data with unread counts and online participants
    const enhancedRooms = await Promise.all(
      rooms.map(async (room) => {
        const unreadCount = await messageService.getUnreadCount(room.id, req.userId);
        const onlineUsers = await presenceService.getOnlineRoomUsers(room.id);

        return {
          id: room.id,
          name: room.name,
          description: room.description,
          type: room.type,
          isActive: room.isActive,
          maxParticipants: room.maxParticipants,
          participantCount: room.participantCount,
          unreadCount,
          onlineCount: onlineUsers.length,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
          createdBy: {
            id: room.createdBy.id,
            username: room.createdBy.username,
            displayName: room.createdBy.displayName,
          },
          userRole: room.getUserRole(req.userId),
          canManage: room.isAdmin(req.userId),
        };
      })
    );

    ResponseHelper.success(res, enhancedRooms, 'User rooms retrieved');
  })
);

// POST /api/rooms
router.post(
  '/',
  authenticate,
  roomCreationRateLimit,
  ...createValidationChain(...validateCreateRoom()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const roomData = req.body;

    const room = await chatRoomService.createRoom(req.userId, roomData);

    appLogger.logBusinessEvent('room_created', {
      roomId: room.id,
      roomName: room.name,
      roomType: room.type,
      createdBy: req.userId,
    });

    ResponseHelper.success(res, {
      id: room.id,
      name: room.name,
      description: room.description,
      type: room.type,
      isActive: room.isActive,
      maxParticipants: room.maxParticipants,
      participantCount: room.participantCount,
      createdAt: room.createdAt,
      createdBy: {
        id: room.createdBy.id,
        username: room.createdBy.username,
        displayName: room.createdBy.displayName,
      },
      participants: room.participants.map(p => ({
        id: p.id,
        role: p.role,
        joinedAt: p.joinedAt,
        user: {
          id: p.user.id,
          username: p.user.username,
          displayName: p.user.displayName,
        },
      })),
    }, 'Room created successfully', 201);
  })
);

// POST /api/rooms/direct
router.post(
  '/direct',
  authenticate,
  ...createValidationChain(...validateDirectMessage()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { otherUserId } = req.body;

    const room = await chatRoomService.createDirectMessage(req.userId, otherUserId);

    appLogger.logBusinessEvent('direct_message_created', {
      roomId: room.id,
      users: [req.userId, otherUserId],
    });

    ResponseHelper.success(res, {
      id: room.id,
      name: room.name,
      type: room.type,
      isActive: room.isActive,
      createdAt: room.createdAt,
      participants: room.participants.map(p => ({
        user: {
          id: p.user.id,
          username: p.user.username,
          displayName: p.user.displayName,
        },
      })),
    }, 'Direct message room created', 201);
  })
);

// GET /api/rooms/search
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

    const rooms = await chatRoomService.searchPublicRooms(
      searchTerm as string,
      parseInt(limit as string)
    );

    const roomData = rooms.map(room => ({
      id: room.id,
      name: room.name,
      description: room.description,
      type: room.type,
      participantCount: room.participantCount,
      maxParticipants: room.maxParticipants,
      createdAt: room.createdAt,
      createdBy: {
        id: room.createdBy.id,
        username: room.createdBy.username,
        displayName: room.createdBy.displayName,
      },
    }));

    ResponseHelper.success(res, roomData, 'Public rooms search results');
  })
);

// GET /api/rooms/:roomId
router.get(
  '/:roomId',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;

    const room = await chatRoomService.getRoomById(roomId);

    if (!room) {
      return ResponseHelper.error(res, 'Room not found', 404);
    }

    // Check if user is a participant
    if (!room.isParticipant(req.userId)) {
      return ResponseHelper.error(res, 'Access denied', 403);
    }

    const unreadCount = await messageService.getUnreadCount(roomId, req.userId);
    const onlineUsers = await presenceService.getOnlineRoomUsers(roomId);

    ResponseHelper.success(res, {
      id: room.id,
      name: room.name,
      description: room.description,
      type: room.type,
      isActive: room.isActive,
      maxParticipants: room.maxParticipants,
      participantCount: room.participantCount,
      unreadCount,
      onlineCount: onlineUsers.length,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      createdBy: {
        id: room.createdBy.id,
        username: room.createdBy.username,
        displayName: room.createdBy.displayName,
      },
      userRole: room.getUserRole(req.userId),
      canManage: room.isAdmin(req.userId),
      participants: room.activeParticipants.map(p => ({
        id: p.id,
        role: p.role,
        joinedAt: p.joinedAt,
        user: {
          id: p.user.id,
          username: p.user.username,
          displayName: p.user.displayName,
        },
        isOnline: onlineUsers.includes(p.userId),
      })),
    }, 'Room details retrieved');
  })
);

// PUT /api/rooms/:roomId
router.put(
  '/:roomId',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId'), ...validateUpdateRoom()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;
    const updateData = req.body;

    const updatedRoom = await chatRoomService.updateRoom(roomId, req.userId, updateData);

    appLogger.logBusinessEvent('room_updated', {
      roomId,
      updatedBy: req.userId,
      fields: Object.keys(updateData),
    });

    ResponseHelper.success(res, {
      id: updatedRoom.id,
      name: updatedRoom.name,
      description: updatedRoom.description,
      maxParticipants: updatedRoom.maxParticipants,
      updatedAt: updatedRoom.updatedAt,
    }, 'Room updated successfully');
  })
);

// DELETE /api/rooms/:roomId
router.delete(
  '/:roomId',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;

    await chatRoomService.deleteRoom(roomId, req.userId);

    appLogger.logBusinessEvent('room_deleted', {
      roomId,
      deletedBy: req.userId,
    });

    ResponseHelper.success(res, null, 'Room deleted successfully');
  })
);

// GET /api/rooms/:roomId/participants
router.get(
  '/:roomId/participants',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;

    const participants = await chatRoomService.getParticipants(roomId);
    const onlineUsers = await presenceService.getOnlineRoomUsers(roomId);

    const participantData = participants.map(p => ({
      id: p.id,
      role: p.role,
      joinedAt: p.joinedAt,
      user: {
        id: p.user.id,
        username: p.user.username,
        displayName: p.user.displayName,
      },
      isOnline: onlineUsers.includes(p.userId),
    }));

    ResponseHelper.success(res, participantData, 'Room participants retrieved');
  })
);

// POST /api/rooms/:roomId/participants
router.post(
  '/:roomId/participants',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId'), ...validateAddParticipant()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;
    const { userId, role = 'member' } = req.body;

    const participant = await chatRoomService.addParticipant(roomId, userId, req.userId, role);

    appLogger.logBusinessEvent('participant_added', {
      roomId,
      userId,
      role,
      addedBy: req.userId,
    });

    ResponseHelper.success(res, {
      id: participant.id,
      role: participant.role,
      joinedAt: participant.joinedAt,
      user: {
        id: participant.user.id,
        username: participant.user.username,
        displayName: participant.user.displayName,
      },
    }, 'Participant added successfully', 201);
  })
);

// DELETE /api/rooms/:roomId/participants/:userId
router.delete(
  '/:roomId/participants/:userId',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId'), validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId, userId } = req.params;

    await chatRoomService.removeParticipant(roomId, userId, req.userId);

    appLogger.logBusinessEvent('participant_removed', {
      roomId,
      userId,
      removedBy: req.userId,
    });

    ResponseHelper.success(res, null, 'Participant removed successfully');
  })
);

// POST /api/rooms/:roomId/participants/:userId/promote
router.post(
  '/:roomId/participants/:userId/promote',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId'), validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId, userId } = req.params;

    const participant = await chatRoomService.promoteParticipant(roomId, userId, req.userId);

    appLogger.logBusinessEvent('participant_promoted', {
      roomId,
      userId,
      promotedBy: req.userId,
    });

    ResponseHelper.success(res, {
      id: participant.id,
      role: participant.role,
      user: {
        id: participant.user.id,
        username: participant.user.username,
        displayName: participant.user.displayName,
      },
    }, 'Participant promoted to admin');
  })
);

// POST /api/rooms/:roomId/participants/:userId/demote
router.post(
  '/:roomId/participants/:userId/demote',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId'), validateUuidParam('userId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId, userId } = req.params;

    const participant = await chatRoomService.demoteParticipant(roomId, userId, req.userId);

    appLogger.logBusinessEvent('participant_demoted', {
      roomId,
      userId,
      demotedBy: req.userId,
    });

    ResponseHelper.success(res, {
      id: participant.id,
      role: participant.role,
      user: {
        id: participant.user.id,
        username: participant.user.username,
        displayName: participant.user.displayName,
      },
    }, 'Participant demoted from admin');
  })
);

// POST /api/rooms/:roomId/join
router.post(
  '/:roomId/join',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;

    const participant = await chatRoomService.addParticipant(roomId, req.userId, req.userId);

    appLogger.logBusinessEvent('room_joined', {
      roomId,
      userId: req.userId,
    });

    ResponseHelper.success(res, {
      id: participant.id,
      role: participant.role,
      joinedAt: participant.joinedAt,
    }, 'Joined room successfully', 201);
  })
);

// POST /api/rooms/:roomId/leave
router.post(
  '/:roomId/leave',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;

    await chatRoomService.removeParticipant(roomId, req.userId, req.userId);

    appLogger.logBusinessEvent('room_left', {
      roomId,
      userId: req.userId,
    });

    ResponseHelper.success(res, null, 'Left room successfully');
  })
);

export default router;