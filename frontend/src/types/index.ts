// User types
export interface User {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  role: 'member' | 'moderator';
  lastSeen?: Date;
  createdAt: Date;
  updatedAt?: Date;
  isOnline?: boolean;
}

export interface UserSession {
  id: string;
  socketId: string;
  deviceInfo?: any;
  ipAddress?: string;
  userAgent?: string;
  presenceStatus: PresenceStatus;
  lastHeartbeat: Date;
  createdAt: Date;
  isCurrent?: boolean;
}

// Message types
export interface Message {
  id: string;
  content: string;
  messageType: MessageType;
  senderId: string;
  chatRoomId: string;
  parentMessageId?: string;
  editedAt?: Date;
  createdAt: Date;
  sender: User;
  attachments?: FileAttachment[];
  readStatus?: MessageReadStatus[];
}

export type MessageType = 'text' | 'system' | 'file_attachment';

export interface MessageReadStatus {
  id: string;
  messageId: string;
  userId: string;
  deliveryStatus: DeliveryStatus;
  readAt?: Date;
  deliveredAt?: Date;
  user: User;
}

export type DeliveryStatus = 'sent' | 'delivered' | 'read';

// Room types
export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  type: RoomType;
  isActive: boolean;
  maxParticipants?: number;
  participantCount: number;
  unreadCount?: number;
  onlineCount?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: User;
  userRole?: ParticipantRole;
  canManage?: boolean;
  participants?: ChatRoomParticipant[];
}

export type RoomType = 'direct' | 'group' | 'public';

export interface ChatRoomParticipant {
  id: string;
  role: ParticipantRole;
  joinedAt: Date;
  user: User;
  isOnline?: boolean;
}

export type ParticipantRole = 'member' | 'admin';

// File types
export interface FileAttachment {
  id: string;
  originalName: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  attachmentType: AttachmentType;
  chatRoomId?: string;
  messageId?: string;
  downloadCount: number;
  createdAt: Date;
  uploadedBy: User;
  isImage?: boolean;
  isVideo?: boolean;
  isAudio?: boolean;
  formattedSize?: string;
}

export type AttachmentType = 'image' | 'video' | 'audio' | 'document';

// Presence types
export type PresenceStatus = 'online' | 'away' | 'offline';

export interface PresenceData {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
  deviceInfo?: any;
}

export interface TypingData {
  userId: string;
  roomId: string;
  isTyping: boolean;
  timestamp: Date;
}

// Auth types
export interface LoginRequest {
  username: string;
  displayName?: string;
  deviceInfo?: any;
}

export interface LoginResponse {
  user: User;
  token: string;
  session: UserSession;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface MessageResult {
  messages: Message[];
  hasMore: boolean;
  nextCursor?: Date;
}

// Socket types
export interface SocketResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: any;
  };
}

export interface SocketEvents {
  // Connection events
  connected: { socketId: string; userId: string; timestamp: string };
  error: { message: string };

  // Message events
  new_message: Message;
  message_edited: { id: string; content: string; editedAt: Date };
  message_deleted: { messageId: string; deletedBy: string };
  message_read: { messageId: string; userId: string; readAt: string };

  // Room events
  user_joined_room: { userId: string; username: string; roomId: string; timestamp: string };
  user_left_room: { userId: string; username: string; roomId: string; timestamp: string };

  // Presence events
  user_typing: { userId: string; username: string; roomId: string; isTyping: boolean };
  presence_change: { userId: string; status: PresenceStatus; timestamp: string };
}

// Form types
export interface SendMessageForm {
  content: string;
  messageType?: MessageType;
  parentMessageId?: string;
}

export interface CreateRoomForm {
  name: string;
  type: RoomType;
  description?: string;
  maxParticipants?: number;
}

export interface UpdateProfileForm {
  displayName?: string;
  email?: string;
}

// Store types
export interface ChatStore {
  // Current state
  currentRoom: ChatRoom | null;
  rooms: ChatRoom[];
  messages: Record<string, Message[]>;
  onlineUsers: string[];
  typingUsers: Record<string, string[]>; // roomId -> userIds

  // Actions
  setCurrentRoom: (room: ChatRoom | null) => void;
  setRooms: (rooms: ChatRoom[]) => void;
  addRoom: (room: ChatRoom) => void;
  updateRoom: (room: ChatRoom) => void;
  removeRoom: (roomId: string) => void;

  setMessages: (roomId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  removeMessage: (messageId: string) => void;

  setOnlineUsers: (userIds: string[]) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;

  setTypingUsers: (roomId: string, userIds: string[]) => void;
  addTypingUser: (roomId: string, userId: string) => void;
  removeTypingUser: (roomId: string, userId: string) => void;
}

// UI types
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface Modal {
  isOpen: boolean;
  title?: string;
  component?: React.ComponentType<any>;
  props?: any;
}

// Search types
export interface SearchResult {
  messages?: Message[];
  users?: User[];
  rooms?: ChatRoom[];
}

// Error types
export interface AppError {
  type: string;
  message: string;
  statusCode?: number;
  details?: any;
}

// Moderation types
export interface ModerationAction {
  id: string;
  type: ModerationActionType;
  targetUserId: string;
  moderatorId: string;
  reason: string;
  duration?: number;
  roomId?: string;
  messageId?: string;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export type ModerationActionType =
  | 'warn'
  | 'mute'
  | 'kick'
  | 'ban'
  | 'message_delete'
  | 'message_flag'
  | 'room_lock'
  | 'room_unlock';

export interface ModerationStatus {
  userId: string;
  roomId?: string;
  isMuted: boolean;
  isBanned: boolean;
  restrictions: {
    canSendMessages: boolean;
    canJoinRooms: boolean;
  };
}