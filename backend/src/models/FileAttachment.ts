import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Length, Min, Max } from 'class-validator';
import { Message } from './Message';
import { User } from './User';

export enum UploadStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum StorageProvider {
  LOCAL = 'local',
  S3 = 's3',
  CLOUDINARY = 'cloudinary',
}

@Entity('file_attachments')
export class FileAttachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_id', nullable: true })
  messageId?: string;

  @Column({ name: 'original_name', length: 255 })
  @Length(1, 255)
  originalName!: string;

  @Column({ name: 'sanitized_name', length: 255 })
  @Length(1, 255)
  sanitizedName!: string;

  @Column({ name: 'mime_type', length: 100 })
  mimeType!: string;

  @Column({ name: 'file_size', type: 'bigint' })
  @Min(1)
  @Max(10485760) // 10MB limit
  fileSize!: number;

  @Column({ name: 'sha256_hash', length: 64, unique: true })
  sha256Hash!: string;

  @Column({
    name: 'storage_provider',
    type: 'enum',
    enum: StorageProvider,
    default: StorageProvider.LOCAL,
  })
  storageProvider!: StorageProvider;

  @Column({ name: 'storage_path', type: 'text' })
  storagePath!: string;

  @Column({ name: 'public_url', type: 'text', nullable: true })
  publicUrl?: string;

  @Column({
    name: 'upload_status',
    type: 'enum',
    enum: UploadStatus,
    default: UploadStatus.PENDING,
  })
  uploadStatus!: UploadStatus;

  @Column({ name: 'uploaded_by_id' })
  uploadedById!: string;

  @Column({ name: 'access_count', default: 0 })
  accessCount!: number;

  @Column({ name: 'last_accessed_at', type: 'timestamptz', nullable: true })
  lastAccessedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  // Relationships
  @ManyToOne(() => Message, (message) => message.attachments, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'message_id' })
  message?: Message;

  @ManyToOne(() => User, (user) => user.uploadedFiles, { eager: true })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy!: User;

  // Business methods
  isPending(): boolean {
    return this.uploadStatus === UploadStatus.PENDING;
  }

  isProcessing(): boolean {
    return this.uploadStatus === UploadStatus.PROCESSING;
  }

  isCompleted(): boolean {
    return this.uploadStatus === UploadStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.uploadStatus === UploadStatus.FAILED;
  }

  isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  isImage(): boolean {
    return this.mimeType.startsWith('image/');
  }

  isVideo(): boolean {
    return this.mimeType.startsWith('video/');
  }

  isAudio(): boolean {
    return this.mimeType.startsWith('audio/');
  }

  isDocument(): boolean {
    const documentTypes = [
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    return documentTypes.includes(this.mimeType);
  }

  getFileExtension(): string {
    const parts = this.originalName.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
  }

  getHumanReadableSize(): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = this.fileSize;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  markAsProcessing(): void {
    this.uploadStatus = UploadStatus.PROCESSING;
  }

  markAsCompleted(publicUrl?: string): void {
    this.uploadStatus = UploadStatus.COMPLETED;
    if (publicUrl) {
      this.publicUrl = publicUrl;
    }
  }

  markAsFailed(): void {
    this.uploadStatus = UploadStatus.FAILED;
  }

  incrementAccessCount(): void {
    this.accessCount++;
    this.lastAccessedAt = new Date();
  }

  setExpiryDate(days: number = 30): void {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    this.expiresAt = expiryDate;
  }

  canBeAccessedBy(userId: string): boolean {
    // File can be accessed by:
    // 1. The uploader
    // 2. Participants in the room where the file was shared
    if (this.uploadedById === userId) {
      return true;
    }

    // If attached to a message, check room participation
    if (this.message?.chatRoom) {
      return this.message.chatRoom.isParticipant(userId);
    }

    return false;
  }

  static createFromUpload(
    originalName: string,
    mimeType: string,
    fileSize: number,
    sha256Hash: string,
    uploadedBy: User,
    storagePath: string,
    storageProvider: StorageProvider = StorageProvider.LOCAL
  ): Partial<FileAttachment> {
    const sanitizedName = this.sanitizeFileName(originalName);

    return {
      originalName,
      sanitizedName,
      mimeType,
      fileSize,
      sha256Hash,
      uploadedBy,
      storagePath,
      storageProvider,
      uploadStatus: UploadStatus.PENDING,
      accessCount: 0,
    };
  }

  static sanitizeFileName(filename: string): string {
    // Replace special characters with underscores
    const sanitized = filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100);

    // Ensure it doesn't start with a dot
    return sanitized.startsWith('.') ? `file${sanitized}` : sanitized;
  }

  static isAllowedMimeType(mimeType: string): boolean {
    const allowedTypes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      // Documents
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Media
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/wav',
    ];

    return allowedTypes.includes(mimeType);
  }

  static isValidFileSize(fileSize: number): boolean {
    return fileSize > 0 && fileSize <= 10485760; // 10MB
  }

  static generateStoragePath(userId: string, filename: string): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const randomId = Math.random().toString(36).substring(2);
    return `uploads/${userId}/${timestamp}/${randomId}_${filename}`;
  }
}