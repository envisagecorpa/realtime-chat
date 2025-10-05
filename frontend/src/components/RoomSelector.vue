<template>
  <div class="h-full bg-gray-800 text-white p-4 flex flex-col">
    <h2 class="text-xl font-bold mb-4">Rooms</h2>

    <!-- Create Room Form -->
    <div class="mb-4">
      <form @submit.prevent="handleCreateRoom" class="flex gap-2">
        <input
          v-model="newRoomName"
          type="text"
          placeholder="New room name..."
          class="flex-1 px-3 py-2 bg-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxlength="50"
          :disabled="creatingRoom"
        />
        <button
          type="submit"
          :disabled="!canCreateRoom"
          class="px-3 py-2 bg-blue-500 rounded text-sm hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {{ creatingRoom ? '...' : '+' }}
        </button>
      </form>
    </div>

    <!-- Room List -->
    <div class="flex-1 overflow-y-auto space-y-2">
      <div
        v-for="room in rooms"
        :key="room.roomId"
        @click="handleJoinRoom(room.roomName)"
        class="px-3 py-2 rounded cursor-pointer transition-colors"
        :class="{
          'bg-blue-600': isCurrentRoom(room.roomId),
          'bg-gray-700 hover:bg-gray-600': !isCurrentRoom(room.roomId),
        }"
        role="button"
        :aria-label="`Join room ${room.roomName}`"
      >
        <div class="flex items-center justify-between">
          <span class="font-medium"># {{ room.roomName }}</span>
          <button
            v-if="room.canDelete"
            @click.stop="handleDeleteRoom(room.roomId)"
            class="text-xs text-red-400 hover:text-red-300"
            aria-label="Delete room"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    <div v-if="rooms.length === 0" class="text-sm text-gray-400 text-center py-8">
      No rooms available
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  rooms: {
    type: Array,
    default: () => [],
  },
  currentRoom: {
    type: Object,
    default: null,
  },
  creatingRoom: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['join', 'create', 'delete']);

const newRoomName = ref('');

const canCreateRoom = computed(() => {
  return (
    !props.creatingRoom &&
    newRoomName.value.trim().length >= 3 &&
    newRoomName.value.trim().length <= 50
  );
});

function isCurrentRoom(roomId) {
  return props.currentRoom && props.currentRoom.roomId === roomId;
}

function handleJoinRoom(roomName) {
  emit('join', roomName);
}

function handleCreateRoom() {
  if (!canCreateRoom.value) return;
  emit('create', newRoomName.value.trim());
  newRoomName.value = '';
}

function handleDeleteRoom(roomId) {
  if (confirm('Are you sure you want to delete this room?')) {
    emit('delete', roomId);
  }
}
</script>
