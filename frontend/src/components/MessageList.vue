<template>
  <div
    ref="messageContainer"
    class="flex-1 overflow-y-auto p-4 space-y-3"
    role="log"
    aria-live="polite"
    aria-label="Chat messages"
  >
    <div v-if="messages.length === 0" class="text-center text-gray-500 mt-8">
      No messages yet. Start the conversation!
    </div>

    <div
      v-for="message in messages"
      :key="message.messageId"
      class="flex flex-col"
      :class="{ 'items-end': message.isOwn }"
    >
      <div
        class="max-w-md px-4 py-2 rounded-lg shadow"
        :class="{
          'bg-blue-500 text-white': message.isOwn,
          'bg-white text-gray-900': !message.isOwn,
        }"
      >
        <div v-if="!message.isOwn" class="text-xs font-semibold mb-1">
          {{ message.username }}
        </div>
        <div class="break-words">{{ message.content }}</div>
        <div
          class="text-xs mt-1 flex items-center justify-end gap-1"
          :class="{ 'text-blue-100': message.isOwn, 'text-gray-500': !message.isOwn }"
        >
          <span>{{ formatTimestamp(message.timestamp) }}</span>
          <span v-if="message.isOwn && message.status === 'sent'" class="ml-1">✓</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  messages: {
    type: Array,
    required: true,
  },
  currentUsername: {
    type: String,
    default: null,
  },
});

const messageContainer = ref(null);

// Auto-scroll to bottom when new messages arrive
watch(
  () => props.messages,
  async () => {
    await nextTick();
    if (messageContainer.value) {
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
    }
  },
  { deep: true }
);

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
</script>
