'use strict';

/**
 * Integration test for room switching
 * Tests: join room A → join room B → verify auto-leave from A (FR-018)
 * Verify presence updates in both rooms, <1s completion (PR-008)
 */

const { io: Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authHandler = require('../../src/handlers/authHandler');
const roomHandler = require('../../src/handlers/roomHandler');
const messageHandler = require('../../src/handlers/messageHandler');
const StorageService = require('../../src/services/StorageService');

describe('Room Switching Integration Test', () => {
  let httpServer, ioServer, clientSocket, observerSocket;
  const TEST_PORT = 3102;
  let storageService;

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
    if (observerSocket) observerSocket.disconnect();
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

  describe('Auto-leave previous room (FR-018)', () => {
    it('should auto-leave room A when joining room B', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      let roomAJoined = false;
      let roomALeft = false;

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join_room', { roomName: 'room-a' });
      });

      clientSocket.on('room_joined', (data) => {
        if (data.roomName === 'room-a') {
          roomAJoined = true;
          // Join room B
          clientSocket.emit('join_room', { roomName: 'room-b' });
        } else if (data.roomName === 'room-b') {
          expect(roomAJoined).toBe(true);
          expect(roomALeft).toBe(true);
          done();
        }
      });

      clientSocket.on('room_left', (data) => {
        expect(data.roomName).toBe('room-a');
        roomALeft = true;
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should broadcast user_left to room A members', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);
      observerSocket = Client(`http://localhost:${TEST_PORT}`);

      let aliceInRoomA = false;
      let bobInRoomA = false;

      // Alice joins room A
      clientSocket.on('authenticated', () => {
        clientSocket.emit('join_room', { roomName: 'room-a' });
      });

      clientSocket.on('room_joined', (data) => {
        if (data.roomName === 'room-a') {
          aliceInRoomA = true;
          // Bob joins room A after Alice
          observerSocket.emit('authenticate', { username: 'bob' });
        }
      });

      // Bob joins room A
      observerSocket.on('authenticated', () => {
        observerSocket.emit('join_room', { roomName: 'room-a' });
      });

      observerSocket.on('room_joined', () => {
        bobInRoomA = true;
        // Alice switches to room B
        clientSocket.emit('join_room', { roomName: 'room-b' });
      });

      // Bob should receive user_left for Alice
      observerSocket.on('user_left', (data) => {
        expect(aliceInRoomA).toBe(true);
        expect(bobInRoomA).toBe(true);
        expect(data.username).toBe('alice');
        expect(data.roomName).toBe('room-a');
        done();
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should broadcast user_joined to room B members', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);
      observerSocket = Client(`http://localhost:${TEST_PORT}`);

      // Bob joins room B first
      observerSocket.on('authenticated', () => {
        observerSocket.emit('join_room', { roomName: 'room-b' });
      });

      observerSocket.on('room_joined', () => {
        // Alice joins room A then switches to room B
        clientSocket.emit('authenticate', { username: 'alice' });
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join_room', { roomName: 'room-a' });
      });

      clientSocket.on('room_joined', (data) => {
        if (data.roomName === 'room-a') {
          // Switch to room B
          clientSocket.emit('join_room', { roomName: 'room-b' });
        }
      });

      // Bob should receive user_joined for Alice in room B
      observerSocket.on('user_joined', (data) => {
        expect(data.username).toBe('alice');
        expect(data.roomName).toBe('room-b');
        done();
      });

      observerSocket.emit('authenticate', { username: 'bob' });
    });
  });

  describe('Performance requirement (PR-008)', () => {
    it('should complete room switch in <1s', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      let switchStartTime;

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join_room', { roomName: 'room-a' });
      });

      clientSocket.on('room_joined', (data) => {
        if (data.roomName === 'room-a') {
          switchStartTime = Date.now();
          clientSocket.emit('join_room', { roomName: 'room-b' });
        } else if (data.roomName === 'room-b') {
          const duration = Date.now() - switchStartTime;
          expect(duration).toBeLessThan(1000); // PR-008 requirement
          done();
        }
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should complete multiple rapid switches', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      const rooms = ['room-1', 'room-2', 'room-3', 'room-4', 'room-5'];
      let currentRoomIndex = 0;
      const startTime = Date.now();

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join_room', { roomName: rooms[0] });
      });

      clientSocket.on('room_joined', (data) => {
        currentRoomIndex = rooms.indexOf(data.roomName) + 1;

        if (currentRoomIndex < rooms.length) {
          // Join next room immediately
          clientSocket.emit('join_room', { roomName: rooms[currentRoomIndex] });
        } else {
          // All switches complete
          const totalDuration = Date.now() - startTime;
          expect(totalDuration).toBeLessThan(5000); // 5 rooms in <5s
          done();
        }
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('Presence integrity', () => {
    it('should maintain accurate presence count across switches', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);
      observerSocket = Client(`http://localhost:${TEST_PORT}`);

      let aliceSwitched = false;

      // Alice joins room A
      clientSocket.on('authenticated', () => {
        clientSocket.emit('join_room', { roomName: 'room-a' });
      });

      clientSocket.on('room_joined', (data) => {
        if (data.roomName === 'room-a' && !aliceSwitched) {
          // Bob joins room A
          observerSocket.emit('authenticate', { username: 'bob' });
        }
      });

      // Bob joins room A
      observerSocket.on('authenticated', () => {
        observerSocket.emit('join_room', { roomName: 'room-a' });
      });

      observerSocket.on('room_joined', (data) => {
        if (data.roomName === 'room-a') {
          // Both in room A
          expect(data.users).toContain('alice');
          expect(data.users).toContain('bob');
          expect(data.users.length).toBe(2);

          // Alice switches to room B
          aliceSwitched = true;
          clientSocket.emit('join_room', { roomName: 'room-b' });
        } else if (data.roomName === 'room-b') {
          // Bob joins room B to check presence
          expect(data.users).toContain('alice');
          expect(data.users.length).toBe(1);
          done();
        }
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should not allow user to be in multiple rooms simultaneously', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);
      observerSocket = Client(`http://localhost:${TEST_PORT}`);

      // Alice joins room A
      clientSocket.on('authenticated', () => {
        clientSocket.emit('join_room', { roomName: 'room-a' });
      });

      clientSocket.on('room_joined', (data) => {
        if (data.roomName === 'room-a') {
          // Alice switches to room B
          clientSocket.emit('join_room', { roomName: 'room-b' });
        } else if (data.roomName === 'room-b') {
          // Bob joins room A to verify Alice is not there
          observerSocket.emit('authenticate', { username: 'bob' });
        }
      });

      observerSocket.on('authenticated', () => {
        observerSocket.emit('join_room', { roomName: 'room-a' });
      });

      observerSocket.on('room_joined', (data) => {
        // Alice should not be in room A
        expect(data.users).not.toContain('alice');
        expect(data.users).toEqual(['bob']);
        done();
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('Message isolation', () => {
    it('should only receive messages from current room after switch', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);
      observerSocket = Client(`http://localhost:${TEST_PORT}`);

      let aliceSwitched = false;

      // Alice joins room A
      clientSocket.on('authenticated', () => {
        clientSocket.emit('join_room', { roomName: 'room-a' });
      });

      clientSocket.on('room_joined', (data) => {
        if (data.roomName === 'room-a') {
          // Switch to room B
          clientSocket.emit('join_room', { roomName: 'room-b' });
        } else if (data.roomName === 'room-b') {
          aliceSwitched = true;
          // Bob joins room A and sends message
          observerSocket.emit('authenticate', { username: 'bob' });
        }
      });

      // Alice should NOT receive messages from room A
      clientSocket.on('new_message', (data) => {
        // Should not happen
        done(new Error('Alice received message from room A after switching'));
      });

      observerSocket.on('authenticated', () => {
        observerSocket.emit('join_room', { roomName: 'room-a' });
      });

      observerSocket.on('room_joined', () => {
        expect(aliceSwitched).toBe(true);
        // Send message in room A
        observerSocket.emit('send_message', { content: 'Message for room A' });
      });

      observerSocket.on('message_sent', () => {
        // Alice didn't receive it, test passes
        setTimeout(done, 200);
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });
});
