'use strict';

/**
 * Integration test for user login flow
 * Tests: authenticate → join_room → verify presence broadcast (PR-003 <500ms)
 * Uses real Socket.IO server + in-memory DB
 */

const { io: Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authHandler = require('../../src/handlers/authHandler');
const roomHandler = require('../../src/handlers/roomHandler');
const StorageService = require('../../src/services/StorageService');

describe('User Login Flow Integration Test', () => {
  let httpServer, ioServer, clientSocket1, clientSocket2;
  const TEST_PORT = 3100;
  let storageService;

  beforeEach((done) => {
    // Initialize in-memory database
    storageService = new StorageService(':memory:');

    httpServer = createServer();
    ioServer = new Server(httpServer);

    ioServer.on('connection', (socket) => {
      authHandler(socket);
      roomHandler(socket);
    });

    httpServer.listen(TEST_PORT, done);
  });

  afterEach((done) => {
    if (clientSocket1) clientSocket1.disconnect();
    if (clientSocket2) clientSocket2.disconnect();
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

  describe('Complete login flow', () => {
    it('should complete authenticate → join_room flow', (done) => {
      clientSocket1 = Client(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('authenticated', (data) => {
        expect(data.username).toBe('alice');
        expect(data.userId).toBeGreaterThan(0);

        // Join room after authentication
        clientSocket1.emit('join_room', { roomName: 'general' });
      });

      clientSocket1.on('room_joined', (data) => {
        expect(data.roomName).toBe('general');
        expect(data.roomId).toBeGreaterThan(0);
        expect(data.users).toContain('alice');
        expect(data.messages).toBeInstanceOf(Array);
        done();
      });

      clientSocket1.emit('authenticate', { username: 'alice' });
    });

    it('should broadcast presence within 500ms (PR-003)', (done) => {
      clientSocket1 = Client(`http://localhost:${TEST_PORT}`);
      clientSocket2 = Client(`http://localhost:${TEST_PORT}`);

      let alice1Joined = false;
      let broadcastTime;

      // Alice joins first
      clientSocket1.on('authenticated', () => {
        clientSocket1.emit('join_room', { roomName: 'general' });
      });

      clientSocket1.on('room_joined', () => {
        alice1Joined = true;
        // Bob joins after Alice is in room
        clientSocket2.emit('authenticate', { username: 'bob' });
      });

      // Alice receives user_joined broadcast for Bob
      clientSocket1.on('user_joined', (data) => {
        const duration = Date.now() - broadcastTime;
        expect(data.username).toBe('bob');
        expect(data.roomName).toBe('general');
        expect(duration).toBeLessThan(500); // PR-003 requirement
        done();
      });

      // Bob joins the room
      clientSocket2.on('authenticated', () => {
        broadcastTime = Date.now();
        clientSocket2.emit('join_room', { roomName: 'general' });
      });

      clientSocket1.emit('authenticate', { username: 'alice' });
    });

    it('should maintain user list correctly', (done) => {
      clientSocket1 = Client(`http://localhost:${TEST_PORT}`);
      clientSocket2 = Client(`http://localhost:${TEST_PORT}`);

      let aliceJoined = false;

      clientSocket1.on('authenticated', () => {
        clientSocket1.emit('join_room', { roomName: 'general' });
      });

      clientSocket1.on('room_joined', () => {
        aliceJoined = true;
        clientSocket2.emit('authenticate', { username: 'bob' });
      });

      clientSocket2.on('authenticated', () => {
        clientSocket2.emit('join_room', { roomName: 'general' });
      });

      clientSocket2.on('room_joined', (data) => {
        expect(aliceJoined).toBe(true);
        expect(data.users).toContain('alice');
        expect(data.users).toContain('bob');
        expect(data.users.length).toBe(2);
        done();
      });

      clientSocket1.emit('authenticate', { username: 'alice' });
    });

    it('should load message history on room join', (done) => {
      clientSocket1 = Client(`http://localhost:${TEST_PORT}`);
      clientSocket2 = Client(`http://localhost:${TEST_PORT}`);

      // Alice joins and sends a message
      clientSocket1.on('authenticated', () => {
        clientSocket1.emit('join_room', { roomName: 'general' });
      });

      clientSocket1.on('room_joined', () => {
        clientSocket1.emit('send_message', { content: 'Hello, world!' });
      });

      clientSocket1.on('message_sent', () => {
        // Bob joins after message is sent
        clientSocket2.emit('authenticate', { username: 'bob' });
      });

      clientSocket2.on('authenticated', () => {
        clientSocket2.emit('join_room', { roomName: 'general' });
      });

      clientSocket2.on('room_joined', (data) => {
        // Bob should see Alice's message in history
        expect(data.messages.length).toBeGreaterThan(0);
        const aliceMessage = data.messages.find(m => m.content === 'Hello, world!');
        expect(aliceMessage).toBeDefined();
        expect(aliceMessage.username).toBe('alice');
        done();
      });

      clientSocket1.emit('authenticate', { username: 'alice' });
    });

    it('should handle disconnect and update presence', (done) => {
      clientSocket1 = Client(`http://localhost:${TEST_PORT}`);
      clientSocket2 = Client(`http://localhost:${TEST_PORT}`);

      let bothJoined = false;

      clientSocket1.on('authenticated', () => {
        clientSocket1.emit('join_room', { roomName: 'general' });
      });

      clientSocket1.on('room_joined', () => {
        clientSocket2.emit('authenticate', { username: 'bob' });
      });

      clientSocket2.on('authenticated', () => {
        clientSocket2.emit('join_room', { roomName: 'general' });
      });

      clientSocket2.on('room_joined', () => {
        bothJoined = true;
        // Alice disconnects
        clientSocket1.disconnect();
      });

      clientSocket2.on('user_left', (data) => {
        expect(bothJoined).toBe(true);
        expect(data.username).toBe('alice');
        expect(data.roomName).toBe('general');
        done();
      });

      clientSocket1.emit('authenticate', { username: 'alice' });
    });
  });

  describe('Error handling', () => {
    it('should reject joining room without authentication', (done) => {
      clientSocket1 = Client(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('error', (data) => {
        expect(data.message).toMatch(/not authenticated/i);
        done();
      });

      clientSocket1.emit('join_room', { roomName: 'general' });
    });

    it('should reject duplicate username', (done) => {
      clientSocket1 = Client(`http://localhost:${TEST_PORT}`);
      clientSocket2 = Client(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('authenticated', () => {
        // Try to authenticate second client with same username
        clientSocket2.emit('authenticate', { username: 'alice' });
      });

      clientSocket2.on('auth_error', (data) => {
        expect(data.error).toMatch(/already.*connected/i);
        done();
      });

      clientSocket1.emit('authenticate', { username: 'alice' });
    });
  });
});
