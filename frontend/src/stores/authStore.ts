import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../services/api';
import { socketService } from '../services/socket';
import type { User, LoginRequest, LoginResponse, AuthState, UpdateProfileForm } from '../types';

interface AuthStore extends AuthState {
  // Actions
  login: (data: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateProfile: (data: UpdateProfileForm) => Promise<void>;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      // Actions
      login: async (data: LoginRequest) => {
        try {
          set({ isLoading: true });

          const response: LoginResponse = await apiClient.login(data);

          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
          });

          // Connect to WebSocket
          await socketService.connect(response.token);
          socketService.startHeartbeat();
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        // Disconnect from WebSocket
        socketService.stopHeartbeat();
        socketService.disconnect();

        // Call logout API (fire and forget)
        apiClient.logout().catch(console.error);

        // Clear state
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      refreshToken: async () => {
        try {
          const response = await apiClient.refreshToken();
          set({ token: response.token });

          // Reconnect WebSocket with new token if needed
          if (!socketService.isConnected()) {
            await socketService.connect(response.token);
          }
        } catch (error) {
          // If refresh fails, logout user
          get().logout();
          throw error;
        }
      },

      updateProfile: async (data: UpdateProfileForm) => {
        const { user } = get();
        if (!user) throw new Error('No user found');

        try {
          const updatedUser = await apiClient.updateUser(user.id, data);
          set({ user: updatedUser });
        } catch (error) {
          throw error;
        }
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      setToken: (token: string) => {
        set({ token });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      initialize: async () => {
        const { token } = get();

        if (!token) {
          set({ isLoading: false });
          return;
        }

        try {
          set({ isLoading: true });

          // Get current user info
          const user = await apiClient.getCurrentUser();

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });

          // Connect to WebSocket
          await socketService.connect(token);
          socketService.startHeartbeat();
        } catch (error) {
          console.error('Failed to initialize auth:', error);
          // Clear invalid token
          get().logout();
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Auto-refresh token periodically
let refreshInterval: NodeJS.Timeout | null = null;

const startTokenRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  refreshInterval = setInterval(() => {
    const { token, isAuthenticated } = useAuthStore.getState();
    if (token && isAuthenticated) {
      useAuthStore.getState().refreshToken().catch(console.error);
    }
  }, 23 * 60 * 60 * 1000); // Refresh every 23 hours (token expires in 24h)
};

const stopTokenRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
};

// Subscribe to auth state changes
useAuthStore.subscribe((state, prevState) => {
  if (state.isAuthenticated && !prevState.isAuthenticated) {
    startTokenRefresh();
  } else if (!state.isAuthenticated && prevState.isAuthenticated) {
    stopTokenRefresh();
  }
});

// Initialize on app start
if (typeof window !== 'undefined') {
  useAuthStore.getState().initialize();
}