'use strict';

/**
 * Unit tests for RoomService
 * Tests room operations, soft delete, validation
 */

const Database = require('better-sqlite3');
const RoomService = require('../../src/services/RoomService');
const Room = require('../../src/models/Room');

describe('RoomService', () => {
  let db;
  let roomService;
  let userId;

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
        created_by_user_id INTEGER NOT NULL,
        deleted_at INTEGER NULL,
        CHECK(length(name) >= 3 AND length(name) <= 50),
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    userId = db.prepare('INSERT INTO users (username, created_at) VALUES (?, ?)').run('testuser', Date.now()).lastInsertRowid;

    const roomModel = new Room(db);
    roomService = new RoomService(roomModel);
  });

  afterEach(() => {
    db.close();
  });

  describe('createRoom', () => {
    it('should create room with valid name', () => {
      const result = roomService.createRoom('general', userId);

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      expect(result.name).toBe('general');
      expect(result.created_by_user_id).toBe(userId);
    });

    it('should reject invalid room names', () => {
      expect(() => roomService.createRoom('ab', userId)).toThrow();
      expect(() => roomService.createRoom('a'.repeat(51), userId)).toThrow();
    });

    it('should reject duplicate room names', () => {
      roomService.createRoom('general', userId);
      expect(() => roomService.createRoom('general', userId)).toThrow(/already exists/i);
    });

    it('should allow hyphens and underscores in room names', () => {
      const result1 = roomService.createRoom('test-room', userId);
      const result2 = roomService.createRoom('test_room', userId);

      expect(result1.name).toBe('test-room');
      expect(result2.name).toBe('test_room');
    });
  });

  describe('listActiveRooms', () => {
    beforeEach(() => {
      roomService.createRoom('general', userId);
      roomService.createRoom('random', userId);
      roomService.createRoom('help', userId);
    });

    it('should return all active rooms', () => {
      const rooms = roomService.listActiveRooms();

      expect(rooms).toHaveLength(3);
      expect(rooms.map(r => r.name)).toContain('general');
      expect(rooms.map(r => r.name)).toContain('random');
      expect(rooms.map(r => r.name)).toContain('help');
    });

    it('should exclude soft-deleted rooms', () => {
      const room = roomService.getRoomByName('general');
      roomService.deleteRoom(room.id, userId);

      const rooms = roomService.listActiveRooms();

      expect(rooms).toHaveLength(2);
      expect(rooms.map(r => r.name)).not.toContain('general');
    });

    it('should return empty array when no active rooms exist', () => {
      const allRooms = roomService.listActiveRooms();
      allRooms.forEach(r => roomService.deleteRoom(r.id, userId));

      const rooms = roomService.listActiveRooms();
      expect(rooms).toEqual([]);
    });
  });

  describe('getRoomById', () => {
    it('should find room by ID', () => {
      const created = roomService.createRoom('general', userId);
      const room = roomService.getRoomById(created.id);

      expect(room).toBeDefined();
      expect(room.id).toBe(created.id);
      expect(room.name).toBe('general');
    });

    it('should return null for non-existent room', () => {
      const room = roomService.getRoomById(999);
      expect(room).toBeNull();
    });
  });

  describe('getRoomByName', () => {
    it('should find room by name', () => {
      roomService.createRoom('general', userId);
      const room = roomService.getRoomByName('general');

      expect(room).toBeDefined();
      expect(room.name).toBe('general');
    });

    it('should return null for non-existent room', () => {
      const room = roomService.getRoomByName('nonexistent');
      expect(room).toBeNull();
    });
  });

  describe('deleteRoom (soft delete)', () => {
    let roomId;

    beforeEach(() => {
      const room = roomService.createRoom('general', userId);
      roomId = room.id;
    });

    it('should soft delete room', () => {
      const result = roomService.deleteRoom(roomId, userId);

      expect(result).toBe(true);

      const room = roomService.getRoomById(roomId);
      expect(room.deleted_at).not.toBeNull();
    });

    it('should enforce creator permissions for delete', () => {
      const otherUserId = db.prepare('INSERT INTO users (username, created_at) VALUES (?, ?)').run('otheruser', Date.now()).lastInsertRowid;

      expect(() => roomService.deleteRoom(roomId, otherUserId)).toThrow(/permission/i);
    });

    it('should allow room creator to delete', () => {
      expect(() => roomService.deleteRoom(roomId, userId)).not.toThrow();
    });

    it('should return false for non-existent room', () => {
      const result = roomService.deleteRoom(999, userId);
      expect(result).toBe(false);
    });
  });

  describe('restoreRoom', () => {
    let roomId;

    beforeEach(() => {
      const room = roomService.createRoom('general', userId);
      roomId = room.id;
      roomService.deleteRoom(roomId, userId);
    });

    it('should restore soft-deleted room', () => {
      const result = roomService.restoreRoom(roomId);

      expect(result).toBe(true);

      const room = roomService.getRoomById(roomId);
      expect(room.deleted_at).toBeNull();
    });

    it('should add restored room back to active list', () => {
      roomService.restoreRoom(roomId);

      const rooms = roomService.listActiveRooms();
      expect(rooms.map(r => r.id)).toContain(roomId);
    });
  });
});
