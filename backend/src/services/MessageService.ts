import { AppDataSource } from '../config/database';
import { Message, MessageType, DeliveryStatus } from '../models/Message';
import { MessageReadStatus } from '../models/MessageReadStatus';
import { User } from '../models/User';
import { ChatRoom } from '../models/ChatRoom';
import { ChatRoomParticipant } from '../models/ChatRoomParticipant';

export interface MessageQuery {
  before?: Date;
  after?: Date;
  limit?: number;
  offset?: number;
}

export interface MessageResult {
  data: Message[];
  hasMore: boolean;
  nextCursor?: Date;
}

export interface CreateMessageData {
  content: string;
  messageType?: MessageType;
  parentMessageId?: string;
}

export class MessageService {
  private messageRepository = AppDataSource.getRepository(Message);
  private readStatusRepository = AppDataSource.getRepository(MessageReadStatus);
  private participantRepository = AppDataSource.getRepository(ChatRoomParticipant);

  async sendMessage(
    senderId: string,
    chatRoomId: string,
    data: CreateMessageData
  ): Promise<Message> {
    const sender = await AppDataSource.getRepository(User).findOne({ where: { id: senderId } });
    const chatRoom = await AppDataSource.getRepository(ChatRoom).findOne({
      where: { id: chatRoomId },
      relations: ['participants', 'participants.user'],
    });

    if (!sender) {
      throw new Error('Sender not found');
    }

    if (!chatRoom) {
      throw new Error('Chat room not found');
    }

    // Check if sender is a participant
    if (!chatRoom.isParticipant(senderId)) {
      throw new Error('User is not a participant in this room');
    }

    // Validate parent message if provided
    let parentMessage: Message | undefined;
    if (data.parentMessageId) {
      parentMessage = await this.messageRepository.findOne({
        where: { id: data.parentMessageId, chatRoomId },
      });

      if (!parentMessage) {
        throw new Error('Parent message not found in this room');
      }
    }

    // Create message
    const message = this.messageRepository.create(
      Message.createTextMessage(data.content, sender, chatRoom, parentMessage)
    );

    if (data.messageType) {
      message.messageType = data.messageType;
    }

    const savedMessage = await this.messageRepository.save(message);

    // Create delivery status for all room participants except sender
    await this.createDeliveryStatuses(savedMessage, chatRoom.activeParticipants, senderId);

    return await this.getMessageById(savedMessage.id) as Message;
  }

  async editMessage(messageId: string, userId: string, newContent: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender', 'chatRoom'],
    });

    if (!message) {
      throw new Error('Message not found');
    }

    if (!message.canBeEditedBy(userId)) {
      throw new Error('You cannot edit this message');
    }

    message.edit(newContent);
    await this.messageRepository.save(message);

    return await this.getMessageById(messageId) as Message;
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender', 'chatRoom'],
    });

    if (!message) {
      throw new Error('Message not found');
    }

    if (!message.canBeDeletedBy(userId)) {
      throw new Error('You cannot delete this message');
    }

    message.softDelete();
    await this.messageRepository.save(message);
  }

  async getMessageById(messageId: string): Promise<Message | null> {
    return await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender', 'chatRoom', 'attachments', 'readStatus', 'readStatus.user'],
    });
  }

  async getRoomMessages(
    roomId: string,
    userId: string,
    query: MessageQuery = {}
  ): Promise<MessageResult> {
    // Verify user is participant
    const participant = await this.participantRepository.findOne({
      where: { chatRoomId: roomId, userId },
    });

    if (!participant || !participant.isActive()) {
      throw new Error('Access denied to room messages');
    }

    const { before, after, limit = 50 } = query;

    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.attachments', 'attachments')
      .leftJoinAndSelect('message.readStatus', 'readStatus')
      .leftJoinAndSelect('readStatus.user', 'readUser')
      .where('message.chatRoomId = :roomId', { roomId })
      .andWhere('message.deletedAt IS NULL')
      .orderBy('message.createdAt', 'DESC')
      .limit(limit + 1); // Get one extra to check if there are more

    if (before) {
      queryBuilder.andWhere('message.createdAt < :before', { before });
    }

    if (after) {
      queryBuilder.andWhere('message.createdAt > :after', { after });
    }

    const messages = await queryBuilder.getMany();

    const hasMore = messages.length > limit;
    const data = hasMore ? messages.slice(0, limit) : messages;

    // Reverse to get chronological order (oldest first)
    data.reverse();

    return {
      data,
      hasMore,
      nextCursor: hasMore ? messages[limit].createdAt : undefined,
    };
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['chatRoom'],
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Check if user is participant
    if (!message.chatRoom.isParticipant(userId)) {
      throw new Error('Access denied');
    }

    // Don't create read status for own messages
    if (message.senderId === userId) {
      return;
    }

    // Check if already marked as read
    const existingStatus = await this.readStatusRepository.findOne({
      where: { messageId, userId },
    });

    if (existingStatus) {
      if (!existingStatus.isRead()) {
        existingStatus.markAsRead();
        await this.readStatusRepository.save(existingStatus);
      }
      return;
    }

    // Create new read status
    const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
    if (user) {
      const readStatus = this.readStatusRepository.create(
        MessageReadStatus.createReadStatus(message, user)
      );
      await this.readStatusRepository.save(readStatus);
    }

    // Update participant's last read message
    await this.participantRepository.update(
      { chatRoomId: message.chatRoomId, userId },
      { lastReadMessageId: messageId }
    );
  }

  async getUnreadCount(roomId: string, userId: string): Promise<number> {
    const participant = await this.participantRepository.findOne({
      where: { chatRoomId: roomId, userId },
    });

    if (!participant || !participant.isActive()) {
      return 0;
    }

    let queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .where('message.chatRoomId = :roomId', { roomId })
      .andWhere('message.senderId != :userId', { userId })
      .andWhere('message.deletedAt IS NULL');

    if (participant.lastReadMessageId) {
      queryBuilder = queryBuilder.andWhere('message.createdAt > (SELECT created_at FROM messages WHERE id = :lastReadId)', {
        lastReadId: participant.lastReadMessageId,
      });
    }

    return await queryBuilder.getCount();
  }

  async searchMessages(
    roomId: string,
    userId: string,
    searchTerm: string,
    limit: number = 20
  ): Promise<Message[]> {
    // Verify access
    const participant = await this.participantRepository.findOne({
      where: { chatRoomId: roomId, userId },
    });

    if (!participant || !participant.isActive()) {
      throw new Error('Access denied');
    }

    if (!searchTerm.trim()) {
      return [];
    }

    return await this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.chatRoomId = :roomId', { roomId })
      .andWhere('message.deletedAt IS NULL')
      .andWhere('message.messageType = :messageType', { messageType: MessageType.TEXT })
      .andWhere('to_tsvector(\'english\', message.content) @@ plainto_tsquery(\'english\', :searchTerm)', {
        searchTerm,
      })
      .orderBy('message.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getMessageDeliveryStatus(messageId: string, senderId: string): Promise<{
    sent: number;
    delivered: number;
    read: number;
    participants: number;
  }> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId, senderId },
      relations: ['chatRoom', 'readStatus'],
    });

    if (!message) {
      throw new Error('Message not found or access denied');
    }

    const participants = message.chatRoom.participantCount - 1; // Exclude sender
    const readStatuses = message.readStatus;

    const delivered = readStatuses.filter(rs => rs.isDelivered()).length;
    const read = readStatuses.filter(rs => rs.isRead()).length;

    return {
      sent: 1, // Message was sent
      delivered,
      read,
      participants,
    };
  }

  async createSystemMessage(roomId: string, content: string, senderId?: string): Promise<Message> {
    const chatRoom = await AppDataSource.getRepository(ChatRoom).findOne({
      where: { id: roomId },
      relations: ['createdBy', 'participants'],
    });

    if (!chatRoom) {
      throw new Error('Chat room not found');
    }

    let sender = chatRoom.createdBy;
    if (senderId) {
      const customSender = await AppDataSource.getRepository(User).findOne({ where: { id: senderId } });
      if (customSender) {
        sender = customSender;
      }
    }

    const message = this.messageRepository.create(
      Message.createSystemMessage(content, chatRoom, sender)
    );

    const savedMessage = await this.messageRepository.save(message);

    // Create delivery status for all participants
    await this.createDeliveryStatuses(savedMessage, chatRoom.activeParticipants);

    return await this.getMessageById(savedMessage.id) as Message;
  }

  private async createDeliveryStatuses(
    message: Message,
    participants: ChatRoomParticipant[],
    excludeUserId?: string
  ): Promise<void> {
    const statuses = participants
      .filter(p => p.userId !== excludeUserId)
      .map(p => this.readStatusRepository.create(
        MessageReadStatus.createDeliveryStatus(message, p.user)
      ));

    if (statuses.length > 0) {
      await this.readStatusRepository.save(statuses);
    }
  }

  async getRecentMessagesAcrossRooms(userId: string, limit: number = 50): Promise<Message[]> {
    // Get user's room IDs
    const participantRooms = await this.participantRepository.find({
      where: { userId, leftAt: null as any },
      select: ['chatRoomId'],
    });

    const roomIds = participantRooms.map(p => p.chatRoomId);

    if (roomIds.length === 0) {
      return [];
    }

    return await this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.chatRoom', 'chatRoom')
      .where('message.chatRoomId IN (:...roomIds)', { roomIds })
      .andWhere('message.deletedAt IS NULL')
      .orderBy('message.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }
}