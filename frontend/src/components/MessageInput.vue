<template>
  <div class="border-t bg-white p-4">
    <form @submit.prevent="handleSend" class="flex gap-2">
      <div class="flex-1">
        <textarea
          v-model="messageInput"
          @keydown.enter.exact.prevent="handleSend"
          placeholder="Type a message... (Press Enter to send)"
          rows="2"
          maxlength="2000"
          class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          :disabled="disabled || sending"
          aria-label="Message input"
        ></textarea>
        <div class="text-xs text-gray-500 mt-1 text-right">
          {{ messageInput.length }} / 2000
        </div>
      </div>
      <button
        type="submit"
        :disabled="!canSend"
        class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors h-fit"
        aria-label="Send message"
      >
        <span v-if="!sending">Send</span>
        <span v-else class="inline-block animate-spin">⏳</span>
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
  sending: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['send']);

const messageInput = ref('');

const canSend = computed(() => {
  return (
    !props.disabled &&
    !props.sending &&
    messageInput.value.trim().length > 0 &&
    messageInput.value.length <= 2000
  );
});

function handleSend() {
  if (!canSend.value) return;

  const message = messageInput.value.trim();
  emit('send', message);
  messageInput.value = '';
}
</script>
