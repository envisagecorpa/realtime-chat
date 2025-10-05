<template>
  <div class="bg-white rounded-lg shadow p-4">
    <h3 class="text-sm font-semibold text-gray-700 mb-3">
      Online Users ({{ onlineCount }})
    </h3>
    <div class="space-y-2">
      <div
        v-for="user in users"
        :key="user"
        class="flex items-center gap-2 text-sm"
      >
        <span class="w-2 h-2 bg-green-500 rounded-full"></span>
        <span class="text-gray-900">{{ user }}</span>
      </div>
    </div>
    <div v-if="users.length === 0" class="text-sm text-gray-500">
      No users online
    </div>
  </div>
</template>

<script setup>
defineProps({
  users: {
    type: Array,
    required: true,
  },
  onlineCount: {
    type: Number,
    required: true,
  },
});
</script>
