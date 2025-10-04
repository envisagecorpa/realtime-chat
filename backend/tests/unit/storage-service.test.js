'use strict';

/**
 * Unit tests for StorageService
 * Tests database connection, WAL mode, transactions, singleton pattern
 */

const StorageService = require('../../src/services/StorageService');
const fs = require('fs');
const path = require('path');

describe('StorageService', () => {
  let storageService;
  const testDbPath = path.join(__dirname, '../test-data/test.db');

  beforeEach(() => {
    // Ensure test data directory exists
    const testDataDir = path.dirname(testDbPath);
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Remove existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    storageService = new StorageService(testDbPath);
  });

  afterEach(() => {
    if (storageService) {
      storageService.close();
    }

    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('initialization', () => {
    it('should create database connection', () => {
      const db = storageService.getDatabase();
      expect(db).toBeDefined();
    });

    it('should enable WAL mode for concurrent access', () => {
      const db = storageService.getDatabase();
      const result = db.pragma('journal_mode', { simple: true });
      expect(result).toBe('wal');
    });

    it('should create database file if it does not exist', () => {
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should use singleton pattern for same database path', () => {
      const service1 = new StorageService(testDbPath);
      const service2 = new StorageService(testDbPath);

      expect(service1.getDatabase()).toBe(service2.getDatabase());

      service1.close();
      service2.close();
    });
  });

  describe('transaction batching', () => {
    beforeEach(() => {
      const db = storageService.getDatabase();
      db.exec(`
        CREATE TABLE test_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
    });

    it('should support transaction for batch inserts', () => {
      const db = storageService.getDatabase();
      const insertStmt = db.prepare('INSERT INTO test_messages (content, created_at) VALUES (?, ?)');

      const insertMany = db.transaction((messages) => {
        for (const msg of messages) {
          insertStmt.run(msg.content, msg.timestamp);
        }
      });

      const messages = Array.from({ length: 100 }, (_, i) => ({
        content: `Message ${i}`,
        timestamp: Date.now(),
      }));

      const startTime = Date.now();
      insertMany(messages);
      const duration = Date.now() - startTime;

      // Should complete batch insert in less than 100ms (PR-005)
      expect(duration).toBeLessThan(100);

      const count = db.prepare('SELECT COUNT(*) as count FROM test_messages').get();
      expect(count.count).toBe(100);
    });

    it('should rollback transaction on error', () => {
      const db = storageService.getDatabase();

      const insertStmt = db.prepare('INSERT INTO test_messages (content, created_at) VALUES (?, ?)');

      const insertManyWithError = db.transaction((messages) => {
        for (const msg of messages) {
          if (msg.content === 'ERROR') {
            throw new Error('Test error');
          }
          insertStmt.run(msg.content, msg.timestamp);
        }
      });

      const messages = [
        { content: 'Message 1', timestamp: Date.now() },
        { content: 'ERROR', timestamp: Date.now() },
        { content: 'Message 3', timestamp: Date.now() },
      ];

      expect(() => insertManyWithError(messages)).toThrow('Test error');

      const count = db.prepare('SELECT COUNT(*) as count FROM test_messages').get();
      expect(count.count).toBe(0); // No messages inserted due to rollback
    });
  });

  describe('database operations', () => {
    beforeEach(() => {
      const db = storageService.getDatabase();
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE
        );
      `);
    });

    it('should support prepared statements', () => {
      const db = storageService.getDatabase();
      const stmt = db.prepare('INSERT INTO users (username) VALUES (?)');
      const result = stmt.run('testuser');

      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should support concurrent reads during writes (WAL mode)', () => {
      const db = storageService.getDatabase();

      // Insert data
      db.prepare('INSERT INTO users (username) VALUES (?)').run('user1');

      // Simulate concurrent read while write is happening
      const readStmt = db.prepare('SELECT * FROM users WHERE username = ?');
      const writeStmt = db.prepare('INSERT INTO users (username) VALUES (?)');

      writeStmt.run('user2');
      const user = readStmt.get('user1');

      expect(user).toBeDefined();
      expect(user.username).toBe('user1');
    });
  });

  describe('close', () => {
    it('should close database connection', () => {
      const db = storageService.getDatabase();
      expect(db.open).toBe(true);

      storageService.close();
      expect(db.open).toBe(false);
    });

    it('should not throw error when closing already closed connection', () => {
      storageService.close();
      expect(() => storageService.close()).not.toThrow();
    });
  });

  describe('in-memory database support', () => {
    it('should support :memory: database for testing', () => {
      const memoryService = new StorageService(':memory:');
      const db = memoryService.getDatabase();

      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
      db.prepare('INSERT INTO test (value) VALUES (?)').run('test');

      const result = db.prepare('SELECT * FROM test').get();
      expect(result.value).toBe('test');

      memoryService.close();
    });
  });
});
