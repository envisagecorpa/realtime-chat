'use strict';

/**
 * Unit tests for Room model
 * Tests room CRUD, soft delete, active room queries
 */

const Database = require('better-sqlite3');
const Room = require('../../src/models/Room');

describe('Room Model', () => {
  let db;
  let room;
  let userId;

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
        created_by_user_id INTEGER NOT NULL,
        deleted_at INTEGER NULL,
        CHECK(length(name) >= 3 AND length(name) <= 50),
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX idx_rooms_name ON rooms(name);
      CREATE INDEX idx_rooms_active ON rooms(deleted_at) WHERE deleted_at IS NULL;
    `);

    // Insert test user
    const userStmt = db.prepare('INSERT INTO users (username, created_at) VALUES (?, ?)');
    userId = userStmt.run('testuser', Date.now()).lastInsertRowid;

    room = new Room(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('should create a new room with valid name', () => {
      const name = 'general';
      const result = room.create(name, userId);

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      expect(result.name).toBe(name);
      expect(result.created_by_user_id).toBe(userId);
      expect(result.deleted_at).toBeNull();
    });

    it('should reject room name shorter than 3 characters', () => {
      expect(() => room.create('ab', userId)).toThrow();
    });

    it('should reject room name longer than 50 characters', () => {
      expect(() => room.create('a'.repeat(51), userId)).toThrow();
    });

    it('should reject duplicate room names', () => {
      room.create('general', userId);
      expect(() => room.create('general', userId)).toThrow(/UNIQUE constraint failed/);
    });

    it('should allow hyphens and underscores in room names', () => {
      const result1 = room.create('test-room', userId);
      const result2 = room.create('test_room', userId);

      expect(result1.name).toBe('test-room');
      expect(result2.name).toBe('test_room');
    });
  });

  describe('findById', () => {
    it('should find room by ID', () => {
      const created = room.create('general', userId);
      const result = room.findById(created.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.name).toBe('general');
    });

    it('should return null for non-existent ID', () => {
      const result = room.findById(999);
      expect(result).toBeNull();
    });

    it('should find soft-deleted rooms', () => {
      const created = room.create('general', userId);
      room.softDelete(created.id);

      const result = room.findById(created.id);
      expect(result).toBeDefined();
      expect(result.deleted_at).not.toBeNull();
    });
  });

  describe('findByName', () => {
    it('should find room by name', () => {
      room.create('general', userId);
      const result = room.findByName('general');

      expect(result).toBeDefined();
      expect(result.name).toBe('general');
    });

    it('should return null for non-existent name', () => {
      const result = room.findByName('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findAllActive', () => {
    beforeEach(() => {
      room.create('general', userId);
      room.create('random', userId);
      room.create('help', userId);
    });

    it('should return all active (non-deleted) rooms', () => {
      const rooms = room.findAllActive();

      expect(rooms).toHaveLength(3);
      expect(rooms.map(r => r.name)).toContain('general');
      expect(rooms.map(r => r.name)).toContain('random');
      expect(rooms.map(r => r.name)).toContain('help');
    });

    it('should exclude soft-deleted rooms', () => {
      const generalRoom = room.findByName('general');
      room.softDelete(generalRoom.id);

      const rooms = room.findAllActive();

      expect(rooms).toHaveLength(2);
      expect(rooms.map(r => r.name)).not.toContain('general');
      expect(rooms.map(r => r.name)).toContain('random');
      expect(rooms.map(r => r.name)).toContain('help');
    });

    it('should return empty array when no active rooms exist', () => {
      const allRooms = room.findAllActive();
      allRooms.forEach(r => room.softDelete(r.id));

      const rooms = room.findAllActive();
      expect(rooms).toEqual([]);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a room by setting deleted_at timestamp', () => {
      const created = room.create('general', userId);
      const beforeDelete = Date.now();

      room.softDelete(created.id);

      const deleted = room.findById(created.id);
      expect(deleted.deleted_at).toBeGreaterThanOrEqual(beforeDelete);
      expect(deleted.deleted_at).toBeLessThanOrEqual(Date.now());
    });

    it('should remove soft-deleted room from active rooms list', () => {
      const created = room.create('general', userId);
      room.softDelete(created.id);

      const activeRooms = room.findAllActive();
      expect(activeRooms.map(r => r.id)).not.toContain(created.id);
    });

    it('should return true when soft deleting existing room', () => {
      const created = room.create('general', userId);
      const result = room.softDelete(created.id);

      expect(result).toBe(true);
    });

    it('should return false when soft deleting non-existent room', () => {
      const result = room.softDelete(999);
      expect(result).toBe(false);
    });
  });

  describe('restore', () => {
    it('should restore a soft-deleted room', () => {
      const created = room.create('general', userId);
      room.softDelete(created.id);

      room.restore(created.id);

      const restored = room.findById(created.id);
      expect(restored.deleted_at).toBeNull();
    });

    it('should add restored room back to active rooms list', () => {
      const created = room.create('general', userId);
      room.softDelete(created.id);
      room.restore(created.id);

      const activeRooms = room.findAllActive();
      expect(activeRooms.map(r => r.id)).toContain(created.id);
    });

    it('should return true when restoring soft-deleted room', () => {
      const created = room.create('general', userId);
      room.softDelete(created.id);

      const result = room.restore(created.id);
      expect(result).toBe(true);
    });

    it('should return false when restoring non-existent room', () => {
      const result = room.restore(999);
      expect(result).toBe(false);
    });
  });

  describe('delete (hard delete)', () => {
    it('should permanently delete a room', () => {
      const created = room.create('general', userId);
      room.delete(created.id);

      const result = room.findById(created.id);
      expect(result).toBeNull();
    });

    it('should return true when deleting existing room', () => {
      const created = room.create('general', userId);
      const result = room.delete(created.id);

      expect(result).toBe(true);
    });

    it('should return false when deleting non-existent room', () => {
      const result = room.delete(999);
      expect(result).toBe(false);
    });
  });
});
