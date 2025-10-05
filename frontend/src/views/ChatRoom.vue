<template>
  <div class="h-screen flex flex-col">
    <!-- Header -->
    <header class="bg-white border-b px-6 py-4 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-800">Real-time Chat</h1>
        <p class="text-sm text-gray-600">
          Logged in as <span class="font-medium">{{ currentUsername }}</span>
          <span v-if="currentRoom" class="ml-2">• Room: #{{ currentRoom.roomName }}</span>
        </p>
      </div>
      <div class="flex items-center gap-4">
        <div
          class="flex items-center gap-2 text-sm"
          :class="connected ? 'text-green-600' : 'text-red-600'"
        >
          <span class="w-2 h-2 rounded-full" :class="connected ? 'bg-green-500' : 'bg-red-500'"></span>
          {{ connected ? 'Connected' : 'Disconnected' }}
        </div>
        <button
          @click="handleLogout"
          class="px-4 py-2 text-sm border rounded hover:bg-gray-50 transition-colors"
        >
          Logout
        </button>
      </div>
    </header>

    <!-- Reconnection Banner -->
    <div
      v-if="!connected"
      class="bg-yellow-50 border-b border-yellow-200 px-6 py-3 text-sm text-yellow-800"
    >
      ⚠️ Connection lost. Attempting to reconnect...
    </div>

    <!-- Error Toast -->
    <div
      v-if="errorMessage"
      class="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-800 flex items-center justify-between"
    >
      <span>{{ errorMessage }}</span>
      <button @click="errorMessage = ''" class="text-red-600 hover:text-red-800">✕</button>
    </div>

    <!-- Main Layout -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar - Room Selector -->
      <aside class="w-64 border-r bg-gray-800 overflow-y-auto">
        <RoomSelector
          :rooms="availableRooms"
          :current-room="currentRoom"
          :creating-room="creatingRoom"
          @join="handleJoinRoom"
          @create="handleCreateRoom"
          @delete="handleDeleteRoom"
        />
      </aside>

      <!-- Main Chat Area -->
      <main class="flex-1 flex flex-col bg-gray-50">
        <div v-if="!currentRoom" class="flex-1 flex items-center justify-center text-gray-500">
          <div class="text-center">
            <p class="text-lg mb-2">👈 Select or create a room to start chatting</p>
          </div>
        </div>

        <template v-else>
          <!-- Messages -->
          <MessageList :messages="messagesWithOwnership" :current-username="currentUsername" />

          <!-- Message Input -->
          <MessageInput
            :disabled="!connected || !currentRoom"
            :sending="sendingMessage"
            @send="handleSendMessage"
          />
        </template>
      </main>

      <!-- Right Sidebar - User List -->
      <aside class="w-64 border-l bg-gray-50 p-4 overflow-y-auto">
        <UserList :users="users" :online-count="onlineCount" />
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { getSocketService } from '../services/socket-service.js';
import { useMessages } from '../composables/useMessages.js';
import { usePresence } from '../composables/usePresence.js';
import { useRooms } from '../composables/useRooms.js';
import MessageList from '../components/MessageList.vue';
import MessageInput from '../components/MessageInput.vue';
import UserList from '../components/UserList.vue';
import RoomSelector from '../components/RoomSelector.vue';

const router = useRouter();
const socket = getSocketService();

const currentUsername = ref(sessionStorage.getItem('username') || '');
const connected = ref(socket.isConnected());
const errorMessage = ref('');
const availableRooms = ref([
  { roomId: 1, roomName: 'general', canDelete: false },
  { roomId: 2, roomName: 'random', canDelete: false },
]);

// Composables
const { messages, sendingMessage, sendMessage } = useMessages(socket);
const { users, onlineCount } = usePresence(socket);
const { currentRoom, creatingRoom, joinRoom, createRoom, deleteRoom } = useRooms(socket);

// Add ownership flag to messages
const messagesWithOwnership = computed(() => {
  return messages.value.map((msg) => ({
    ...msg,
    isOwn: msg.username === currentUsername.value,
  }));
});

function handleJoinRoom(roomName) {
  joinRoom(roomName);
}

function handleCreateRoom(roomName) {
  createRoom(roomName);
}

function handleDeleteRoom(roomId) {
  deleteRoom(roomId);
}

function handleSendMessage(content) {
  sendMessage(content);
}

function handleLogout() {
  sessionStorage.clear();
  socket.disconnect();
  router.push('/');
}

function handleError(data) {
  errorMessage.value = data.message || 'An error occurred';
  setTimeout(() => {
    errorMessage.value = '';
  }, 5000);
}

function handleConnectionChange() {
  connected.value = socket.isConnected();
}

function handleRoomCreated(data) {
  // Add new room to list
  availableRooms.value.push({
    roomId: data.roomId,
    roomName: data.roomName,
    canDelete: data.createdBy === currentUsername.value,
  });
}

onMounted(() => {
  // Check authentication
  if (!currentUsername.value) {
    router.push('/');
    return;
  }

  // Auto-join general room
  setTimeout(() => {
    joinRoom('general');
  }, 500);

  // Register event listeners
  socket.on('error', handleError);
  socket.on('connect', handleConnectionChange);
  socket.on('disconnect', handleConnectionChange);
  socket.on('room_created', handleRoomCreated);
});

onUnmounted(() => {
  socket.off('error', handleError);
  socket.off('connect', handleConnectionChange);
  socket.off('disconnect', handleConnectionChange);
  socket.off('room_created', handleRoomCreated);
});
</script>
