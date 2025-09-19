import { Router, Request, Response } from 'express';
import { MessageService } from '../services/MessageService';
import { ChatRoomService } from '../services/ChatRoomService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { messageRateLimit, searchRateLimit } from '../middleware/rateLimiter';
import {
  createValidationChain,
  validateSendMessage,
  validateEditMessage,
  validateMessageQuery,
  validateUuidParam,
  validateSearch,
} from '../middleware/validation';
import { catchAsync } from '../middleware/errorHandler';
import { ResponseHelper } from '../utils/helpers';
import { appLogger } from '../utils/logger';

const router = Router();
const messageService = new MessageService();
const chatRoomService = new ChatRoomService();

// POST /api/messages
router.post(
  '/',
  authenticate,
  messageRateLimit,
  ...createValidationChain(...validateSendMessage()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { chatRoomId, content, messageType, parentMessageId } = req.body;

    const message = await messageService.sendMessage(req.userId, chatRoomId, {
      content,
      messageType,
      parentMessageId,
    });

    appLogger.logBusinessEvent('message_sent', {
      messageId: message.id,
      chatRoomId,
      senderId: req.userId,
      contentLength: content.length,
      messageType: messageType || 'text',
    });

    ResponseHelper.success(res, {
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      senderId: message.senderId,
      chatRoomId: message.chatRoomId,
      parentMessageId: message.parentMessageId,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        username: message.sender.username,
        displayName: message.sender.displayName,
      },
      attachments: message.attachments || [],
      readStatus: message.readStatus || [],
    }, 'Message sent successfully', 201);
  })
);

// GET /api/messages/:messageId
router.get(
  '/:messageId',
  authenticate,
  ...createValidationChain(validateUuidParam('messageId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { messageId } = req.params;

    const message = await messageService.getMessageById(messageId);

    if (!message) {
      return ResponseHelper.error(res, 'Message not found', 404);
    }

    // Check if user has access to this message's room
    if (!message.chatRoom.isParticipant(req.userId)) {
      return ResponseHelper.error(res, 'Access denied', 403);
    }

    ResponseHelper.success(res, {
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      senderId: message.senderId,
      chatRoomId: message.chatRoomId,
      parentMessageId: message.parentMessageId,
      editedAt: message.editedAt,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        username: message.sender.username,
        displayName: message.sender.displayName,
      },
      attachments: message.attachments || [],
      readStatus: message.readStatus || [],
    }, 'Message retrieved successfully');
  })
);

// PUT /api/messages/:messageId
router.put(
  '/:messageId',
  authenticate,
  ...createValidationChain(...validateEditMessage()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { messageId } = req.params;
    const { content } = req.body;

    const message = await messageService.editMessage(messageId, req.userId, content);

    appLogger.logBusinessEvent('message_edited', {
      messageId,
      editedBy: req.userId,
      newContentLength: content.length,
    });

    ResponseHelper.success(res, {
      id: message.id,
      content: message.content,
      editedAt: message.editedAt,
      updatedAt: message.updatedAt,
    }, 'Message updated successfully');
  })
);

// DELETE /api/messages/:messageId
router.delete(
  '/:messageId',
  authenticate,
  ...createValidationChain(validateUuidParam('messageId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { messageId } = req.params;

    await messageService.deleteMessage(messageId, req.userId);

    appLogger.logBusinessEvent('message_deleted', {
      messageId,
      deletedBy: req.userId,
    });

    ResponseHelper.success(res, null, 'Message deleted successfully');
  })
);

// POST /api/messages/:messageId/read
router.post(
  '/:messageId/read',
  authenticate,
  ...createValidationChain(validateUuidParam('messageId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { messageId } = req.params;

    await messageService.markMessageAsRead(messageId, req.userId);

    ResponseHelper.success(res, null, 'Message marked as read');
  })
);

// GET /api/messages/:messageId/delivery-status
router.get(
  '/:messageId/delivery-status',
  authenticate,
  ...createValidationChain(validateUuidParam('messageId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { messageId } = req.params;

    const deliveryStatus = await messageService.getMessageDeliveryStatus(messageId, req.userId);

    ResponseHelper.success(res, deliveryStatus, 'Message delivery status retrieved');
  })
);

// GET /api/rooms/:roomId/messages
router.get(
  '/rooms/:roomId',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId'), ...validateMessageQuery()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;
    const { before, after, limit = 50 } = req.query;

    const query: any = {
      limit: parseInt(limit as string),
    };

    if (before) {
      query.before = new Date(before as string);
    }

    if (after) {
      query.after = new Date(after as string);
    }

    const result = await messageService.getRoomMessages(roomId, req.userId, query);

    const messagesWithSender = result.data.map(message => ({
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      senderId: message.senderId,
      chatRoomId: message.chatRoomId,
      parentMessageId: message.parentMessageId,
      editedAt: message.editedAt,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        username: message.sender.username,
        displayName: message.sender.displayName,
      },
      attachments: message.attachments || [],
      readStatus: message.readStatus || [],
    }));

    ResponseHelper.success(res, {
      messages: messagesWithSender,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    }, 'Room messages retrieved');
  })
);

// GET /api/rooms/:roomId/messages/unread-count
router.get(
  '/rooms/:roomId/unread-count',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;

    const unreadCount = await messageService.getUnreadCount(roomId, req.userId);

    ResponseHelper.success(res, { count: unreadCount }, 'Unread count retrieved');
  })
);

// GET /api/rooms/:roomId/messages/search
router.get(
  '/rooms/:roomId/search',
  authenticate,
  searchRateLimit,
  ...createValidationChain(validateUuidParam('roomId'), ...validateSearch()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;
    const { q: searchTerm, limit = 20 } = req.query;

    if (!searchTerm) {
      return ResponseHelper.error(res, 'Search term is required', 400);
    }

    const messages = await messageService.searchMessages(
      roomId,
      req.userId,
      searchTerm as string,
      parseInt(limit as string)
    );

    const searchResults = messages.map(message => ({
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      senderId: message.senderId,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        username: message.sender.username,
        displayName: message.sender.displayName,
      },
    }));

    ResponseHelper.success(res, searchResults, 'Message search results');
  })
);

// GET /api/messages/recent
router.get(
  '/recent',
  authenticate,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { limit = 50 } = req.query;

    const messages = await messageService.getRecentMessagesAcrossRooms(
      req.userId,
      parseInt(limit as string)
    );

    const recentMessages = messages.map(message => ({
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      senderId: message.senderId,
      chatRoomId: message.chatRoomId,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        username: message.sender.username,
        displayName: message.sender.displayName,
      },
      chatRoom: {
        id: message.chatRoom.id,
        name: message.chatRoom.name,
        type: message.chatRoom.type,
      },
    }));

    ResponseHelper.success(res, recentMessages, 'Recent messages retrieved');
  })
);

export default router;