'use strict';

/**
 * Contract test for leave_room event
 * Tests room_left confirmation, user_left broadcast
 * Expected to FAIL initially (TDD red phase)
 */

const { io: Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authHandler = require('../../src/handlers/authHandler');
const roomHandler = require('../../src/handlers/roomHandler');

describe('leave_room event contract', () => {
  let httpServer, ioServer, clientSocket, serverSocket;
  const TEST_PORT = 3003;

  beforeEach((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);

    httpServer.listen(TEST_PORT, () => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      ioServer.on('connection', (socket) => {
        serverSocket = socket;
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

  describe('successful room leave', () => {
    it('should respond with room_left event', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('room_left', (data) => {
            expect(data).toBeDefined();
            expect(data.roomName).toBe('general');
            done();
          });

          clientSocket.emit('leave_room');
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should remove user from room presence', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`);

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.emit('leave_room');
        });

        clientSocket.on('room_left', () => {
          // Verify alice is no longer in room by having bob join
          secondClient.emit('authenticate', { username: 'bob' });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      secondClient.on('authenticated', () => {
        secondClient.on('room_joined', (data) => {
          expect(data.users).not.toContain('alice');
          expect(data.users).toEqual(['bob']);
          secondClient.close();
          done();
        });

        secondClient.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('user_left broadcast', () => {
    it('should broadcast user_left to other users in room', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`);
      let bothJoined = false;

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          if (!bothJoined) {
            secondClient.emit('authenticate', { username: 'bob' });
          }
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      secondClient.on('authenticated', () => {
        secondClient.on('room_joined', () => {
          bothJoined = true;
          // Alice leaves
          clientSocket.emit('leave_room');
        });

        secondClient.on('user_left', (data) => {
          expect(data.username).toBe('alice');
          expect(data.roomName).toBe('general');
          secondClient.close();
          done();
        });

        secondClient.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should not send user_left to the leaving user', (done) => {
      let receivedUserLeft = false;

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('user_left', () => {
            receivedUserLeft = true;
          });

          clientSocket.emit('leave_room');
        });

        clientSocket.on('room_left', () => {
          setTimeout(() => {
            expect(receivedUserLeft).toBe(false);
            done();
          }, 100);
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('edge cases', () => {
    it('should handle leave_room when not in any room', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('error', (data) => {
          expect(data.message).toMatch(/not.*in.*room/i);
          done();
        });

        clientSocket.emit('leave_room');
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should require authentication before leaving room', (done) => {
      clientSocket.on('error', (data) => {
        expect(data.message).toMatch(/not authenticated/i);
        done();
      });

      clientSocket.emit('leave_room');
    });
  });

  describe('disconnect behavior', () => {
    it('should automatically leave room on disconnect', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`);
      let bothJoined = false;

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          if (!bothJoined) {
            secondClient.emit('authenticate', { username: 'bob' });
          }
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      secondClient.on('authenticated', () => {
        secondClient.on('room_joined', () => {
          bothJoined = true;
          // Alice disconnects
          clientSocket.close();
        });

        secondClient.on('user_left', (data) => {
          expect(data.username).toBe('alice');
          secondClient.close();
          done();
        });

        secondClient.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });
});
