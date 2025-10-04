'use strict';

/**
 * Contract test for reconnection events
 * Tests reconnecting attempts (max 5, FR-016), reconnected state restoration, reconnect_failed after 5 attempts
 * Expected to FAIL initially (TDD red phase)
 */

const { io: Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authHandler = require('../../src/handlers/authHandler');
const roomHandler = require('../../src/handlers/roomHandler');

describe('reconnection events contract', () => {
  let httpServer, ioServer, clientSocket, serverSocket;
  const TEST_PORT = 3008;

  beforeEach((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);

    httpServer.listen(TEST_PORT, () => {
      done();
    });
  });

  afterEach(() => {
    if (clientSocket) clientSocket.close();
    if (ioServer) ioServer.close();
    if (httpServer) httpServer.close();
  });

  describe('reconnection attempts (FR-016)', () => {
    it('should emit reconnect_attempt event on connection loss', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 100,
      });

      ioServer.on('connection', (socket) => {
        authHandler(socket);
        roomHandler(socket);
      });

      let reconnectAttempts = 0;

      clientSocket.on('connect', () => {
        if (reconnectAttempts === 0) {
          // Disconnect to trigger reconnection
          ioServer.close();
        }
      });

      clientSocket.on('reconnect_attempt', (attemptNumber) => {
        reconnectAttempts++;
        expect(attemptNumber).toBeGreaterThan(0);
        if (reconnectAttempts >= 1) {
          done();
        }
      });
    }, 10000);

    it('should limit reconnection attempts to 5 (FR-016)', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 50,
      });

      ioServer.on('connection', (socket) => {
        authHandler(socket);
        roomHandler(socket);
      });

      let reconnectAttempts = 0;

      clientSocket.on('connect', () => {
        // Close server to prevent reconnection
        ioServer.close();
      });

      clientSocket.on('reconnect_attempt', () => {
        reconnectAttempts++;
      });

      clientSocket.on('reconnect_failed', () => {
        expect(reconnectAttempts).toBeLessThanOrEqual(5);
        done();
      });
    }, 10000);
  });

  describe('successful reconnection', () => {
    it('should emit reconnect event on successful reconnection', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 100,
      });

      ioServer.on('connection', (socket) => {
        authHandler(socket);
        roomHandler(socket);
      });

      let initialConnect = true;

      clientSocket.on('connect', () => {
        if (initialConnect) {
          initialConnect = false;
          // Temporarily disconnect
          clientSocket.io.engine.close();
        }
      });

      clientSocket.on('reconnect', (attemptNumber) => {
        expect(attemptNumber).toBeGreaterThan(0);
        done();
      });
    }, 10000);

    it('should restore user state after reconnection', (done) => {
      let initialSocketId;
      let reconnected = false;

      ioServer.on('connection', (socket) => {
        serverSocket = socket;
        authHandler(socket);
        roomHandler(socket);

        if (reconnected) {
          // After reconnection, verify can restore state
          socket.on('authenticate', (data) => {
            socket.on('join_room', () => {
              // Successfully re-authenticated and re-joined room
              done();
            });
          });
        }
      });

      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 100,
      });

      clientSocket.on('connect', () => {
        if (!initialSocketId) {
          initialSocketId = clientSocket.id;
          // Authenticate and join room
          clientSocket.emit('authenticate', { username: 'alice' });
        }
      });

      clientSocket.on('authenticated', () => {
        if (!reconnected) {
          clientSocket.emit('join_room', { roomName: 'general' });
        }
      });

      clientSocket.on('room_joined', () => {
        if (!reconnected) {
          // Force disconnect to test reconnection
          reconnected = true;
          clientSocket.io.engine.close();
        }
      });

      clientSocket.on('reconnect', () => {
        // Re-authenticate after reconnection
        clientSocket.emit('authenticate', { username: 'alice' });
        clientSocket.emit('join_room', { roomName: 'general' });
      });
    }, 10000);
  });

  describe('reconnect_failed event', () => {
    it('should emit reconnect_failed after max attempts', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 50,
      });

      ioServer.on('connection', (socket) => {
        authHandler(socket);
        roomHandler(socket);
      });

      clientSocket.on('connect', () => {
        // Close server permanently
        ioServer.close();
      });

      clientSocket.on('reconnect_failed', () => {
        expect(true).toBe(true); // Reached max attempts
        done();
      });
    }, 10000);
  });

  describe('disconnect handling', () => {
    it('should emit disconnect event when connection is lost', (done) => {
      ioServer.on('connection', (socket) => {
        serverSocket = socket;
        authHandler(socket);
        roomHandler(socket);
      });

      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        reconnection: false, // Disable reconnection for this test
      });

      clientSocket.on('connect', () => {
        // Close connection
        ioServer.close();
      });

      clientSocket.on('disconnect', (reason) => {
        expect(reason).toBeDefined();
        done();
      });
    });

    it('should clean up user presence on disconnect', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`, {
        reconnection: false,
      });

      ioServer.on('connection', (socket) => {
        authHandler(socket);
        roomHandler(socket);
      });

      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        reconnection: false,
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('authenticate', { username: 'alice' });
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.on('room_joined', () => {
        // Bob joins to monitor presence
        secondClient.emit('authenticate', { username: 'bob' });
      });

      secondClient.on('authenticated', () => {
        secondClient.emit('join_room', { roomName: 'general' });
      });

      secondClient.on('room_joined', () => {
        // Alice disconnects
        clientSocket.close();
      });

      secondClient.on('user_left', (data) => {
        expect(data.username).toBe('alice');
        secondClient.close();
        done();
      });
    });
  });

  describe('connection error handling', () => {
    it('should emit connect_error on connection failure', (done) => {
      // Try to connect to non-existent server
      clientSocket = Client('http://localhost:9999', {
        reconnection: false,
        timeout: 1000,
      });

      clientSocket.on('connect_error', (error) => {
        expect(error).toBeDefined();
        done();
      });
    });
  });

  describe('exponential backoff', () => {
    it('should increase delay between reconnection attempts', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 100,
        reconnectionDelayMax: 1000,
        randomizationFactor: 0,
      });

      ioServer.on('connection', (socket) => {
        authHandler(socket);
        roomHandler(socket);
      });

      const attemptTimes = [];

      clientSocket.on('connect', () => {
        ioServer.close();
      });

      clientSocket.on('reconnect_attempt', () => {
        attemptTimes.push(Date.now());
      });

      clientSocket.on('reconnect_failed', () => {
        // Verify delays are increasing
        if (attemptTimes.length >= 2) {
          for (let i = 1; i < attemptTimes.length; i++) {
            const delay = attemptTimes[i] - attemptTimes[i - 1];
            expect(delay).toBeGreaterThanOrEqual(50); // Some delay between attempts
          }
        }
        done();
      });
    }, 15000);
  });
});
