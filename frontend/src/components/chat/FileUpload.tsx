import React, { useRef, useState } from 'react';
import { Upload, X, File, Image, Video, Music, FileText } from 'lucide-react';
import { apiClient } from '../../services/api';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import type { FileAttachment } from '../../types';

interface FileUploadProps {
  onFilesUploaded: (attachments: FileAttachment[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
  allowedTypes?: string[];
  disabled?: boolean;
  children?: React.ReactNode;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_TYPES = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'text/*',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
];

export function FileUpload({
  onFilesUploaded,
  maxFiles = 5,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  disabled = false,
  children,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<
    Array<{ file: File; progress: number; error?: string }>
  >([]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    const type = file.type.toLowerCase();
    if (type.startsWith('image/')) return Image;
    if (type.startsWith('video/')) return Video;
    if (type.startsWith('audio/')) return Music;
    if (type.includes('pdf') || type.startsWith('text/')) return FileText;
    return File;
  };

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${formatFileSize(maxSizeBytes)}`;
    }

    const isAllowed = allowedTypes.some(type => {
      if (type === '*') return true;
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      if (type.startsWith('.')) {
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      }
      return file.type === type;
    });

    if (!isAllowed) {
      return 'File type not allowed';
    }

    return null;
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const validFiles = files.slice(0, maxFiles);
    const uploadQueue = validFiles.map(file => ({
      file,
      progress: 0,
      error: validateFile(file),
    }));

    setUploadingFiles(uploadQueue);

    const uploadedAttachments: FileAttachment[] = [];

    for (let i = 0; i < uploadQueue.length; i++) {
      const { file, error } = uploadQueue[i];

      if (error) {
        continue;
      }

      try {
        setUploadingFiles(prev =>
          prev.map((item, index) =>
            index === i ? { ...item, progress: 0 } : item
          )
        );

        const attachment = await apiClient.uploadFile(file, (progress) => {
          setUploadingFiles(prev =>
            prev.map((item, index) =>
              index === i ? { ...item, progress } : item
            )
          );
        });

        uploadedAttachments.push(attachment);

        setUploadingFiles(prev =>
          prev.map((item, index) =>
            index === i ? { ...item, progress: 100 } : item
          )
        );
      } catch (error: any) {
        setUploadingFiles(prev =>
          prev.map((item, index) =>
            index === i ? { ...item, error: error.message || 'Upload failed' } : item
          )
        );
      }
    }

    setTimeout(() => {
      setUploadingFiles([]);
      if (uploadedAttachments.length > 0) {
        onFilesUploaded(uploadedAttachments);
      }
    }, 1000);
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || disabled) return;
    uploadFiles(Array.from(files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const triggerFileSelect = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const removeUploadingFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={allowedTypes.join(',')}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />

      {children ? (
        <div onClick={triggerFileSelect} className="cursor-pointer">
          {children}
        </div>
      ) : (
        <div
          onClick={triggerFileSelect}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">
            Up to {maxFiles} files, max {formatFileSize(maxSizeBytes)} each
          </p>
        </div>
      )}

      {/* Upload progress */}
      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadingFiles.map((upload, index) => {
            const FileIcon = getFileIcon(upload.file);
            return (
              <div
                key={index}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                <FileIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {upload.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(upload.file.size)}
                  </p>
                  {upload.error ? (
                    <p className="text-xs text-red-600">{upload.error}</p>
                  ) : (
                    <div className="mt-1">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${upload.progress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {upload.progress === 100 ? 'Complete' : `${upload.progress}%`}
                      </p>
                    </div>
                  )}
                </div>
                {upload.progress < 100 && !upload.error ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <button
                    onClick={() => removeUploadingFile(index)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FileAttachmentDisplayProps {
  attachment: FileAttachment;
  onRemove?: () => void;
  showRemove?: boolean;
}

export function FileAttachmentDisplay({
  attachment,
  onRemove,
  showRemove = false,
}: FileAttachmentDisplayProps) {
  const getFileIcon = () => {
    const type = attachment.mimeType.toLowerCase();
    if (type.startsWith('image/')) return Image;
    if (type.startsWith('video/')) return Video;
    if (type.startsWith('audio/')) return Music;
    if (type.includes('pdf') || type.startsWith('text/')) return FileText;
    return File;
  };

  const handleDownload = () => {
    window.open(attachment.fileUrl, '_blank');
  };

  const FileIcon = getFileIcon();

  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border">
      <FileIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {attachment.originalName}
        </p>
        <p className="text-xs text-gray-500">
          {attachment.formattedSize || `${Math.round(attachment.fileSize / 1024)}KB`}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={handleDownload}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Download
        </button>
        {showRemove && onRemove && (
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}