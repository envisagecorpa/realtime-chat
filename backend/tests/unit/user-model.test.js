'use strict';

/**
 * Unit tests for User model
 * Tests CRUD operations, constraints, and business logic
 */

const Database = require('better-sqlite3');
const User = require('../../src/models/User');

describe('User Model', () => {
  let db;
  let user;

  beforeEach(() => {
    // Create in-memory database for isolated tests
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Create users table
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NULL,
        CHECK(length(username) >= 3 AND length(username) <= 20)
      );
      CREATE INDEX idx_users_username ON users(username);
    `);

    user = new User(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('should create a new user with valid username', () => {
      const username = 'alice';
      const result = user.create(username);

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      expect(result.username).toBe(username);
      expect(result.created_at).toBeGreaterThan(0);
      expect(result.last_seen_at).toBeNull();
    });

    it('should reject username shorter than 3 characters', () => {
      expect(() => user.create('ab')).toThrow();
    });

    it('should reject username longer than 20 characters', () => {
      expect(() => user.create('a'.repeat(21))).toThrow();
    });

    it('should reject duplicate usernames', () => {
      user.create('alice');
      expect(() => user.create('alice')).toThrow(/UNIQUE constraint failed/);
    });

    it('should reject usernames with invalid characters', () => {
      expect(() => user.create('alice-123')).toThrow();
    });
  });

  describe('findByUsername', () => {
    beforeEach(() => {
      user.create('alice');
      user.create('bob');
    });

    it('should find existing user by username', () => {
      const result = user.findByUsername('alice');

      expect(result).toBeDefined();
      expect(result.username).toBe('alice');
      expect(result.id).toBeGreaterThan(0);
    });

    it('should return null for non-existent username', () => {
      const result = user.findByUsername('charlie');
      expect(result).toBeNull();
    });

    it('should be case-sensitive', () => {
      const result = user.findByUsername('ALICE');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find existing user by ID', () => {
      const created = user.create('alice');
      const result = user.findById(created.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.username).toBe('alice');
    });

    it('should return null for non-existent ID', () => {
      const result = user.findById(999);
      expect(result).toBeNull();
    });
  });

  describe('updateLastSeen', () => {
    it('should update last_seen_at timestamp', () => {
      const created = user.create('alice');
      expect(created.last_seen_at).toBeNull();

      const timestamp = Date.now();
      user.updateLastSeen(created.id, timestamp);

      const updated = user.findById(created.id);
      expect(updated.last_seen_at).toBe(timestamp);
    });

    it('should allow updating last_seen_at multiple times', () => {
      const created = user.create('alice');
      const timestamp1 = Date.now();
      const timestamp2 = timestamp1 + 5000;

      user.updateLastSeen(created.id, timestamp1);
      user.updateLastSeen(created.id, timestamp2);

      const updated = user.findById(created.id);
      expect(updated.last_seen_at).toBe(timestamp2);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      user.create('alice');
      user.create('bob');
      user.create('charlie');
    });

    it('should return all users', () => {
      const users = user.list();

      expect(users).toHaveLength(3);
      expect(users.map(u => u.username)).toContain('alice');
      expect(users.map(u => u.username)).toContain('bob');
      expect(users.map(u => u.username)).toContain('charlie');
    });

    it('should return empty array when no users exist', () => {
      db.exec('DELETE FROM users');
      const users = user.list();

      expect(users).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete user by ID', () => {
      const created = user.create('alice');
      const deleted = user.delete(created.id);

      expect(deleted).toBe(true);
      expect(user.findById(created.id)).toBeNull();
    });

    it('should return false when deleting non-existent user', () => {
      const deleted = user.delete(999);
      expect(deleted).toBe(false);
    });
  });
});
