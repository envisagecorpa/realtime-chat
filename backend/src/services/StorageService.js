'use strict';

/**
 * StorageService - SQLite database connection management
 * Provides singleton pattern, WAL mode, transaction support
 */

const Database = require('better-sqlite3');
const { migrate } = require('../db/migrate');

// Singleton instances keyed by database path
const instances = new Map();

/**
 * StorageService class for managing SQLite database connections
 */
class StorageService {
  /**
   * Create or retrieve StorageService instance (singleton pattern)
   * @param {string} dbPath - Path to SQLite database file or ':memory:'
   */
  constructor(dbPath) {
    // Return existing instance if already created for this path
    if (instances.has(dbPath)) {
      return instances.get(dbPath);
    }

    this.dbPath = dbPath;

    // Run migrations to initialize schema
    this.db = migrate(dbPath);

    // Enable WAL mode for concurrent reads during writes (DP-004)
    this.db.pragma('journal_mode = WAL');

    // Store singleton instance
    instances.set(dbPath, this);
  }

  /**
   * Get the database instance
   * @returns {Database} better-sqlite3 database instance
   */
  getDatabase() {
    return this.db;
  }

  /**
   * Close database connection
   * @returns {void}
   */
  close() {
    if (this.db && this.db.open) {
      this.db.close();
      instances.delete(this.dbPath);
    }
  }

  /**
   * Check if database is open
   * @returns {boolean} True if database is open
   */
  isOpen() {
    return this.db && this.db.open;
  }
}

module.exports = StorageService;
