/**
 * Unit test for useRooms composable
 * Tests: room list, create, delete, switch rooms <1s (PR-008)
 * Expected to FAIL initially (TDD red phase)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRooms } from '../../src/composables/useRooms.js';

describe('useRooms', () => {
  let mockSocket;

  beforeEach(() => {
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      joinRoom: vi.fn(),
      createRoom: vi.fn(),
      deleteRoom: vi.fn(),
      leaveRoom: vi.fn(),
    };
  });

  it('should initialize with null currentRoom', () => {
    const { currentRoom } = useRooms(mockSocket);
    expect(currentRoom.value).toBeNull();
  });

  it('should set currentRoom on room_joined event', () => {
    const { currentRoom } = useRooms(mockSocket);

    const onHandler = mockSocket.on.mock.calls.find(call => call[0] === 'room_joined');
    const handler = onHandler[1];

    handler({ roomId: 1, roomName: 'general' });
    expect(currentRoom.value).toEqual({ roomId: 1, roomName: 'general' });
  });

  it('should join room via socket', () => {
    const { joinRoom } = useRooms(mockSocket);

    joinRoom('general');
    expect(mockSocket.joinRoom).toHaveBeenCalledWith('general');
  });

  it('should create room via socket', () => {
    const { createRoom } = useRooms(mockSocket);

    createRoom('my-room');
    expect(mockSocket.createRoom).toHaveBeenCalledWith('my-room');
  });

  it('should delete room via socket', () => {
    const { deleteRoom } = useRooms(mockSocket);

    deleteRoom(123);
    expect(mockSocket.deleteRoom).toHaveBeenCalledWith(123);
  });

  it('should leave room via socket', () => {
    const { leaveRoom } = useRooms(mockSocket);

    leaveRoom();
    expect(mockSocket.leaveRoom).toHaveBeenCalled();
  });

  it('should clear currentRoom on room_left event', () => {
    const { currentRoom } = useRooms(mockSocket);

    // Set current room
    const roomJoinedHandler = mockSocket.on.mock.calls.find(call => call[0] === 'room_joined')[1];
    roomJoinedHandler({ roomId: 1, roomName: 'general' });

    // Leave room
    const roomLeftHandler = mockSocket.on.mock.calls.find(call => call[0] === 'room_left')[1];
    roomLeftHandler({});

    expect(currentRoom.value).toBeNull();
  });

  it('should enforce single room per user (FR-017)', () => {
    const { currentRoom } = useRooms(mockSocket);

    const roomJoinedHandler = mockSocket.on.mock.calls.find(call => call[0] === 'room_joined')[1];

    // Join first room
    roomJoinedHandler({ roomId: 1, roomName: 'room1' });
    expect(currentRoom.value.roomName).toBe('room1');

    // Join second room (should replace)
    roomJoinedHandler({ roomId: 2, roomName: 'room2' });
    expect(currentRoom.value.roomName).toBe('room2');
  });

  it('should track room creation status', () => {
    const { creatingRoom, createRoom } = useRooms(mockSocket);

    expect(creatingRoom.value).toBe(false);

    createRoom('new-room');
    expect(creatingRoom.value).toBe(true);

    // Simulate room_created
    const onHandler = mockSocket.on.mock.calls.find(call => call[0] === 'room_created');
    const handler = onHandler[1];
    handler({ roomId: 1, roomName: 'new-room' });

    expect(creatingRoom.value).toBe(false);
  });
});
