'use strict';

/**
 * Message handler for Socket.IO
 * Handles send_message and load_messages events
 */

const Message = require('../models/Message');
const User = require('../models/User');
const StorageService = require('../services/StorageService');
const MessageService = require('../services/MessageService');

// Valid page sizes (FR-020)
const VALID_PAGE_SIZES = [50, 100, 200, 500];

/**
 * Register message event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {object} deps - Dependencies (messageModel, messageService, userModel)
 */
function messageHandler(socket, deps = {}) {
  // Use injected dependencies or create new ones (for backward compatibility with tests)
  let messageModel = deps.messageModel;
  let messageService = deps.messageService;
  let userModel = deps.userModel;

  if (!messageModel || !messageService || !userModel) {
    const dbPath = process.env.DB_PATH || ':memory:';
    const storageService = new StorageService(dbPath);
    const db = storageService.getDatabase();

    messageModel = messageModel || new Message(db);
    userModel = userModel || new User(db);
    messageService = messageService || new MessageService(messageModel);
  }

  /**
   * Handle send_message event
   */
  socket.on('send_message', async (data) => {
    try {
      // Check authentication
      if (!socket.data.authenticated) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Check if in a room
      const currentRoomId = socket.data.currentRoomId;
      if (!currentRoomId) {
        socket.emit('error', { message: 'Not in any room. Please join a room first.' });
        return;
      }

      const { content } = data || {};
      const userId = socket.data.userId;
      const username = socket.data.username;
      const timestamp = Date.now();

      // Send message (validates and sanitizes)
      const message = messageService.sendMessage({
        userId,
        roomId: currentRoomId,
        content,
        timestamp,
      });

      // Emit message_sent confirmation to sender (FR-012)
      socket.emit('message_sent', {
        messageId: message.id,
        content: message.content,
        username,
        timestamp: message.timestamp,
        status: message.delivery_status,
      });

      // Broadcast new_message to others in room (FR-002)
      socket.to(`room:${currentRoomId}`).emit('new_message', {
        messageId: message.id,
        content: message.content,
        username,
        timestamp: message.timestamp,
      });
    } catch (error) {
      socket.emit('error', { message: error.message || 'Failed to send message' });
    }
  });

  /**
   * Handle load_messages event
   */
  socket.on('load_messages', async (data) => {
    try {
      // Check authentication
      if (!socket.data.authenticated) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Check if in a room
      const currentRoomId = socket.data.currentRoomId;
      if (!currentRoomId) {
        socket.emit('error', { message: 'Not in any room. Please join a room first.' });
        return;
      }

      const { page = 1, pageSize = 50 } = data || {};

      // Validate page number
      if (page < 1) {
        socket.emit('error', { message: 'Invalid page number' });
        return;
      }

      // Validate page size
      if (!VALID_PAGE_SIZES.includes(pageSize)) {
        socket.emit('error', {
          message: `Invalid page size. Valid sizes: ${VALID_PAGE_SIZES.join(', ')}`,
        });
        return;
      }

      // Calculate offset
      const offset = (page - 1) * pageSize;

      // Get messages with pagination
      const result = messageService.getMessageHistory(currentRoomId, {
        limit: pageSize,
        offset,
      });

      // Add usernames to messages
      const messagesWithUsernames = result.messages.map(msg => {
        const user = userModel.findById(msg.user_id);
        return {
          messageId: msg.id,
          content: msg.content,
          username: user ? user.username : 'unknown',
          timestamp: msg.timestamp,
        };
      });

      // Emit messages_loaded
      socket.emit('messages_loaded', {
        messages: messagesWithUsernames,
        total: result.total,
        hasMore: result.hasMore,
      });
    } catch (error) {
      socket.emit('error', { message: error.message || 'Failed to load messages' });
    }
  });
}

module.exports = messageHandler;
