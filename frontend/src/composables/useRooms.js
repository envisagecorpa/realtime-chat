/**
 * useRooms Composable
 * Manages room state and operations (create, delete, switch <1s PR-008)
 * Enforces single room per user (FR-017)
 */

import { ref, onMounted, onUnmounted } from 'vue';

export function useRooms(socket) {
  const currentRoom = ref(null);
  const creatingRoom = ref(false);

  /**
   * Handle room_joined event
   */
  function handleRoomJoined(data) {
    currentRoom.value = {
      roomId: data.roomId,
      roomName: data.roomName,
    };
  }

  /**
   * Handle room_left event
   */
  function handleRoomLeft() {
    currentRoom.value = null;
  }

  /**
   * Handle room_created event
   */
  function handleRoomCreated(data) {
    creatingRoom.value = false;
  }

  /**
   * Join a room
   */
  function joinRoom(roomName) {
    socket.joinRoom(roomName);
  }

  /**
   * Leave current room
   */
  function leaveRoom() {
    socket.leaveRoom();
  }

  /**
   * Create a new room
   */
  function createRoom(roomName) {
    if (!roomName || !roomName.trim()) {
      return;
    }

    creatingRoom.value = true;
    socket.createRoom(roomName);
  }

  /**
   * Delete a room
   */
  function deleteRoom(roomId) {
    socket.deleteRoom(roomId);
  }

  // Register event listeners
  onMounted(() => {
    socket.on('room_joined', handleRoomJoined);
    socket.on('room_left', handleRoomLeft);
    socket.on('room_created', handleRoomCreated);
  });

  // Clean up event listeners
  onUnmounted(() => {
    socket.off('room_joined', handleRoomJoined);
    socket.off('room_left', handleRoomLeft);
    socket.off('room_created', handleRoomCreated);
  });

  return {
    currentRoom,
    creatingRoom,
    joinRoom,
    leaveRoom,
    createRoom,
    deleteRoom,
  };
}
