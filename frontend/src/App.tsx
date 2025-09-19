import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { socketService } from './services/socket';
import { Login } from './pages/Login';
import { ChatLayout } from './components/layout/ChatLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { ToastContainer } from './components/ui/Toast';
import { useToast } from './hooks/useToast';

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function AppContent() {
  const { user, isLoading, initialize } = useAuthStore();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const { toasts, removeToast, error, success, warning } = useToast();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (user) {
      // Connect to WebSocket when user is authenticated
      setConnectionStatus('connecting');

      socketService.connect(user.id)
        .then(() => {
          setConnectionStatus('connected');
          success('Connected', 'Successfully connected to chat server');
        })
        .catch((err) => {
          console.error('Failed to connect to WebSocket:', err);
          setConnectionStatus('disconnected');
          error('Connection Failed', 'Failed to connect to chat server');
        });

      // Handle connection events
      const handleConnect = () => {
        setConnectionStatus('connected');
        success('Reconnected', 'Connection to chat server restored');
      };
      const handleDisconnect = () => {
        setConnectionStatus('disconnected');
        warning('Disconnected', 'Lost connection to chat server. Trying to reconnect...');
      };
      const handleReconnecting = () => setConnectionStatus('connecting');

      socketService.on('connect', handleConnect);
      socketService.on('disconnect', handleDisconnect);
      socketService.on('reconnecting', handleReconnecting);

      return () => {
        socketService.off('connect', handleConnect);
        socketService.off('disconnect', handleDisconnect);
        socketService.off('reconnecting', handleReconnecting);
        socketService.disconnect();
      };
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="h-screen bg-gray-100">
      {/* Connection status indicator */}
      {connectionStatus !== 'connected' && (
        <div className="bg-yellow-500 text-white text-center py-2 px-4 text-sm">
          {connectionStatus === 'connecting' ? (
            <div className="flex items-center justify-center space-x-2">
              <LoadingSpinner size="sm" />
              <span>Connecting to chat...</span>
            </div>
          ) : (
            <span>Disconnected from chat. Trying to reconnect...</span>
          )}
        </div>
      )}

      <ChatLayout />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}