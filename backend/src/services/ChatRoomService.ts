import { AppDataSource } from '../config/database';
import { ChatRoom, RoomType } from '../models/ChatRoom';
import { ChatRoomParticipant, ParticipantRole } from '../models/ChatRoomParticipant';
import { User } from '../models/User';
import { MessageService } from './MessageService';

export interface CreateRoomData {
  name: string;
  type: RoomType;
  description?: string;
  maxParticipants?: number;
}

export interface RoomListQuery {
  type?: RoomType;
  active?: boolean;
  search?: string;
}

export class ChatRoomService {
  private roomRepository = AppDataSource.getRepository(ChatRoom);
  private participantRepository = AppDataSource.getRepository(ChatRoomParticipant);
  private userRepository = AppDataSource.getRepository(User);
  private messageService = new MessageService();

  async createRoom(creatorId: string, data: CreateRoomData): Promise<ChatRoom> {
    const creator = await this.userRepository.findOne({ where: { id: creatorId } });
    if (!creator) {
      throw new Error('Creator not found');
    }

    // Validate room data
    this.validateRoomData(data);

    let roomData: Partial<ChatRoom>;

    switch (data.type) {
      case RoomType.GROUP:
        roomData = ChatRoom.createGroupChat(data.name, creator, data.description);
        break;
      case RoomType.PUBLIC:
        roomData = ChatRoom.createPublicRoom(data.name, creator, data.description);
        break;
      case RoomType.DIRECT:
        throw new Error('Direct messages should be created using createDirectMessage method');
      default:
        throw new Error('Invalid room type');
    }

    if (data.maxParticipants) {
      roomData.maxParticipants = data.maxParticipants;
    }

    const room = this.roomRepository.create(roomData);
    const savedRoom = await this.roomRepository.save(room);

    // Add creator as admin participant
    await this.addParticipant(savedRoom.id, creatorId, creatorId, ParticipantRole.ADMIN);

    // Create welcome system message
    await this.messageService.createSystemMessage(
      savedRoom.id,
      `Welcome to ${savedRoom.name}! 🎉`,
      creatorId
    );

    return await this.getRoomById(savedRoom.id) as ChatRoom;
  }

  async createDirectMessage(user1Id: string, user2Id: string): Promise<ChatRoom> {
    if (user1Id === user2Id) {
      throw new Error('Cannot create direct message with yourself');
    }

    const [user1, user2] = await Promise.all([
      this.userRepository.findOne({ where: { id: user1Id } }),
      this.userRepository.findOne({ where: { id: user2Id } }),
    ]);

    if (!user1 || !user2) {
      throw new Error('One or both users not found');
    }

    // Check if direct message already exists
    const existingRoom = await this.findDirectMessageRoom(user1Id, user2Id);
    if (existingRoom) {
      return existingRoom;
    }

    // Create new direct message room
    const roomData = ChatRoom.createDirectMessage(user1, user2);
    const room = this.roomRepository.create(roomData);
    const savedRoom = await this.roomRepository.save(room);

    // Add both users as participants
    await Promise.all([
      this.addParticipant(savedRoom.id, user1Id, user1Id, ParticipantRole.MEMBER),
      this.addParticipant(savedRoom.id, user2Id, user1Id, ParticipantRole.MEMBER),
    ]);

    return await this.getRoomById(savedRoom.id) as ChatRoom;
  }

  async getRoomById(roomId: string): Promise<ChatRoom | null> {
    return await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['createdBy', 'participants', 'participants.user'],
    });
  }

  async getUserRooms(userId: string, query: RoomListQuery = {}): Promise<ChatRoom[]> {
    const { type, active = true } = query;

    const queryBuilder = this.roomRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'participant')
      .leftJoinAndSelect('room.createdBy', 'createdBy')
      .leftJoinAndSelect('room.participants', 'allParticipants')
      .leftJoinAndSelect('allParticipants.user', 'participantUser')
      .where('participant.userId = :userId', { userId })
      .andWhere('participant.leftAt IS NULL');

    if (active) {
      queryBuilder.andWhere('room.isActive = :active', { active: true });
    }

    if (type) {
      queryBuilder.andWhere('room.type = :type', { type });
    }

    queryBuilder.orderBy('room.updatedAt', 'DESC');

    return await queryBuilder.getMany();
  }

  async updateRoom(
    roomId: string,
    userId: string,
    updateData: Partial<CreateRoomData>
  ): Promise<ChatRoom> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Check permissions
    if (!room.isAdmin(userId)) {
      throw new Error('Only admins can update room settings');
    }

    // Validate update data
    if (updateData.name) {
      if (updateData.name.length < 1 || updateData.name.length > 100) {
        throw new Error('Room name must be 1-100 characters');
      }
      room.name = updateData.name;
    }

    if (updateData.description !== undefined) {
      if (updateData.description && updateData.description.length > 500) {
        throw new Error('Description too long');
      }
      room.description = updateData.description || undefined;
    }

    if (updateData.maxParticipants) {
      if (updateData.maxParticipants < 2 || updateData.maxParticipants > 500) {
        throw new Error('Max participants must be between 2 and 500');
      }

      if (updateData.maxParticipants < room.participantCount) {
        throw new Error('Cannot set max participants below current participant count');
      }

      room.maxParticipants = updateData.maxParticipants;
    }

    return await this.roomRepository.save(room);
  }

  async addParticipant(
    roomId: string,
    userIdToAdd: string,
    addedBy: string,
    role: ParticipantRole = ParticipantRole.MEMBER
  ): Promise<ChatRoomParticipant> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const userToAdd = await this.userRepository.findOne({ where: { id: userIdToAdd } });
    if (!userToAdd) {
      throw new Error('User to add not found');
    }

    // Check permissions
    if (!room.isAdmin(addedBy) && addedBy !== userIdToAdd) {
      throw new Error('Only admins can add participants');
    }

    // Check if room is full
    if (!room.canAddParticipant()) {
      throw new Error('Room is full');
    }

    // Check if user is already a participant
    if (room.isParticipant(userIdToAdd)) {
      throw new Error('User is already a participant');
    }

    // For direct messages, only allow the 2 intended participants
    if (room.isDirectMessage() && room.participantCount >= 2) {
      throw new Error('Direct message rooms can only have 2 participants');
    }

    const participant = this.participantRepository.create(
      ChatRoomParticipant.createParticipant(userToAdd, room, role)
    );

    const savedParticipant = await this.participantRepository.save(participant);

    // Create system message for user joining (except for direct messages)
    if (!room.isDirectMessage()) {
      await this.messageService.createSystemMessage(
        roomId,
        `${userToAdd.displayName || userToAdd.username} joined the room`,
        addedBy
      );
    }

    return savedParticipant;
  }

  async removeParticipant(roomId: string, userIdToRemove: string, removedBy: string): Promise<void> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const participant = room.participants.find(p => p.userId === userIdToRemove && p.isActive());
    if (!participant) {
      throw new Error('User is not a participant in this room');
    }

    // Check permissions
    const canRemove =
      room.isAdmin(removedBy) || // Admin can remove anyone
      removedBy === userIdToRemove || // User can leave themselves
      room.createdById === removedBy; // Creator can remove anyone

    if (!canRemove) {
      throw new Error('Insufficient permissions to remove participant');
    }

    // Prevent removing the last admin (if not self-removal)
    if (participant.isAdmin() && removedBy !== userIdToRemove) {
      const adminCount = room.participants.filter(p => p.isAdmin() && p.isActive()).length;
      if (adminCount <= 1) {
        throw new Error('Cannot remove the last admin');
      }
    }

    participant.leave();
    await this.participantRepository.save(participant);

    // Create system message (except for direct messages)
    if (!room.isDirectMessage()) {
      const action = removedBy === userIdToRemove ? 'left' : 'was removed from';
      await this.messageService.createSystemMessage(
        roomId,
        `${participant.user.displayName || participant.user.username} ${action} the room`,
        removedBy
      );
    }

    // If room becomes empty, mark as inactive
    if (room.participantCount <= 0) {
      room.isActive = false;
      await this.roomRepository.save(room);
    }
  }

  async promoteParticipant(roomId: string, userIdToPromote: string, promotedBy: string): Promise<ChatRoomParticipant> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (!room.isAdmin(promotedBy)) {
      throw new Error('Only admins can promote participants');
    }

    const participant = room.participants.find(p => p.userId === userIdToPromote && p.isActive());
    if (!participant) {
      throw new Error('User is not a participant in this room');
    }

    if (participant.isAdmin()) {
      throw new Error('User is already an admin');
    }

    participant.promoteToAdmin();
    const savedParticipant = await this.participantRepository.save(participant);

    await this.messageService.createSystemMessage(
      roomId,
      `${participant.user.displayName || participant.user.username} was promoted to admin`,
      promotedBy
    );

    return savedParticipant;
  }

  async demoteParticipant(roomId: string, userIdToDemote: string, demotedBy: string): Promise<ChatRoomParticipant> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (!room.isAdmin(demotedBy)) {
      throw new Error('Only admins can demote participants');
    }

    const participant = room.participants.find(p => p.userId === userIdToDemote && p.isActive());
    if (!participant) {
      throw new Error('User is not a participant in this room');
    }

    if (!participant.isAdmin()) {
      throw new Error('User is not an admin');
    }

    // Prevent demoting the last admin
    const adminCount = room.participants.filter(p => p.isAdmin() && p.isActive()).length;
    if (adminCount <= 1) {
      throw new Error('Cannot demote the last admin');
    }

    participant.demoteToMember();
    const savedParticipant = await this.participantRepository.save(participant);

    await this.messageService.createSystemMessage(
      roomId,
      `${participant.user.displayName || participant.user.username} was demoted from admin`,
      demotedBy
    );

    return savedParticipant;
  }

  async getParticipants(roomId: string): Promise<ChatRoomParticipant[]> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    return room.activeParticipants;
  }

  async searchPublicRooms(searchTerm: string, limit: number = 10): Promise<ChatRoom[]> {
    if (!searchTerm.trim()) {
      return [];
    }

    return await this.roomRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.createdBy', 'createdBy')
      .where('room.type = :type', { type: RoomType.PUBLIC })
      .andWhere('room.isActive = true')
      .andWhere('(LOWER(room.name) LIKE LOWER(:search) OR LOWER(room.description) LIKE LOWER(:search))', {
        search: `%${searchTerm}%`,
      })
      .orderBy('room.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  private async findDirectMessageRoom(user1Id: string, user2Id: string): Promise<ChatRoom | null> {
    const room = await this.roomRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'p1', 'p1.userId = :user1Id AND p1.leftAt IS NULL')
      .innerJoin('room.participants', 'p2', 'p2.userId = :user2Id AND p2.leftAt IS NULL')
      .leftJoinAndSelect('room.participants', 'allParticipants')
      .leftJoinAndSelect('allParticipants.user', 'participantUser')
      .leftJoinAndSelect('room.createdBy', 'createdBy')
      .where('room.type = :type', { type: RoomType.DIRECT })
      .setParameters({ user1Id, user2Id })
      .getOne();

    return room;
  }

  private validateRoomData(data: CreateRoomData): void {
    if (!data.name || data.name.trim().length < 1 || data.name.length > 100) {
      throw new Error('Room name must be 1-100 characters');
    }

    if (data.description && data.description.length > 500) {
      throw new Error('Description cannot exceed 500 characters');
    }

    if (data.maxParticipants !== undefined) {
      if (data.maxParticipants < 2 || data.maxParticipants > 500) {
        throw new Error('Max participants must be between 2 and 500');
      }
    }

    if (!Object.values(RoomType).includes(data.type)) {
      throw new Error('Invalid room type');
    }
  }

  async deleteRoom(roomId: string, deletedBy: string): Promise<void> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Only creator or moderator can delete rooms
    const user = await this.userRepository.findOne({ where: { id: deletedBy } });
    if (!user?.isModerator() && room.createdById !== deletedBy) {
      throw new Error('Only the creator or moderators can delete rooms');
    }

    // Mark room as inactive instead of hard delete to preserve message history
    room.isActive = false;
    await this.roomRepository.save(room);

    // Remove all participants
    await this.participantRepository.update(
      { chatRoomId: roomId, leftAt: null as any },
      { leftAt: new Date() }
    );
  }
}