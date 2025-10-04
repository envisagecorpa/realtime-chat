'use strict';

/**
 * Room management handler for Socket.IO
 * Handles join_room, leave_room, create_room, delete_room events
 */

const { validateRoomName } = require('../../../shared/types/room-validation');
const Room = require('../models/Room');
const Message = require('../models/Message');
const StorageService = require('../services/StorageService');
const RoomService = require('../services/RoomService');
const MessageService = require('../services/MessageService');
const PresenceService = require('../services/PresenceService');

// Shared presence service instance
const presenceService = new PresenceService();

/**
 * Register room event handlers
 * @param {Socket} socket - Socket.IO socket instance
 */
function roomHandler(socket) {
  const dbPath = process.env.DB_PATH || ':memory:';
  const storageService = new StorageService(dbPath);
  const db = storageService.getDatabase();

  const roomModel = new Room(db);
  const messageModel = new Message(db);
  const roomService = new RoomService(roomModel);
  const messageService = new MessageService(messageModel);

  /**
   * Handle join_room event
   */
  socket.on('join_room', async (data) => {
    try {
      // Check authentication
      if (!socket.data.authenticated) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { roomName } = data || {};
      const username = socket.data.username;
      const userId = socket.data.userId;

      // Validate room name
      const validation = validateRoomName(roomName);
      if (!validation.valid) {
        socket.emit('error', { message: validation.error });
        return;
      }

      // Get or create room
      let room = roomModel.findByName(roomName);
      if (!room) {
        room = roomService.createRoom(roomName, userId);
      }

      // Check if room is deleted
      if (room.deleted_at !== null) {
        socket.emit('error', { message: 'Room not found or deleted' });
        return;
      }

      // Auto-leave previous room (FR-018)
      const previousRoomId = presenceService.getCurrentRoom(username);
      if (previousRoomId !== null && previousRoomId !== room.id) {
        const previousRoom = roomModel.findById(previousRoomId);
        if (previousRoom) {
          // Leave previous room
          socket.leave(`room:${previousRoomId}`);
          presenceService.removeUserFromRoom(previousRoomId, username);

          // Emit room_left to user
          socket.emit('room_left', { roomName: previousRoom.name });

          // Broadcast user_left to previous room
          socket.to(`room:${previousRoomId}`).emit('user_left', {
            username,
            roomName: previousRoom.name,
          });
        }
      }

      // Join new room
      socket.join(`room:${room.id}`);
      presenceService.addUserToRoom(room.id, username);

      // Store current room in socket data
      socket.data.currentRoomId = room.id;
      socket.data.currentRoomName = room.name;

      // Load recent messages (default 50)
      const { messages } = messageService.getMessageHistory(room.id, { limit: 50, offset: 0 });

      // Get users in room
      const users = presenceService.getUsersInRoom(room.id);

      // Emit room_joined to user
      socket.emit('room_joined', {
        roomId: room.id,
        roomName: room.name,
        users,
        messages: messages.map(msg => ({
          messageId: msg.id,
          content: msg.content,
          username: msg.username || 'unknown',
          timestamp: msg.timestamp,
        })),
      });

      // Broadcast user_joined to others in room (FR-005)
      socket.to(`room:${room.id}`).emit('user_joined', {
        username,
        roomName: room.name,
      });
    } catch (error) {
      socket.emit('error', { message: error.message || 'Failed to join room' });
    }
  });

  /**
   * Handle leave_room event
   */
  socket.on('leave_room', async () => {
    try {
      // Check authentication
      if (!socket.data.authenticated) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const username = socket.data.username;
      const currentRoomId = socket.data.currentRoomId;

      if (!currentRoomId) {
        socket.emit('error', { message: 'Not in any room' });
        return;
      }

      const room = roomModel.findById(currentRoomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Leave room
      socket.leave(`room:${currentRoomId}`);
      presenceService.removeUserFromRoom(currentRoomId, username);

      // Clear current room from socket data
      socket.data.currentRoomId = null;
      socket.data.currentRoomName = null;

      // Emit room_left to user
      socket.emit('room_left', { roomName: room.name });

      // Broadcast user_left to others
      socket.to(`room:${currentRoomId}`).emit('user_left', {
        username,
        roomName: room.name,
      });
    } catch (error) {
      socket.emit('error', { message: error.message || 'Failed to leave room' });
    }
  });

  /**
   * Handle create_room event
   */
  socket.on('create_room', async (data) => {
    try {
      // Check authentication
      if (!socket.data.authenticated) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { roomName } = data || {};
      const userId = socket.data.userId;
      const username = socket.data.username;

      // Validate room name
      const validation = validateRoomName(roomName);
      if (!validation.valid) {
        socket.emit('error', { message: validation.error });
        return;
      }

      // Check if room already exists
      const existing = roomModel.findByName(roomName);
      if (existing && existing.deleted_at === null) {
        socket.emit('error', { message: 'Room already exists' });
        return;
      }

      // Create room
      const room = roomService.createRoom(roomName, userId);

      // Emit room_created
      socket.emit('room_created', {
        roomId: room.id,
        roomName: room.name,
        createdBy: username,
      });
    } catch (error) {
      socket.emit('error', { message: error.message || 'Failed to create room' });
    }
  });

  /**
   * Handle delete_room event
   */
  socket.on('delete_room', async (data) => {
    try {
      // Check authentication
      if (!socket.data.authenticated) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { roomId } = data || {};
      const userId = socket.data.userId;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID required' });
        return;
      }

      const room = roomModel.findById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Check permission (only creator can delete)
      if (room.created_by_user_id !== userId) {
        socket.emit('error', { message: 'You do not have permission to delete this room' });
        return;
      }

      // Soft delete room
      roomService.deleteRoom(roomId, userId);

      // Remove all users from room
      const users = presenceService.getUsersInRoom(roomId);
      for (const user of users) {
        presenceService.removeUserFromRoom(roomId, user);
      }

      // Broadcast room_deleted to all users in room
      socket.to(`room:${roomId}`).emit('room_deleted', {
        roomId,
        roomName: room.name,
      });

      // Emit to deleter as well
      socket.emit('room_deleted', {
        roomId,
        roomName: room.name,
      });

      // Disconnect all sockets from room
      const socketsInRoom = await socket.in(`room:${roomId}`).fetchSockets();
      for (const s of socketsInRoom) {
        s.leave(`room:${roomId}`);
        if (s.data.currentRoomId === roomId) {
          s.data.currentRoomId = null;
          s.data.currentRoomName = null;
        }
      }
    } catch (error) {
      socket.emit('error', { message: error.message || 'Failed to delete room' });
    }
  });

  /**
   * Handle disconnect - auto leave rooms
   */
  socket.on('disconnect', () => {
    if (socket.data.authenticated && socket.data.username) {
      const username = socket.data.username;
      const currentRoomId = socket.data.currentRoomId;

      if (currentRoomId) {
        const room = roomModel.findById(currentRoomId);
        if (room) {
          presenceService.removeUserFromRoom(currentRoomId, username);

          // Broadcast user_left
          socket.to(`room:${currentRoomId}`).emit('user_left', {
            username,
            roomName: room.name,
          });
        }
      }
    }
  });
}

module.exports = roomHandler;
