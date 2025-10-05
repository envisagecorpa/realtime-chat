/**
 * Unit test for usePresence composable
 * Tests: online users list reactivity, join/leave updates <500ms (PR-003)
 * Expected to FAIL initially (TDD red phase)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePresence } from '../../src/composables/usePresence.js';

describe('usePresence', () => {
  let mockSocket;

  beforeEach(() => {
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
    };
  });

  it('should initialize with empty users array', () => {
    const { users } = usePresence(mockSocket);
    expect(users.value).toEqual([]);
  });

  it('should set users from room_joined event', () => {
    const { users } = usePresence(mockSocket);

    const onHandler = mockSocket.on.mock.calls.find(call => call[0] === 'room_joined');
    const handler = onHandler[1];

    handler({ users: ['alice', 'bob'] });
    expect(users.value).toEqual(['alice', 'bob']);
  });

  it('should add user on user_joined event', () => {
    const { users } = usePresence(mockSocket);

    // Set initial users
    const roomJoinedHandler = mockSocket.on.mock.calls.find(call => call[0] === 'room_joined')[1];
    roomJoinedHandler({ users: ['alice'] });

    // Add new user
    const userJoinedHandler = mockSocket.on.mock.calls.find(call => call[0] === 'user_joined')[1];
    userJoinedHandler({ username: 'bob' });

    expect(users.value).toContain('bob');
    expect(users.value).toHaveLength(2);
  });

  it('should remove user on user_left event', () => {
    const { users } = usePresence(mockSocket);

    // Set initial users
    const roomJoinedHandler = mockSocket.on.mock.calls.find(call => call[0] === 'room_joined')[1];
    roomJoinedHandler({ users: ['alice', 'bob'] });

    // Remove user
    const userLeftHandler = mockSocket.on.mock.calls.find(call => call[0] === 'user_left')[1];
    userLeftHandler({ username: 'bob' });

    expect(users.value).not.toContain('bob');
    expect(users.value).toEqual(['alice']);
  });

  it('should not add duplicate users', () => {
    const { users } = usePresence(mockSocket);

    const roomJoinedHandler = mockSocket.on.mock.calls.find(call => call[0] === 'room_joined')[1];
    roomJoinedHandler({ users: ['alice'] });

    const userJoinedHandler = mockSocket.on.mock.calls.find(call => call[0] === 'user_joined')[1];
    userJoinedHandler({ username: 'alice' });

    expect(users.value).toEqual(['alice']);
  });

  it('should provide online user count', () => {
    const { users, onlineCount } = usePresence(mockSocket);

    const roomJoinedHandler = mockSocket.on.mock.calls.find(call => call[0] === 'room_joined')[1];
    roomJoinedHandler({ users: ['alice', 'bob', 'charlie'] });

    expect(onlineCount.value).toBe(3);
  });
});
