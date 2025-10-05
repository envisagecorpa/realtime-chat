/**
 * Unit test for Socket.IO client service
 * Tests: connect, disconnect, emit, event listeners, reconnection (FR-016)
 * Expected to FAIL initially (TDD red phase)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSocketService } from '../../src/services/socket-service.js';

describe('SocketService', () => {
  let socketService;
  let mockSocket;

  beforeEach(() => {
    // Create mock socket
    mockSocket = {
      connected: false,
      on: vi.fn(),
      off: vi.fn(),
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

    // Mock io function
    vi.mock('socket.io-client', () => ({
      io: vi.fn(() => mockSocket),
    }));
  });

  afterEach(() => {
    if (socketService) {
      socketService.disconnect();
    }
    vi.clearAllMocks();
  });

  describe('Connection management', () => {
    it('should create socket service with default URL', () => {
      socketService = createSocketService();
      expect(socketService).toBeDefined();
      expect(socketService.connect).toBeDefined();
      expect(socketService.disconnect).toBeDefined();
      expect(socketService.emit).toBeDefined();
      expect(socketService.on).toBeDefined();
      expect(socketService.off).toBeDefined();
    });

    it('should connect to server', () => {
      socketService = createSocketService('http://localhost:3000');
      socketService.connect();
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('should disconnect from server', () => {
      socketService = createSocketService();
      socketService.connect();
      socketService.disconnect();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should return connection status', () => {
      socketService = createSocketService();
      expect(socketService.isConnected()).toBe(false);

      mockSocket.connected = true;
      expect(socketService.isConnected()).toBe(true);
    });
  });

  describe('Event handling', () => {
    it('should register event listener', () => {
      socketService = createSocketService();
      const handler = vi.fn();

      socketService.on('test_event', handler);
      expect(mockSocket.on).toHaveBeenCalledWith('test_event', handler);
    });

    it('should remove event listener', () => {
      socketService = createSocketService();
      const handler = vi.fn();

      socketService.off('test_event', handler);
      expect(mockSocket.off).toHaveBeenCalledWith('test_event', handler);
    });

    it('should emit event with data', () => {
      socketService = createSocketService();
      const data = { message: 'Hello' };

      socketService.emit('send_message', data);
      expect(mockSocket.emit).toHaveBeenCalledWith('send_message', data);
    });

    it('should support multiple listeners for same event', () => {
      socketService = createSocketService();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      socketService.on('test_event', handler1);
      socketService.on('test_event', handler2);

      expect(mockSocket.on).toHaveBeenCalledTimes(2);
    });
  });

  describe('Reconnection handling (FR-016)', () => {
    it('should support max 5 reconnection attempts', () => {
      socketService = createSocketService('http://localhost:3000', {
        reconnectionAttempts: 5,
      });

      expect(socketService).toBeDefined();
      // Reconnection config should be passed to socket.io
    });

    it('should handle reconnect event', () => {
      socketService = createSocketService();
      const handler = vi.fn();

      socketService.on('reconnect', handler);
      expect(mockSocket.on).toHaveBeenCalledWith('reconnect', handler);
    });

    it('should handle reconnect_failed event', () => {
      socketService = createSocketService();
      const handler = vi.fn();

      socketService.on('reconnect_failed', handler);
      expect(mockSocket.on).toHaveBeenCalledWith('reconnect_failed', handler);
    });

    it('should handle disconnect event', () => {
      socketService = createSocketService();
      const handler = vi.fn();

      socketService.on('disconnect', handler);
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', handler);
    });
  });

  describe('Cleanup', () => {
    it('should remove all listeners on disconnect', () => {
      socketService = createSocketService();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      socketService.on('event1', handler1);
      socketService.on('event2', handler2);

      socketService.disconnect();

      // Should have removed listeners
      expect(mockSocket.off).toHaveBeenCalled();
    });
  });

  describe('Helper methods', () => {
    it('should provide authenticate helper', () => {
      socketService = createSocketService();

      socketService.authenticate({ username: 'alice' });
      expect(mockSocket.emit).toHaveBeenCalledWith('authenticate', { username: 'alice' });
    });

    it('should provide joinRoom helper', () => {
      socketService = createSocketService();

      socketService.joinRoom('general');
      expect(mockSocket.emit).toHaveBeenCalledWith('join_room', { roomName: 'general' });
    });

    it('should provide sendMessage helper', () => {
      socketService = createSocketService();

      socketService.sendMessage('Hello, world!');
      expect(mockSocket.emit).toHaveBeenCalledWith('send_message', { content: 'Hello, world!' });
    });

    it('should provide leaveRoom helper', () => {
      socketService = createSocketService();

      socketService.leaveRoom();
      expect(mockSocket.emit).toHaveBeenCalledWith('leave_room');
    });

    it('should provide createRoom helper', () => {
      socketService = createSocketService();

      socketService.createRoom('my-room');
      expect(mockSocket.emit).toHaveBeenCalledWith('create_room', { roomName: 'my-room' });
    });

    it('should provide deleteRoom helper', () => {
      socketService = createSocketService();

      socketService.deleteRoom(123);
      expect(mockSocket.emit).toHaveBeenCalledWith('delete_room', { roomId: 123 });
    });

    it('should provide loadMessages helper', () => {
      socketService = createSocketService();

      socketService.loadMessages(1, 50);
      expect(mockSocket.emit).toHaveBeenCalledWith('load_messages', { page: 1, pageSize: 50 });
    });
  });

  describe('Error handling', () => {
    it('should handle connection errors', () => {
      socketService = createSocketService();
      const errorHandler = vi.fn();

      socketService.on('connect_error', errorHandler);
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', errorHandler);
    });

    it('should handle server errors', () => {
      socketService = createSocketService();
      const errorHandler = vi.fn();

      socketService.on('error', errorHandler);
      expect(mockSocket.on).toHaveBeenCalledWith('error', errorHandler);
    });
  });
});
