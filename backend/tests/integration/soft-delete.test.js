'use strict';

/**
 * Integration test for soft delete rooms
 * Tests: create room → send messages → delete room → verify messages persist
 * Verify room hidden from active list, verify restore works
 */

const { io: Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authHandler = require('../../src/handlers/authHandler');
const roomHandler = require('../../src/handlers/roomHandler');
const messageHandler = require('../../src/handlers/messageHandler');
const StorageService = require('../../src/services/StorageService');
const Room = require('../../src/models/Room');
const Message = require('../../src/models/Message');

describe('Soft Delete Integration Test', () => {
  let httpServer, ioServer, clientSocket, storageService;
  const TEST_PORT = 3104;

  beforeEach((done) => {
    storageService = new StorageService(':memory:');

    httpServer = createServer();
    ioServer = new Server(httpServer);

    ioServer.on('connection', (socket) => {
      authHandler(socket);
      roomHandler(socket);
      messageHandler(socket);
    });

    httpServer.listen(TEST_PORT, done);
  });

  afterEach((done) => {
    if (clientSocket) clientSocket.disconnect();
    if (storageService) storageService.close();

    if (ioServer) {
      ioServer.close(() => {
        if (httpServer && httpServer.listening) {
          httpServer.close(done);
        } else {
          done();
        }
      });
    } else {
      done();
    }
  });

  describe('Soft delete behavior (FR-015)', () => {
    it('should soft delete room and persist messages', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      let roomId, messageId;

      clientSocket.on('authenticated', () => {
        clientSocket.emit('create_room', { roomName: 'temp-project' });
      });

      clientSocket.on('room_created', (data) => {
        roomId = data.roomId;
        clientSocket.emit('join_room', { roomName: 'temp-project' });
      });

      clientSocket.on('room_joined', () => {
        clientSocket.emit('send_message', { content: 'Important message' });
      });

      clientSocket.on('message_sent', (data) => {
        messageId = data.messageId;

        // Delete the room
        clientSocket.emit('delete_room', { roomId });
      });

      clientSocket.on('room_deleted', () => {
        // Verify room is soft deleted
        const db = storageService.getDatabase();
        const roomModel = new Room(db);
        const messageModel = new Message(db);

        const room = roomModel.findById(roomId);
        expect(room.deleted_at).not.toBeNull();

        // Verify message still exists
        const message = messageModel.findById(messageId);
        expect(message).not.toBeNull();
        expect(message.content).toBe('Important message');

        done();
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should hide soft-deleted room from active list', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      let roomId;

      clientSocket.on('authenticated', () => {
        clientSocket.emit('create_room', { roomName: 'temp-room' });
      });

      clientSocket.on('room_created', (data) => {
        roomId = data.roomId;

        // Delete room
        clientSocket.emit('delete_room', { roomId });
      });

      clientSocket.on('room_deleted', () => {
        // Check active rooms list
        const db = storageService.getDatabase();
        const roomModel = new Room(db);

        const activeRooms = roomModel.findAllActive();
        const deletedRoom = activeRooms.find(r => r.id === roomId);

        expect(deletedRoom).toBeUndefined();
        done();
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should support room restoration', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      let roomId;

      clientSocket.on('authenticated', () => {
        clientSocket.emit('create_room', { roomName: 'restorable-room' });
      });

      clientSocket.on('room_created', (data) => {
        roomId = data.roomId;

        // Delete room
        clientSocket.emit('delete_room', { roomId });
      });

      clientSocket.on('room_deleted', () => {
        // Restore room directly via model
        const db = storageService.getDatabase();
        const roomModel = new Room(db);

        const restored = roomModel.restore(roomId);
        expect(restored).toBe(true);

        // Verify room is active again
        const room = roomModel.findById(roomId);
        expect(room.deleted_at).toBeNull();

        const activeRooms = roomModel.findAllActive();
        const restoredRoom = activeRooms.find(r => r.id === roomId);
        expect(restoredRoom).toBeDefined();

        done();
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should preserve message count after soft delete', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      let roomId;
      const messageCount = 10;
      let sentCount = 0;

      clientSocket.on('authenticated', () => {
        clientSocket.emit('create_room', { roomName: 'message-test' });
      });

      clientSocket.on('room_created', (data) => {
        roomId = data.roomId;
        clientSocket.emit('join_room', { roomName: 'message-test' });
      });

      clientSocket.on('room_joined', () => {
        // Send multiple messages
        for (let i = 1; i <= messageCount; i++) {
          clientSocket.emit('send_message', { content: `Message ${i}` });
        }
      });

      clientSocket.on('message_sent', () => {
        sentCount++;

        if (sentCount === messageCount) {
          // Delete room
          clientSocket.emit('delete_room', { roomId });
        }
      });

      clientSocket.on('room_deleted', () => {
        // Verify all messages still exist
        const db = storageService.getDatabase();
        const messageModel = new Message(db);

        const result = messageModel.findByRoomPaginated(roomId, {
          limit: 100,
          offset: 0,
        });

        expect(result.total).toBe(messageCount);
        expect(result.messages.length).toBe(messageCount);

        done();
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('Permission enforcement', () => {
    it('should only allow creator to delete room', (done) => {
      const client1 = Client(`http://localhost:${TEST_PORT}`);
      const client2 = Client(`http://localhost:${TEST_PORT}`);

      let roomId;

      // Alice creates room
      client1.on('authenticated', () => {
        client1.emit('create_room', { roomName: 'alice-room' });
      });

      client1.on('room_created', (data) => {
        roomId = data.roomId;

        // Bob tries to delete
        client2.emit('authenticate', { username: 'bob' });
      });

      client2.on('authenticated', () => {
        client2.emit('delete_room', { roomId });
      });

      client2.on('error', (data) => {
        expect(data.message).toMatch(/permission/i);

        client1.disconnect();
        client2.disconnect();
        done();
      });

      client1.emit('authenticate', { username: 'alice' });
    });
  });

  describe('User removal on deletion', () => {
    it('should remove all users from deleted room', (done) => {
      const client1 = Client(`http://localhost:${TEST_PORT}`);
      const client2 = Client(`http://localhost:${TEST_PORT}`);

      let roomId;
      let bothJoined = false;

      // Alice creates and joins room
      client1.on('authenticated', () => {
        client1.emit('create_room', { roomName: 'temp-room' });
      });

      client1.on('room_created', (data) => {
        roomId = data.roomId;
        client1.emit('join_room', { roomName: 'temp-room' });
      });

      client1.on('room_joined', () => {
        // Bob joins
        client2.emit('authenticate', { username: 'bob' });
      });

      client2.on('authenticated', () => {
        client2.emit('join_room', { roomName: 'temp-room' });
      });

      client2.on('room_joined', () => {
        bothJoined = true;
        // Alice deletes room
        client1.emit('delete_room', { roomId });
      });

      let deletedCount = 0;
      const checkCompletion = () => {
        deletedCount++;
        if (deletedCount === 2) {
          expect(bothJoined).toBe(true);
          client1.disconnect();
          client2.disconnect();
          done();
        }
      };

      client1.on('room_deleted', checkCompletion);
      client2.on('room_deleted', checkCompletion);

      client1.emit('authenticate', { username: 'alice' });
    });
  });
});
