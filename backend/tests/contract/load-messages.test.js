'use strict';

/**
 * Contract test for load_messages event
 * Tests messages_loaded response with pagination (FR-020), page sizes 50/100/200/500
 * Expected to FAIL initially (TDD red phase)
 */

const { io: Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authHandler = require('../../src/handlers/authHandler');
const roomHandler = require('../../src/handlers/roomHandler');
const messageHandler = require('../../src/handlers/messageHandler');

describe('load_messages event contract', () => {
  let httpServer, ioServer, clientSocket, serverSocket;
  const TEST_PORT = 3007;

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

  describe('successful message loading', () => {
    it('should respond with messages_loaded event', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('messages_loaded', (data) => {
            expect(data).toBeDefined();
            expect(data.messages).toBeInstanceOf(Array);
            expect(data.total).toBeGreaterThanOrEqual(0);
            expect(data.hasMore).toBeDefined();
            done();
          });

          clientSocket.emit('load_messages', { page: 1, pageSize: 50 });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should return messages ordered by timestamp DESC (FR-008)', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          // Send multiple messages first
          let sentCount = 0;

          const sendMessages = () => {
            clientSocket.emit('send_message', { content: `Message ${sentCount + 1}` });
          };

          clientSocket.on('message_sent', () => {
            sentCount++;
            if (sentCount < 5) {
              setTimeout(sendMessages, 10);
            } else {
              // Load messages
              clientSocket.emit('load_messages', { page: 1, pageSize: 50 });
            }
          });

          clientSocket.on('messages_loaded', (data) => {
            expect(data.messages.length).toBeGreaterThanOrEqual(5);
            // Verify DESC ordering (most recent first)
            for (let i = 1; i < data.messages.length; i++) {
              expect(data.messages[i - 1].timestamp).toBeGreaterThanOrEqual(
                data.messages[i].timestamp
              );
            }
            done();
          });

          sendMessages();
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('pagination (FR-020)', () => {
    it('should support default page size of 50', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('messages_loaded', (data) => {
            expect(data.messages.length).toBeLessThanOrEqual(50);
            done();
          });

          clientSocket.emit('load_messages', { page: 1 }); // No pageSize specified
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should support page size of 100', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('messages_loaded', (data) => {
            expect(data.messages.length).toBeLessThanOrEqual(100);
            done();
          });

          clientSocket.emit('load_messages', { page: 1, pageSize: 100 });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should support page size of 200', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('messages_loaded', (data) => {
            expect(data.messages.length).toBeLessThanOrEqual(200);
            done();
          });

          clientSocket.emit('load_messages', { page: 1, pageSize: 200 });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should support page size of 500', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('messages_loaded', (data) => {
            expect(data.messages.length).toBeLessThanOrEqual(500);
            done();
          });

          clientSocket.emit('load_messages', { page: 1, pageSize: 500 });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should reject invalid page sizes', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('error', (data) => {
            expect(data.message).toMatch(/invalid.*page.*size|50.*100.*200.*500/i);
            done();
          });

          clientSocket.emit('load_messages', { page: 1, pageSize: 75 });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should indicate if more messages exist (hasMore flag)', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('messages_loaded', (data) => {
            expect(typeof data.hasMore).toBe('boolean');
            if (data.total > 50) {
              expect(data.hasMore).toBe(true);
            } else {
              expect(data.hasMore).toBe(false);
            }
            done();
          });

          clientSocket.emit('load_messages', { page: 1, pageSize: 50 });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should support pagination across multiple pages', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          let page1Messages = [];

          clientSocket.on('messages_loaded', (data) => {
            if (page1Messages.length === 0) {
              page1Messages = data.messages;
              if (data.hasMore) {
                // Load page 2
                clientSocket.emit('load_messages', { page: 2, pageSize: 50 });
              } else {
                done(); // Only one page available
              }
            } else {
              // Page 2 loaded
              const page2Messages = data.messages;
              // Verify no overlap
              if (page1Messages.length > 0 && page2Messages.length > 0) {
                expect(page1Messages[0].messageId).not.toBe(page2Messages[0].messageId);
              }
              done();
            }
          });

          clientSocket.emit('load_messages', { page: 1, pageSize: 50 });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('message content', () => {
    it('should include all message fields', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('message_sent', () => {
            clientSocket.emit('load_messages', { page: 1, pageSize: 50 });
          });

          clientSocket.on('messages_loaded', (data) => {
            if (data.messages.length > 0) {
              const msg = data.messages[0];
              expect(msg.messageId).toBeDefined();
              expect(msg.content).toBeDefined();
              expect(msg.username).toBeDefined();
              expect(msg.timestamp).toBeDefined();
            }
            done();
          });

          clientSocket.emit('send_message', { content: 'Test message' });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('validation', () => {
    it('should require authentication', (done) => {
      clientSocket.on('error', (data) => {
        expect(data.message).toMatch(/not authenticated/i);
        done();
      });

      clientSocket.emit('load_messages', { page: 1, pageSize: 50 });
    });

    it('should require user to be in a room', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('error', (data) => {
          expect(data.message).toMatch(/not.*in.*room|join.*room/i);
          done();
        });

        clientSocket.emit('load_messages', { page: 1, pageSize: 50 });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should reject invalid page number', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('error', (data) => {
            expect(data.message).toMatch(/invalid.*page/i);
            done();
          });

          clientSocket.emit('load_messages', { page: 0, pageSize: 50 });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should default page to 1 if not provided', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('messages_loaded', (data) => {
            expect(data).toBeDefined();
            done();
          });

          clientSocket.emit('load_messages', { pageSize: 50 });
        });

        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('room isolation', () => {
    it('should only return messages from current room', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`);

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_joined', () => {
          clientSocket.on('message_sent', () => {
            // Bob joins different room
            secondClient.emit('authenticate', { username: 'bob' });
          });

          clientSocket.emit('send_message', { content: 'Room1 message' });
        });

        clientSocket.emit('join_room', { roomName: 'room1' });
      });

      secondClient.on('authenticated', () => {
        secondClient.on('room_joined', () => {
          secondClient.on('messages_loaded', (data) => {
            // Bob should not see Alice's message from room1
            const room1Message = data.messages.find((m) => m.content === 'Room1 message');
            expect(room1Message).toBeUndefined();
            secondClient.close();
            done();
          });

          secondClient.emit('load_messages', { page: 1, pageSize: 50 });
        });

        secondClient.emit('join_room', { roomName: 'room2' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });
});
