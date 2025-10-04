'use strict';

/**
 * Contract test for join_room event
 * Tests room_joined response with users/messages, user_joined broadcast, auto-leave previous room (FR-018)
 * Expected to FAIL initially (TDD red phase)
 */

const { io: Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authHandler = require('../../src/handlers/authHandler');
const roomHandler = require('../../src/handlers/roomHandler');

describe('join_room event contract', () => {
  let httpServer, ioServer, clientSocket, serverSocket;
  const TEST_PORT = 3002;

  beforeEach((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);

    httpServer.listen(TEST_PORT, () => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      ioServer.on('connection', (socket) => {
        serverSocket = socket;
        // Attach handlers (don't exist yet - should fail)
        authHandler(socket);
        roomHandler(socket);
        done();
      });
    });
  });

  afterEach(() => {
    if (clientSocket) clientSocket.close();
    if (ioServer) ioServer.close();
    if (httpServer) httpServer.close();
  });

  describe('successful room join', () => {
    it('should respond with room_joined event containing room details', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', (data) => {
          expect(data).toBeDefined();
          expect(data.roomId).toBeGreaterThan(0);
          expect(data.roomName).toBe('general');
          expect(data.users).toBeInstanceOf(Array);
          expect(data.messages).toBeInstanceOf(Array);
          done();
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should include authenticated user in users list (FR-005)', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', (data) => {
          expect(data.users).toContain('alice');
          done();
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should return recent messages ordered by timestamp DESC (FR-008)', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', (data) => {
          expect(data.messages).toBeInstanceOf(Array);
          // Verify ordering if messages exist
          if (data.messages.length > 1) {
            for (let i = 1; i < data.messages.length; i++) {
              expect(data.messages[i - 1].timestamp).toBeGreaterThanOrEqual(
                data.messages[i].timestamp
              );
            }
          }
          done();
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('user_joined broadcast (FR-005)', () => {
    it('should broadcast user_joined to other users in room', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`);
      let firstUserJoined = false;

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          firstUserJoined = true;
          // Second user joins same room
          secondClient.emit('authenticate', { username: 'bob' });
        });

        clientSocket.on('user_joined', (data) => {
          expect(data.username).toBe('bob');
          expect(data.roomName).toBe('general');
          secondClient.close();
          done();
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      secondClient.on('authenticated', () => {
        if (firstUserJoined) {
          secondClient.emit('join_room', { roomName: 'general' });
        }
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should not broadcast user_joined to the joining user', (done) => {
      let receivedUserJoined = false;

      clientSocket.on('authenticated', () => {
        clientSocket.on('user_joined', () => {
          receivedUserJoined = true;
        });

        clientSocket.on('room_joined', () => {
          setTimeout(() => {
            expect(receivedUserJoined).toBe(false);
            done();
          }, 100);
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('auto-leave previous room (FR-018)', () => {
    it('should automatically leave previous room when joining new room', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', (data) => {
          if (data.roomName === 'room1') {
            // Joined first room, now join second
            clientSocket.emit('join_room', { roomName: 'room2' });
          } else if (data.roomName === 'room2') {
            // Successfully joined second room
            done();
          }
        });

        clientSocket.on('room_left', (data) => {
          expect(data.roomName).toBe('room1');
        });

        clientSocket.emit('join_room', { roomName: 'room1' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should broadcast user_left to previous room members', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`);
      let aliceInRoom1 = false;

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', (data) => {
          if (data.roomName === 'room1') {
            aliceInRoom1 = true;
            // Bob joins room1
            secondClient.emit('authenticate', { username: 'bob' });
          }
        });

        clientSocket.emit('join_room', { roomName: 'room1' });
      });

      secondClient.on('authenticated', () => {
        if (aliceInRoom1) {
          secondClient.on('room_joined', () => {
            // Alice switches to room2
            clientSocket.emit('join_room', { roomName: 'room2' });
          });

          secondClient.on('user_left', (data) => {
            expect(data.username).toBe('alice');
            expect(data.roomName).toBe('room1');
            secondClient.close();
            done();
          });

          secondClient.emit('join_room', { roomName: 'room1' });
        }
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('room creation on join', () => {
    it('should create room if it does not exist', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', (data) => {
          expect(data.roomName).toBe('newroom');
          expect(data.roomId).toBeGreaterThan(0);
          expect(data.users).toEqual(['alice']);
          expect(data.messages).toEqual([]);
          done();
        });

        clientSocket.emit('join_room', { roomName: 'newroom' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('validation', () => {
    it('should reject join_room without authentication', (done) => {
      clientSocket.on('error', (data) => {
        expect(data.message).toMatch(/not authenticated/i);
        done();
      });

      clientSocket.emit('join_room', { roomName: 'general' });
    });

    it('should reject invalid room name', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('error', (data) => {
          expect(data.message).toMatch(/invalid.*room/i);
          done();
        });

        clientSocket.emit('join_room', { roomName: 'ab' }); // Too short
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });
});
