import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { useAuthStore } from '../stores/authStore';

// API client configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

import type {
  ApiResponse,
  PaginatedResponse,
  LoginRequest,
  LoginResponse,
  User,
  UserSession,
  ChatRoom,
  Message,
  MessageResult,
  FileAttachment,
  CreateRoomForm,
  SendMessageForm,
  UpdateProfileForm,
  ModerationAction,
  ModerationStatus,
} from '../types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear auth state and redirect to login
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<ApiResponse<LoginResponse>>('/auth/login', data);
    return response.data.data!;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
  }

  async refreshToken(): Promise<{ token: string }> {
    const response = await this.client.post<ApiResponse<{ token: string }>>('/auth/refresh');
    return response.data.data!;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<ApiResponse<User>>('/auth/me');
    return response.data.data!;
  }

  async getSessions(): Promise<UserSession[]> {
    const response = await this.client.get<ApiResponse<UserSession[]>>('/auth/sessions');
    return response.data.data!;
  }

  async terminateSession(sessionId: string): Promise<void> {
    await this.client.delete(`/auth/sessions/${sessionId}`);
  }

  // User endpoints
  async getUsers(params?: {
    search?: string;
    online?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<User>> {
    const response = await this.client.get<PaginatedResponse<User>>('/users', { params });
    return response.data;
  }

  async getUser(userId: string): Promise<User> {
    const response = await this.client.get<ApiResponse<User>>(`/users/${userId}`);
    return response.data.data!;
  }

  async updateUser(userId: string, data: UpdateProfileForm): Promise<User> {
    const response = await this.client.put<ApiResponse<User>>(`/users/${userId}`, data);
    return response.data.data!;
  }

  async searchUsers(query: string, limit = 10): Promise<User[]> {
    const response = await this.client.get<ApiResponse<User[]>>('/users/search', {
      params: { q: query, limit },
    });
    return response.data.data!;
  }

  async getOnlineUsers(): Promise<User[]> {
    const response = await this.client.get<ApiResponse<User[]>>('/users/online');
    return response.data.data!;
  }

  async updatePresence(userId: string, status: string): Promise<void> {
    await this.client.put(`/users/${userId}/presence`, { status });
  }

  // Room endpoints
  async getRooms(params?: { type?: string; active?: boolean }): Promise<ChatRoom[]> {
    const response = await this.client.get<ApiResponse<ChatRoom[]>>('/rooms', { params });
    return response.data.data!;
  }

  async getRoom(roomId: string): Promise<ChatRoom> {
    const response = await this.client.get<ApiResponse<ChatRoom>>(`/rooms/${roomId}`);
    return response.data.data!;
  }

  async createRoom(data: CreateRoomForm): Promise<ChatRoom> {
    const response = await this.client.post<ApiResponse<ChatRoom>>('/rooms', data);
    return response.data.data!;
  }

  async createDirectMessage(otherUserId: string): Promise<ChatRoom> {
    const response = await this.client.post<ApiResponse<ChatRoom>>('/rooms/direct', {
      otherUserId,
    });
    return response.data.data!;
  }

  async updateRoom(roomId: string, data: Partial<CreateRoomForm>): Promise<ChatRoom> {
    const response = await this.client.put<ApiResponse<ChatRoom>>(`/rooms/${roomId}`, data);
    return response.data.data!;
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.client.delete(`/rooms/${roomId}`);
  }

  async joinRoom(roomId: string): Promise<void> {
    await this.client.post(`/rooms/${roomId}/join`);
  }

  async leaveRoom(roomId: string): Promise<void> {
    await this.client.post(`/rooms/${roomId}/leave`);
  }

  async getRoomParticipants(roomId: string): Promise<any[]> {
    const response = await this.client.get<ApiResponse<any[]>>(`/rooms/${roomId}/participants`);
    return response.data.data!;
  }

  async addParticipant(roomId: string, userId: string, role = 'member'): Promise<void> {
    await this.client.post(`/rooms/${roomId}/participants`, { userId, role });
  }

  async removeParticipant(roomId: string, userId: string): Promise<void> {
    await this.client.delete(`/rooms/${roomId}/participants/${userId}`);
  }

  async searchPublicRooms(query: string, limit = 10): Promise<ChatRoom[]> {
    const response = await this.client.get<ApiResponse<ChatRoom[]>>('/rooms/search', {
      params: { q: query, limit },
    });
    return response.data.data!;
  }

  // Message endpoints
  async sendMessage(data: SendMessageForm & { chatRoomId: string }): Promise<Message> {
    const response = await this.client.post<ApiResponse<Message>>('/messages', data);
    return response.data.data!;
  }

  async getMessage(messageId: string): Promise<Message> {
    const response = await this.client.get<ApiResponse<Message>>(`/messages/${messageId}`);
    return response.data.data!;
  }

  async editMessage(messageId: string, content: string): Promise<Message> {
    const response = await this.client.put<ApiResponse<Message>>(`/messages/${messageId}`, {
      content,
    });
    return response.data.data!;
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.client.delete(`/messages/${messageId}`);
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    await this.client.post(`/messages/${messageId}/read`);
  }

  async getRoomMessages(
    roomId: string,
    params?: {
      before?: Date;
      after?: Date;
      limit?: number;
    }
  ): Promise<MessageResult> {
    const response = await this.client.get<ApiResponse<MessageResult>>(`/messages/rooms/${roomId}`, {
      params: {
        ...params,
        before: params?.before?.toISOString(),
        after: params?.after?.toISOString(),
      },
    });
    return response.data.data!;
  }

  async getUnreadCount(roomId: string): Promise<{ count: number }> {
    const response = await this.client.get<ApiResponse<{ count: number }>>(
      `/messages/rooms/${roomId}/unread-count`
    );
    return response.data.data!;
  }

  async searchMessages(roomId: string, query: string, limit = 20): Promise<Message[]> {
    const response = await this.client.get<ApiResponse<Message[]>>(
      `/messages/rooms/${roomId}/search`,
      {
        params: { q: query, limit },
      }
    );
    return response.data.data!;
  }

  async getRecentMessages(limit = 50): Promise<Message[]> {
    const response = await this.client.get<ApiResponse<Message[]>>('/messages/recent', {
      params: { limit },
    });
    return response.data.data!;
  }

  // File endpoints
  async uploadFile(
    file: File,
    chatRoomId?: string,
    messageId?: string,
    onProgress?: (progress: number) => void
  ): Promise<FileAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    if (chatRoomId) formData.append('chatRoomId', chatRoomId);
    if (messageId) formData.append('messageId', messageId);

    const response = await this.client.post<ApiResponse<FileAttachment>>('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    return response.data.data!;
  }

  async getFile(fileId: string): Promise<FileAttachment> {
    const response = await this.client.get<ApiResponse<FileAttachment>>(`/files/${fileId}`);
    return response.data.data!;
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const response = await this.client.get(`/files/${fileId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.client.delete(`/files/${fileId}`);
  }

  async getUserFiles(params?: {
    type?: string;
    chatRoomId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<FileAttachment>> {
    const response = await this.client.get<PaginatedResponse<FileAttachment>>('/files', { params });
    return response.data;
  }

  async getRoomFiles(
    roomId: string,
    params?: {
      type?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<PaginatedResponse<FileAttachment>> {
    const response = await this.client.get<PaginatedResponse<FileAttachment>>(
      `/files/rooms/${roomId}`,
      { params }
    );
    return response.data;
  }

  // Moderation endpoints
  async flagMessage(messageId: string, reason: string): Promise<void> {
    await this.client.post(`/moderation/messages/${messageId}/flag`, { reason });
  }

  async getUserModerationStatus(userId: string, roomId?: string): Promise<ModerationStatus> {
    const response = await this.client.get<ApiResponse<ModerationStatus>>(
      `/moderation/users/${userId}/status`,
      {
        params: roomId ? { roomId } : undefined,
      }
    );
    return response.data.data!;
  }

  async getRoomModerationStatus(roomId: string): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>(`/moderation/rooms/${roomId}/status`);
    return response.data.data!;
  }

  // Moderator-only endpoints
  async createModerationAction(data: {
    type: string;
    targetUserId: string;
    reason: string;
    duration?: number;
    roomId?: string;
    messageId?: string;
  }): Promise<ModerationAction> {
    const response = await this.client.post<ApiResponse<ModerationAction>>(
      '/moderation/actions',
      data
    );
    return response.data.data!;
  }

  async warnUser(userId: string, reason: string, roomId?: string): Promise<ModerationAction> {
    const response = await this.client.post<ApiResponse<ModerationAction>>(
      `/moderation/users/${userId}/warn`,
      { reason, roomId }
    );
    return response.data.data!;
  }

  async muteUser(
    userId: string,
    reason: string,
    duration?: number,
    roomId?: string
  ): Promise<ModerationAction> {
    const response = await this.client.post<ApiResponse<ModerationAction>>(
      `/moderation/users/${userId}/mute`,
      { reason, duration, roomId }
    );
    return response.data.data!;
  }

  async kickUser(userId: string, reason: string, roomId: string): Promise<ModerationAction> {
    const response = await this.client.post<ApiResponse<ModerationAction>>(
      `/moderation/users/${userId}/kick`,
      { reason, roomId }
    );
    return response.data.data!;
  }

  async banUser(
    userId: string,
    reason: string,
    duration?: number,
    roomId?: string
  ): Promise<ModerationAction> {
    const response = await this.client.post<ApiResponse<ModerationAction>>(
      `/moderation/users/${userId}/ban`,
      { reason, duration, roomId }
    );
    return response.data.data!;
  }

  async lockRoom(roomId: string, reason: string): Promise<ModerationAction> {
    const response = await this.client.post<ApiResponse<ModerationAction>>(
      `/moderation/rooms/${roomId}/lock`,
      { reason }
    );
    return response.data.data!;
  }

  async unlockRoom(roomId: string, reason: string): Promise<ModerationAction> {
    const response = await this.client.post<ApiResponse<ModerationAction>>(
      `/moderation/rooms/${roomId}/unlock`,
      { reason }
    );
    return response.data.data!;
  }
}

export const apiClient = new ApiClient();
export default apiClient;