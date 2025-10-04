'use strict';

/**
 * Unit tests for Message model
 * Tests message creation, pagination, status transitions, retry logic
 */

const Database = require('better-sqlite3');
const Message = require('../../src/models/Message');

describe('Message Model', () => {
  let db;
  let message;
  let userId;
  let roomId;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Create required tables
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

      CREATE INDEX idx_messages_room_timestamp ON messages(room_id, timestamp);
      CREATE INDEX idx_messages_user ON messages(user_id);
    `);

    // Insert test user and room
    const userStmt = db.prepare('INSERT INTO users (username, created_at) VALUES (?, ?)');
    const roomStmt = db.prepare('INSERT INTO rooms (name, created_at, created_by_user_id) VALUES (?, ?, ?)');

    userId = userStmt.run('testuser', Date.now()).lastInsertRowid;
    roomId = roomStmt.run('testroom', Date.now(), userId).lastInsertRowid;

    message = new Message(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('should create a new message with valid data', () => {
      const data = {
        userId,
        roomId,
        content: 'Hello world',
        timestamp: Date.now(),
      };

      const result = message.create(data);

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      expect(result.user_id).toBe(userId);
      expect(result.room_id).toBe(roomId);
      expect(result.content).toBe('Hello world');
      expect(result.delivery_status).toBe('pending');
      expect(result.retry_count).toBe(0);
    });

    it('should reject empty content', () => {
      const data = {
        userId,
        roomId,
        content: '',
        timestamp: Date.now(),
      };

      expect(() => message.create(data)).toThrow(/CHECK constraint failed/);
    });

    it('should reject content longer than 2000 characters', () => {
      const data = {
        userId,
        roomId,
        content: 'a'.repeat(2001),
        timestamp: Date.now(),
      };

      expect(() => message.create(data)).toThrow(/CHECK constraint failed/);
    });

    it('should reject invalid timestamp', () => {
      const data = {
        userId,
        roomId,
        content: 'test',
        timestamp: -1,
      };

      expect(() => message.create(data)).toThrow(/CHECK constraint failed/);
    });
  });

  describe('findByRoomPaginated', () => {
    beforeEach(() => {
      // Create 10 messages with different timestamps
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        message.create({
          userId,
          roomId,
          content: `Message ${i}`,
          timestamp: now + i * 1000,
        });
      }
    });

    it('should return paginated messages ordered by timestamp DESC', () => {
      const result = message.findByRoomPaginated(roomId, { limit: 5, offset: 0 });

      expect(result.messages).toHaveLength(5);
      expect(result.messages[0].content).toBe('Message 9'); // Most recent
      expect(result.messages[4].content).toBe('Message 5');
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(true);
    });

    it('should handle pagination with offset', () => {
      const result = message.findByRoomPaginated(roomId, { limit: 5, offset: 5 });

      expect(result.messages).toHaveLength(5);
      expect(result.messages[0].content).toBe('Message 4');
      expect(result.messages[4].content).toBe('Message 0'); // Oldest
      expect(result.hasMore).toBe(false);
    });

    it('should return empty array for non-existent room', () => {
      const result = message.findByRoomPaginated(999, { limit: 10, offset: 0 });

      expect(result.messages).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should support different page sizes (50, 100, 200, 500)', () => {
      const pageSizes = [50, 100, 200, 500];

      pageSizes.forEach(size => {
        const result = message.findByRoomPaginated(roomId, { limit: size, offset: 0 });
        expect(result.messages.length).toBeLessThanOrEqual(size);
      });
    });
  });

  describe('updateDeliveryStatus', () => {
    let messageId;

    beforeEach(() => {
      const result = message.create({
        userId,
        roomId,
        content: 'test',
        timestamp: Date.now(),
      });
      messageId = result.id;
    });

    it('should update delivery status from pending to sent', () => {
      message.updateDeliveryStatus(messageId, 'sent');

      const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      expect(updated.delivery_status).toBe('sent');
    });

    it('should update delivery status from pending to failed', () => {
      message.updateDeliveryStatus(messageId, 'failed');

      const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      expect(updated.delivery_status).toBe('failed');
    });

    it('should reject invalid status', () => {
      expect(() => message.updateDeliveryStatus(messageId, 'invalid')).toThrow(/CHECK constraint failed/);
    });
  });

  describe('incrementRetryCount', () => {
    let messageId;

    beforeEach(() => {
      const result = message.create({
        userId,
        roomId,
        content: 'test',
        timestamp: Date.now(),
      });
      messageId = result.id;
    });

    it('should increment retry_count from 0 to 1', () => {
      message.incrementRetryCount(messageId);

      const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      expect(updated.retry_count).toBe(1);
    });

    it('should increment retry_count multiple times', () => {
      message.incrementRetryCount(messageId);
      message.incrementRetryCount(messageId);
      message.incrementRetryCount(messageId);

      const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      expect(updated.retry_count).toBe(3);
    });

    it('should not exceed maximum retry_count of 3', () => {
      message.incrementRetryCount(messageId);
      message.incrementRetryCount(messageId);
      message.incrementRetryCount(messageId);

      expect(() => message.incrementRetryCount(messageId)).toThrow(/CHECK constraint failed/);
    });
  });

  describe('findById', () => {
    it('should find message by ID', () => {
      const created = message.create({
        userId,
        roomId,
        content: 'test message',
        timestamp: Date.now(),
      });

      const result = message.findById(created.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.content).toBe('test message');
    });

    it('should return null for non-existent ID', () => {
      const result = message.findById(999);
      expect(result).toBeNull();
    });
  });
});
