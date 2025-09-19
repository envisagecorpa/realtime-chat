import { Router, Request, Response } from 'express';
import multer from 'multer';
import { FileService } from '../services/FileService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { fileUploadRateLimit } from '../middleware/rateLimiter';
import {
  createValidationChain,
  validateFileUpload,
  validateUuidParam,
  validatePagination,
} from '../middleware/validation';
import { catchAsync } from '../middleware/errorHandler';
import { ResponseHelper, FileHelper } from '../utils/helpers';
import { appLogger } from '../utils/logger';

const router = Router();
const fileService = new FileService();

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  },
  fileFilter: (req, file, cb) => {
    // Basic file type validation
    const allowedMimeTypes = [
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

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

// POST /api/files/upload
router.post(
  '/upload',
  authenticate,
  fileUploadRateLimit,
  upload.single('file'),
  ...createValidationChain(...validateFileUpload()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return ResponseHelper.error(res, 'No file provided', 400);
    }

    const { chatRoomId, messageId } = req.body;
    const tusEndpoint = process.env.TUS_ENDPOINT;

    const uploadData = {
      filename: req.file.filename || req.file.originalname,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      buffer: req.file.buffer,
      chatRoomId,
      messageId,
    };

    const result = await fileService.uploadFile(req.userId, uploadData, tusEndpoint);

    appLogger.logFileOperation(
      'upload',
      result.file.id,
      req.userId,
      result.file.originalName,
      result.file.fileSize
    );

    ResponseHelper.success(res, {
      id: result.file.id,
      originalName: result.file.originalName,
      filename: result.file.filename,
      fileSize: result.file.fileSize,
      mimeType: result.file.mimeType,
      attachmentType: result.file.attachmentType,
      chatRoomId: result.file.chatRoomId,
      messageId: result.file.messageId,
      uploadUrl: result.uploadUrl, // For resumable uploads
      createdAt: result.file.createdAt,
    }, 'File uploaded successfully', 201);
  })
);

// GET /api/files/:fileId
router.get(
  '/:fileId',
  authenticate,
  ...createValidationChain(validateUuidParam('fileId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { fileId } = req.params;

    const file = await fileService.getFileById(fileId, req.userId);

    if (!file) {
      return ResponseHelper.error(res, 'File not found', 404);
    }

    ResponseHelper.success(res, {
      id: file.id,
      originalName: file.originalName,
      filename: file.filename,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      attachmentType: file.attachmentType,
      chatRoomId: file.chatRoomId,
      messageId: file.messageId,
      downloadCount: file.downloadCount,
      createdAt: file.createdAt,
      uploadedBy: {
        id: file.uploadedBy.id,
        username: file.uploadedBy.username,
        displayName: file.uploadedBy.displayName,
      },
      isImage: FileHelper.isImageFile(file.originalName),
      isVideo: FileHelper.isVideoFile(file.originalName),
      isAudio: FileHelper.isAudioFile(file.originalName),
      formattedSize: FileHelper.formatFileSize(file.fileSize),
    }, 'File details retrieved');
  })
);

// GET /api/files/:fileId/download
router.get(
  '/:fileId/download',
  authenticate,
  ...createValidationChain(validateUuidParam('fileId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { fileId } = req.params;

    const downloadData = await fileService.downloadFile(fileId, req.userId);

    appLogger.logFileOperation('download', fileId, req.userId, downloadData.filename);

    // Set appropriate headers for file download
    res.set({
      'Content-Type': downloadData.mimetype,
      'Content-Disposition': `attachment; filename="${downloadData.filename}"`,
      'Content-Length': downloadData.buffer.length.toString(),
    });

    res.send(downloadData.buffer);
  })
);

// DELETE /api/files/:fileId
router.delete(
  '/:fileId',
  authenticate,
  ...createValidationChain(validateUuidParam('fileId')),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { fileId } = req.params;

    await fileService.deleteFile(fileId, req.userId);

    appLogger.logFileOperation('delete', fileId, req.userId);

    ResponseHelper.success(res, null, 'File deleted successfully');
  })
);

// GET /api/files
router.get(
  '/',
  authenticate,
  ...createValidationChain(...validatePagination()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { type, chatRoomId, limit = 20, offset = 0 } = req.query;

    const result = await fileService.getUserFiles(req.userId, {
      type: type as any,
      chatRoomId: chatRoomId as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    const filesWithEnhancedData = result.data.map(file => ({
      id: file.id,
      originalName: file.originalName,
      filename: file.filename,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      attachmentType: file.attachmentType,
      chatRoomId: file.chatRoomId,
      messageId: file.messageId,
      downloadCount: file.downloadCount,
      createdAt: file.createdAt,
      uploadedBy: {
        id: file.uploadedBy.id,
        username: file.uploadedBy.username,
        displayName: file.uploadedBy.displayName,
      },
      isImage: FileHelper.isImageFile(file.originalName),
      isVideo: FileHelper.isVideoFile(file.originalName),
      isAudio: FileHelper.isAudioFile(file.originalName),
      formattedSize: FileHelper.formatFileSize(file.fileSize),
    }));

    ResponseHelper.paginated(
      res,
      filesWithEnhancedData,
      Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
      parseInt(limit as string),
      result.total,
      'User files retrieved'
    );
  })
);

// GET /api/files/rooms/:roomId
router.get(
  '/rooms/:roomId',
  authenticate,
  ...createValidationChain(validateUuidParam('roomId'), ...validatePagination()),
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;
    const { type, limit = 20, offset = 0 } = req.query;

    const result = await fileService.getRoomFiles(roomId, req.userId, {
      type: type as any,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    const filesWithEnhancedData = result.data.map(file => ({
      id: file.id,
      originalName: file.originalName,
      filename: file.filename,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      attachmentType: file.attachmentType,
      downloadCount: file.downloadCount,
      createdAt: file.createdAt,
      uploadedBy: {
        id: file.uploadedBy.id,
        username: file.uploadedBy.username,
        displayName: file.uploadedBy.displayName,
      },
      isImage: FileHelper.isImageFile(file.originalName),
      isVideo: FileHelper.isVideoFile(file.originalName),
      isAudio: FileHelper.isAudioFile(file.originalName),
      formattedSize: FileHelper.formatFileSize(file.fileSize),
    }));

    ResponseHelper.paginated(
      res,
      filesWithEnhancedData,
      Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
      parseInt(limit as string),
      result.total,
      'Room files retrieved'
    );
  })
);

// GET /api/files/stats
router.get(
  '/stats',
  authenticate,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await fileService.getFileStats(req.userId);

    ResponseHelper.success(res, {
      ...stats,
      formattedTotalSize: FileHelper.formatFileSize(stats.totalSize),
      formattedStorageUsed: FileHelper.formatFileSize(stats.storageUsed),
    }, 'File statistics retrieved');
  })
);

// POST /api/files/tus-complete
router.post(
  '/tus-complete',
  authenticate,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { uploadId, finalPath } = req.body;

    if (!uploadId || !finalPath) {
      return ResponseHelper.error(res, 'Upload ID and final path are required', 400);
    }

    const file = await fileService.completeResumableUpload(uploadId, finalPath);

    appLogger.logFileOperation(
      'tus_complete',
      file.id,
      req.userId,
      file.originalName,
      file.fileSize
    );

    ResponseHelper.success(res, {
      id: file.id,
      originalName: file.originalName,
      filename: file.filename,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      attachmentType: file.attachmentType,
    }, 'Resumable upload completed');
  })
);

export default router;