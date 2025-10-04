'use strict';

/**
 * Unit tests for PresenceService
 * Tests in-memory presence tracking, single-room enforcement (FR-017)
 */

const PresenceService = require('../../src/services/PresenceService');

describe('PresenceService', () => {
  let presenceService;

  beforeEach(() => {
    presenceService = new PresenceService();
  });

  describe('addUserToRoom', () => {
    it('should add user to room', () => {
      presenceService.addUserToRoom(1, 'alice');

      const users = presenceService.getUsersInRoom(1);
      expect(users).toContain('alice');
    });

    it('should handle multiple users in same room', () => {
      presenceService.addUserToRoom(1, 'alice');
      presenceService.addUserToRoom(1, 'bob');
      presenceService.addUserToRoom(1, 'charlie');

      const users = presenceService.getUsersInRoom(1);
      expect(users).toHaveLength(3);
      expect(users).toContain('alice');
      expect(users).toContain('bob');
      expect(users).toContain('charlie');
    });

    it('should not add duplicate users to same room', () => {
      presenceService.addUserToRoom(1, 'alice');
      presenceService.addUserToRoom(1, 'alice');

      const users = presenceService.getUsersInRoom(1);
      expect(users).toHaveLength(1);
    });

    it('should enforce single-room constraint (FR-017)', () => {
      presenceService.addUserToRoom(1, 'alice');
      presenceService.addUserToRoom(2, 'alice');

      // Alice should only be in room 2 now
      const room1Users = presenceService.getUsersInRoom(1);
      const room2Users = presenceService.getUsersInRoom(2);

      expect(room1Users).not.toContain('alice');
      expect(room2Users).toContain('alice');
    });

    it('should return previous room when user switches rooms', () => {
      presenceService.addUserToRoom(1, 'alice');
      const previousRoom = presenceService.addUserToRoom(2, 'alice');

      expect(previousRoom).toBe(1);
    });

    it('should return null when user joins first room', () => {
      const previousRoom = presenceService.addUserToRoom(1, 'alice');
      expect(previousRoom).toBeNull();
    });
  });

  describe('removeUserFromRoom', () => {
    beforeEach(() => {
      presenceService.addUserToRoom(1, 'alice');
      presenceService.addUserToRoom(1, 'bob');
    });

    it('should remove user from room', () => {
      presenceService.removeUserFromRoom(1, 'alice');

      const users = presenceService.getUsersInRoom(1);
      expect(users).not.toContain('alice');
      expect(users).toContain('bob');
    });

    it('should handle removing user not in room', () => {
      expect(() => presenceService.removeUserFromRoom(1, 'charlie')).not.toThrow();
    });

    it('should handle removing from non-existent room', () => {
      expect(() => presenceService.removeUserFromRoom(999, 'alice')).not.toThrow();
    });

    it('should return true when user successfully removed', () => {
      const result = presenceService.removeUserFromRoom(1, 'alice');
      expect(result).toBe(true);
    });

    it('should return false when user not in room', () => {
      const result = presenceService.removeUserFromRoom(1, 'charlie');
      expect(result).toBe(false);
    });
  });

  describe('removeUserFromAllRooms', () => {
    beforeEach(() => {
      presenceService.addUserToRoom(1, 'alice');
      presenceService.addUserToRoom(1, 'bob');
      presenceService.addUserToRoom(2, 'charlie');
    });

    it('should remove user from all rooms', () => {
      const rooms = presenceService.removeUserFromAllRooms('alice');

      expect(rooms).toEqual([1]);
      expect(presenceService.getUsersInRoom(1)).not.toContain('alice');
    });

    it('should return empty array if user not in any room', () => {
      const rooms = presenceService.removeUserFromAllRooms('dave');
      expect(rooms).toEqual([]);
    });

    it('should handle user in single room', () => {
      const rooms = presenceService.removeUserFromAllRooms('charlie');
      expect(rooms).toEqual([2]);
    });
  });

  describe('getUsersInRoom', () => {
    it('should return empty array for room with no users', () => {
      const users = presenceService.getUsersInRoom(1);
      expect(users).toEqual([]);
    });

    it('should return empty array for non-existent room', () => {
      const users = presenceService.getUsersInRoom(999);
      expect(users).toEqual([]);
    });

    it('should return all users in room', () => {
      presenceService.addUserToRoom(1, 'alice');
      presenceService.addUserToRoom(1, 'bob');

      const users = presenceService.getUsersInRoom(1);
      expect(users).toHaveLength(2);
      expect(users).toContain('alice');
      expect(users).toContain('bob');
    });
  });

  describe('getCurrentRoom', () => {
    it('should return current room for user', () => {
      presenceService.addUserToRoom(1, 'alice');

      const room = presenceService.getCurrentRoom('alice');
      expect(room).toBe(1);
    });

    it('should return null for user not in any room', () => {
      const room = presenceService.getCurrentRoom('alice');
      expect(room).toBeNull();
    });

    it('should update when user switches rooms', () => {
      presenceService.addUserToRoom(1, 'alice');
      presenceService.addUserToRoom(2, 'alice');

      const room = presenceService.getCurrentRoom('alice');
      expect(room).toBe(2);
    });
  });

  describe('isUserInRoom', () => {
    beforeEach(() => {
      presenceService.addUserToRoom(1, 'alice');
    });

    it('should return true when user is in room', () => {
      expect(presenceService.isUserInRoom(1, 'alice')).toBe(true);
    });

    it('should return false when user is not in room', () => {
      expect(presenceService.isUserInRoom(2, 'alice')).toBe(false);
    });

    it('should return false for non-existent user', () => {
      expect(presenceService.isUserInRoom(1, 'bob')).toBe(false);
    });
  });

  describe('getRoomCount', () => {
    it('should return number of rooms with active users', () => {
      presenceService.addUserToRoom(1, 'alice');
      presenceService.addUserToRoom(2, 'bob');
      presenceService.addUserToRoom(3, 'charlie');

      expect(presenceService.getRoomCount()).toBe(3);
    });

    it('should not count empty rooms', () => {
      presenceService.addUserToRoom(1, 'alice');
      presenceService.removeUserFromRoom(1, 'alice');

      expect(presenceService.getRoomCount()).toBe(0);
    });
  });

  describe('getUserCount', () => {
    it('should return total number of unique users across all rooms', () => {
      presenceService.addUserToRoom(1, 'alice');
      presenceService.addUserToRoom(2, 'bob');
      presenceService.addUserToRoom(3, 'charlie');

      expect(presenceService.getUserCount()).toBe(3);
    });

    it('should not count same user multiple times', () => {
      presenceService.addUserToRoom(1, 'alice');
      // User can only be in one room due to FR-017
      expect(presenceService.getUserCount()).toBe(1);
    });
  });
});
