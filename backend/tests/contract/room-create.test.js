'use strict';

/**
 * Contract test for create_room event
 * Tests room_created response, name validation, duplicate name error
 * Expected to FAIL initially (TDD red phase)
 */

const { io: Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authHandler = require('../../src/handlers/authHandler');
const roomHandler = require('../../src/handlers/roomHandler');

describe('create_room event contract', () => {
  let httpServer, ioServer, clientSocket, serverSocket;
  const TEST_PORT = 3004;

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

  describe('successful room creation', () => {
    it('should respond with room_created event', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_created', (data) => {
          expect(data).toBeDefined();
          expect(data.roomId).toBeGreaterThan(0);
          expect(data.roomName).toBe('project-alpha');
          expect(data.createdBy).toBe('alice');
          done();
        });

        clientSocket.emit('create_room', { roomName: 'project-alpha' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should persist created room', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`);

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_created', () => {
          // Verify room exists by having second user join
          secondClient.emit('authenticate', { username: 'bob' });
        });

        clientSocket.emit('create_room', { roomName: 'project-alpha' });
      });

      secondClient.on('authenticated', () => {
        secondClient.on('room_joined', (data) => {
          expect(data.roomName).toBe('project-alpha');
          expect(data.roomId).toBeGreaterThan(0);
          secondClient.close();
          done();
        });

        secondClient.emit('join_room', { roomName: 'project-alpha' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should allow hyphens and underscores in room name', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_created', (data) => {
          expect(data.roomName).toBe('project_alpha-v2');
          done();
        });

        clientSocket.emit('create_room', { roomName: 'project_alpha-v2' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('room name validation', () => {
    it('should reject room name shorter than 3 characters', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('error', (data) => {
          expect(data.message).toMatch(/3.*characters/i);
          done();
        });

        clientSocket.emit('create_room', { roomName: 'ab' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should reject room name longer than 50 characters', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('error', (data) => {
          expect(data.message).toMatch(/50.*characters/i);
          done();
        });

        clientSocket.emit('create_room', { roomName: 'a'.repeat(51) });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should reject room name with special characters', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('error', (data) => {
          expect(data.message).toMatch(/alphanumeric|hyphen|underscore/i);
          done();
        });

        clientSocket.emit('create_room', { roomName: 'room@123' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should reject empty room name', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('error', (data) => {
          expect(data.message).toBeDefined();
          done();
        });

        clientSocket.emit('create_room', { roomName: '' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should reject missing roomName field', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('error', (data) => {
          expect(data.message).toBeDefined();
          done();
        });

        clientSocket.emit('create_room', {});
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('duplicate room name handling', () => {
    it('should reject duplicate room name', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_created', () => {
          // Try to create same room again
          clientSocket.on('error', (data) => {
            expect(data.message).toMatch(/already exists|duplicate/i);
            done();
          });

          clientSocket.emit('create_room', { roomName: 'general' });
        });

        clientSocket.emit('create_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should treat room names as case-insensitive', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_created', () => {
          clientSocket.on('error', (data) => {
            expect(data.message).toMatch(/already exists|duplicate/i);
            done();
          });

          clientSocket.emit('create_room', { roomName: 'GENERAL' });
        });

        clientSocket.emit('create_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('authentication requirement', () => {
    it('should reject create_room without authentication', (done) => {
      clientSocket.on('error', (data) => {
        expect(data.message).toMatch(/not authenticated/i);
        done();
      });

      clientSocket.emit('create_room', { roomName: 'general' });
    });
  });

  describe('creator permissions', () => {
    it('should set creator as the authenticated user', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_created', (data) => {
          expect(data.createdBy).toBe('alice');
          done();
        });

        clientSocket.emit('create_room', { roomName: 'alice-room' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });
});
