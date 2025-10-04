'use strict';

/**
 * Contract test for authenticate event
 * Tests username validation, authenticated response, auth_error on duplicate
 * Expected to FAIL initially (TDD red phase)
 */

const { io: Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authHandler = require('../../src/handlers/authHandler');

describe('authenticate event contract', () => {
  let httpServer, ioServer, clientSocket, serverSocket;
  const TEST_PORT = 3001;

  beforeEach((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);

    ioServer.on('connection', (socket) => {
      serverSocket = socket;
      // Attach auth handler
      authHandler(socket);
      done();
    });

    httpServer.listen(TEST_PORT, () => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);
    });
  });

  afterEach((done) => {
    if (clientSocket) {
      clientSocket.disconnect();
    }

    const closeServer = () => {
      if (httpServer && httpServer.listening) {
        httpServer.close(done);
      } else {
        done();
      }
    };

    if (ioServer) {
      ioServer.close(closeServer);
    } else {
      closeServer();
    }
  });

  describe('valid authentication', () => {
    it('should respond with authenticated event on valid username', (done) => {
      const username = 'alice';

      clientSocket.on('authenticated', (data) => {
        expect(data).toBeDefined();
        expect(data.username).toBe(username);
        expect(data.userId).toBeGreaterThan(0);
        done();
      });

      clientSocket.emit('authenticate', { username });
    });

    it('should accept usernames with 3-20 alphanumeric characters', (done) => {
      const username = 'user123';

      clientSocket.on('authenticated', (data) => {
        expect(data.username).toBe(username);
        done();
      });

      clientSocket.emit('authenticate', { username });
    });
  });

  describe('username validation', () => {
    it('should reject username shorter than 3 characters', (done) => {
      clientSocket.on('auth_error', (data) => {
        expect(data.error).toMatch(/3.*characters/i);
        done();
      });

      clientSocket.emit('authenticate', { username: 'ab' });
    });

    it('should reject username longer than 20 characters', (done) => {
      clientSocket.on('auth_error', (data) => {
        expect(data.error).toMatch(/20.*characters/i);
        done();
      });

      clientSocket.emit('authenticate', { username: 'a'.repeat(21) });
    });

    it('should reject username with special characters', (done) => {
      clientSocket.on('auth_error', (data) => {
        expect(data.error).toMatch(/alphanumeric/i);
        done();
      });

      clientSocket.emit('authenticate', { username: 'user@123' });
    });

    it('should reject empty username', (done) => {
      clientSocket.on('auth_error', (data) => {
        expect(data.error).toBeDefined();
        done();
      });

      clientSocket.emit('authenticate', { username: '' });
    });

    it('should reject missing username field', (done) => {
      clientSocket.on('auth_error', (data) => {
        expect(data.error).toBeDefined();
        done();
      });

      clientSocket.emit('authenticate', {});
    });
  });

  describe('duplicate username handling', () => {
    it('should reject duplicate username when user already connected', (done) => {
      const username = 'bob';
      const secondClient = Client(`http://localhost:${TEST_PORT}`);

      clientSocket.on('authenticated', () => {
        // First client authenticated, try second with same username
        secondClient.on('auth_error', (data) => {
          expect(data.error).toMatch(/already.*connected|in use/i);
          secondClient.close();
          done();
        });

        secondClient.emit('authenticate', { username });
      });

      clientSocket.emit('authenticate', { username });
    });

    it('should allow username after previous user disconnects', (done) => {
      const username = 'charlie';

      clientSocket.on('authenticated', () => {
        clientSocket.close();

        // Create new client after first disconnects
        setTimeout(() => {
          const newClient = Client(`http://localhost:${TEST_PORT}`);

          newClient.on('authenticated', (data) => {
            expect(data.username).toBe(username);
            newClient.close();
            done();
          });

          newClient.emit('authenticate', { username });
        }, 100);
      });

      clientSocket.emit('authenticate', { username });
    });
  });

  describe('case sensitivity', () => {
    it('should treat usernames as case-insensitive', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`);

      clientSocket.on('authenticated', () => {
        secondClient.on('auth_error', (data) => {
          expect(data.error).toMatch(/already.*connected|in use/i);
          secondClient.close();
          done();
        });

        secondClient.emit('authenticate', { username: 'ALICE' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });
});
