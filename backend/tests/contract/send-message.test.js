'use strict';

/**
 * Contract test for send_message event
 * Tests message_sent confirmation (FR-012), new_message broadcast (FR-002),
 * content validation 2000 chars, timestamp ordering (FR-008)
 * Expected to FAIL initially (TDD red phase)
 */

const { io: Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authHandler = require('../../src/handlers/authHandler');
const roomHandler = require('../../src/handlers/roomHandler');
const messageHandler = require('../../src/handlers/messageHandler');

describe('send_message event contract', () => {
  let httpServer, ioServer, clientSocket, serverSocket;
  const TEST_PORT = 3006;

  beforeEach((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);

    httpServer.listen(TEST_PORT, () => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      ioServer.on('connection', (socket) => {
        serverSocket = socket;
        authHandler(socket);
        roomHandler(socket);
        messageHandler(socket);
        done();
      });
    });
  });

  afterEach(() => {
    if (clientSocket) clientSocket.close();
    if (ioServer) ioServer.close();
    if (httpServer) httpServer.close();
  });

  describe('successful message send (FR-012)', () => {
    it('should respond with message_sent confirmation', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('message_sent', (data) => {
            expect(data).toBeDefined();
            expect(data.messageId).toBeGreaterThan(0);
            expect(data.content).toBe('Hello, world!');
            expect(data.timestamp).toBeGreaterThan(0);
            expect(data.status).toBe('sent');
            done();
          });

          clientSocket.emit('send_message', { content: 'Hello, world!' });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should include sender username in confirmation', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('message_sent', (data) => {
            expect(data.username).toBe('alice');
            done();
          });

          clientSocket.emit('send_message', { content: 'Test message' });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('new_message broadcast (FR-002)', () => {
    it('should broadcast new_message to other users in room', (done) => {
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
          // Alice sends message
          clientSocket.emit('send_message', { content: 'Hello, Bob!' });
        });

        secondClient.on('new_message', (data) => {
          expect(data.content).toBe('Hello, Bob!');
          expect(data.username).toBe('alice');
          expect(data.messageId).toBeGreaterThan(0);
          expect(data.timestamp).toBeGreaterThan(0);
          secondClient.close();
          done();
        });

        secondClient.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should not send new_message to sender', (done) => {
      let receivedNewMessage = false;

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('new_message', () => {
            receivedNewMessage = true;
          });

          clientSocket.on('message_sent', () => {
            setTimeout(() => {
              expect(receivedNewMessage).toBe(false);
              done();
            }, 100);
          });

          clientSocket.emit('send_message', { content: 'Test' });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should only broadcast to users in same room', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`);
      let receivedMessage = false;

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          secondClient.emit('authenticate', { username: 'bob' });
        });

        clientSocket.emit('join_room', { roomName: 'room1' });
      });

      secondClient.on('authenticated', () => {
        secondClient.on('room_joined', () => {
          secondClient.on('new_message', () => {
            receivedMessage = true;
          });

          // Alice sends message to room1
          clientSocket.emit('send_message', { content: 'Room1 message' });

          setTimeout(() => {
            expect(receivedMessage).toBe(false);
            secondClient.close();
            done();
          }, 100);
        });

        secondClient.emit('join_room', { roomName: 'room2' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('content validation', () => {
    it('should reject empty message', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('error', (data) => {
            expect(data.message).toMatch(/empty|required/i);
            done();
          });

          clientSocket.emit('send_message', { content: '' });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should reject message exceeding 2000 characters', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('error', (data) => {
            expect(data.message).toMatch(/2000.*characters|too long/i);
            done();
          });

          const longMessage = 'a'.repeat(2001);
          clientSocket.emit('send_message', { content: longMessage });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should accept message exactly at 2000 characters', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('message_sent', (data) => {
            expect(data.content).toHaveLength(2000);
            done();
          });

          const maxMessage = 'a'.repeat(2000);
          clientSocket.emit('send_message', { content: maxMessage });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should trim whitespace from message content', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('message_sent', (data) => {
            expect(data.content).toBe('Trimmed message');
            done();
          });

          clientSocket.emit('send_message', { content: '  Trimmed message  ' });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('timestamp ordering (FR-008)', () => {
    it('should assign server timestamp to message', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          const beforeSend = Date.now();

          clientSocket.on('message_sent', (data) => {
            const afterSend = Date.now();
            expect(data.timestamp).toBeGreaterThanOrEqual(beforeSend);
            expect(data.timestamp).toBeLessThanOrEqual(afterSend);
            done();
          });

          clientSocket.emit('send_message', { content: 'Test' });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should order messages by timestamp', (done) => {
      const messages = [];

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('message_sent', (data) => {
            messages.push(data);

            if (messages.length === 3) {
              // Verify ordering
              expect(messages[0].timestamp).toBeLessThanOrEqual(messages[1].timestamp);
              expect(messages[1].timestamp).toBeLessThanOrEqual(messages[2].timestamp);
              done();
            }
          });

          // Send 3 messages in quick succession
          clientSocket.emit('send_message', { content: 'Message 1' });
          setTimeout(() => clientSocket.emit('send_message', { content: 'Message 2' }), 10);
          setTimeout(() => clientSocket.emit('send_message', { content: 'Message 3' }), 20);
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('requirements', () => {
    it('should require user to be in a room', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('error', (data) => {
          expect(data.message).toMatch(/not.*in.*room|join.*room/i);
          done();
        });

        clientSocket.emit('send_message', { content: 'Test' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should require authentication', (done) => {
      clientSocket.on('error', (data) => {
        expect(data.message).toMatch(/not authenticated/i);
        done();
      });

      clientSocket.emit('send_message', { content: 'Test' });
    });
  });

  describe('HTML sanitization (SR-002)', () => {
    it('should sanitize HTML tags in message content', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('message_sent', (data) => {
            expect(data.content).not.toContain('<script>');
            expect(data.content).toContain('&lt;script&gt;');
            done();
          });

          clientSocket.emit('send_message', { content: '<script>alert("xss")</script>' });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });
});
