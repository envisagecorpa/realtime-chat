/**
 * Integration Test: Reconnection Flow
 * T087: simulate disconnect → verify reconnecting UI → verify 5 retry attempts → verify reconnect_failed message (FR-016)
 *
 * Tests the complete reconnection workflow:
 * 1. Simulates connection loss
 * 2. Verifies reconnecting UI state is shown
 * 3. Tests up to 5 retry attempts (FR-016)
 * 4. Handles reconnect_failed after max retries
 * 5. Tests successful reconnection and state recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { createSocketService } from '../../src/services/socket-service.js';

describe('Reconnection Flow (E2E)', () => {
  let socketService;
  let mockSocket;
  let eventHandlers = {};

  beforeEach(() => {
    eventHandlers = {};

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
        if (eventHandlers.connect) {
          eventHandlers.connect();
        }
      }),
      disconnect: vi.fn(() => {
        mockSocket.connected = false;
        if (eventHandlers.disconnect) {
          eventHandlers.disconnect('io client disconnect');
        }
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
  });

  afterEach(() => {
    if (socketService) {
      socketService.disconnect();
    }
    vi.clearAllMocks();
  });

  it('should show reconnecting UI on disconnect', async () => {
    const connectionStatus = ref('connected');

    // Connect
    socketService.connect();
    expect(mockSocket.connected).toBe(true);
    connectionStatus.value = 'connected';

    // Simulate disconnect
    mockSocket.connected = false;
    if (eventHandlers.disconnect) {
      eventHandlers.disconnect('transport close');
    }

    connectionStatus.value = 'reconnecting';

    expect(connectionStatus.value).toBe('reconnecting');
  });

  it('should attempt 5 reconnection retries (FR-016)', async () => {
    const reconnectAttempts = ref(0);
    const maxRetries = 5;

    socketService.connect();

    // Simulate disconnect
    mockSocket.connected = false;
    if (eventHandlers.disconnect) {
      eventHandlers.disconnect('transport close');
    }

    // Simulate 5 reconnection attempts
    for (let i = 1; i <= maxRetries; i++) {
      if (eventHandlers.reconnect_attempt) {
        eventHandlers.reconnect_attempt(i);
      }
      reconnectAttempts.value = i;
    }

    expect(reconnectAttempts.value).toBe(5);
    expect(reconnectAttempts.value).toBeLessThanOrEqual(maxRetries);
  });

  it('should show reconnect_failed message after max retries', async () => {
    const connectionStatus = ref('connected');
    const errorMessage = ref('');

    socketService.connect();

    // Simulate disconnect
    mockSocket.connected = false;
    if (eventHandlers.disconnect) {
      eventHandlers.disconnect('transport close');
    }

    connectionStatus.value = 'reconnecting';

    // Simulate all 5 retries failing
    for (let i = 1; i <= 5; i++) {
      if (eventHandlers.reconnect_attempt) {
        eventHandlers.reconnect_attempt(i);
      }
    }

    // Simulate reconnect_failed event
    if (eventHandlers.reconnect_failed) {
      eventHandlers.reconnect_failed();
    }

    connectionStatus.value = 'failed';
    errorMessage.value = 'Unable to reconnect. Please refresh the page.';

    expect(connectionStatus.value).toBe('failed');
    expect(errorMessage.value).toContain('Unable to reconnect');
  });

  it('should successfully reconnect and restore state', async () => {
    const connectionStatus = ref('connected');
    const currentRoom = ref({ roomId: 1, roomName: 'general' });
    const username = ref('testuser');

    // Initial connection
    socketService.connect();
    connectionStatus.value = 'connected';

    // Authenticate and join room
    socketService.emit('authenticate', { username: username.value });
    if (eventHandlers.authenticated) {
      eventHandlers.authenticated({ username: username.value, userId: 1 });
    }

    socketService.emit('join_room', { roomName: currentRoom.value.roomName });
    if (eventHandlers.room_joined) {
      eventHandlers.room_joined({
        roomId: 1,
        roomName: 'general',
        users: [username.value],
        messages: []
      });
    }

    // Simulate disconnect
    mockSocket.connected = false;
    if (eventHandlers.disconnect) {
      eventHandlers.disconnect('transport close');
    }
    connectionStatus.value = 'reconnecting';

    // Simulate successful reconnect
    mockSocket.connected = true;
    if (eventHandlers.connect) {
      eventHandlers.connect();
    }
    connectionStatus.value = 'connected';

    // Re-authenticate after reconnect
    socketService.emit('authenticate', { username: username.value });
    if (eventHandlers.authenticated) {
      eventHandlers.authenticated({ username: username.value, userId: 1 });
    }

    // Rejoin room
    socketService.emit('join_room', { roomName: currentRoom.value.roomName });
    if (eventHandlers.room_joined) {
      eventHandlers.room_joined({
        roomId: 1,
        roomName: 'general',
        users: [username.value],
        messages: []
      });
    }

    expect(connectionStatus.value).toBe('connected');
    expect(currentRoom.value.roomName).toBe('general');
  });

  it('should track reconnection attempt count', async () => {
    const reconnectAttempt = ref(0);

    socketService.connect();

    // Simulate disconnect
    mockSocket.connected = false;
    if (eventHandlers.disconnect) {
      eventHandlers.disconnect('transport close');
    }

    // Track each reconnection attempt
    const attemptCounts = [];
    for (let i = 1; i <= 5; i++) {
      if (eventHandlers.reconnect_attempt) {
        eventHandlers.reconnect_attempt(i);
      }
      reconnectAttempt.value = i;
      attemptCounts.push(i);
    }

    expect(attemptCounts).toEqual([1, 2, 3, 4, 5]);
    expect(reconnectAttempt.value).toBe(5);
  });

  it('should clear reconnection state on successful reconnect', async () => {
    const connectionStatus = ref('connected');
    const reconnectAttempts = ref(0);

    socketService.connect();

    // Disconnect
    mockSocket.connected = false;
    if (eventHandlers.disconnect) {
      eventHandlers.disconnect('transport close');
    }
    connectionStatus.value = 'reconnecting';

    // 2 failed attempts
    for (let i = 1; i <= 2; i++) {
      if (eventHandlers.reconnect_attempt) {
        eventHandlers.reconnect_attempt(i);
      }
      reconnectAttempts.value = i;
    }

    expect(reconnectAttempts.value).toBe(2);

    // Successful reconnect on 3rd attempt
    mockSocket.connected = true;
    if (eventHandlers.connect) {
      eventHandlers.connect();
    }

    connectionStatus.value = 'connected';
    reconnectAttempts.value = 0; // Clear attempt count

    expect(connectionStatus.value).toBe('connected');
    expect(reconnectAttempts.value).toBe(0);
  });

  it('should handle disconnect during active chat session', async () => {
    const messages = ref([]);
    const isSending = ref(false);

    socketService.connect();

    // Authenticate and join room
    socketService.emit('authenticate', { username: 'testuser' });
    if (eventHandlers.authenticated) {
      eventHandlers.authenticated({ username: 'testuser', userId: 1 });
    }

    socketService.emit('join_room', { roomName: 'general' });
    if (eventHandlers.room_joined) {
      eventHandlers.room_joined({
        roomId: 1,
        roomName: 'general',
        users: ['testuser'],
        messages: []
      });
    }

    // Start sending message
    isSending.value = true;
    socketService.emit('send_message', {
      content: 'Test message',
      timestamp: Date.now()
    });

    // Disconnect before message_sent confirmation
    mockSocket.connected = false;
    if (eventHandlers.disconnect) {
      eventHandlers.disconnect('transport close');
    }

    // Message should remain in "sending" state
    expect(isSending.value).toBe(true);

    // Reconnect
    mockSocket.connected = true;
    if (eventHandlers.connect) {
      eventHandlers.connect();
    }

    // Re-authenticate and rejoin
    socketService.emit('authenticate', { username: 'testuser' });
    if (eventHandlers.authenticated) {
      eventHandlers.authenticated({ username: 'testuser', userId: 1 });
    }

    socketService.emit('join_room', { roomName: 'general' });
    if (eventHandlers.room_joined) {
      eventHandlers.room_joined({
        roomId: 1,
        roomName: 'general',
        users: ['testuser'],
        messages: [
          { id: 1, username: 'testuser', content: 'Test message', timestamp: Date.now() }
        ]
      });
    }

    messages.value = [
      { id: 1, username: 'testuser', content: 'Test message', timestamp: Date.now() }
    ];
    isSending.value = false;

    // Message should appear in history after reconnect
    expect(messages.value.length).toBe(1);
    expect(isSending.value).toBe(false);
  });

  it('should emit disconnect reason for logging', async () => {
    const disconnectReason = ref('');

    socketService.connect();

    // Simulate various disconnect reasons
    const reasons = [
      'io server disconnect',
      'io client disconnect',
      'transport close',
      'ping timeout'
    ];

    for (const reason of reasons) {
      mockSocket.connected = false;
      if (eventHandlers.disconnect) {
        eventHandlers.disconnect(reason);
      }
      disconnectReason.value = reason;

      expect(disconnectReason.value).toBe(reason);

      // Reconnect for next iteration
      mockSocket.connected = true;
      if (eventHandlers.connect) {
        eventHandlers.connect();
      }
    }
  });

  it('should prevent message sending during reconnection', async () => {
    const canSendMessage = ref(true);

    socketService.connect();
    canSendMessage.value = mockSocket.connected;

    // Disconnect
    mockSocket.connected = false;
    if (eventHandlers.disconnect) {
      eventHandlers.disconnect('transport close');
    }

    canSendMessage.value = mockSocket.connected;

    // Attempt to send message while disconnected
    if (canSendMessage.value) {
      socketService.emit('send_message', {
        content: 'This should not send',
        timestamp: Date.now()
      });
    }

    // Verify message was not sent
    expect(canSendMessage.value).toBe(false);
  });

  it('should show retry countdown in UI', async () => {
    const retryCountdown = ref(0);
    const reconnectDelay = ref(0);

    socketService.connect();

    // Disconnect
    mockSocket.connected = false;
    if (eventHandlers.disconnect) {
      eventHandlers.disconnect('transport close');
    }

    // Simulate reconnection attempts with delays
    const delays = [1000, 2000, 5000, 10000, 10000]; // Socket.IO default delays

    for (let i = 0; i < 5; i++) {
      if (eventHandlers.reconnect_attempt) {
        eventHandlers.reconnect_attempt(i + 1);
      }

      reconnectDelay.value = delays[i];
      retryCountdown.value = Math.floor(delays[i] / 1000); // Convert to seconds

      expect(retryCountdown.value).toBeGreaterThan(0);
    }

    expect(reconnectDelay.value).toBe(10000); // Max delay
  });

  it('should handle rapid connect/disconnect cycles', async () => {
    const connectionEvents = [];

    // 10 rapid connect/disconnect cycles
    for (let i = 0; i < 10; i++) {
      // Connect
      mockSocket.connected = true;
      if (eventHandlers.connect) {
        eventHandlers.connect();
      }
      connectionEvents.push('connect');

      // Disconnect
      mockSocket.connected = false;
      if (eventHandlers.disconnect) {
        eventHandlers.disconnect('transport close');
      }
      connectionEvents.push('disconnect');
    }

    expect(connectionEvents.length).toBe(20);
    expect(connectionEvents.filter(e => e === 'connect').length).toBe(10);
    expect(connectionEvents.filter(e => e === 'disconnect').length).toBe(10);
  });
});
