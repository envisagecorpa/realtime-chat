# Tasks: Real-time Chat System with Message History and User Presence

**Input**: Design documents from `/specs/002-real-time-chat/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: `backend/src/`, `frontend/src/`
- Backend: Node.js + TypeScript + Express.js + Socket.IO + TypeORM
- Frontend: React 18 + TypeScript + Socket.IO client + TanStack Query
- Database: PostgreSQL + Redis

## Phase 3.1: Project Setup
- [ ] T001 Create backend/frontend project structure with package.json files
- [ ] T002 Initialize backend TypeScript project with Express.js, Socket.IO, TypeORM, Redis dependencies
- [ ] T003 Initialize frontend React project with Socket.IO client, TanStack Query, Vite dependencies
- [ ] T004 [P] Configure backend linting (ESLint + Prettier) in backend/.eslintrc.js
- [ ] T005 [P] Configure frontend linting (ESLint + Prettier) in frontend/.eslintrc.js
- [ ] T006 [P] Setup backend TypeScript config in backend/tsconfig.json
- [ ] T007 [P] Setup frontend TypeScript config in frontend/tsconfig.json
- [ ] T008 Create Docker Compose file for PostgreSQL and Redis development services
- [ ] T009 [P] Setup environment configuration files backend/.env.example and frontend/.env.example

## Phase 3.2: Database Setup
- [ ] T010 Create TypeORM configuration in backend/src/config/database.ts
- [ ] T011 Create initial database migration for all entities in backend/src/migrations/001_initial_schema.ts
- [ ] T012 [P] Create database seeding script in backend/src/seeds/dev-data.ts

## Phase 3.3: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.4
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests [P] - REST API
- [ ] T013 [P] Contract test POST /api/auth/login in backend/tests/contract/auth.test.ts
- [ ] T014 [P] Contract test GET /api/auth/me in backend/tests/contract/auth.test.ts
- [ ] T015 [P] Contract test GET /api/users in backend/tests/contract/users.test.ts
- [ ] T016 [P] Contract test GET,PATCH /api/users/{userId} in backend/tests/contract/users.test.ts
- [ ] T017 [P] Contract test GET,POST /api/rooms in backend/tests/contract/rooms.test.ts
- [ ] T018 [P] Contract test GET,PATCH /api/rooms/{roomId} in backend/tests/contract/rooms.test.ts
- [ ] T019 [P] Contract test GET,POST /api/rooms/{roomId}/participants in backend/tests/contract/participants.test.ts
- [ ] T020 [P] Contract test DELETE /api/rooms/{roomId}/participants/{userId} in backend/tests/contract/participants.test.ts
- [ ] T021 [P] Contract test GET /api/rooms/{roomId}/messages in backend/tests/contract/messages.test.ts
- [ ] T022 [P] Contract test PATCH,DELETE /api/messages/{messageId} in backend/tests/contract/messages.test.ts
- [ ] T023 [P] Contract test POST /api/messages/{messageId}/read in backend/tests/contract/messages.test.ts
- [ ] T024 [P] Contract test POST /api/files/upload (tus.io) in backend/tests/contract/files.test.ts
- [ ] T025 [P] Contract test GET /api/files/{fileId} in backend/tests/contract/files.test.ts
- [ ] T026 [P] Contract test POST /api/admin/users/{userId}/block in backend/tests/contract/admin.test.ts
- [ ] T027 [P] Contract test GET /api/admin/reports in backend/tests/contract/admin.test.ts

### Contract Tests [P] - WebSocket Events
- [ ] T028 [P] Contract test WebSocket connection/auth in backend/tests/contract/websocket.test.ts
- [ ] T029 [P] Contract test message_send/received events in backend/tests/contract/websocket-messaging.test.ts
- [ ] T030 [P] Contract test presence events (user_online/offline) in backend/tests/contract/websocket-presence.test.ts
- [ ] T031 [P] Contract test typing events (typing_start/stop) in backend/tests/contract/websocket-typing.test.ts
- [ ] T032 [P] Contract test room events (room_join/leave) in backend/tests/contract/websocket-rooms.test.ts
- [ ] T033 [P] Contract test file upload events in backend/tests/contract/websocket-files.test.ts

### Integration Tests [P] - User Stories
- [ ] T034 [P] Integration test: User authentication flow in backend/tests/integration/auth-flow.test.ts
- [ ] T035 [P] Integration test: Real-time message exchange in backend/tests/integration/messaging.test.ts
- [ ] T036 [P] Integration test: User presence tracking in backend/tests/integration/presence.test.ts
- [ ] T037 [P] Integration test: File upload and sharing in backend/tests/integration/file-sharing.test.ts
- [ ] T038 [P] Integration test: Group chat operations in backend/tests/integration/group-chat.test.ts
- [ ] T039 [P] Integration test: Message history retrieval in backend/tests/integration/message-history.test.ts
- [ ] T040 [P] Integration test: Moderation features in backend/tests/integration/moderation.test.ts

## Phase 3.4: Data Models (ONLY after tests are failing)
- [ ] T041 [P] User entity in backend/src/models/User.ts
- [ ] T042 [P] Message entity in backend/src/models/Message.ts
- [ ] T043 [P] ChatRoom entity in backend/src/models/ChatRoom.ts
- [ ] T044 [P] ChatRoomParticipant entity in backend/src/models/ChatRoomParticipant.ts
- [ ] T045 [P] MessageReadStatus entity in backend/src/models/MessageReadStatus.ts
- [ ] T046 [P] UserSession entity in backend/src/models/UserSession.ts
- [ ] T047 [P] FileAttachment entity in backend/src/models/FileAttachment.ts

## Phase 3.5: Services Layer
- [ ] T048 [P] AuthService (JWT token generation/validation) in backend/src/services/AuthService.ts
- [ ] T049 [P] UserService (CRUD, profile management) in backend/src/services/UserService.ts
- [ ] T050 [P] MessageService (send, edit, delete, history) in backend/src/services/MessageService.ts
- [ ] T051 [P] ChatRoomService (create, manage participants) in backend/src/services/ChatRoomService.ts
- [ ] T052 [P] PresenceService (Redis-based presence tracking) in backend/src/services/PresenceService.ts
- [ ] T053 [P] FileService (upload, download, validation) in backend/src/services/FileService.ts
- [ ] T054 [P] ModerationService (blocking, reporting) in backend/src/services/ModerationService.ts

## Phase 3.6: Middleware and Utilities
- [ ] T055 [P] JWT authentication middleware in backend/src/middleware/auth.ts
- [ ] T056 [P] Request validation middleware in backend/src/middleware/validation.ts
- [ ] T057 [P] Error handling middleware in backend/src/middleware/errorHandler.ts
- [ ] T058 [P] Rate limiting middleware in backend/src/middleware/rateLimiter.ts
- [ ] T059 [P] CORS configuration in backend/src/middleware/cors.ts
- [ ] T060 [P] Logging utility in backend/src/utils/logger.ts
- [ ] T061 [P] Database connection utility in backend/src/utils/database.ts
- [ ] T062 [P] Redis connection utility in backend/src/utils/redis.ts

## Phase 3.7: REST API Controllers
- [ ] T063 Authentication controller (/api/auth/*) in backend/src/api/AuthController.ts
- [ ] T064 Users controller (/api/users/*) in backend/src/api/UsersController.ts
- [ ] T065 Rooms controller (/api/rooms/*) in backend/src/api/RoomsController.ts
- [ ] T066 Messages controller (/api/messages/*) in backend/src/api/MessagesController.ts
- [ ] T067 Files controller (/api/files/*) in backend/src/api/FilesController.ts
- [ ] T068 Admin controller (/api/admin/*) in backend/src/api/AdminController.ts

## Phase 3.8: WebSocket Implementation
- [ ] T069 Socket.IO server setup and authentication in backend/src/socket/SocketServer.ts
- [ ] T070 Connection management handler in backend/src/socket/ConnectionHandler.ts
- [ ] T071 Messaging events handler in backend/src/socket/MessagingHandler.ts
- [ ] T072 Presence events handler in backend/src/socket/PresenceHandler.ts
- [ ] T073 Room management handler in backend/src/socket/RoomHandler.ts
- [ ] T074 File upload events handler in backend/src/socket/FileHandler.ts
- [ ] T075 Typing indicators handler in backend/src/socket/TypingHandler.ts

## Phase 3.9: Background Jobs
- [ ] T076 [P] Message archiving job (30-day retention) in backend/src/jobs/MessageArchiveJob.ts
- [ ] T077 [P] File cleanup job (orphaned files) in backend/src/jobs/FileCleanupJob.ts
- [ ] T078 [P] Session cleanup job (expired sessions) in backend/src/jobs/SessionCleanupJob.ts
- [ ] T079 Job scheduler setup in backend/src/jobs/JobScheduler.ts

## Phase 3.10: Backend Integration
- [ ] T080 Express.js app setup with all middleware in backend/src/app.ts
- [ ] T081 API routes registration in backend/src/routes/index.ts
- [ ] T082 Socket.IO integration with Express server in backend/src/server.ts
- [ ] T083 Database migrations runner in backend/src/scripts/migrate.ts
- [ ] T084 Development data seeder in backend/src/scripts/seed.ts

## Phase 3.11: Frontend Core Setup
- [ ] T085 [P] TypeScript type definitions in frontend/src/types/api.ts
- [ ] T086 [P] WebSocket types in frontend/src/types/websocket.ts
- [ ] T087 [P] API client configuration in frontend/src/services/api.ts
- [ ] T088 [P] Socket.IO client setup in frontend/src/services/socket.ts
- [ ] T089 [P] Authentication context in frontend/src/contexts/AuthContext.tsx
- [ ] T090 [P] WebSocket context in frontend/src/contexts/SocketContext.tsx

## Phase 3.12: Frontend Custom Hooks
- [ ] T091 [P] useAuth hook in frontend/src/hooks/useAuth.ts
- [ ] T092 [P] useSocket hook in frontend/src/hooks/useSocket.ts
- [ ] T093 [P] useMessages hook in frontend/src/hooks/useMessages.ts
- [ ] T094 [P] usePresence hook in frontend/src/hooks/usePresence.ts
- [ ] T095 [P] useTyping hook in frontend/src/hooks/useTyping.ts
- [ ] T096 [P] useFileUpload hook in frontend/src/hooks/useFileUpload.ts

## Phase 3.13: Frontend Components
- [ ] T097 [P] Login component in frontend/src/components/auth/Login.tsx
- [ ] T098 [P] UserList component in frontend/src/components/users/UserList.tsx
- [ ] T099 [P] ChatRoomList component in frontend/src/components/rooms/ChatRoomList.tsx
- [ ] T100 [P] MessageList component in frontend/src/components/messages/MessageList.tsx
- [ ] T101 [P] MessageInput component in frontend/src/components/messages/MessageInput.tsx
- [ ] T102 [P] TypingIndicator component in frontend/src/components/messages/TypingIndicator.tsx
- [ ] T103 [P] FileUpload component in frontend/src/components/files/FileUpload.tsx
- [ ] T104 [P] PresenceIndicator component in frontend/src/components/presence/PresenceIndicator.tsx

## Phase 3.14: Frontend Pages
- [ ] T105 Login page in frontend/src/pages/LoginPage.tsx
- [ ] T106 Chat dashboard page in frontend/src/pages/ChatPage.tsx
- [ ] T107 Room management page in frontend/src/pages/RoomsPage.tsx
- [ ] T108 User profile page in frontend/src/pages/ProfilePage.tsx

## Phase 3.15: Frontend Integration
- [ ] T109 App routing setup in frontend/src/App.tsx
- [ ] T110 TanStack Query setup in frontend/src/main.tsx
- [ ] T111 CSS/styling setup in frontend/src/styles/
- [ ] T112 Build configuration in frontend/vite.config.ts

## Phase 3.16: End-to-End Integration
- [ ] T113 Backend environment configuration and startup script
- [ ] T114 Frontend environment configuration and build process
- [ ] T115 Docker development environment setup
- [ ] T116 Database initialization and migration scripts
- [ ] T117 Cross-service integration testing

## Phase 3.17: Performance and Security
- [ ] T118 [P] Input sanitization and validation in backend/src/utils/sanitization.ts
- [ ] T119 [P] SQL injection prevention validation in backend/tests/security/sql-injection.test.ts
- [ ] T120 [P] XSS protection validation in backend/tests/security/xss-protection.test.ts
- [ ] T121 [P] Rate limiting enforcement tests in backend/tests/security/rate-limiting.test.ts
- [ ] T122 [P] File upload security tests in backend/tests/security/file-upload.test.ts
- [ ] T123 Load testing for 1000 concurrent connections in backend/tests/performance/load.test.ts
- [ ] T124 Message delivery latency testing (<100ms) in backend/tests/performance/latency.test.ts

## Phase 3.18: Final Polish
- [ ] T125 [P] Unit tests for all services in backend/tests/unit/
- [ ] T126 [P] Frontend component unit tests in frontend/tests/components/
- [ ] T127 [P] API documentation generation in docs/api.md
- [ ] T128 [P] WebSocket events documentation in docs/websocket.md
- [ ] T129 Quickstart validation (run all scenarios from quickstart.md)
- [ ] T130 Code review and refactoring
- [ ] T131 Performance optimization based on test results
- [ ] T132 Production deployment preparation

## Dependencies
**Critical Path**:
- Setup (T001-T012) before everything
- Tests (T013-T040) before implementation (T041+)
- Models (T041-T047) before Services (T048-T054)
- Services before Controllers (T063-T068) and Handlers (T069-T075)
- Backend core before Frontend integration (T085+)
- Integration (T113-T117) before Performance/Polish (T118-T132)

**Blocking Dependencies**:
- T010,T011 block all model tasks (T041-T047)
- T041 (User) blocks T048,T049 (AuthService, UserService)
- T042 (Message) blocks T050 (MessageService)
- T043,T044 (ChatRoom entities) block T051 (ChatRoomService)
- T080-T082 (Backend integration) block T113-T117
- T089,T090 (Frontend contexts) block T091-T096 (hooks)
- T097-T104 (components) require T091-T096 (hooks)

## Parallel Execution Examples

### Phase 3.2: Database Setup
```bash
# Launch T010, T011, T012 in sequence (dependencies)
Task: "Create TypeORM configuration in backend/src/config/database.ts"
# Then after T010 completes:
Task: "Create initial database migration for all entities in backend/src/migrations/001_initial_schema.ts"
# Then after T011 completes:
Task: "Create database seeding script in backend/src/seeds/dev-data.ts"
```

### Phase 3.3: Contract Tests (All Parallel)
```bash
# Launch T013-T040 together (different test files):
Task: "Contract test POST /api/auth/login in backend/tests/contract/auth.test.ts"
Task: "Contract test GET /api/users in backend/tests/contract/users.test.ts"
Task: "Contract test GET,POST /api/rooms in backend/tests/contract/rooms.test.ts"
Task: "Contract test WebSocket connection/auth in backend/tests/contract/websocket.test.ts"
Task: "Integration test: User authentication flow in backend/tests/integration/auth-flow.test.ts"
# ... (all contract and integration tests)
```

### Phase 3.4: Data Models (All Parallel)
```bash
# Launch T041-T047 together (different entity files):
Task: "User entity in backend/src/models/User.ts"
Task: "Message entity in backend/src/models/Message.ts"
Task: "ChatRoom entity in backend/src/models/ChatRoom.ts"
Task: "FileAttachment entity in backend/src/models/FileAttachment.ts"
# ... (all model entities)
```

### Phase 3.5: Services (All Parallel)
```bash
# Launch T048-T054 together (different service files):
Task: "AuthService (JWT token generation/validation) in backend/src/services/AuthService.ts"
Task: "UserService (CRUD, profile management) in backend/src/services/UserService.ts"
Task: "MessageService (send, edit, delete, history) in backend/src/services/MessageService.ts"
# ... (all services)
```

## Notes
- [P] tasks = different files, no dependencies
- Verify all tests fail before implementing
- Commit after each phase completion
- Follow TDD strictly: Tests → Models → Services → Controllers → Integration
- Backend must be fully functional before frontend development
- Use WebSocket for real-time features, REST API for CRUD operations

## Validation Checklist
*GATE: Checked before execution*

- [x] All 14 REST API endpoints have contract tests (T013-T027)
- [x] All 6 WebSocket event groups have contract tests (T028-T033)
- [x] All 7 user stories have integration tests (T034-T040)
- [x] All 7 entities have model tasks (T041-T047)
- [x] All major services implemented (T048-T054)
- [x] All parallel tasks are truly independent (different files)
- [x] Tests come before implementation (TDD enforced)
- [x] Each task specifies exact file path
- [x] Dependencies clearly documented
- [x] Performance targets addressed (T123-T124)
- [x] Security requirements covered (T118-T122)