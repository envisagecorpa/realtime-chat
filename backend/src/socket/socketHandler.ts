import { Server as SocketIOServer, Socket } from 'socket.io';
import { validateSocketAuth } from '../middleware/auth';
import { MessageService } from '../services/MessageService';
import { ChatRoomService } from '../services/ChatRoomService';
import { PresenceService } from '../services/PresenceService';
import { ModerationService } from '../services/ModerationService';
import { validateSocketEvent, socketEventRules } from '../middleware/validation';
import { socketRateLimiter } from '../middleware/rateLimiter';
import { appLogger } from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId: string;
  username: string;
  sessionId: string;
  role: string;
}

export class SocketHandler {
  private io: SocketIOServer;
  private messageService: MessageService;
  private chatRoomService: ChatRoomService;
  private presenceService: PresenceService;
  private moderationService: ModerationService;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.messageService = new MessageService();
    this.chatRoomService = new ChatRoomService();
    this.presenceService = new PresenceService();
    this.moderationService = new ModerationService();

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
          return next(new Error('No authentication token provided'));
        }

        const payload = await validateSocketAuth(token as string);

        (socket as AuthenticatedSocket).userId = payload.userId;
        (socket as AuthenticatedSocket).username = payload.username;
        (socket as AuthenticatedSocket).sessionId = payload.sessionId;
        (socket as AuthenticatedSocket).role = payload.role;

        appLogger.logSocketEvent('user_connected', socket.id, payload.userId);
        next();
      } catch (error) {
        appLogger.logSocketEvent('auth_failed', socket.id, undefined, { error: error.message });
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    const { userId, sessionId } = socket;

    try {
      // Register socket connection and set user online
      await Promise.all([
        this.presenceService.registerSession(userId, sessionId, socket.id),
        this.presenceService.setUserOnline(userId, sessionId),
      ]);

      // Join user to their personal room for private messages
      socket.join(`user:${userId}`);

      // Set up event handlers
      this.setupSocketEvents(socket);

      // Handle disconnection
      socket.on('disconnect', () => this.handleDisconnection(socket));

      // Send initial connection success
      socket.emit('connected', {
        socketId: socket.id,
        userId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      appLogger.error('Socket connection setup failed', error, { userId, socketId: socket.id });
      socket.emit('error', { message: 'Connection setup failed' });
      socket.disconnect();
    }
  }

  private setupSocketEvents(socket: AuthenticatedSocket): void {
    // Message events
    socket.on('send_message', (data, callback) => this.handleSendMessage(socket, data, callback));
    socket.on('edit_message', (data, callback) => this.handleEditMessage(socket, data, callback));
    socket.on('delete_message', (data, callback) => this.handleDeleteMessage(socket, data, callback));
    socket.on('mark_read', (data, callback) => this.handleMarkRead(socket, data, callback));

    // Room events
    socket.on('join_room', (data, callback) => this.handleJoinRoom(socket, data, callback));
    socket.on('leave_room', (data, callback) => this.handleLeaveRoom(socket, data, callback));

    // Presence events
    socket.on('typing_start', (data, callback) => this.handleTypingStart(socket, data, callback));
    socket.on('typing_stop', (data, callback) => this.handleTypingStop(socket, data, callback));
    socket.on('presence_update', (data, callback) => this.handlePresenceUpdate(socket, data, callback));

    // Heartbeat
    socket.on('heartbeat', (data, callback) => this.handleHeartbeat(socket, data, callback));

    // Error handling
    socket.on('error', (error) => {
      appLogger.logSocketEvent('socket_error', socket.id, socket.userId, { error });
    });
  }

  private async handleSendMessage(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ): Promise<void> {
    try {
      // Rate limiting
      if (!await socketRateLimiter.checkLimit('send_message', socket.userId)) {
        return this.sendError(callback, 'Rate limit exceeded for sending messages');
      }

      // Validate event data
      const validation = validateSocketEvent(data, socketEventRules.send_message);
      if (!validation.isValid) {
        return this.sendError(callback, 'Invalid message data', validation.errors);
      }

      const { chatRoomId, content, messageType, parentMessageId } = data;

      // Check if user is muted or banned
      const [isMuted, isBanned] = await Promise.all([
        this.moderationService.isUserMuted(socket.userId, chatRoomId),
        this.moderationService.isUserBanned(socket.userId, chatRoomId),
      ]);

      if (isMuted || isBanned) {
        return this.sendError(callback, 'You are not allowed to send messages in this room');
      }

      // Check if room is locked
      const isRoomLocked = await this.moderationService.isRoomLocked(chatRoomId);
      if (isRoomLocked && socket.role !== 'moderator') {
        return this.sendError(callback, 'This room is currently locked');
      }

      // Send message
      const message = await this.messageService.sendMessage(socket.userId, chatRoomId, {
        content,
        messageType,
        parentMessageId,
      });

      // Broadcast to room participants
      socket.to(`room:${chatRoomId}`).emit('new_message', {
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
      });

      // Publish presence change if this is the user's first message
      await this.presenceService.publishPresenceChange(socket.userId, 'online', [chatRoomId]);

      this.sendSuccess(callback, { messageId: message.id });

      appLogger.logSocketEvent('message_sent', socket.id, socket.userId, {
        messageId: message.id,
        chatRoomId,
        contentLength: content.length,
      });

    } catch (error) {
      appLogger.error('Send message failed', error, {
        userId: socket.userId,
        socketId: socket.id,
        data,
      });
      this.sendError(callback, 'Failed to send message');
    }
  }

  private async handleEditMessage(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ): Promise<void> {
    try {
      const { messageId, content } = data;

      if (!messageId || !content) {
        return this.sendError(callback, 'Message ID and content are required');
      }

      const message = await this.messageService.editMessage(messageId, socket.userId, content);

      // Broadcast to room participants
      socket.to(`room:${message.chatRoomId}`).emit('message_edited', {
        id: message.id,
        content: message.content,
        editedAt: message.editedAt,
      });

      this.sendSuccess(callback, { messageId: message.id });

      appLogger.logSocketEvent('message_edited', socket.id, socket.userId, { messageId });

    } catch (error) {
      appLogger.error('Edit message failed', error, { userId: socket.userId, data });
      this.sendError(callback, error.message || 'Failed to edit message');
    }
  }

  private async handleDeleteMessage(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ): Promise<void> {
    try {
      const { messageId } = data;

      if (!messageId) {
        return this.sendError(callback, 'Message ID is required');
      }

      // Get message first to know which room to broadcast to
      const message = await this.messageService.getMessageById(messageId);
      if (!message) {
        return this.sendError(callback, 'Message not found');
      }

      await this.messageService.deleteMessage(messageId, socket.userId);

      // Broadcast to room participants
      socket.to(`room:${message.chatRoomId}`).emit('message_deleted', {
        messageId,
        deletedBy: socket.userId,
      });

      this.sendSuccess(callback, { messageId });

      appLogger.logSocketEvent('message_deleted', socket.id, socket.userId, { messageId });

    } catch (error) {
      appLogger.error('Delete message failed', error, { userId: socket.userId, data });
      this.sendError(callback, error.message || 'Failed to delete message');
    }
  }

  private async handleMarkRead(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ): Promise<void> {
    try {
      const validation = validateSocketEvent(data, socketEventRules.mark_read);
      if (!validation.isValid) {
        return this.sendError(callback, 'Invalid data', validation.errors);
      }

      const { messageId } = data;

      await this.messageService.markMessageAsRead(messageId, socket.userId);

      // Get message to know which room to broadcast to
      const message = await this.messageService.getMessageById(messageId);
      if (message) {
        socket.to(`room:${message.chatRoomId}`).emit('message_read', {
          messageId,
          userId: socket.userId,
          readAt: new Date().toISOString(),
        });
      }

      this.sendSuccess(callback);

    } catch (error) {
      appLogger.error('Mark read failed', error, { userId: socket.userId, data });
      this.sendError(callback, error.message || 'Failed to mark message as read');
    }
  }

  private async handleJoinRoom(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ): Promise<void> {
    try {
      if (!await socketRateLimiter.checkLimit('join_room', socket.userId)) {
        return this.sendError(callback, 'Rate limit exceeded for joining rooms');
      }

      const validation = validateSocketEvent(data, socketEventRules.join_room);
      if (!validation.isValid) {
        return this.sendError(callback, 'Invalid data', validation.errors);
      }

      const { chatRoomId } = data;

      // Verify user is a participant
      const room = await this.chatRoomService.getRoomById(chatRoomId);
      if (!room || !room.isParticipant(socket.userId)) {
        return this.sendError(callback, 'Access denied to this room');
      }

      // Join socket room
      socket.join(`room:${chatRoomId}`);

      // Add user to room presence
      await this.presenceService.addUserToRoom(socket.userId, chatRoomId);

      // Notify other room members
      socket.to(`room:${chatRoomId}`).emit('user_joined_room', {
        userId: socket.userId,
        username: socket.username,
        roomId: chatRoomId,
        timestamp: new Date().toISOString(),
      });

      this.sendSuccess(callback, { roomId: chatRoomId });

      appLogger.logSocketEvent('room_joined', socket.id, socket.userId, { chatRoomId });

    } catch (error) {
      appLogger.error('Join room failed', error, { userId: socket.userId, data });
      this.sendError(callback, error.message || 'Failed to join room');
    }
  }

  private async handleLeaveRoom(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ): Promise<void> {
    try {
      const validation = validateSocketEvent(data, socketEventRules.leave_room);
      if (!validation.isValid) {
        return this.sendError(callback, 'Invalid data', validation.errors);
      }

      const { chatRoomId } = data;

      // Leave socket room
      socket.leave(`room:${chatRoomId}`);

      // Remove user from room presence
      await this.presenceService.removeUserFromRoom(socket.userId, chatRoomId);

      // Stop typing if user was typing
      await this.presenceService.removeTypingIndicator(socket.userId, chatRoomId);

      // Notify other room members
      socket.to(`room:${chatRoomId}`).emit('user_left_room', {
        userId: socket.userId,
        username: socket.username,
        roomId: chatRoomId,
        timestamp: new Date().toISOString(),
      });

      this.sendSuccess(callback, { roomId: chatRoomId });

      appLogger.logSocketEvent('room_left', socket.id, socket.userId, { chatRoomId });

    } catch (error) {
      appLogger.error('Leave room failed', error, { userId: socket.userId, data });
      this.sendError(callback, error.message || 'Failed to leave room');
    }
  }

  private async handleTypingStart(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ): Promise<void> {
    try {
      if (!await socketRateLimiter.checkLimit('typing_start', socket.userId)) {
        return this.sendSuccess(callback); // Don't error on typing rate limits
      }

      const validation = validateSocketEvent(data, socketEventRules.typing_start);
      if (!validation.isValid) {
        return this.sendError(callback, 'Invalid data', validation.errors);
      }

      const { chatRoomId } = data;

      await this.presenceService.setTypingIndicator(socket.userId, chatRoomId);

      socket.to(`room:${chatRoomId}`).emit('user_typing', {
        userId: socket.userId,
        username: socket.username,
        roomId: chatRoomId,
        isTyping: true,
      });

      this.sendSuccess(callback);

    } catch (error) {
      appLogger.error('Typing start failed', error, { userId: socket.userId, data });
      this.sendError(callback, 'Failed to set typing indicator');
    }
  }

  private async handleTypingStop(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ): Promise<void> {
    try {
      const validation = validateSocketEvent(data, socketEventRules.typing_stop);
      if (!validation.isValid) {
        return this.sendError(callback, 'Invalid data', validation.errors);
      }

      const { chatRoomId } = data;

      await this.presenceService.removeTypingIndicator(socket.userId, chatRoomId);

      socket.to(`room:${chatRoomId}`).emit('user_typing', {
        userId: socket.userId,
        username: socket.username,
        roomId: chatRoomId,
        isTyping: false,
      });

      this.sendSuccess(callback);

    } catch (error) {
      appLogger.error('Typing stop failed', error, { userId: socket.userId, data });
      this.sendError(callback, 'Failed to remove typing indicator');
    }
  }

  private async handlePresenceUpdate(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ): Promise<void> {
    try {
      const { status } = data;
      const validStatuses = ['online', 'away', 'offline'];

      if (!validStatuses.includes(status)) {
        return this.sendError(callback, 'Invalid presence status');
      }

      switch (status) {
        case 'online':
          await this.presenceService.setUserOnline(socket.userId, socket.sessionId);
          break;
        case 'away':
          await this.presenceService.setUserAway(socket.userId);
          break;
        case 'offline':
          await this.presenceService.setUserOffline(socket.userId);
          break;
      }

      // Broadcast presence change
      await this.presenceService.publishPresenceChange(socket.userId, status as any);

      this.sendSuccess(callback, { status });

    } catch (error) {
      appLogger.error('Presence update failed', error, { userId: socket.userId, data });
      this.sendError(callback, 'Failed to update presence');
    }
  }

  private async handleHeartbeat(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ): Promise<void> {
    try {
      await this.presenceService.updateHeartbeat(socket.userId);
      this.sendSuccess(callback, { timestamp: new Date().toISOString() });
    } catch (error) {
      appLogger.error('Heartbeat failed', error, { userId: socket.userId });
      this.sendError(callback, 'Heartbeat failed');
    }
  }

  private async handleDisconnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const { userId, sessionId } = socket;

      // Unregister session
      await this.presenceService.unregisterSession(sessionId);

      // Remove from all typing indicators
      // This could be optimized by tracking which rooms the user was in

      appLogger.logSocketEvent('user_disconnected', socket.id, userId);

    } catch (error) {
      appLogger.error('Disconnection handling failed', error, {
        userId: socket.userId,
        socketId: socket.id,
      });
    }
  }

  private sendSuccess(callback: Function, data?: any): void {
    if (callback) {
      callback({ success: true, data });
    }
  }

  private sendError(callback: Function, message: string, details?: any): void {
    if (callback) {
      callback({ success: false, error: { message, details } });
    }
  }

  // Method to broadcast to specific users
  public broadcastToUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  // Method to broadcast to room
  public broadcastToRoom(roomId: string, event: string, data: any): void {
    this.io.to(`room:${roomId}`).emit(event, data);
  }

  // Method to get online users in a room
  public async getRoomSockets(roomId: string): Promise<string[]> {
    const sockets = await this.io.in(`room:${roomId}`).fetchSockets();
    return sockets.map(socket => socket.id);
  }
}