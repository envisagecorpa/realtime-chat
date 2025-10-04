'use strict';

/**
 * Unit tests for MessageService
 * Tests message operations, validation, sanitization, retry logic
 */

const Database = require('better-sqlite3');
const MessageService = require('../../src/services/MessageService');
const Message = require('../../src/models/Message');

describe('MessageService', () => {
  let db;
  let messageService;
  let userId;
  let roomId;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Create tables
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        created_by_user_id INTEGER NOT NULL
      );

      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        room_id INTEGER NOT NULL,
        content TEXT NOT NULL CHECK(length(content) > 0 AND length(content) <= 2000),
        timestamp INTEGER NOT NULL CHECK(timestamp > 0),
        delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending', 'sent', 'failed')),
        retry_count INTEGER NOT NULL DEFAULT 0 CHECK(retry_count >= 0 AND retry_count <= 3),
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      );
    `);

    // Insert test data
    userId = db.prepare('INSERT INTO users (username, created_at) VALUES (?, ?)').run('testuser', Date.now()).lastInsertRowid;
    roomId = db.prepare('INSERT INTO rooms (name, created_at, created_by_user_id) VALUES (?, ?, ?)').run('testroom', Date.now(), userId).lastInsertRowid;

    const messageModel = new Message(db);
    messageService = new MessageService(messageModel);
  });

  afterEach(() => {
    db.close();
  });

  describe('sendMessage', () => {
    it('should create message with valid data', () => {
      const data = {
        userId,
        roomId,
        content: 'Hello world',
        timestamp: Date.now(),
      };

      const result = messageService.sendMessage(data);

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      expect(result.content).toBe('Hello world');
      expect(result.delivery_status).toBe('pending');
    });

    it('should sanitize HTML content to prevent XSS (SR-002)', () => {
      const data = {
        userId,
        roomId,
        content: '<script>alert("xss")</script>',
        timestamp: Date.now(),
      };

      const result = messageService.sendMessage(data);

      expect(result.content).not.toContain('<script>');
      expect(result.content).toContain('&lt;script&gt;');
    });

    it('should reject empty content', () => {
      const data = {
        userId,
        roomId,
        content: '',
        timestamp: Date.now(),
      };

      expect(() => messageService.sendMessage(data)).toThrow(/cannot be empty/i);
    });

    it('should reject content exceeding 2000 characters', () => {
      const data = {
        userId,
        roomId,
        content: 'a'.repeat(2001),
        timestamp: Date.now(),
      };

      expect(() => messageService.sendMessage(data)).toThrow(/exceeds maximum length/i);
    });

    it('should trim whitespace from content', () => {
      const data = {
        userId,
        roomId,
        content: '  Hello world  ',
        timestamp: Date.now(),
      };

      const result = messageService.sendMessage(data);
      expect(result.content).toBe('Hello world');
    });
  });

  describe('getMessageHistory', () => {
    beforeEach(() => {
      // Create 50 test messages
      const now = Date.now();
      for (let i = 0; i < 50; i++) {
        db.prepare('INSERT INTO messages (user_id, room_id, content, timestamp, created_at) VALUES (?, ?, ?, ?, ?)').run(
          userId,
          roomId,
          `Message ${i}`,
          now + i * 1000,
          now + i * 1000
        );
      }
    });

    it('should return paginated message history with default page size 50', () => {
      const result = messageService.getMessageHistory(roomId);

      expect(result.messages).toHaveLength(50);
      expect(result.total).toBe(50);
      expect(result.hasMore).toBe(false);
    });

    it('should support custom page size', () => {
      const result = messageService.getMessageHistory(roomId, { limit: 20, offset: 0 });

      expect(result.messages).toHaveLength(20);
      expect(result.hasMore).toBe(true);
    });

    it('should support pagination with offset', () => {
      const result = messageService.getMessageHistory(roomId, { limit: 20, offset: 20 });

      expect(result.messages).toHaveLength(20);
      expect(result.hasMore).toBe(true);
    });

    it('should return messages ordered by timestamp DESC (most recent first)', () => {
      const result = messageService.getMessageHistory(roomId, { limit: 5 });

      expect(result.messages[0].content).toBe('Message 49');
      expect(result.messages[4].content).toBe('Message 45');
    });
  });

  describe('markAsSent', () => {
    let messageId;

    beforeEach(() => {
      const msg = db.prepare('INSERT INTO messages (user_id, room_id, content, timestamp, created_at) VALUES (?, ?, ?, ?, ?)').run(
        userId,
        roomId,
        'test',
        Date.now(),
        Date.now()
      );
      messageId = msg.lastInsertRowid;
    });

    it('should update message status to sent', () => {
      messageService.markAsSent(messageId);

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      expect(message.delivery_status).toBe('sent');
    });

    it('should return true on successful update', () => {
      const result = messageService.markAsSent(messageId);
      expect(result).toBe(true);
    });

    it('should return false for non-existent message', () => {
      const result = messageService.markAsSent(999);
      expect(result).toBe(false);
    });
  });

  describe('markAsFailed', () => {
    let messageId;

    beforeEach(() => {
      const msg = db.prepare('INSERT INTO messages (user_id, room_id, content, timestamp, created_at) VALUES (?, ?, ?, ?, ?)').run(
        userId,
        roomId,
        'test',
        Date.now(),
        Date.now()
      );
      messageId = msg.lastInsertRowid;
    });

    it('should update message status to failed', () => {
      messageService.markAsFailed(messageId);

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      expect(message.delivery_status).toBe('failed');
    });
  });

  describe('retry logic (FR-019)', () => {
    let messageId;

    beforeEach(() => {
      const msg = db.prepare('INSERT INTO messages (user_id, room_id, content, timestamp, created_at) VALUES (?, ?, ?, ?, ?)').run(
        userId,
        roomId,
        'test',
        Date.now(),
        Date.now()
      );
      messageId = msg.lastInsertRowid;
    });

    it('should increment retry count', () => {
      messageService.incrementRetryCount(messageId);

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      expect(message.retry_count).toBe(1);
    });

    it('should allow up to 3 retry attempts', () => {
      messageService.incrementRetryCount(messageId);
      messageService.incrementRetryCount(messageId);
      messageService.incrementRetryCount(messageId);

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      expect(message.retry_count).toBe(3);
    });

    it('should not exceed maximum of 3 retries', () => {
      messageService.incrementRetryCount(messageId);
      messageService.incrementRetryCount(messageId);
      messageService.incrementRetryCount(messageId);

      expect(() => messageService.incrementRetryCount(messageId)).toThrow();
    });

    it('should check if message can be retried', () => {
      expect(messageService.canRetry(messageId)).toBe(true);

      messageService.incrementRetryCount(messageId);
      messageService.incrementRetryCount(messageId);
      messageService.incrementRetryCount(messageId);

      expect(messageService.canRetry(messageId)).toBe(false);
    });
  });
});
