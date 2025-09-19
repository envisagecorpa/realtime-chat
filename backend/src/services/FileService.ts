import { AppDataSource } from '../config/database';
import { FileAttachment, AttachmentType } from '../models/FileAttachment';
import { User } from '../models/User';
import { ChatRoom } from '../models/ChatRoom';
import { Message } from '../models/Message';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import mime from 'mime-types';

export interface UploadFileData {
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  buffer: Buffer;
  chatRoomId?: string;
  messageId?: string;
}

export interface FileQuery {
  type?: AttachmentType;
  chatRoomId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface FileUploadResult {
  file: FileAttachment;
  uploadUrl?: string;
}

export class FileService {
  private fileRepository = AppDataSource.getRepository(FileAttachment);
  private userRepository = AppDataSource.getRepository(User);
  private chatRoomRepository = AppDataSource.getRepository(ChatRoom);
  private messageRepository = AppDataSource.getRepository(Message);

  private uploadDir = process.env.UPLOAD_DIR || './uploads';
  private maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB
  private allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip', 'application/x-zip-compressed',
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    'video/mp4', 'video/webm', 'video/ogg',
  ];

  constructor() {
    this.ensureUploadDirectory();
  }

  async uploadFile(
    uploaderId: string,
    data: UploadFileData,
    tusEndpoint?: string
  ): Promise<FileUploadResult> {
    const uploader = await this.userRepository.findOne({ where: { id: uploaderId } });
    if (!uploader) {
      throw new Error('Uploader not found');
    }

    // Validate file
    this.validateFile(data);

    // Validate chat room access if provided
    if (data.chatRoomId) {
      const chatRoom = await this.chatRoomRepository.findOne({
        where: { id: data.chatRoomId },
        relations: ['participants'],
      });

      if (!chatRoom) {
        throw new Error('Chat room not found');
      }

      if (!chatRoom.isParticipant(uploaderId)) {
        throw new Error('Access denied to this room');
      }
    }

    // Generate file hash for deduplication
    const fileHash = this.generateFileHash(data.buffer);

    // Check for existing file with same hash
    const existingFile = await this.fileRepository.findOne({
      where: { sha256Hash: fileHash },
    });

    if (existingFile && existingFile.isAccessibleBy(uploaderId, data.chatRoomId)) {
      // Return existing file if user has access
      return { file: existingFile };
    }

    // Generate unique filename
    const fileExtension = path.extname(data.originalName);
    const uniqueFilename = `${Date.now()}_${Math.random().toString(36).substring(2)}${fileExtension}`;
    const filePath = path.join(this.uploadDir, uniqueFilename);

    // Determine attachment type
    const attachmentType = this.determineAttachmentType(data.mimetype);

    // Create file record
    const file = this.fileRepository.create(
      FileAttachment.createAttachment(
        data.originalName,
        uniqueFilename,
        filePath,
        data.size,
        data.mimetype,
        attachmentType,
        uploader,
        fileHash,
        data.chatRoomId
      )
    );

    // For large files, use tus resumable upload
    if (data.size > 5 * 1024 * 1024 && tusEndpoint) { // 5MB threshold
      file.tusUploadId = this.generateTusUploadId();
      const savedFile = await this.fileRepository.save(file);

      return {
        file: savedFile,
        uploadUrl: `${tusEndpoint}/${file.tusUploadId}`,
      };
    }

    // For smaller files, save directly
    await fs.writeFile(filePath, data.buffer);
    file.markAsUploaded();

    const savedFile = await this.fileRepository.save(file);

    // Attach to message if provided
    if (data.messageId) {
      await this.attachToMessage(savedFile.id, data.messageId, uploaderId);
    }

    return { file: savedFile };
  }

  async completeResumableUpload(uploadId: string, finalPath: string): Promise<FileAttachment> {
    const file = await this.fileRepository.findOne({
      where: { tusUploadId: uploadId },
    });

    if (!file) {
      throw new Error('Upload session not found');
    }

    // Verify file was uploaded correctly
    const stats = await fs.stat(finalPath);
    if (stats.size !== file.fileSize) {
      throw new Error('File size mismatch');
    }

    // Update file record
    file.filePath = finalPath;
    file.markAsUploaded();

    return await this.fileRepository.save(file);
  }

  async getFileById(fileId: string, userId: string): Promise<FileAttachment | null> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['uploadedBy', 'chatRoom', 'message'],
    });

    if (!file) {
      return null;
    }

    // Check access permissions
    if (!file.isAccessibleBy(userId, file.chatRoomId)) {
      throw new Error('Access denied');
    }

    return file;
  }

  async downloadFile(fileId: string, userId: string): Promise<{
    buffer: Buffer;
    filename: string;
    mimetype: string;
  }> {
    const file = await this.getFileById(fileId, userId);

    if (!file) {
      throw new Error('File not found');
    }

    if (!file.isUploaded()) {
      throw new Error('File upload not completed');
    }

    try {
      const buffer = await fs.readFile(file.filePath);

      // Update download count
      file.incrementDownloads();
      await this.fileRepository.save(file);

      return {
        buffer,
        filename: file.originalName,
        mimetype: file.mimeType,
      };
    } catch (error) {
      throw new Error('File not accessible');
    }
  }

  async attachToMessage(fileId: string, messageId: string, userId: string): Promise<void> {
    const [file, message] = await Promise.all([
      this.getFileById(fileId, userId),
      this.messageRepository.findOne({
        where: { id: messageId },
        relations: ['sender', 'chatRoom'],
      }),
    ]);

    if (!file) {
      throw new Error('File not found');
    }

    if (!message) {
      throw new Error('Message not found');
    }

    // Verify user can attach to this message
    if (message.senderId !== userId) {
      throw new Error('Can only attach files to your own messages');
    }

    // Verify file and message are in same room (if applicable)
    if (file.chatRoomId && file.chatRoomId !== message.chatRoomId) {
      throw new Error('File and message must be in the same room');
    }

    file.messageId = messageId;
    await this.fileRepository.save(file);
  }

  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.getFileById(fileId, userId);

    if (!file) {
      throw new Error('File not found');
    }

    // Check if user can delete this file
    if (!file.canBeDeletedBy(userId)) {
      throw new Error('Insufficient permissions to delete file');
    }

    // Soft delete the file record
    file.softDelete();
    await this.fileRepository.save(file);

    // Schedule physical file deletion (in production, this might be a background job)
    setTimeout(async () => {
      try {
        await fs.unlink(file.filePath);
      } catch (error) {
        console.error('Failed to delete physical file:', error);
      }
    }, 1000 * 60 * 5); // Delete after 5 minutes
  }

  async getUserFiles(userId: string, query: FileQuery = {}): Promise<{
    data: FileAttachment[];
    total: number;
  }> {
    const { type, chatRoomId, limit = 20, offset = 0 } = query;

    const queryBuilder = this.fileRepository
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.uploadedBy', 'uploader')
      .leftJoinAndSelect('file.chatRoom', 'chatRoom')
      .where('file.uploadedById = :userId', { userId })
      .andWhere('file.deletedAt IS NULL')
      .orderBy('file.createdAt', 'DESC');

    if (type) {
      queryBuilder.andWhere('file.attachmentType = :type', { type });
    }

    if (chatRoomId) {
      queryBuilder.andWhere('file.chatRoomId = :chatRoomId', { chatRoomId });
    }

    const [files, total] = await queryBuilder
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { data: files, total };
  }

  async getRoomFiles(roomId: string, userId: string, query: FileQuery = {}): Promise<{
    data: FileAttachment[];
    total: number;
  }> {
    // Verify user has access to room
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      relations: ['participants'],
    });

    if (!chatRoom || !chatRoom.isParticipant(userId)) {
      throw new Error('Access denied to room files');
    }

    const { type, limit = 20, offset = 0 } = query;

    const queryBuilder = this.fileRepository
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.uploadedBy', 'uploader')
      .where('file.chatRoomId = :roomId', { roomId })
      .andWhere('file.deletedAt IS NULL')
      .orderBy('file.createdAt', 'DESC');

    if (type) {
      queryBuilder.andWhere('file.attachmentType = :type', { type });
    }

    const [files, total] = await queryBuilder
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { data: files, total };
  }

  async getFileStats(userId?: string): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: Record<AttachmentType, number>;
    storageUsed: number;
  }> {
    const queryBuilder = this.fileRepository
      .createQueryBuilder('file')
      .where('file.deletedAt IS NULL');

    if (userId) {
      queryBuilder.andWhere('file.uploadedById = :userId', { userId });
    }

    const files = await queryBuilder.getMany();

    const stats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.fileSize, 0),
      filesByType: {} as Record<AttachmentType, number>,
      storageUsed: files.reduce((sum, file) => sum + file.fileSize, 0),
    };

    // Initialize type counts
    Object.values(AttachmentType).forEach(type => {
      stats.filesByType[type] = 0;
    });

    // Count files by type
    files.forEach(file => {
      stats.filesByType[file.attachmentType]++;
    });

    return stats;
  }

  async cleanupExpiredFiles(): Promise<number> {
    const expiredFiles = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.deletedAt IS NOT NULL')
      .andWhere('file.deletedAt < :expiredDate', {
        expiredDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      })
      .getMany();

    let deletedCount = 0;

    for (const file of expiredFiles) {
      try {
        await fs.unlink(file.filePath);
        await this.fileRepository.remove(file);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to cleanup file ${file.id}:`, error);
      }
    }

    return deletedCount;
  }

  private validateFile(data: UploadFileData): void {
    // Check file size
    if (data.size > this.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`);
    }

    // Check mime type
    if (!this.allowedMimeTypes.includes(data.mimetype)) {
      throw new Error('File type not allowed');
    }

    // Check filename
    if (!data.originalName || data.originalName.length > 255) {
      throw new Error('Invalid filename');
    }

    // Security check - no path traversal
    if (data.originalName.includes('..') || data.originalName.includes('/') || data.originalName.includes('\\')) {
      throw new Error('Invalid filename');
    }
  }

  private generateFileHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private determineAttachmentType(mimetype: string): AttachmentType {
    if (mimetype.startsWith('image/')) {
      return AttachmentType.IMAGE;
    }
    if (mimetype.startsWith('video/')) {
      return AttachmentType.VIDEO;
    }
    if (mimetype.startsWith('audio/')) {
      return AttachmentType.AUDIO;
    }
    return AttachmentType.DOCUMENT;
  }

  private generateTusUploadId(): string {
    return `tus_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }
}