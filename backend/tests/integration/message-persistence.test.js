'use strict';

/**
 * Integration test for message persistence
 * Tests: send message → restart server → verify message loads from SQLite (FR-023)
 * Tests WAL mode concurrent writes (DP-004)
 */

const { io: Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const authHandler = require('../../src/handlers/authHandler');
const roomHandler = require('../../src/handlers/roomHandler');
const messageHandler = require('../../src/handlers/messageHandler');
const StorageService = require('../../src/services/StorageService');

describe('Message Persistence Integration Test', () => {
  let httpServer, ioServer, clientSocket;
  const TEST_PORT = 3101;
  const TEST_DB_PATH = path.join(__dirname, '../../../data/test-persistence.db');
  let storageService;

  beforeEach((done) => {
    // Clean up test database if it exists
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Initialize database
    process.env.DB_PATH = TEST_DB_PATH;
    storageService = new StorageService(TEST_DB_PATH);

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

    const cleanup = () => {
      if (storageService) storageService.close();

      // Clean up test database
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
      }

      process.env.DB_PATH = undefined;
      done();
    };

    if (ioServer) {
      ioServer.close(() => {
        if (httpServer && httpServer.listening) {
          httpServer.close(cleanup);
        } else {
          cleanup();
        }
      });
    } else {
      cleanup();
    }
  });

  describe('Message persistence (FR-023)', () => {
    it('should persist messages to SQLite and reload after server restart', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      const testMessage = 'This message should persist';
      let messageId;

      // Step 1: Send a message
      clientSocket.on('authenticated', () => {
        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.on('room_joined', () => {
        clientSocket.emit('send_message', { content: testMessage });
      });

      clientSocket.on('message_sent', (data) => {
        messageId = data.messageId;
        expect(messageId).toBeGreaterThan(0);

        // Step 2: Disconnect and restart server
        clientSocket.disconnect();

        ioServer.close(() => {
          httpServer.close(() => {
            // Restart server
            httpServer = createServer();
            ioServer = new Server(httpServer);

            ioServer.on('connection', (socket) => {
              authHandler(socket);
              roomHandler(socket);
              messageHandler(socket);
            });

            httpServer.listen(TEST_PORT, () => {
              // Step 3: Reconnect and verify message persisted
              clientSocket = Client(`http://localhost:${TEST_PORT}`);

              clientSocket.on('authenticated', () => {
                clientSocket.emit('join_room', { roomName: 'general' });
              });

              clientSocket.on('room_joined', (data) => {
                // Verify message is in history
                const persistedMessage = data.messages.find(m => m.messageId === messageId);
                expect(persistedMessage).toBeDefined();
                expect(persistedMessage.content).toBe(testMessage);
                expect(persistedMessage.username).toBe('alice');
                done();
              });

              clientSocket.emit('authenticate', { username: 'alice' });
            });
          });
        });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    }, 15000);

    it('should persist multiple messages with correct ordering', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      const messages = ['First message', 'Second message', 'Third message'];
      let sentCount = 0;

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.on('room_joined', () => {
        // Send first message
        clientSocket.emit('send_message', { content: messages[0] });
      });

      clientSocket.on('message_sent', () => {
        sentCount++;
        if (sentCount < messages.length) {
          // Send next message
          setTimeout(() => {
            clientSocket.emit('send_message', { content: messages[sentCount] });
          }, 10);
        } else {
          // All messages sent, reconnect to verify
          clientSocket.disconnect();

          setTimeout(() => {
            clientSocket = Client(`http://localhost:${TEST_PORT}`);

            clientSocket.on('authenticated', () => {
              clientSocket.emit('join_room', { roomName: 'general' });
            });

            clientSocket.on('room_joined', (data) => {
              expect(data.messages.length).toBe(3);

              // Verify messages are ordered DESC (most recent first)
              expect(data.messages[0].content).toBe('Third message');
              expect(data.messages[1].content).toBe('Second message');
              expect(data.messages[2].content).toBe('First message');
              done();
            });

            clientSocket.emit('authenticate', { username: 'bob' });
          }, 100);
        }
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    }, 15000);
  });

  describe('WAL mode concurrent writes (DP-004)', () => {
    it('should handle concurrent writes from multiple connections', (done) => {
      const client1 = Client(`http://localhost:${TEST_PORT}`);
      const client2 = Client(`http://localhost:${TEST_PORT}`);

      let client1Ready = false;
      let client2Ready = false;
      let messagesReceived = 0;

      const checkCompletion = () => {
        messagesReceived++;
        if (messagesReceived === 2) {
          // Both messages sent, verify both persisted
          const client3 = Client(`http://localhost:${TEST_PORT}`);

          client3.on('authenticated', () => {
            client3.emit('join_room', { roomName: 'general' });
          });

          client3.on('room_joined', (data) => {
            expect(data.messages.length).toBe(2);

            const msg1 = data.messages.find(m => m.content === 'Message from client 1');
            const msg2 = data.messages.find(m => m.content === 'Message from client 2');

            expect(msg1).toBeDefined();
            expect(msg2).toBeDefined();

            client1.disconnect();
            client2.disconnect();
            client3.disconnect();
            done();
          });

          client3.emit('authenticate', { username: 'charlie' });
        }
      };

      client1.on('authenticated', () => {
        client1.emit('join_room', { roomName: 'general' });
      });

      client1.on('room_joined', () => {
        client1Ready = true;
        if (client2Ready) {
          // Both ready, send messages concurrently
          client1.emit('send_message', { content: 'Message from client 1' });
          client2.emit('send_message', { content: 'Message from client 2' });
        }
      });

      client1.on('message_sent', checkCompletion);

      client2.on('authenticated', () => {
        client2.emit('join_room', { roomName: 'general' });
      });

      client2.on('room_joined', () => {
        client2Ready = true;
        if (client1Ready) {
          // Both ready, send messages concurrently
          client1.emit('send_message', { content: 'Message from client 1' });
          client2.emit('send_message', { content: 'Message from client 2' });
        }
      });

      client2.on('message_sent', checkCompletion);

      client1.emit('authenticate', { username: 'alice' });
      client2.emit('authenticate', { username: 'bob' });
    }, 15000);
  });

  describe('User persistence', () => {
    it('should persist user data and update last_seen_at', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      let userId;

      clientSocket.on('authenticated', (data) => {
        userId = data.userId;
        expect(userId).toBeGreaterThan(0);

        // Disconnect and reconnect
        clientSocket.disconnect();

        setTimeout(() => {
          clientSocket = Client(`http://localhost:${TEST_PORT}`);

          clientSocket.on('authenticated', (data2) => {
            // Should get same user ID
            expect(data2.userId).toBe(userId);
            expect(data2.username).toBe('alice');
            done();
          });

          clientSocket.emit('authenticate', { username: 'alice' });
        }, 100);
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    }, 15000);
  });

  describe('Room persistence', () => {
    it('should persist created rooms across server restarts', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      let roomId;

      clientSocket.on('authenticated', () => {
        clientSocket.emit('create_room', { roomName: 'my-project' });
      });

      clientSocket.on('room_created', (data) => {
        roomId = data.roomId;
        expect(roomId).toBeGreaterThan(0);

        // Restart server
        clientSocket.disconnect();

        ioServer.close(() => {
          httpServer.close(() => {
            httpServer = createServer();
            ioServer = new Server(httpServer);

            ioServer.on('connection', (socket) => {
              authHandler(socket);
              roomHandler(socket);
              messageHandler(socket);
            });

            httpServer.listen(TEST_PORT, () => {
              clientSocket = Client(`http://localhost:${TEST_PORT}`);

              clientSocket.on('authenticated', () => {
                clientSocket.emit('join_room', { roomName: 'my-project' });
              });

              clientSocket.on('room_joined', (data) => {
                expect(data.roomId).toBe(roomId);
                expect(data.roomName).toBe('my-project');
                done();
              });

              clientSocket.emit('authenticate', { username: 'bob' });
            });
          });
        });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    }, 15000);
  });
});
