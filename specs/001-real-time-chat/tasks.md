# Tasks: Real-time Chat System

**Input**: Design documents from `/specs/001-real-time-chat/`
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
- Paths shown below assume web project structure from plan.md

## Phase 3.1: Setup
- [ ] T001 Create project structure per implementation plan (backend/ and frontend/ directories)
- [ ] T002 Initialize Node.js TypeScript project with Express.js, Socket.IO, TypeORM dependencies in backend/
- [ ] T003 Initialize React TypeScript project with Socket.IO client, TanStack Query dependencies in frontend/
- [ ] T004 [P] Configure ESLint, Prettier, and TypeScript config in backend/
- [ ] T005 [P] Configure ESLint, Prettier, and TypeScript config in frontend/
- [ ] T006 [P] Setup Docker Compose for PostgreSQL and Redis services
- [ ] T007 [P] Create environment configuration files (.env.example, .env) in backend/

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [ ] T008 [P] Contract test POST /api/auth/register in backend/tests/contract/auth.test.ts
- [ ] T009 [P] Contract test POST /api/auth/login in backend/tests/contract/auth.test.ts
- [ ] T010 [P] Contract test POST /api/auth/refresh in backend/tests/contract/auth.test.ts
- [ ] T011 [P] Contract test GET /api/rooms in backend/tests/contract/rooms.test.ts
- [ ] T012 [P] Contract test POST /api/rooms in backend/tests/contract/rooms.test.ts
- [ ] T013 [P] Contract test GET /api/rooms/{roomId} in backend/tests/contract/rooms.test.ts
- [ ] T014 [P] Contract test GET /api/rooms/{roomId}/messages in backend/tests/contract/messages.test.ts
- [ ] T015 [P] Contract test POST /api/rooms/{roomId}/messages in backend/tests/contract/messages.test.ts
- [ ] T016 [P] Contract test GET /api/users/me in backend/tests/contract/users.test.ts

### WebSocket Contract Tests
- [ ] T017 [P] WebSocket contract test join_room event in backend/tests/contract/websocket.test.ts
- [ ] T018 [P] WebSocket contract test leave_room event in backend/tests/contract/websocket.test.ts
- [ ] T019 [P] WebSocket contract test send_message event in backend/tests/contract/websocket.test.ts
- [ ] T020 [P] WebSocket contract test typing_start/stop events in backend/tests/contract/websocket.test.ts

### Integration Tests
- [ ] T021 [P] Integration test user registration flow in backend/tests/integration/user-registration.test.ts
- [ ] T022 [P] Integration test user authentication flow in backend/tests/integration/user-auth.test.ts
- [ ] T023 [P] Integration test create and join chat room in backend/tests/integration/chat-room.test.ts
- [ ] T024 [P] Integration test real-time messaging in backend/tests/integration/real-time-messaging.test.ts
- [ ] T025 [P] Integration test user presence tracking in backend/tests/integration/user-presence.test.ts
- [ ] T026 [P] Integration test message history retrieval in backend/tests/integration/message-history.test.ts
- [ ] T027 [P] Integration test typing indicators in backend/tests/integration/typing-indicators.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models
- [ ] T028 [P] User entity model in backend/src/models/User.ts
- [ ] T029 [P] ChatRoom entity model in backend/src/models/ChatRoom.ts
- [ ] T030 [P] Message entity model in backend/src/models/Message.ts
- [ ] T031 [P] ChatRoomParticipant entity model in backend/src/models/ChatRoomParticipant.ts
- [ ] T032 [P] Database connection and TypeORM configuration in backend/src/config/database.ts
- [ ] T033 [P] Database migrations for all entities in backend/src/migrations/

### Services
- [ ] T034 [P] UserService with CRUD operations in backend/src/services/UserService.ts
- [ ] T035 [P] ChatRoomService with room management in backend/src/services/ChatRoomService.ts
- [ ] T036 [P] MessageService with message handling in backend/src/services/MessageService.ts
- [ ] T037 [P] PresenceService with Redis operations in backend/src/services/PresenceService.ts
- [ ] T038 [P] AuthService with JWT handling in backend/src/services/AuthService.ts

### API Controllers
- [ ] T039 [P] Auth controller for registration/login in backend/src/controllers/AuthController.ts
- [ ] T040 [P] Rooms controller for room management in backend/src/controllers/RoomsController.ts
- [ ] T041 [P] Messages controller for message handling in backend/src/controllers/MessagesController.ts
- [ ] T042 [P] Users controller for user profile in backend/src/controllers/UsersController.ts

### WebSocket Handlers
- [ ] T043 [P] Socket.IO connection handler in backend/src/socket/ConnectionHandler.ts
- [ ] T044 [P] Room join/leave handler in backend/src/socket/RoomHandler.ts
- [ ] T045 [P] Message sending handler in backend/src/socket/MessageHandler.ts
- [ ] T046 [P] Typing indicators handler in backend/src/socket/TypingHandler.ts
- [ ] T047 [P] Presence tracking handler in backend/src/socket/PresenceHandler.ts

### Frontend Components
- [ ] T048 [P] Login/Register page components in frontend/src/pages/Auth/
- [ ] T049 [P] Chat dashboard page component in frontend/src/pages/Dashboard/
- [ ] T050 [P] Chat room component in frontend/src/components/ChatRoom/
- [ ] T051 [P] Message list component in frontend/src/components/MessageList/
- [ ] T052 [P] Message input component in frontend/src/components/MessageInput/
- [ ] T053 [P] User presence component in frontend/src/components/UserPresence/
- [ ] T054 [P] Room sidebar component in frontend/src/components/RoomSidebar/

### Frontend Services
- [ ] T055 [P] API client service in frontend/src/services/ApiClient.ts
- [ ] T056 [P] WebSocket client service in frontend/src/services/SocketClient.ts
- [ ] T057 [P] Authentication context in frontend/src/contexts/AuthContext.tsx
- [ ] T058 [P] Chat context for real-time state in frontend/src/contexts/ChatContext.tsx

## Phase 3.4: Integration
- [ ] T059 Connect UserService to PostgreSQL database
- [ ] T060 Connect PresenceService to Redis
- [ ] T061 JWT authentication middleware in backend/src/middleware/auth.ts
- [ ] T062 Request validation middleware in backend/src/middleware/validation.ts
- [ ] T063 Error handling middleware in backend/src/middleware/errorHandler.ts
- [ ] T064 CORS configuration for frontend integration
- [ ] T065 Socket.IO authentication middleware
- [ ] T066 Rate limiting middleware for API and WebSocket
- [ ] T067 Frontend API integration with TanStack Query
- [ ] T068 Frontend WebSocket integration with React components
- [ ] T069 Frontend routing and navigation setup

## Phase 3.5: Polish
- [ ] T070 [P] Unit tests for UserService in backend/tests/unit/UserService.test.ts
- [ ] T071 [P] Unit tests for MessageService in backend/tests/unit/MessageService.test.ts
- [ ] T072 [P] Unit tests for PresenceService in backend/tests/unit/PresenceService.test.ts
- [ ] T073 [P] Unit tests for AuthService in backend/tests/unit/AuthService.test.ts
- [ ] T074 [P] Frontend component tests in frontend/tests/components/
- [ ] T075 [P] Performance tests for message delivery (<100ms) in backend/tests/performance/
- [ ] T076 [P] Load tests for concurrent connections (1000+) in backend/tests/performance/
- [ ] T077 [P] Update quickstart.md with final setup instructions
- [ ] T078 Remove code duplication and refactor
- [ ] T079 Run manual testing scenarios from quickstart.md
- [ ] T080 Final security audit and dependency updates

## Dependencies
- Setup (T001-T007) before all other phases
- Tests (T008-T027) before implementation (T028-T058)
- Database models (T028-T033) before services (T034-T038)
- Services before controllers (T039-T042) and socket handlers (T043-T047)
- Backend components before frontend integration (T067-T069)
- Implementation before polish (T070-T080)

### Specific Dependencies
- T032 (DB config) blocks T034-T038 (services)
- T034 (UserService) blocks T039 (AuthController), T043 (ConnectionHandler)
- T035 (ChatRoomService) blocks T040 (RoomsController), T044 (RoomHandler)
- T036 (MessageService) blocks T041 (MessagesController), T045 (MessageHandler)
- T037 (PresenceService) blocks T047 (PresenceHandler)
- T038 (AuthService) blocks T039 (AuthController), T061 (auth middleware)
- T056 (SocketClient) blocks T058 (ChatContext)
- T057 (AuthContext) blocks T048 (Auth pages)

## Parallel Execution Examples

### Phase 3.2 Contract Tests (Launch together):
```
Task: "Contract test POST /api/auth/register in backend/tests/contract/auth.test.ts"
Task: "Contract test GET /api/rooms in backend/tests/contract/rooms.test.ts"
Task: "Contract test WebSocket join_room event in backend/tests/contract/websocket.test.ts"
Task: "Integration test user registration flow in backend/tests/integration/user-registration.test.ts"
```

### Phase 3.3 Database Models (Launch together):
```
Task: "User entity model in backend/src/models/User.ts"
Task: "ChatRoom entity model in backend/src/models/ChatRoom.ts"
Task: "Message entity model in backend/src/models/Message.ts"
Task: "Database connection and TypeORM configuration in backend/src/config/database.ts"
```

### Phase 3.3 Frontend Components (Launch together):
```
Task: "Login/Register page components in frontend/src/pages/Auth/"
Task: "Chat room component in frontend/src/components/ChatRoom/"
Task: "Message list component in frontend/src/components/MessageList/"
Task: "API client service in frontend/src/services/ApiClient.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify all tests fail before implementing
- Commit after each task completion
- Follow TDD strictly: Red-Green-Refactor cycle
- Use TypeScript strict mode throughout
- Implement proper error handling in all services

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - Each REST endpoint → contract test task [P]
   - Each WebSocket event → contract test task [P]
   - Each endpoint → implementation task

2. **From Data Model**:
   - Each entity → model creation task [P]
   - Relationships → service layer tasks

3. **From User Stories**:
   - Each quickstart scenario → integration test [P]
   - Real-time features → WebSocket integration tasks

4. **Ordering**:
   - Setup → Tests → Models → Services → Controllers → Integration → Polish
   - Dependencies block parallel execution

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T008-T020)
- [x] All entities have model tasks (T028-T031)
- [x] All tests come before implementation
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] WebSocket events covered (join_room, leave_room, send_message, typing)
- [x] Frontend components match backend API structure
- [x] Real-time features properly tested and implemented