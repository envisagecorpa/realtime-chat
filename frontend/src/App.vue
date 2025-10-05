<template>
  <div id="app" class="min-h-screen bg-gray-100">
    <router-view />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { getSocketService } from './services/socket-service.js';

const socket = getSocketService(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000');

onMounted(() => {
  socket.connect();
});

onUnmounted(() => {
  socket.disconnect();
});
</script>

<style>
#app {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
</style>
