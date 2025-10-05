import { createRouter, createWebHistory } from 'vue-router';
import Login from '../views/Login.vue';
import ChatRoom from '../views/ChatRoom.vue';

const routes = [
  {
    path: '/',
    name: 'Login',
    component: Login,
  },
  {
    path: '/chat',
    name: 'ChatRoom',
    component: ChatRoom,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard for authentication
router.beforeEach((to, from, next) => {
  const username = sessionStorage.getItem('username');

  if (to.meta.requiresAuth && !username) {
    next('/');
  } else if (to.path === '/' && username) {
    next('/chat');
  } else {
    next();
  }
});

export default router;
