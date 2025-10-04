'use strict';

/**
 * RoomService - Business logic for room operations
 * Handles room creation, soft delete, permissions
 */

/**
 * RoomService class
 */
class RoomService {
  /**
   * Create RoomService instance
   * @param {Room} roomModel - Room model instance
   */
  constructor(roomModel) {
    this.roomModel = roomModel;
  }

  /**
   * Create a new room
   * @param {string} name - Room name
   * @param {number} createdByUserId - ID of user creating the room
   * @returns {{id: number, name: string, created_at: number, created_by_user_id: number, deleted_at: null}} Created room
   * @throws {Error} If room name is invalid or already exists
   */
  createRoom(name, createdByUserId) {
    // Check if room already exists
    const existing = this.roomModel.findByName(name);
    if (existing) {
      throw new Error(`Room with name "${name}" already exists`);
    }

    return this.roomModel.create(name, createdByUserId);
  }

  /**
   * Get all active (non-deleted) rooms
   * @returns {Array<{id: number, name: string, created_at: number, created_by_user_id: number, deleted_at: null}>} Active rooms
   */
  listActiveRooms() {
    return this.roomModel.findAllActive();
  }

  /**
   * Get room by ID
   * @param {number} id - Room ID
   * @returns {{id: number, name: string, created_at: number, created_by_user_id: number, deleted_at: number|null}|null} Room or null
   */
  getRoomById(id) {
    return this.roomModel.findById(id);
  }

  /**
   * Get room by name
   * @param {string} name - Room name
   * @returns {{id: number, name: string, created_at: number, created_by_user_id: number, deleted_at: number|null}|null} Room or null
   */
  getRoomByName(name) {
    return this.roomModel.findByName(name);
  }

  /**
   * Soft delete a room (enforce creator permissions)
   * @param {number} roomId - Room ID
   * @param {number} userId - ID of user attempting to delete
   * @returns {boolean} True if soft deleted successfully
   * @throws {Error} If user does not have permission to delete
   */
  deleteRoom(roomId, userId) {
    const room = this.roomModel.findById(roomId);
    if (!room) {
      return false;
    }

    // Enforce creator permissions
    if (room.created_by_user_id !== userId) {
      throw new Error('You do not have permission to delete this room');
    }

    return this.roomModel.softDelete(roomId);
  }

  /**
   * Restore a soft-deleted room
   * @param {number} roomId - Room ID
   * @returns {boolean} True if restored successfully
   */
  restoreRoom(roomId) {
    return this.roomModel.restore(roomId);
  }

  /**
   * Permanently delete a room (hard delete)
   * @param {number} roomId - Room ID
   * @returns {boolean} True if deleted successfully
   */
  hardDeleteRoom(roomId) {
    return this.roomModel.delete(roomId);
  }
}

module.exports = RoomService;
