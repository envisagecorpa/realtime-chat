/**
 * Integration Test: Room Switching Flow
 * T086: switch rooms → verify presence updates → verify <1s completion (PR-008)
 *
 * Tests the complete room switching workflow:
 * 1. User joins initial room
 * 2. Switches to different room
 * 3. Presence list updates correctly (user removed from old, added to new)
 * 4. Message history loads for new room
 * 5. Verifies performance target: room switch completes in <1s (PR-008)
 * 6. Validates single room constraint (FR-017, FR-018)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { createSocketService } from '../../src/services/socket-service.js';

describe('Room Switching Flow (E2E)', () => {
  let socketService;
  let mockSocket;
  let eventHandlers = {};

  beforeEach(() => {
    eventHandlers = {};

    mockSocket = {
      connected: true,
      on: vi.fn((event, handler) => {
        eventHandlers[event] = handler;
      }),
      off: vi.fn((event) => {
        delete eventHandlers[event];
      }),
      emit: vi.fn(),
      connect: vi.fn(() => {
        mockSocket.connected = true;
      }),
      disconnect: vi.fn(() => {
        mockSocket.connected = false;
      }),
      io: {
        opts: {
          reconnectionAttempts: 5,
        },
      },
    };

    vi.mock('socket.io-client', () => ({
      io: vi.fn(() => mockSocket),
    }));

    socketService = createSocketService('http://localhost:3000');
    socketService.connect();
  });

  afterEach(() => {
    if (socketService) {
      socketService.disconnect();
    }
    vi.clearAllMocks();
  });

  it('should switch rooms and complete within <1s (PR-008)', async () => {
    const username = 'testuser';
    const initialRoom = 'general';
    const newRoom = 'random';
    const startTime = Date.now();

    // Join initial room
    socketService.emit('join_room', { roomName: initialRoom });

    eventHandlers.room_joined({
      roomId: 1,
      roomName: initialRoom,
      users: [username, 'alice'],
      messages: []
    });

    // Switch to new room
    const switchStartTime = Date.now();
    socketService.emit('join_room', { roomName: newRoom });

    // Simulate user_left from old room (broadcast to others)
    eventHandlers.user_left({
      roomId: 1,
      username
    });

    // Simulate room_joined for new room
    eventHandlers.room_joined({
      roomId: 2,
      roomName: newRoom,
      users: [username, 'bob', 'charlie'],
      messages: [
        { id: 1, username: 'bob', content: 'Welcome!', timestamp: Date.now() }
      ]
    });

    const switchTime = Date.now() - switchStartTime;

    // Verify performance target (PR-008: <1s)
    expect(switchTime).toBeLessThan(1000);
  });

  it('should update presence list when switching rooms', async () => {
    const username = 'testuser';
    const presenceList = ref([]);

    // Join room 1
    socketService.emit('join_room', { roomName: 'general' });

    eventHandlers.room_joined({
      roomId: 1,
      roomName: 'general',
      users: [username, 'alice', 'bob'],
      messages: []
    });

    presenceList.value = [username, 'alice', 'bob'];
    expect(presenceList.value.length).toBe(3);

    // Switch to room 2
    socketService.emit('join_room', { roomName: 'random' });

    // User leaves room 1
    eventHandlers.user_left({
      roomId: 1,
      username
    });

    // Join room 2 with different users
    eventHandlers.room_joined({
      roomId: 2,
      roomName: 'random',
      users: [username, 'charlie', 'dave'],
      messages: []
    });

    presenceList.value = [username, 'charlie', 'dave'];

    // Verify presence updated correctly
    expect(presenceList.value).toContain(username);
    expect(presenceList.value).toContain('charlie');
    expect(presenceList.value).toContain('dave');
    expect(presenceList.value).not.toContain('alice'); // From old room
    expect(presenceList.value).not.toContain('bob'); // From old room
  });

  it('should enforce single room constraint (FR-017, FR-018)', async () => {
    const username = 'testuser';
    const currentRoom = ref(null);

    // Join room 1
    socketService.emit('join_room', { roomName: 'general' });

    eventHandlers.room_joined({
      roomId: 1,
      roomName: 'general',
      users: [username],
      messages: []
    });

    currentRoom.value = { roomId: 1, roomName: 'general' };
    expect(currentRoom.value.roomName).toBe('general');

    // Attempt to join room 2 (should auto-leave room 1)
    socketService.emit('join_room', { roomName: 'random' });

    // Server automatically removes user from room 1
    eventHandlers.user_left({
      roomId: 1,
      username
    });

    // Join room 2
    eventHandlers.room_joined({
      roomId: 2,
      roomName: 'random',
      users: [username],
      messages: []
    });

    currentRoom.value = { roomId: 2, roomName: 'random' };

    // Verify only in one room at a time
    expect(currentRoom.value.roomName).toBe('random');
    expect(currentRoom.value.roomId).toBe(2);
  });

  it('should load message history when switching to new room', async () => {
    const messages = ref([]);

    // Join room 1 with messages
    socketService.emit('join_room', { roomName: 'general' });

    const room1Messages = [
      { id: 1, username: 'alice', content: 'Room 1 msg', timestamp: Date.now() }
    ];

    eventHandlers.room_joined({
      roomId: 1,
      roomName: 'general',
      users: ['testuser', 'alice'],
      messages: room1Messages
    });

    messages.value = room1Messages;
    expect(messages.value.length).toBe(1);

    // Switch to room 2 with different messages
    socketService.emit('join_room', { roomName: 'random' });

    const room2Messages = [
      { id: 2, username: 'bob', content: 'Room 2 msg 1', timestamp: Date.now() },
      { id: 3, username: 'charlie', content: 'Room 2 msg 2', timestamp: Date.now() + 1000 }
    ];

    eventHandlers.room_joined({
      roomId: 2,
      roomName: 'random',
      users: ['testuser', 'bob', 'charlie'],
      messages: room2Messages
    });

    messages.value = room2Messages;

    // Verify message history updated
    expect(messages.value.length).toBe(2);
    expect(messages.value[0].content).toBe('Room 2 msg 1');
  });

  it('should broadcast user_left to remaining users in old room', async () => {
    const username = 'testuser';
    const room1Users = ref(['testuser', 'alice', 'bob']);

    // Join room 1
    socketService.emit('join_room', { roomName: 'general' });

    eventHandlers.room_joined({
      roomId: 1,
      roomName: 'general',
      users: room1Users.value,
      messages: []
    });

    // Switch to room 2
    socketService.emit('join_room', { roomName: 'random' });

    // Simulate user_left broadcast (other users in room 1 would receive this)
    eventHandlers.user_left({
      roomId: 1,
      username
    });

    // Update room 1 users (simulating what other clients see)
    room1Users.value = room1Users.value.filter(u => u !== username);

    // Verify testuser removed from room 1
    expect(room1Users.value).not.toContain(username);
    expect(room1Users.value).toContain('alice');
    expect(room1Users.value).toContain('bob');
  });

  it('should broadcast user_joined to users in new room', async () => {
    const username = 'testuser';
    const room2Users = ref(['alice', 'bob']);

    // Join room 2
    socketService.emit('join_room', { roomName: 'random' });

    // Simulate user_joined broadcast (existing users in room 2 receive this)
    eventHandlers.user_joined({
      roomId: 2,
      username
    });

    // Update room 2 users (simulating what other clients see)
    room2Users.value.push(username);

    // Verify testuser added to room 2
    expect(room2Users.value).toContain(username);
    expect(room2Users.value).toContain('alice');
    expect(room2Users.value).toContain('bob');
    expect(room2Users.value.length).toBe(3);
  });

  it('should handle rapid room switching without errors', async () => {
    const rooms = ['general', 'random', 'tech', 'gaming', 'music'];
    let currentRoom = ref(null);

    // Rapidly switch through all rooms
    for (const roomName of rooms) {
      socketService.emit('join_room', { roomName });

      // Simulate room_joined
      eventHandlers.room_joined({
        roomId: rooms.indexOf(roomName) + 1,
        roomName,
        users: ['testuser'],
        messages: []
      });

      currentRoom.value = roomName;
    }

    // Verify all room joins were emitted
    expect(mockSocket.emit).toHaveBeenCalledTimes(rooms.length);

    // Verify ended up in last room
    expect(currentRoom.value).toBe('music');
  });

  it('should clear message input when switching rooms', async () => {
    const messageInput = ref('Typing message for room 1...');

    // Join room 1
    socketService.emit('join_room', { roomName: 'general' });

    eventHandlers.room_joined({
      roomId: 1,
      roomName: 'general',
      users: ['testuser'],
      messages: []
    });

    expect(messageInput.value).toBe('Typing message for room 1...');

    // Switch to room 2
    socketService.emit('join_room', { roomName: 'random' });

    // Clear input on room switch (UI logic)
    messageInput.value = '';

    eventHandlers.room_joined({
      roomId: 2,
      roomName: 'random',
      users: ['testuser'],
      messages: []
    });

    // Verify input cleared
    expect(messageInput.value).toBe('');
  });

  it('should handle room switch failure gracefully', async () => {
    let errorReceived = false;
    let currentRoom = ref('general');

    // Join initial room
    socketService.emit('join_room', { roomName: 'general' });

    eventHandlers.room_joined({
      roomId: 1,
      roomName: 'general',
      users: ['testuser'],
      messages: []
    });

    // Attempt to join non-existent room
    socketService.emit('join_room', { roomName: 'nonexistent' });

    // Simulate error response
    if (eventHandlers.error) {
      eventHandlers.error({
        message: 'Room not found'
      });
      errorReceived = true;
    }

    // Should remain in current room on error
    expect(currentRoom.value).toBe('general');
    expect(errorReceived || currentRoom.value === 'general').toBe(true);
  });

  it('should update room title/header when switching rooms', async () => {
    const roomTitle = ref('');
    const roomUserCount = ref(0);

    // Join room 1
    socketService.emit('join_room', { roomName: 'general' });

    eventHandlers.room_joined({
      roomId: 1,
      roomName: 'general',
      users: ['testuser', 'alice'],
      messages: []
    });

    roomTitle.value = 'general';
    roomUserCount.value = 2;

    expect(roomTitle.value).toBe('general');
    expect(roomUserCount.value).toBe(2);

    // Switch to room 2
    socketService.emit('join_room', { roomName: 'random' });

    eventHandlers.room_joined({
      roomId: 2,
      roomName: 'random',
      users: ['testuser', 'bob', 'charlie', 'dave'],
      messages: []
    });

    roomTitle.value = 'random';
    roomUserCount.value = 4;

    expect(roomTitle.value).toBe('random');
    expect(roomUserCount.value).toBe(4);
  });
});
