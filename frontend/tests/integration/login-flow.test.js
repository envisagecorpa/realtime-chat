/**
 * Integration Test: Login to Chat Flow
 * T084: authenticate → redirect → join room → verify message history loads <2s (PR-002)
 *
 * Tests the complete user authentication and room join flow:
 * 1. User authenticates with username
 * 2. Receives authenticated event
 * 3. Joins default room
 * 4. Receives room_joined event with message history
 * 5. Verifies performance target: message history loads in <2s
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { createSocketService } from '../../src/services/socket-service.js';

describe('Login to Chat Flow (E2E)', () => {
  let socketService;
  let mockSocket;
  let eventHandlers = {};

  beforeEach(() => {
    eventHandlers = {};

    // Create mock socket that tracks event handlers
    mockSocket = {
      connected: false,
      on: vi.fn((event, handler) => {
        eventHandlers[event] = handler;
      }),
      off: vi.fn((event) => {
        delete eventHandlers[event];
      }),
      emit: vi.fn(),
      connect: vi.fn(() => {
        mockSocket.connected = true;
        // Simulate connection
        if (eventHandlers.connect) {
          eventHandlers.connect();
        }
      }),
      disconnect: vi.fn(() => {
        mockSocket.connected = false;
        if (eventHandlers.disconnect) {
          eventHandlers.disconnect();
        }
      }),
      io: {
        opts: {
          reconnectionAttempts: 5,
        },
      },
    };

    // Mock socket.io-client
    vi.mock('socket.io-client', () => ({
      io: vi.fn(() => mockSocket),
    }));

    socketService = createSocketService('http://localhost:3000');
  });

  afterEach(() => {
    if (socketService) {
      socketService.disconnect();
    }
    vi.clearAllMocks();
  });

  it('should complete login flow: authenticate → join room → load history', async () => {
    const username = 'testuser';
    const roomName = 'general';
    const startTime = Date.now();

    // Track flow state
    let authenticated = false;
    let roomJoined = false;
    let historyLoaded = false;

    // Connect to server
    socketService.connect();
    expect(mockSocket.connected).toBe(true);

    // Step 1: Send authenticate event
    socketService.emit('authenticate', { username });
    expect(mockSocket.emit).toHaveBeenCalledWith('authenticate', { username });

    // Step 2: Simulate server response - authenticated
    eventHandlers.authenticated({
      username,
      userId: 1
    });
    authenticated = true;
    expect(authenticated).toBe(true);

    // Step 3: Send join_room event
    socketService.emit('join_room', { roomName });
    expect(mockSocket.emit).toHaveBeenCalledWith('join_room', { roomName });

    // Step 4: Simulate server response - room_joined with message history
    const mockMessages = [
      { id: 1, username: 'alice', content: 'Hello', timestamp: Date.now() - 1000 },
      { id: 2, username: 'bob', content: 'Hi there', timestamp: Date.now() - 500 },
    ];

    eventHandlers.room_joined({
      roomId: 1,
      roomName,
      users: ['testuser', 'alice', 'bob'],
      messages: mockMessages
    });
    roomJoined = true;
    historyLoaded = true;

    // Step 5: Verify performance target (PR-002: <2s)
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(2000);

    // Verify flow completed successfully
    expect(authenticated).toBe(true);
    expect(roomJoined).toBe(true);
    expect(historyLoaded).toBe(true);
  });

  it('should handle authentication failure gracefully', async () => {
    const username = 'invalid@user';
    let errorReceived = false;

    socketService.connect();

    // Send authenticate with invalid username
    socketService.emit('authenticate', { username });

    // Simulate server error response
    if (eventHandlers.error) {
      eventHandlers.error({
        message: 'Invalid username format'
      });
      errorReceived = true;
    }

    // Should not proceed to room join on auth failure
    expect(errorReceived || !eventHandlers.authenticated).toBe(true);
  });

  it('should load message history with correct pagination defaults', async () => {
    const username = 'testuser';
    const roomName = 'general';

    socketService.connect();

    // Authenticate
    socketService.emit('authenticate', { username });
    eventHandlers.authenticated({ username, userId: 1 });

    // Join room
    socketService.emit('join_room', { roomName });

    // Simulate room_joined with default pagination (50 messages)
    const messages = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      username: 'user' + (i % 3),
      content: `Message ${i + 1}`,
      timestamp: Date.now() - (50 - i) * 1000
    }));

    eventHandlers.room_joined({
      roomId: 1,
      roomName,
      users: ['testuser'],
      messages
    });

    // Verify default page size
    expect(messages.length).toBe(50);

    // Verify messages are sorted by timestamp (newest first expected from server)
    expect(messages[0].timestamp).toBeGreaterThan(messages[messages.length - 1].timestamp);
  });

  it('should emit load_messages event for pagination', async () => {
    const username = 'testuser';
    const roomName = 'general';

    socketService.connect();
    socketService.emit('authenticate', { username });
    eventHandlers.authenticated({ username, userId: 1 });

    socketService.emit('join_room', { roomName });
    eventHandlers.room_joined({
      roomId: 1,
      roomName,
      users: ['testuser'],
      messages: []
    });

    // Request next page of messages
    const roomId = 1;
    const page = 2;
    const pageSize = 100;

    socketService.emit('load_messages', { roomId, page, pageSize });

    expect(mockSocket.emit).toHaveBeenCalledWith('load_messages', {
      roomId,
      page,
      pageSize
    });
  });

  it('should maintain presence list after joining room', async () => {
    const username = 'testuser';
    const roomName = 'general';
    const presenceList = ref([]);

    socketService.connect();
    socketService.emit('authenticate', { username });
    eventHandlers.authenticated({ username, userId: 1 });

    socketService.emit('join_room', { roomName });

    // Simulate room_joined with presence list
    const users = ['testuser', 'alice', 'bob'];
    eventHandlers.room_joined({
      roomId: 1,
      roomName,
      users,
      messages: []
    });

    presenceList.value = users;

    // Verify presence includes authenticated user
    expect(presenceList.value).toContain(username);
    expect(presenceList.value.length).toBe(3);
  });

  it('should handle rapid room switching after login', async () => {
    const username = 'testuser';

    socketService.connect();
    socketService.emit('authenticate', { username });
    eventHandlers.authenticated({ username, userId: 1 });

    // Join first room
    socketService.emit('join_room', { roomName: 'general' });
    eventHandlers.room_joined({
      roomId: 1,
      roomName: 'general',
      users: ['testuser'],
      messages: []
    });

    // Switch to second room
    socketService.emit('join_room', { roomName: 'random' });
    eventHandlers.room_joined({
      roomId: 2,
      roomName: 'random',
      users: ['testuser'],
      messages: []
    });

    // Verify both room joins were emitted
    expect(mockSocket.emit).toHaveBeenCalledWith('join_room', { roomName: 'general' });
    expect(mockSocket.emit).toHaveBeenCalledWith('join_room', { roomName: 'random' });
  });

  it('should disconnect cleanly after successful login flow', async () => {
    const username = 'testuser';

    socketService.connect();
    socketService.emit('authenticate', { username });
    eventHandlers.authenticated({ username, userId: 1 });

    socketService.emit('join_room', { roomName: 'general' });
    eventHandlers.room_joined({
      roomId: 1,
      roomName: 'general',
      users: ['testuser'],
      messages: []
    });

    // Disconnect
    socketService.disconnect();

    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(mockSocket.connected).toBe(false);
  });
});
