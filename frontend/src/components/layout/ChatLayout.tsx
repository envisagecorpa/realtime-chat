import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { ChatArea } from '../chat/ChatArea';
import { UserProfile } from '../user/UserProfile';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { apiClient } from '../../services/api';
import { socketService } from '../../services/socket';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorBoundary } from '../ui/ErrorBoundary';

export function ChatLayout() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { setRooms, setOnlineUsers } = useChatStore();
  const [isConnected, setIsConnected] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Fetch user's rooms
  const {
    data: rooms = [],
    isLoading: roomsLoading,
    error: roomsError,
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => apiClient.getRooms(),
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch online users
  const { data: onlineUsers = [] } = useQuery({
    queryKey: ['online-users'],
    queryFn: () => apiClient.getOnlineUsers(),
    enabled: isAuthenticated,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Update stores when data changes
  useEffect(() => {
    if (rooms) {
      setRooms(rooms);
    }
  }, [rooms, setRooms]);

  useEffect(() => {
    if (onlineUsers) {
      setOnlineUsers(onlineUsers.map(user => user.id));
    }
  }, [onlineUsers, setOnlineUsers]);

  // Handle socket connection
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Monitor socket connection status
    const cleanup = socketService.onConnectionChange(setIsConnected);

    return cleanup;
  }, [isAuthenticated, navigate]);

  // Handle connection errors
  useEffect(() => {
    if (roomsError) {
      console.error('Failed to load rooms:', roomsError);
      // If unauthorized, logout user
      if ((roomsError as any)?.response?.status === 401) {
        logout();
      }
    }
  }, [roomsError, logout]);

  if (!isAuthenticated || !user) {
    navigate('/login');
    return null;
  }

  if (roomsLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-screen flex bg-gray-100">
        {/* Sidebar */}
        <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200">
          <Sidebar
            onShowProfile={() => setShowProfile(true)}
            isConnected={isConnected}
          />
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          <ChatArea />
        </div>

        {/* User profile modal */}
        {showProfile && (
          <UserProfile
            user={user}
            isOpen={showProfile}
            onClose={() => setShowProfile(false)}
          />
        )}

        {/* Connection status indicator */}
        {!isConnected && (
          <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-md shadow-lg">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
              Disconnected - Attempting to reconnect...
            </div>
          </div>
        )}

        {/* Connected status (briefly shown) */}
        {isConnected && (
          <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-md shadow-lg animate-fade-in-out">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Connected
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

// CSS for fade in/out animation (add to your global CSS)
const styles = `
  @keyframes fade-in-out {
    0% { opacity: 0; transform: translateY(-10px); }
    10% { opacity: 1; transform: translateY(0); }
    90% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-10px); }
  }

  .animate-fade-in-out {
    animation: fade-in-out 3s ease-in-out forwards;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}