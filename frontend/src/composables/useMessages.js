/**
 * useMessages Composable
 * Manages message list with reactivity and timestamp sorting (FR-008)
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';

export function useMessages(socket) {
  const messages = ref([]);
  const sendingMessage = ref(false);

  /**
   * Add new message and sort by timestamp DESC (FR-008)
   */
  function handleNewMessage(message) {
    messages.value.push(message);
    messages.value.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Handle messages_loaded event
   */
  function handleMessagesLoaded(data) {
    messages.value = [...data.messages];
  }

  /**
   * Handle message_sent event
   */
  function handleMessageSent(data) {
    sendingMessage.value = false;
    handleNewMessage(data);
  }

  /**
   * Send message to current room
   */
  function sendMessage(content) {
    if (!content || !content.trim()) {
      return;
    }

    sendingMessage.value = true;
    socket.sendMessage(content);
  }

  /**
   * Load message history
   */
  function loadHistory(page = 1, pageSize = 50) {
    socket.loadMessages(page, pageSize);
  }

  /**
   * Clear messages (when leaving room)
   */
  function clearMessages() {
    messages.value = [];
  }

  // Register event listeners
  onMounted(() => {
    socket.on('new_message', handleNewMessage);
    socket.on('messages_loaded', handleMessagesLoaded);
    socket.on('message_sent', handleMessageSent);
  });

  // Clean up event listeners
  onUnmounted(() => {
    socket.off('new_message', handleNewMessage);
    socket.off('messages_loaded', handleMessagesLoaded);
    socket.off('message_sent', handleMessageSent);
  });

  return {
    messages,
    sendingMessage,
    handleNewMessage,
    sendMessage,
    loadHistory,
    clearMessages,
  };
}
