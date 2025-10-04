'use strict';

/**
 * Room validation utilities
 * Validates room names according to spec requirements (3-50 alphanumeric + hyphen/underscore)
 */

const ROOM_NAME_REGEX = /^[a-zA-Z0-9_-]{3,50}$/;

/**
 * Validate room name format
 * @param {string} name - Room name to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
function validateRoomName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Room name is required' };
  }

  if (!ROOM_NAME_REGEX.test(name)) {
    return {
      valid: false,
      error: 'Room name must be 3-50 characters (alphanumeric, hyphens, and underscores only)',
    };
  }

  return { valid: true };
}

module.exports = {
  ROOM_NAME_REGEX,
  validateRoomName,
};
