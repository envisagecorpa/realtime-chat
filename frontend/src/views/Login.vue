<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
    <div class="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
      <h1 class="text-3xl font-bold text-center mb-2 text-gray-800">Real-time Chat</h1>
      <p class="text-center text-gray-600 mb-8">Enter your username to join</p>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="Enter username (3-20 characters)"
            class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            :class="{ 'border-red-500': error }"
            maxlength="20"
            required
            autofocus
            :disabled="loading"
          />
          <p v-if="validationError" class="text-xs text-red-500 mt-1">
            {{ validationError }}
          </p>
        </div>

        <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="!canLogin"
          class="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <span v-if="!loading">Join Chat</span>
          <span v-else>Connecting...</span>
        </button>
      </form>

      <div class="mt-6 text-center text-xs text-gray-500">
        <p>Username must be 3-20 alphanumeric characters</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { getSocketService } from '../services/socket-service.js';

const router = useRouter();
const socket = getSocketService();

const username = ref('');
const loading = ref(false);
const error = ref('');

const validationError = computed(() => {
  if (!username.value) return '';
  if (username.value.length < 3) return 'Too short (minimum 3 characters)';
  if (username.value.length > 20) return 'Too long (maximum 20 characters)';
  if (!/^[a-zA-Z0-9]+$/.test(username.value)) return 'Only letters and numbers allowed';
  return '';
});

const canLogin = computed(() => {
  return !loading.value && username.value.length >= 3 && !validationError.value;
});

function handleLogin() {
  if (!canLogin.value) return;

  error.value = '';
  loading.value = true;

  socket.authenticate({ username: username.value });
}

function handleAuthenticated(data) {
  loading.value = false;
  // Store username in session storage
  sessionStorage.setItem('username', data.username);
  sessionStorage.setItem('userId', data.userId);
  // Navigate to chat
  router.push('/chat');
}

function handleAuthError(data) {
  loading.value = false;
  error.value = data.error || 'Authentication failed. Please try again.';
}

onMounted(() => {
  // Check if already authenticated
  const storedUsername = sessionStorage.getItem('username');
  if (storedUsername) {
    router.push('/chat');
  }

  socket.on('authenticated', handleAuthenticated);
  socket.on('auth_error', handleAuthError);
});

onUnmounted(() => {
  socket.off('authenticated', handleAuthenticated);
  socket.off('auth_error', handleAuthError);
});
</script>
