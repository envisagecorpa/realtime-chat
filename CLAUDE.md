# Real-time Chat Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-18

## Active Technologies
- **Language**: Node.js 18+ with TypeScript
- **Backend**: Express.js, Socket.IO, TypeORM, Redis client, tus.io (file uploads)
- **Frontend**: React 18, Socket.IO client, TanStack Query, tus-js-client
- **Database**: PostgreSQL for message history, Redis for presence/sessions
- **Storage**: PostgreSQL BYTEA for files ≤10MB, automated archiving to Parquet format
- **Testing**: Jest + Supertest (backend), Jest + React Testing Library (frontend)
- **Target Platform**: Modern web browsers (Chrome 90+, Firefox 88+, Safari 14+)
- **Performance**: <100ms message delivery, 1000+ concurrent users, 30-day retention

## Project Structure
```
backend/
├── src/
│   ├── models/        # TypeORM entities (User, Message, ChatRoom, FileAttachment)
│   ├── services/      # Business logic (MessageService, PresenceService, FileService)
│   ├── api/          # REST API controllers
│   ├── socket/       # WebSocket event handlers
│   ├── middleware/   # Auth, validation, error handling
│   └── jobs/        # Background jobs for archiving
└── tests/
    ├── contract/     # API contract tests
    ├── integration/  # End-to-end tests
    └── unit/        # Service unit tests

frontend/
├── src/
│   ├── components/   # React components (ChatRoom, MessageList, FileUpload)
│   ├── pages/       # Page components (Login, Dashboard)
│   ├── services/    # API clients, WebSocket setup
│   ├── hooks/       # Custom React hooks for chat features
│   └── types/       # TypeScript type definitions
└── tests/
    └── components/  # Component tests
```

## Commands
```bash
# Backend development
cd backend
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run test         # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run test:contract # Run contract tests specifically
npm run migrate      # Run database migrations
npm run seed:dev     # Seed development data
npm run lint         # ESLint checking
npm run typecheck    # TypeScript type checking

# Frontend development
cd frontend
npm run dev          # Start Vite development server
npm run build        # Build for production
npm run test         # Run component tests
npm run lint         # ESLint checking
npm run typecheck    # TypeScript type checking

# Database management
docker run -d --name postgres -e POSTGRES_DB=chatdb -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:15
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Full stack development
npm run dev:all      # Start backend, frontend, and databases concurrently
```

## Code Style
**TypeScript/Node.js**:
- Use TypeScript strict mode with explicit return types
- Prefer async/await over Promises
- Use TypeORM decorators for entities with proper relationships
- Implement comprehensive error handling with custom error classes
- Use dependency injection pattern for services
- Follow SOLID principles for service architecture

**React/Frontend**:
- Use functional components with hooks exclusively
- Implement proper TypeScript interfaces for all props and state
- Use TanStack Query for server state management
- Follow React best practices for component composition
- Use Socket.IO client hooks for real-time features
- Implement optimistic updates for better UX

**WebSocket/Real-time**:
- Use Socket.IO with Redis adapter for scaling
- Implement proper room-based message routing
- Handle reconnection gracefully with state recovery
- Use typing indicators with 10-second TTL
- Implement presence tracking with heartbeat mechanism

**Database**:
- Use TypeORM migrations for all schema changes
- Implement proper indexing strategy for chat queries
- Use PostgreSQL partitioning for message tables
- Follow PostgreSQL naming conventions
- Implement automated archiving for 30-day retention
- Use Redis for ephemeral data (presence, sessions, typing)

**File Upload**:
- Use tus.io protocol for resumable uploads
- Implement multi-layer security validation
- Store files up to 10MB in PostgreSQL BYTEA
- Use SHA-256 for file deduplication
- Implement rate limiting (20 uploads/hour per user)

## Data Model Key Entities
- **User**: Authentication, profile, role (member/moderator)
- **Message**: Content, delivery tracking, threading support
- **ChatRoom**: Direct/group/public rooms with participant management
- **MessageReadStatus**: Read receipts and delivery confirmation
- **FileAttachment**: File metadata, upload status, security validation
- **UserSession**: Connection tracking, presence management

## API Patterns
**REST Endpoints**:
- `/api/auth/*` - Authentication (username-only login)
- `/api/users/*` - User management and profiles
- `/api/rooms/*` - Chat room CRUD operations
- `/api/messages/*` - Message history and editing
- `/api/files/*` - File upload and download
- `/api/admin/*` - Moderation features (moderator only)

**WebSocket Events**:
- `message_send/received` - Real-time messaging
- `typing_start/stop` - Typing indicators
- `room_join/leave` - Room membership
- `user_online/offline` - Presence tracking
- `file_upload_*` - File sharing events

## Security Implementation
- JWT-based authentication with username-only login
- Role-based authorization (member/moderator)
- Rate limiting on all endpoints and WebSocket events
- File upload security with MIME type validation
- SQL injection prevention with TypeORM
- XSS protection with input sanitization
- CORS configuration for frontend access

## Recent Changes
### 002-real-time-chat (2025-09-18)
Added comprehensive real-time chat system with WebSocket messaging, user presence tracking, file upload capabilities (10MB limit), message history with 30-day retention, automated archiving, and moderation features. Includes complete REST API, WebSocket events, and React frontend components.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.