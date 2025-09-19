import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';

export class ValidationMiddleware {
  // Check validation results and return errors if any
  static handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array().map(error => ({
          field: error.type === 'field' ? error.path : 'unknown',
          message: error.msg,
          value: error.type === 'field' ? error.value : undefined,
        })),
      });
      return;
    }

    next();
  };

  // User validation rules
  static validateLogin(): ValidationChain[] {
    return [
      body('username')
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be 3-50 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
      body('displayName')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Display name cannot exceed 100 characters'),
      body('deviceInfo')
        .optional()
        .isObject()
        .withMessage('Device info must be an object'),
    ];
  }

  static validateUserUpdate(): ValidationChain[] {
    return [
      body('displayName')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Display name cannot exceed 100 characters'),
      body('email')
        .optional()
        .isEmail()
        .withMessage('Must be a valid email address'),
    ];
  }

  // Message validation rules
  static validateSendMessage(): ValidationChain[] {
    return [
      body('content')
        .isLength({ min: 1, max: 2000 })
        .withMessage('Message content must be 1-2000 characters'),
      body('messageType')
        .optional()
        .isIn(['text', 'system', 'file_attachment'])
        .withMessage('Invalid message type'),
      body('parentMessageId')
        .optional()
        .isUUID()
        .withMessage('Parent message ID must be a valid UUID'),
    ];
  }

  static validateEditMessage(): ValidationChain[] {
    return [
      param('messageId')
        .isUUID()
        .withMessage('Message ID must be a valid UUID'),
      body('content')
        .isLength({ min: 1, max: 2000 })
        .withMessage('Message content must be 1-2000 characters'),
    ];
  }

  static validateMessageQuery(): ValidationChain[] {
    return [
      query('before')
        .optional()
        .isISO8601()
        .withMessage('Before must be a valid ISO date'),
      query('after')
        .optional()
        .isISO8601()
        .withMessage('After must be a valid ISO date'),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    ];
  }

  // Chat room validation rules
  static validateCreateRoom(): ValidationChain[] {
    return [
      body('name')
        .isLength({ min: 1, max: 100 })
        .withMessage('Room name must be 1-100 characters'),
      body('type')
        .isIn(['direct', 'group', 'public'])
        .withMessage('Room type must be direct, group, or public'),
      body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters'),
      body('maxParticipants')
        .optional()
        .isInt({ min: 2, max: 500 })
        .withMessage('Max participants must be between 2 and 500'),
    ];
  }

  static validateUpdateRoom(): ValidationChain[] {
    return [
      param('roomId')
        .isUUID()
        .withMessage('Room ID must be a valid UUID'),
      body('name')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Room name must be 1-100 characters'),
      body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters'),
      body('maxParticipants')
        .optional()
        .isInt({ min: 2, max: 500 })
        .withMessage('Max participants must be between 2 and 500'),
    ];
  }

  static validateAddParticipant(): ValidationChain[] {
    return [
      param('roomId')
        .isUUID()
        .withMessage('Room ID must be a valid UUID'),
      body('userId')
        .isUUID()
        .withMessage('User ID must be a valid UUID'),
      body('role')
        .optional()
        .isIn(['member', 'admin'])
        .withMessage('Role must be member or admin'),
    ];
  }

  static validateDirectMessage(): ValidationChain[] {
    return [
      body('otherUserId')
        .isUUID()
        .withMessage('Other user ID must be a valid UUID'),
    ];
  }

  // File validation rules
  static validateFileUpload(): ValidationChain[] {
    return [
      body('chatRoomId')
        .optional()
        .isUUID()
        .withMessage('Chat room ID must be a valid UUID'),
      body('messageId')
        .optional()
        .isUUID()
        .withMessage('Message ID must be a valid UUID'),
    ];
  }

  // Moderation validation rules
  static validateModerationAction(): ValidationChain[] {
    return [
      body('type')
        .isIn(['warn', 'mute', 'kick', 'ban', 'message_delete', 'message_flag', 'room_lock', 'room_unlock'])
        .withMessage('Invalid moderation action type'),
      body('targetUserId')
        .isUUID()
        .withMessage('Target user ID must be a valid UUID'),
      body('reason')
        .isLength({ min: 1, max: 500 })
        .withMessage('Reason must be 1-500 characters'),
      body('duration')
        .optional()
        .isInt({ min: 1, max: 525600 }) // Max 1 year in minutes
        .withMessage('Duration must be between 1 minute and 1 year'),
      body('roomId')
        .optional()
        .isUUID()
        .withMessage('Room ID must be a valid UUID'),
      body('messageId')
        .optional()
        .isUUID()
        .withMessage('Message ID must be a valid UUID'),
    ];
  }

  static validateFlagMessage(): ValidationChain[] {
    return [
      param('messageId')
        .isUUID()
        .withMessage('Message ID must be a valid UUID'),
      body('reason')
        .isLength({ min: 1, max: 200 })
        .withMessage('Reason must be 1-200 characters'),
    ];
  }

  // Common parameter validation
  static validateUuidParam(paramName: string): ValidationChain {
    return param(paramName)
      .isUUID()
      .withMessage(`${paramName} must be a valid UUID`);
  }

  static validatePagination(): ValidationChain[] {
    return [
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    ];
  }

  static validateSearch(): ValidationChain[] {
    return [
      query('search')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search term must be 1-100 characters'),
    ];
  }

  // WebSocket event validation
  static validateSocketEvent(eventData: any, rules: Record<string, any>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = eventData[field];

      if (rule.required && (value === undefined || value === null)) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rule.type && typeof value !== rule.type) {
          errors.push(`${field} must be of type ${rule.type}`);
        }

        if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
          errors.push(`${field} must be at least ${rule.minLength} characters`);
        }

        if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
          errors.push(`${field} cannot exceed ${rule.maxLength} characters`);
        }

        if (rule.min && typeof value === 'number' && value < rule.min) {
          errors.push(`${field} must be at least ${rule.min}`);
        }

        if (rule.max && typeof value === 'number' && value > rule.max) {
          errors.push(`${field} cannot exceed ${rule.max}`);
        }

        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
        }

        if (rule.uuid && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
          errors.push(`${field} must be a valid UUID`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Socket event validation rules
  static socketEventRules = {
    'send_message': {
      chatRoomId: { required: true, type: 'string', uuid: true },
      content: { required: true, type: 'string', minLength: 1, maxLength: 2000 },
      messageType: { type: 'string', enum: ['text', 'system', 'file_attachment'] },
      parentMessageId: { type: 'string', uuid: true },
    },
    'join_room': {
      chatRoomId: { required: true, type: 'string', uuid: true },
    },
    'leave_room': {
      chatRoomId: { required: true, type: 'string', uuid: true },
    },
    'typing_start': {
      chatRoomId: { required: true, type: 'string', uuid: true },
    },
    'typing_stop': {
      chatRoomId: { required: true, type: 'string', uuid: true },
    },
    'mark_read': {
      messageId: { required: true, type: 'string', uuid: true },
    },
  };
}

// Helper function to create validation middleware chain
export function createValidationChain(...validations: ValidationChain[]): (ValidationChain | typeof ValidationMiddleware.handleValidationErrors)[] {
  return [...validations, ValidationMiddleware.handleValidationErrors];
}

// Export commonly used validations
export const {
  validateLogin,
  validateUserUpdate,
  validateSendMessage,
  validateEditMessage,
  validateMessageQuery,
  validateCreateRoom,
  validateUpdateRoom,
  validateAddParticipant,
  validateDirectMessage,
  validateFileUpload,
  validateModerationAction,
  validateFlagMessage,
  validateUuidParam,
  validatePagination,
  validateSearch,
  validateSocketEvent,
  socketEventRules,
  handleValidationErrors,
} = ValidationMiddleware;