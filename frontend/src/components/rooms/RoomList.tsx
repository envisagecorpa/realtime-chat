import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Hash, MessageCircle, Users, Lock } from 'lucide-react';
import { clsx } from 'clsx';
import { UserAvatar } from '../ui/UserAvatar';
import { Badge } from '../ui/Badge';
import { useRoomTypingUsers } from '../../stores/chatStore';
import type { ChatRoom } from '../../types';

interface RoomListProps {
  rooms: ChatRoom[];
  currentRoom: ChatRoom | null;
  onRoomSelect: (room: ChatRoom) => void;
}

export function RoomList({ rooms, currentRoom, onRoomSelect }: RoomListProps) {
  if (rooms.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {rooms.map((room) => (
        <RoomListItem
          key={room.id}
          room={room}
          isSelected={currentRoom?.id === room.id}
          onSelect={() => onRoomSelect(room)}
        />
      ))}
    </div>
  );
}

interface RoomListItemProps {
  room: ChatRoom;
  isSelected: boolean;
  onSelect: () => void;
}

function RoomListItem({ room, isSelected, onSelect }: RoomListItemProps) {
  const typingUsers = useRoomTypingUsers(room.id);
  const hasTypingUsers = typingUsers.length > 0;

  const getRoomIcon = () => {
    switch (room.type) {
      case 'direct':
        return <MessageCircle className="h-4 w-4" />;
      case 'group':
        return <Users className="h-4 w-4" />;
      case 'public':
        return <Hash className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getRoomName = () => {
    if (room.type === 'direct') {
      // For direct messages, show the other participant's name
      const otherParticipant = room.participants?.find(
        (p) => p.user.id !== room.createdBy.id // This is simplified; in practice, you'd exclude the current user
      );
      return otherParticipant?.user.displayName || otherParticipant?.user.username || room.name;
    }
    return room.name;
  };

  const getLastActivity = () => {
    return formatDistanceToNow(new Date(room.updatedAt), { addSuffix: true });
  };

  return (
    <button
      onClick={onSelect}
      className={clsx(
        'w-full p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-150',
        isSelected && 'bg-blue-50 border border-blue-200'
      )}
    >
      <div className="flex items-start space-x-3">
        {/* Room icon or avatar */}
        <div className="flex-shrink-0 mt-1">
          {room.type === 'direct' && room.participants?.[0] ? (
            <UserAvatar
              user={room.participants[0].user}
              size="sm"
              showOnlineStatus
            />
          ) : (
            <div
              className={clsx(
                'flex items-center justify-center h-8 w-8 rounded-lg',
                room.type === 'public' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
              )}
            >
              {getRoomIcon()}
            </div>
          )}
        </div>

        {/* Room details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <p
                className={clsx(
                  'text-sm font-medium truncate',
                  isSelected ? 'text-blue-900' : 'text-gray-900'
                )}
              >
                {getRoomName()}
              </p>
              {!room.isActive && (
                <Lock className="h-3 w-3 text-gray-400 flex-shrink-0" />
              )}
            </div>

            {/* Unread count badge */}
            {room.unreadCount && room.unreadCount > 0 && (
              <Badge variant="danger" size="sm">
                {room.unreadCount > 99 ? '99+' : room.unreadCount}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between mt-1">
            {/* Typing indicator or last activity */}
            <div className="flex-1 min-w-0">
              {hasTypingUsers ? (
                <p className="text-xs text-green-600 italic">
                  {typingUsers.length === 1
                    ? 'Someone is typing...'
                    : `${typingUsers.length} people are typing...`}
                </p>
              ) : (
                <p className="text-xs text-gray-500 truncate">
                  {room.description || `Active ${getLastActivity()}`}
                </p>
              )}
            </div>

            {/* Online count for group rooms */}
            {room.type !== 'direct' && room.onlineCount !== undefined && (
              <div className="flex items-center space-x-1 ml-2">
                <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                <span className="text-xs text-gray-500">{room.onlineCount}</span>
              </div>
            )}
          </div>

          {/* Participant avatars for group rooms */}
          {room.type !== 'direct' && room.participants && room.participants.length > 0 && (
            <div className="flex items-center mt-2 -space-x-1">
              {room.participants.slice(0, 3).map((participant) => (
                <UserAvatar
                  key={participant.id}
                  user={participant.user}
                  size="xs"
                  className="ring-1 ring-white"
                />
              ))}
              {room.participants.length > 3 && (
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-200 text-gray-600 ring-1 ring-white">
                  <span className="text-xs font-medium">
                    +{room.participants.length - 3}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}