/**
 * usePresence Composable
 * Manages online users list with reactive updates (PR-003 <500ms)
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';

export function usePresence(socket) {
  const users = ref([]);

  /**
   * Online user count
   */
  const onlineCount = computed(() => users.value.length);

  /**
   * Handle room_joined event - set initial users
   */
  function handleRoomJoined(data) {
    users.value = [...data.users];
  }

  /**
   * Handle user_joined event - add user to list
   */
  function handleUserJoined(data) {
    if (!users.value.includes(data.username)) {
      users.value.push(data.username);
    }
  }

  /**
   * Handle user_left event - remove user from list
   */
  function handleUserLeft(data) {
    const index = users.value.indexOf(data.username);
    if (index > -1) {
      users.value.splice(index, 1);
    }
  }

  /**
   * Clear users list (when leaving room)
   */
  function clearUsers() {
    users.value = [];
  }

  // Register event listeners
  onMounted(() => {
    socket.on('room_joined', handleRoomJoined);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
  });

  // Clean up event listeners
  onUnmounted(() => {
    socket.off('room_joined', handleRoomJoined);
    socket.off('user_joined', handleUserJoined);
    socket.off('user_left', handleUserLeft);
  });

  return {
    users,
    onlineCount,
    clearUsers,
  };
}
