'use strict';

/**
 * PresenceService - In-memory presence tracking
 * Manages user presence in chat rooms with single-room enforcement (FR-017)
 */

/**
 * PresenceService class
 */
class PresenceService {
  /**
   * Create PresenceService instance
   */
  constructor() {
    // Map: roomId → Set<username>
    this.roomPresence = new Map();

    // Map: username → roomId (for single-room enforcement)
    this.userToRoom = new Map();
  }

  /**
   * Add user to a room (enforces FR-017: single room per user)
   * @param {number} roomId - Room ID
   * @param {string} username - Username
   * @returns {number|null} Previous room ID if user was in another room, null otherwise
   */
  addUserToRoom(roomId, username) {
    let previousRoom = null;

    // Check if user is already in another room
    if (this.userToRoom.has(username)) {
      previousRoom = this.userToRoom.get(username);

      // Remove from previous room (FR-017: single room constraint)
      if (previousRoom !== roomId) {
        this.removeUserFromRoom(previousRoom, username);
      }
    }

    // Add user to new room
    if (!this.roomPresence.has(roomId)) {
      this.roomPresence.set(roomId, new Set());
    }
    this.roomPresence.get(roomId).add(username);

    // Update user's current room
    this.userToRoom.set(username, roomId);

    return previousRoom;
  }

  /**
   * Remove user from a specific room
   * @param {number} roomId - Room ID
   * @param {string} username - Username
   * @returns {boolean} True if user was removed, false if user was not in room
   */
  removeUserFromRoom(roomId, username) {
    if (!this.roomPresence.has(roomId)) {
      return false;
    }

    const room = this.roomPresence.get(roomId);
    const wasRemoved = room.delete(username);

    // Clean up empty room
    if (room.size === 0) {
      this.roomPresence.delete(roomId);
    }

    // Update user's current room mapping
    if (this.userToRoom.get(username) === roomId) {
      this.userToRoom.delete(username);
    }

    return wasRemoved;
  }

  /**
   * Remove user from all rooms (for disconnect)
   * @param {string} username - Username
   * @returns {Array<number>} Array of room IDs the user was removed from
   */
  removeUserFromAllRooms(username) {
    const rooms = [];

    if (this.userToRoom.has(username)) {
      const roomId = this.userToRoom.get(username);
      this.removeUserFromRoom(roomId, username);
      rooms.push(roomId);
    }

    return rooms;
  }

  /**
   * Get all users in a room
   * @param {number} roomId - Room ID
   * @returns {Array<string>} Array of usernames
   */
  getUsersInRoom(roomId) {
    if (!this.roomPresence.has(roomId)) {
      return [];
    }
    return Array.from(this.roomPresence.get(roomId));
  }

  /**
   * Get current room for a user
   * @param {string} username - Username
   * @returns {number|null} Room ID or null if not in any room
   */
  getCurrentRoom(username) {
    return this.userToRoom.get(username) || null;
  }

  /**
   * Check if user is in a specific room
   * @param {number} roomId - Room ID
   * @param {string} username - Username
   * @returns {boolean} True if user is in room
   */
  isUserInRoom(roomId, username) {
    if (!this.roomPresence.has(roomId)) {
      return false;
    }
    return this.roomPresence.get(roomId).has(username);
  }

  /**
   * Get number of rooms with active users
   * @returns {number} Number of rooms
   */
  getRoomCount() {
    return this.roomPresence.size;
  }

  /**
   * Get total number of unique users across all rooms
   * @returns {number} Number of users
   */
  getUserCount() {
    return this.userToRoom.size;
  }

  /**
   * Clear all presence data (for testing)
   * @returns {void}
   */
  clear() {
    this.roomPresence.clear();
    this.userToRoom.clear();
  }
}

module.exports = PresenceService;
