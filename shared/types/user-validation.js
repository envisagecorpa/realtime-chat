'use strict';

/**
 * User validation utilities
 * Validates username according to spec requirements (3-20 alphanumeric + underscore)
 */

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  if (!USERNAME_REGEX.test(username)) {
    return {
      valid: false,
      error: 'Username must be 3-20 characters (alphanumeric and underscores only)',
    };
  }

  return { valid: true };
}

module.exports = {
  USERNAME_REGEX,
  validateUsername,
};
