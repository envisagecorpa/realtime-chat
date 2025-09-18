# Real-time Chat Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-17

## Active Technologies
- **Language**: Node.js 18+ with TypeScript
- **Backend**: Express.js, Socket.IO, TypeORM, Redis client
- **Frontend**: React 18, Socket.IO client, TanStack Query
- **Database**: PostgreSQL for message history, Redis for presence/sessions
- **Testing**: Jest + Supertest (backend), Jest + React Testing Library (frontend)
- **Target Platform**: Modern web browsers (Chrome 90+, Firefox 88+, Safari 14+)

## Project Structure
```
backend/
├── src/
│   ├── models/        # TypeORM entities (User, Message, ChatRoom)
│   ├── services/      # Business logic (MessageService, PresenceService)
│   ├── api/          # REST API controllers
│   ├── socket/       # WebSocket event handlers
│   └── middleware/   # Auth, validation, error handling
└── tests/
    ├── contract/     # API contract tests
    ├── integration/  # End-to-end tests
    └── unit/        # Service unit tests

frontend/
├── src/
│   ├── components/   # React components (ChatRoom, MessageList)
│   ├── pages/       # Page components (Login, Dashboard)
│   ├── services/    # API clients, WebSocket setup
│   ├── hooks/       # Custom React hooks
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
npm run migrate      # Run database migrations
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
docker run -d --name postgres -e POSTGRES_DB=chatdb -p 5432:5432 postgres:15
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

## Code Style
**TypeScript/Node.js**:
- Use TypeScript strict mode
- Prefer async/await over Promises
- Use TypeORM decorators for entities
- Implement proper error handling with custom error classes
- Use dependency injection pattern for services

**React/Frontend**:
- Use functional components with hooks
- Implement proper TypeScript interfaces for props
- Use TanStack Query for server state management
- Follow React best practices for component composition
- Use Socket.IO client for real-time features

**Database**:
- Use TypeORM migrations for schema changes
- Implement proper indexing strategy
- Use Redis for ephemeral data (presence, sessions)
- Follow PostgreSQL naming conventions

## Recent Changes
### 001-real-time-chat (2025-09-17)
Added real-time chat system with WebSocket messaging, user presence tracking, and message history. Includes complete backend API, React frontend, and database schema design.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->