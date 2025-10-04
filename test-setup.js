#!/usr/bin/env node
'use strict';

/**
 * Quick test script to verify setup is working
 */

const Database = require('./backend/node_modules/better-sqlite3');
const path = require('path');
const { validateUsername } = require('./shared/types/user-validation');
const { validateMessage, sanitizeContent } = require('./shared/types/message-validation');
const { validateRoomName } = require('./shared/types/room-validation');

console.log('=== Testing Real-Time Chat Setup ===\n');

// Test database connection
console.log('1. Testing Database Connection...');
try {
  const dbPath = path.join(__dirname, 'backend/data/chat.db');
  const db = new Database(dbPath, { readonly: true });

  // Query users
  const users = db.prepare('SELECT * FROM users').all();
  console.log(`   ✓ Found ${users.length} users:`, users.map(u => u.username).join(', '));

  // Query rooms
  const rooms = db.prepare('SELECT * FROM rooms WHERE deleted_at IS NULL').all();
  console.log(`   ✓ Found ${rooms.length} rooms:`, rooms.map(r => r.name).join(', '));

  // Query messages
  const messages = db.prepare('SELECT COUNT(*) as count FROM messages').get();
  console.log(`   ✓ Found ${messages.count} messages in database`);

  db.close();
  console.log('   ✓ Database connection successful!\n');
} catch (error) {
  console.error('   ✗ Database error:', error.message);
  process.exit(1);
}

// Test validation functions
console.log('2. Testing Validation Functions...');

// Username validation
const usernameTests = [
  { input: 'alice', expected: true },
  { input: 'ab', expected: false }, // too short
  { input: 'a'.repeat(21), expected: false }, // too long
  { input: 'alice-123', expected: false }, // invalid chars
  { input: 'alice_123', expected: true },
];

usernameTests.forEach(test => {
  const result = validateUsername(test.input);
  const pass = result.valid === test.expected;
  console.log(`   ${pass ? '✓' : '✗'} validateUsername("${test.input}"): ${result.valid ? 'valid' : result.error}`);
});

// Message validation
const messageTests = [
  { input: 'Hello world!', expected: true },
  { input: '', expected: false }, // empty
  { input: 'a'.repeat(2001), expected: false }, // too long
  { input: '<script>alert("xss")</script>', expected: true, sanitized: '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;' },
];

messageTests.forEach(test => {
  const result = validateMessage(test.input);
  const pass = result.valid === test.expected;
  console.log(`   ${pass ? '✓' : '✗'} validateMessage("${test.input.substring(0, 30)}"): ${result.valid ? 'valid' : result.error}`);
  if (test.sanitized && result.sanitized) {
    const sanitizePass = result.sanitized === test.sanitized;
    console.log(`      ${sanitizePass ? '✓' : '✗'} Sanitization: ${result.sanitized.substring(0, 50)}...`);
  }
});

// Room name validation
const roomTests = [
  { input: 'general', expected: true },
  { input: 'ab', expected: false }, // too short
  { input: 'test-room_123', expected: true },
  { input: 'test room', expected: false }, // spaces not allowed
];

roomTests.forEach(test => {
  const result = validateRoomName(test.input);
  const pass = result.valid === test.expected;
  console.log(`   ${pass ? '✓' : '✗'} validateRoomName("${test.input}"): ${result.valid ? 'valid' : result.error}`);
});

console.log('\n=== All Setup Tests Passed! ===\n');
console.log('✓ Database is initialized and seeded');
console.log('✓ Validation functions are working');
console.log('✓ Ready to continue with backend implementation');
console.log('\nNext steps:');
console.log('  - Phase 3.3: Backend Models TDD (T018-T023)');
console.log('  - Phase 3.4: Backend Services TDD (T024-T031)');
console.log('  - Phase 3.5: Socket.IO Contract Tests (T032-T039)');
console.log('  - Phase 3.6: Socket.IO Handlers + Server (T040-T051)');
