'use strict';

/**
 * Integration test for pagination
 * Tests: seed 500 messages → load page 1 (50 msgs) <2s (PR-002)
 * Verify page size options 50/100/200/500
 */

const { io: Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authHandler = require('../../src/handlers/authHandler');
const roomHandler = require('../../src/handlers/roomHandler');
const messageHandler = require('../../src/handlers/messageHandler');
const StorageService = require('../../src/services/StorageService');
const Message = require('../../src/models/Message');

describe('Pagination Integration Test', () => {
  let httpServer, ioServer, clientSocket, storageService;
  const TEST_PORT = 3103;

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

  describe('Large dataset pagination (PR-002)', () => {
    it('should load page 1 (50 msgs) in <2s from 500 messages', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      let roomId, userId;

      // Create user and room, then seed 500 messages
      clientSocket.on('authenticated', (data) => {
        userId = data.userId;
        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.on('room_joined', (data) => {
        roomId = data.roomId;

        // Seed 500 messages directly to DB
        const db = storageService.getDatabase();
        const messageModel = new Message(db);

        const startTime = Date.now();
        for (let i = 1; i <= 500; i++) {
          messageModel.create({
            userId,
            roomId,
            content: `Message ${i}`,
            timestamp: Date.now() + i,
          });
        }
        const seedTime = Date.now() - startTime;
        console.log(`Seeded 500 messages in ${seedTime}ms`);

        // Load page 1
        const loadStart = Date.now();
        clientSocket.emit('load_messages', { page: 1, pageSize: 50 });

        clientSocket.on('messages_loaded', (msgData) => {
          const loadDuration = Date.now() - loadStart;

          expect(msgData.messages.length).toBe(50);
          expect(msgData.total).toBe(500);
          expect(msgData.hasMore).toBe(true);
          expect(loadDuration).toBeLessThan(2000); // PR-002 requirement

          done();
        });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    }, 15000);

    it('should support all page sizes: 50, 100, 200, 500', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      const pageSizes = [50, 100, 200, 500];
      let currentPageSizeIndex = 0;

      clientSocket.on('authenticated', (data) => {
        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.on('room_joined', (data) => {
        // Seed 500 messages
        const db = storageService.getDatabase();
        const messageModel = new Message(db);

        for (let i = 1; i <= 500; i++) {
          messageModel.create({
            userId: data.roomId, // reuse for simplicity
            roomId: data.roomId,
            content: `Message ${i}`,
            timestamp: Date.now() + i,
          });
        }

        // Load with first page size
        clientSocket.emit('load_messages', {
          page: 1,
          pageSize: pageSizes[0],
        });
      });

      clientSocket.on('messages_loaded', (data) => {
        const expectedSize = pageSizes[currentPageSizeIndex];
        expect(data.messages.length).toBe(expectedSize);
        expect(data.total).toBe(500);

        currentPageSizeIndex++;

        if (currentPageSizeIndex < pageSizes.length) {
          // Load next page size
          clientSocket.emit('load_messages', {
            page: 1,
            pageSize: pageSizes[currentPageSizeIndex],
          });
        } else {
          done();
        }
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    }, 15000);

    it('should handle pagination across multiple pages correctly', (done) => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      let roomId, userId;

      clientSocket.on('authenticated', (data) => {
        userId = data.userId;
        clientSocket.emit('join_room', { roomName: 'general' });
      });

      clientSocket.on('room_joined', (data) => {
        roomId = data.roomId;

        // Seed 150 messages
        const db = storageService.getDatabase();
        const messageModel = new Message(db);

        for (let i = 1; i <= 150; i++) {
          messageModel.create({
            userId,
            roomId,
            content: `Message ${i}`,
            timestamp: Date.now() + i,
          });
        }

        // Load page 1
        clientSocket.emit('load_messages', { page: 1, pageSize: 50 });

        let page1Messages, page2Messages, page3Messages;
        let pagesLoaded = 0;

        const originalListener = (data) => {
          pagesLoaded++;

          if (pagesLoaded === 1) {
            page1Messages = data.messages;
            expect(page1Messages.length).toBe(50);
            expect(data.hasMore).toBe(true);
            clientSocket.emit('load_messages', { page: 2, pageSize: 50 });
          } else if (pagesLoaded === 2) {
            page2Messages = data.messages;
            expect(page2Messages.length).toBe(50);
            expect(data.hasMore).toBe(true);
            clientSocket.emit('load_messages', { page: 3, pageSize: 50 });
          } else if (pagesLoaded === 3) {
            page3Messages = data.messages;
            expect(page3Messages.length).toBe(50);
            expect(data.hasMore).toBe(false);

            // Verify no overlaps
            const allIds = [
              ...page1Messages.map(m => m.messageId),
              ...page2Messages.map(m => m.messageId),
              ...page3Messages.map(m => m.messageId),
            ];
            const uniqueIds = new Set(allIds);
            expect(uniqueIds.size).toBe(150);

            done();
          }
        };

        clientSocket.on('messages_loaded', originalListener);
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    }, 15000);
  });
});
