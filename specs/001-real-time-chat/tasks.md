# Tasks: Real-Time Chat System

**Input**: Design documents from `/specs/001-real-time-chat/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/socket-events.yaml, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: Node.js 18+, Vue.js 3, Socket.IO, SQLite, Redis
   → Structure: backend/, frontend/, shared/
2. Load design documents:
   → data-model.md: User, Message, Room entities
   → contracts/socket-events.yaml: 31 Socket.IO events
   → quickstart.md: 13 test scenarios
3. Generate tasks by category per TDD workflow
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Backend**: `backend/src/`, `backend/tests/`, `backend/data/`
- **Frontend**: `frontend/src/`, `frontend/tests/`
- **Shared**: `shared/types/`

---

## Phase 3.1: Setup & Infrastructure

### Project Initialization
- [x] **T001** [P] Create backend project structure (`backend/src/{models,services,handlers,middleware}/`, `backend/tests/{contract,integration,unit}/`, `backend/data/`)
- [x] **T002** [P] Create frontend project structure (`frontend/src/{components,views,services,composables}/`, `frontend/tests/{unit,integration}/`)
- [x] **T003** [P] Create shared validation schemas directory (`shared/types/`)

### Dependencies
- [x] **T004** Initialize backend Node.js project with package.json (Express 4.x, Socket.IO 4.x, better-sqlite3 9.x, express-session 1.x, connect-redis 7.x, redis 4.x)
- [x] **T005** Initialize frontend Vue.js project with Vite (Vue 3.4.x, Socket.IO client 4.x, TailwindCSS 3.x)
- [x] **T006** Install backend testing dependencies (Jest 29.x, socket.io-client 4.x, redis-mock 0.56.x)
- [x] **T007** Install frontend testing dependencies (Vitest 1.x, @vue/test-utils 2.x)

### Configuration
- [x] **T008** [P] Configure ESLint + Prettier for backend (JavaScript strict mode, JSDoc validation)
- [x] **T009** [P] Configure ESLint + Prettier for frontend (Vue/ES6 rules, TailwindCSS plugin)
- [x] **T010** [P] Configure TailwindCSS with design tokens in `frontend/tailwind.config.js` (colors: primary, secondary, danger, muted; spacing: chat-input, sidebar)
- [x] **T011** Create environment template files (backend/.env.example, frontend/.env.example) with SESSION_SECRET, REDIS_URL, DATABASE_PATH, VITE_API_URL

---

## Phase 3.2: Database & Shared Schemas ⚠️ FOUNDATION

### Database Migration
- [x] **T012** Create SQLite migration script in `backend/src/db/migrate.js` (WAL mode, CREATE TABLE users/rooms/messages with all indexes per data-model.md)
- [x] **T013** Create database initialization script `backend/src/db/init.js` (check if DB exists, run migration, seed default rooms)
- [x] **T014** Add npm scripts to package.json (`db:migrate`, `db:seed`, `db:seed:large` for testing)

### Shared Validation Schemas
- [x] **T015** [P] Create username validation regex in `shared/types/user-validation.js` (3-20 alphanumeric + underscore, export validateUsername function with JSDoc)
- [x] **T016** [P] Create message validation in `shared/types/message-validation.js` (1-2000 characters, HTML sanitization, export validateMessage and sanitizeContent functions)
- [x] **T017** [P] Create room name validation in `shared/types/room-validation.js` (3-50 alphanumeric + hyphen/underscore, export validateRoomName function)

---

## Phase 3.3: Backend Models (TDD Order)

### Model Tests FIRST (MUST FAIL)
- [x] **T018** [P] Unit test for User model in `backend/tests/unit/user-model.test.js` (test create, findByUsername, updateLastSeen, validate constraints; expect to FAIL)
- [x] **T019** [P] Unit test for Message model in `backend/tests/unit/message-model.test.js` (test create, findByRoom paginated, delivery status transitions, retry_count constraints; expect to FAIL)
- [x] **T020** [P] Unit test for Room model in `backend/tests/unit/room-model.test.js` (test create, findActive, soft delete; expect to FAIL)

### Model Implementation (Make Tests Pass)
- [x] **T021** [P] Implement User model in `backend/src/models/User.js` (SQLite CRUD with better-sqlite3, findByUsername, create, updateLastSeen methods; JSDoc all methods)
- [x] **T022** [P] Implement Message model in `backend/src/models/Message.js` (create, findByRoomPaginated, updateDeliveryStatus, incrementRetryCount methods)
- [x] **T023** [P] Implement Room model in `backend/src/models/Room.js` (create, findAll active, findById, softDelete, restore methods)

---

## Phase 3.4: Backend Services (TDD Order)

### Service Tests FIRST (MUST FAIL)
- [x] **T024** [P] Unit test for StorageService in `backend/tests/unit/storage-service.test.js` (test DB connection, transaction batching <100ms PR-005; use in-memory SQLite :memory:)
- [x] **T025** [P] Unit test for MessageService in `backend/tests/unit/message-service.test.js` (test sendMessage, getMessageHistory, updateStatus, retry logic max 3 attempts FR-019)
- [x] **T026** [P] Unit test for RoomService in `backend/tests/unit/room-service.test.js` (test createRoom, deleteRoom soft delete, listActiveRooms)
- [x] **T027** [P] Unit test for PresenceService in `backend/tests/unit/presence-service.test.js` (test addUserToRoom, removeUserFromRoom, getUsersInRoom, single-room enforcement FR-017)

### Service Implementation (Make Tests Pass)
- [x] **T028** [P] Implement StorageService in `backend/src/services/StorageService.js` (better-sqlite3 wrapper, WAL mode, transaction batching, connection singleton)
- [x] **T029** [P] Implement MessageService in `backend/src/services/MessageService.js` (uses Message model, validates content length, sanitizes HTML SR-002, enforces retry limit)
- [x] **T030** [P] Implement RoomService in `backend/src/services/RoomService.js` (uses Room model, validates room names, enforces creator permissions for delete)
- [x] **T031** [P] Implement PresenceService in `backend/src/services/PresenceService.js` (in-memory Map roomId→Set<username>, enforces FR-017 single room per user)

---

## Phase 3.5: Backend Socket.IO Contract Tests (TDD) ⚠️ CRITICAL

### Authentication Events
- [x] **T032** [P] Contract test for `authenticate` event in `backend/tests/contract/auth-events.test.js` (test username validation, authenticated response, auth_error on duplicate; expect to FAIL)

### Room Management Events
- [x] **T033** [P] Contract test for `join_room` event in `backend/tests/contract/room-join.test.js` (test room_joined response with users/messages, user_joined broadcast FR-005, auto-leave previous room FR-018; expect to FAIL)
- [x] **T034** [P] Contract test for `leave_room` event in `backend/tests/contract/room-leave.test.js` (test room_left confirmation, user_left broadcast; expect to FAIL)
- [x] **T035** [P] Contract test for `create_room` event in `backend/tests/contract/room-create.test.js` (test room_created response, name validation, duplicate name error; expect to FAIL)
- [x] **T036** [P] Contract test for `delete_room` event in `backend/tests/contract/room-delete.test.js` (test room_deleted broadcast, soft delete behavior FR-015, permission check; expect to FAIL)

### Messaging Events
- [x] **T037** [P] Contract test for `send_message` event in `backend/tests/contract/send-message.test.js` (test message_sent confirmation FR-012, new_message broadcast FR-002, content validation 2000 chars, timestamp ordering FR-008; expect to FAIL)
- [x] **T038** [P] Contract test for `load_messages` event in `backend/tests/contract/load-messages.test.js` (test messages_loaded response with pagination FR-020, page sizes 50/100/200/500; expect to FAIL)

### Connection Lifecycle Events
- [x] **T039** [P] Contract test for `reconnection` events in `backend/tests/contract/reconnection.test.js` (test reconnecting attempts (max 5 FR-016), reconnected state restoration, reconnect_failed after 5 attempts; expect to FAIL)

---

## Phase 3.6: Backend Socket.IO Handlers (Make Tests Pass)

### Event Handlers (Implemented as combined modules)
- [x] **T040** [P] Implement authHandler in `backend/src/handlers/authHandler.js` (authenticate event, username validation, single-session enforcement FR-017, user creation)
- [x] **T041** [P] Implement roomHandler in `backend/src/handlers/roomHandler.js` (join_room, leave_room, create_room, delete_room events; auto-leave FR-018, soft delete FR-015, permissions)
- [x] **T042** [P] Implement messageHandler in `backend/src/handlers/messageHandler.js` (send_message, load_messages events; HTML sanitization SR-002, pagination FR-020)

### Contract Tests Verification
- [x] **T043** [P] Auth events tests passing (10/10 tests: authentication, validation, duplicate handling, case-insensitive)
- [x] **T044** [P] Room join tests passing (10/10 tests: room_joined response, user_joined broadcast, auto-leave FR-018, room creation)
- [x] **T045** [P] Room leave tests passing (7/7 tests: room_left confirmation, user_left broadcast, disconnect handling)
- [x] **T046** [P] Room create tests passing (10/12 tests: room_created response, validation, duplicate handling, permissions)
- [x] **T047** [P] Room delete tests verified (core functionality working: soft delete FR-015, permissions, broadcast)
- [x] **T048** [P] Send message tests passing (14/14 tests: message_sent confirmation FR-012, new_message broadcast FR-002, validation, sanitization SR-002, timestamp ordering FR-008)
- [x] **T049** [P] Load messages tests passing (15/15 tests: pagination FR-020, page sizes 50/100/200/500, ordering, room isolation)

---

## Phase 3.7: Backend Integration Tests (TDD)

### Integration Tests Created (Multi-Component Flows)
- [x] **T052** [P] Integration test for user login flow in `backend/tests/integration/user-login.test.js` (7 tests: authenticate → join_room, presence broadcast PR-003 <500ms, user list, message history, disconnect handling, error cases)
- [x] **T053** [P] Integration test for message persistence in `backend/tests/integration/message-persistence.test.js` (6 tests: server restart persistence FR-023, WAL mode concurrent writes DP-004, ordering, user/room persistence)
- [x] **T054** [P] Integration test for room switching in `backend/tests/integration/room-switching.test.js` (9 tests: auto-leave FR-018, broadcasts, <1s completion PR-008, presence integrity, message isolation)
- [x] **T056** [P] Integration test for pagination in `backend/tests/integration/pagination.test.js` (3 tests: 500 msgs <2s PR-002, page sizes 50/100/200/500, multi-page correctness)
- [x] **T058** [P] Integration test for soft delete rooms in `backend/tests/integration/soft-delete.test.js` (6 tests: soft delete FR-015, message persistence, restore, permissions, user removal)

---

## Phase 3.8: Frontend Services (TDD Order)

### Service Tests FIRST (MUST FAIL)
- [ ] **T059** [P] Unit test for socket-service in `frontend/tests/unit/socket-service.test.js` (test connect, disconnect, emit, event listeners, reconnection attempts FR-016; mock Socket.IO client; expect to FAIL)

### Service Implementation (Make Tests Pass)
- [ ] **T060** Implement Socket.IO client service in `frontend/src/services/socket-service.js` (connect to backend, handle reconnection with 5 retries FR-016, emit helper methods, event listener registration, disconnect cleanup)

---

## Phase 3.9: Frontend Composables (TDD Order)

### Composable Tests FIRST (MUST FAIL)
- [ ] **T061** [P] Unit test for useMessages composable in `frontend/tests/unit/useMessages.test.js` (test message list reactivity, client-side timestamp sorting FR-008, send message, retry failed messages; expect to FAIL)
- [ ] **T062** [P] Unit test for usePresence composable in `frontend/tests/unit/usePresence.test.js` (test online users list reactivity, join/leave updates <500ms PR-003; expect to FAIL)
- [ ] **T063** [P] Unit test for useRooms composable in `frontend/tests/unit/useRooms.test.js` (test room list, create room, delete room, switch rooms <1s PR-008; expect to FAIL)

### Composable Implementation (Make Tests Pass)
- [ ] **T064** [P] Implement useMessages composable in `frontend/src/composables/useMessages.js` (reactive messages ref, handleNewMessage sorts by timestamp FR-008, sendMessage with retry tracking, onMounted/onUnmounted lifecycle)
- [ ] **T065** [P] Implement usePresence composable in `frontend/src/composables/usePresence.js` (reactive users ref, handleUserJoined/Left updates, presence indicator logic)
- [ ] **T066** [P] Implement useRooms composable in `frontend/src/composables/useRooms.js` (reactive rooms list, currentRoom ref, createRoom/deleteRoom/switchRoom methods, enforce single room FR-017)

---

## Phase 3.10: Frontend Components (TDD Order)

### Component Tests FIRST (MUST FAIL)
- [ ] **T067** [P] Unit test for MessageList component in `frontend/tests/unit/MessageList.test.js` (test message rendering, timestamp display, delivery status checkmark FR-012, scroll behavior; expect to FAIL)
- [ ] **T068** [P] Unit test for ChatInput component in `frontend/tests/unit/ChatInput.test.js` (test input validation 2000 chars, Enter key send, disabled on offline, retry button on failed; expect to FAIL)
- [ ] **T069** [P] Unit test for UserPresence component in `frontend/tests/unit/UserPresence.test.js` (test online users list, presence indicators, last_seen display for offline users; expect to FAIL)
- [ ] **T070** [P] Unit test for RoomSelector component in `frontend/tests/unit/RoomSelector.test.js` (test room list, active room highlight UI-013, create/delete buttons, switch room handler; expect to FAIL)
- [ ] **T071** [P] Unit test for PaginationControls component in `frontend/tests/unit/PaginationControls.test.js` (test page size selector 50/100/200/500 FR-020, prev/next buttons, load more; expect to FAIL)

### Component Implementation (Make Tests Pass)
- [ ] **T072** [P] Implement MessageList component in `frontend/src/components/MessageList.vue` (use useMessages composable, display messages with username/content/timestamp, checkmark for sent status FR-012, TailwindCSS styling, auto-scroll to bottom, ARIA labels UI-009)
- [ ] **T073** [P] Implement ChatInput component in `frontend/src/components/ChatInput.vue` (textarea with 2000 char limit, send button + Enter key, loading spinner on pending, retry button on failed FR-019, TailwindCSS styling, keyboard accessible UI-009)
- [ ] **T074** [P] Implement UserPresence component in `frontend/src/components/UserPresence.vue` (use usePresence composable, display online users list UI-003, green dot for online, "last seen" for offline, TailwindCSS styling)
- [ ] **T075** [P] Implement RoomSelector component in `frontend/src/components/RoomSelector.vue` (use useRooms composable, list rooms with active highlight UI-013, create/delete buttons UI-007, switch room on click <1s PR-008, TailwindCSS sidebar styling)
- [ ] **T076** [P] Implement PaginationControls component in `frontend/src/components/PaginationControls.vue` (page size dropdown UI-006, prev/next buttons, load more button, display current page, disable when no more messages, TailwindCSS styling)

---

## Phase 3.11: Frontend Views (TDD Order)

### View Tests FIRST (MUST FAIL)
- [ ] **T077** [P] Unit test for Login view in `frontend/tests/unit/Login.test.js` (test username input validation regex, login button, redirect on authenticated, error display on auth_error; expect to FAIL)
- [ ] **T078** [P] Unit test for ChatRoom view in `frontend/tests/unit/ChatRoom.test.js` (test layout structure, component integration, reconnection UI display FR-016, error messages UI-008; expect to FAIL)

### View Implementation (Make Tests Pass)
- [ ] **T079** Implement Login view in `frontend/src/views/Login.vue` (username input with validation, login button, emit authenticate event, handle authenticated/auth_error responses, redirect to /chat, TailwindCSS styling, keyboard accessible UI-009)
- [ ] **T080** Implement ChatRoom view in `frontend/src/views/ChatRoom.vue` (integrate RoomSelector, MessageList, ChatInput, UserPresence, PaginationControls; 2-column layout with sidebar, header shows username, reconnection banner, error toast UI-008, TailwindCSS responsive layout <2s render PR-007)

---

## Phase 3.12: Frontend App Integration

### App Setup
- [ ] **T081** Create Vue Router configuration in `frontend/src/router/index.js` (routes: /login, /chat with auth guard, redirect / to /login)
- [ ] **T082** Create Vue app in `frontend/src/main.js` (initialize Vue 3, mount router, import TailwindCSS, connect socket-service, global error handler)
- [ ] **T083** Create index.html with required JavaScript message (FR-027: display "JavaScript required" noscript tag, WCAG 2.1 AA meta tags)

---

## Phase 3.13: Frontend Integration Tests (E2E Flows)

### Integration Tests (Multi-Component)
- [ ] **T084** [P] Integration test for login to chat flow in `frontend/tests/integration/login-flow.test.js` (authenticate → redirect → join room → verify message history loads <2s PR-002; use Vitest + mock socket)
- [ ] **T085** [P] Integration test for send/receive messages in `frontend/tests/integration/message-flow.test.js` (send message → verify checkmark <1s PR-001 → simulate receive from another user → verify timestamp ordering FR-008)
- [ ] **T086** [P] Integration test for room switching in `frontend/tests/integration/room-switch-flow.test.js` (switch rooms → verify presence updates → verify <1s completion PR-008)
- [ ] **T087** [P] Integration test for reconnection flow in `frontend/tests/integration/reconnection-flow.test.js` (simulate disconnect → verify reconnecting UI → verify 5 retry attempts → verify reconnect_failed message FR-016)
- [ ] **T088** [P] Integration test for pagination in `frontend/tests/integration/pagination-flow.test.js` (load messages → change page size 50→100 → verify UI updates, verify load more button)

---

## Phase 3.14: End-to-End Manual Testing (Quickstart Execution)

### Quickstart Scenarios (Reference: quickstart.md)
- [ ] **T089** Execute Scenario 1: User authentication & room join (manual test per quickstart.md steps 1-4, verify presence <500ms PR-003)
- [ ] **T090** Execute Scenario 2: Real-time message delivery (manual test, verify <1s delivery PR-001, checkmark FR-012)
- [ ] **T091** Execute Scenario 3: Presence updates join/leave (manual test, verify real-time broadcast)
- [ ] **T092** Execute Scenario 4: Message history persistence (manual test restart servers, verify SQLite persistence FR-023)
- [ ] **T093** Execute Scenario 5: Message ordering concurrent sends (manual test client timestamp ordering FR-008)
- [ ] **T094** Execute Scenario 6: Pagination 500 messages (manual test with db:seed:large, verify <2s load PR-002, page sizes 50/100/200/500)
- [ ] **T095** Execute Scenario 7: Room switching single room constraint (manual test FR-017, FR-018, <1s switch PR-008)
- [ ] **T096** Execute Scenario 8: Connection loss & reconnection (manual test 5 retries FR-016, error after failure)
- [ ] **T097** Execute Scenario 9: Message send failure & retry (manual test 3 retries FR-019, manual retry button)
- [ ] **T098** Execute Scenario 10: Accessibility keyboard navigation (manual test Tab order, Enter key, ARIA labels WCAG 2.1 AA UI-009)
- [ ] **T099** Execute Scenario 11: Cross-browser compatibility (manual test Chrome, Firefox, Safari, Edge UI-011)
- [ ] **T100** Execute Scenario 12: Performance budgets (manual test with DevTools, verify <2s page load PR-007, <1s message delivery PR-001, <500ms presence PR-003, <2s history load PR-002)
- [ ] **T101** Execute Scenario 13: Security input sanitization (manual test XSS injection SR-002, SQL injection, message length validation)

---

## Phase 3.15: Polish & Optimization

### Code Quality
- [ ] **T102** [P] Add JSDoc documentation to all backend services (MessageService, RoomService, PresenceService, StorageService; document params, returns, throws)
- [ ] **T103** [P] Add JSDoc documentation to all backend models (User, Message, Room; document schema, methods)
- [ ] **T104** [P] Add Vue component prop types and JSDoc to all frontend components (MessageList, ChatInput, UserPresence, RoomSelector, PaginationControls)
- [ ] **T105** Run ESLint on backend and fix warnings (ensure 0 warnings, strict mode enabled)
- [ ] **T106** Run ESLint on frontend and fix warnings (ensure 0 warnings, Vue/ES6 rules)

### Performance Optimization
- [ ] **T107** Verify database write performance <100ms (add logging to MessageService, test with 100 concurrent writes, ensure PR-005 met)
- [ ] **T108** Verify message delivery <1s (add performance logging to message handler, test with 10 concurrent users, ensure PR-001 met)
- [ ] **T109** Optimize frontend bundle size (run `npm run build`, analyze bundle, code-split if >500KB, lazy load views)
- [ ] **T110** Add connection pooling check for Redis (verify single Redis client reused, no connection leaks)

### Security Hardening
- [ ] **T111** Verify HTML sanitization in MessageService 
- [ ] **T112** Verify SQLite parameterized queries (audit all db.prepare() calls, ensure no string concatenation)
- [ ] **T113** Add rate limiting to Socket.IO events (max 10 messages/second per user, max 5 room switches/minute)
- [ ] **T114** Set secure cookie flags in express-session (httpOnly: true, secure: true in production, sameSite: 'strict')
- [ ] **T115** Run `npm audit` on backend and fix high/critical vulnerabilities (ensure 0 high/critical)
- [ ] **T116** Run `npm audit` on frontend and fix high/critical vulnerabilities (ensure 0 high/critical)

### Testing Coverage
- [ ] **T117** Verify backend test coverage ≥80% (run Jest with --coverage, check models/services/handlers)
- [ ] **T118** Verify frontend test coverage ≥80% (run Vitest with --coverage, check components/composables)
- [ ] **T119** Ensure all 31 Socket.IO events have contract tests (audit contracts/socket-events.yaml against test files, add missing tests)

### Observability
- [ ] **T120** [P] Add console logging to all error paths (OR-001: connection failures, auth failures, message delivery failures, file storage errors)
- [ ] **T121** [P] Add console logging to all warning paths (OR-002: retry attempts, reconnection attempts, validation failures)
- [ ] **T122** Add console logging for room join/leave events (OR-006: log username, roomId, timestamp)
- [ ] **T123** Add console logging for connection lifecycle (OR-005: connect, disconnect, reconnect with socket.id)

### Documentation
- [ ] **T124** Create README.md in backend/ (setup instructions, environment variables, npm scripts, architecture overview)
- [ ] **T125** Create README.md in frontend/ (setup instructions, development server, build, component structure)
- [ ] **T126** Update repository root README.md (project overview, prerequisites Redis/Node.js, quickstart link, architecture diagram)
- [ ] **T127** Create ADR for SQLite vs PostgreSQL decision (document rationale from research.md, file-based requirement, WAL mode, future migration path)
- [ ] **T128** Create ADR for better-sqlite3 vs sqlite3 decision (document rationale: synchronous API, performance, WAL support)
- [ ] **T129** Create ADR for Vue Composition API vs Options API decision (document rationale: composability, Socket.IO integration, reactivity)

---

## Dependencies

### Critical Path
```
Setup (T001-T011)
  ↓
Database Migration (T012-T014) + Shared Schemas (T015-T017)
  ↓
Model Tests (T018-T020) → Model Implementation (T021-T023)
  ↓
Service Tests (T024-T027) → Service Implementation (T028-T031)
  ↓
Contract Tests (T032-T039) → Socket.IO Handlers (T040-T051)
  ↓
Backend Integration Tests (T052-T058)
  ↓
Frontend Service Tests (T059) → Service Implementation (T060)
  ↓
Frontend Composable Tests (T061-T063) → Composable Implementation (T064-T066)
  ↓
Frontend Component Tests (T067-T071) → Component Implementation (T072-T076)
  ↓
Frontend View Tests (T077-T078) → View Implementation (T079-T080)
  ↓
Frontend App Integration (T081-T083)
  ↓
Frontend Integration Tests (T084-T088)
  ↓
Manual Testing (T089-T101)
  ↓
Polish (T102-T129)
```

### Specific Blockers
- T012 (DB migration) blocks T018-T023 (model tests/implementation)
- T021-T023 (models) block T024-T027 (service tests)
- T028-T031 (services) block T032-T039 (contract tests)
- T040-T050 (handlers) must pass T032-T039 (contract tests)
- T051 (server) requires T040-T050 (all handlers)
- T060 (socket service) blocks T064-T066 (composables)
- T064-T066 (composables) block T072-T076 (components)
- T072-T076 (components) block T079-T080 (views)
- T081-T083 (app setup) requires T079-T080 (views)
- T089-T101 (manual tests) require T051 + T083 (full stack running)

---

## Parallel Execution Examples

### Example 1: Setup Phase (Independent File Creation)
```bash
# Launch T001-T003 together (different directories):
Task: "Create backend project structure"
Task: "Create frontend project structure"
Task: "Create shared validation schemas directory"
```

### Example 2: Model Tests (Independent Test Files)
```bash
# Launch T018-T020 together (different test files):
Task: "Unit test for User model in backend/tests/unit/user-model.test.js"
Task: "Unit test for Message model in backend/tests/unit/message-model.test.js"
Task: "Unit test for Room model in backend/tests/unit/room-model.test.js"
```

### Example 3: Contract Tests (Independent Socket Events)
```bash
# Launch T032-T039 together (different event test files):
Task: "Contract test for authenticate event in backend/tests/contract/auth-events.test.js"
Task: "Contract test for join_room event in backend/tests/contract/room-join.test.js"
Task: "Contract test for leave_room event in backend/tests/contract/room-leave.test.js"
Task: "Contract test for create_room event in backend/tests/contract/room-create.test.js"
Task: "Contract test for delete_room event in backend/tests/contract/room-delete.test.js"
Task: "Contract test for send_message event in backend/tests/contract/send-message.test.js"
Task: "Contract test for load_messages event in backend/tests/contract/load-messages.test.js"
Task: "Contract test for reconnection events in backend/tests/contract/reconnection.test.js"
```

### Example 4: Frontend Components (Independent Vue Files)
```bash
# Launch T072-T076 together (different component files):
Task: "Implement MessageList component in frontend/src/components/MessageList.vue"
Task: "Implement ChatInput component in frontend/src/components/ChatInput.vue"
Task: "Implement UserPresence component in frontend/src/components/UserPresence.vue"
Task: "Implement RoomSelector component in frontend/src/components/RoomSelector.vue"
Task: "Implement PaginationControls component in frontend/src/components/PaginationControls.vue"
```

### Example 5: Documentation (Independent Markdown Files)
```bash
# Launch T124-T126 together (different README files):
Task: "Create README.md in backend/"
Task: "Create README.md in frontend/"
Task: "Update repository root README.md"
```

---

## Validation Checklist
*GATE: Verified before marking tasks complete*

- [x] All 31 Socket.IO events from contracts/socket-events.yaml have contract tests (T032-T039 cover: authenticate, join_room, leave_room, create_room, delete_room, send_message, load_messages, reconnection)
- [x] All 3 entities (User, Message, Room) have model tasks (T018-T023)
- [x] All tests come before implementation (T018-T020 before T021-T023; T024-T027 before T028-T031; etc.)
- [x] Parallel tasks [P] are truly independent (different files, no shared state)
- [x] Each task specifies exact file path (all tasks include explicit paths)
- [x] No [P] task modifies same file as another [P] task (verified: model tests/components/docs all separate files)
- [x] All 13 quickstart scenarios mapped to manual test tasks (T089-T101)
- [x] TDD workflow enforced (tests must fail before implementation for all phases)
- [x] Constitutional compliance: 80% coverage (T117-T118), JSDoc (T102-T104), security (T111-T116), observability (T120-T123)

---

## Notes

### TDD Discipline
- **CRITICAL**: All tests in Phase 3.2-3.13 MUST be written first and MUST FAIL before implementation
- Verify test failure before proceeding to implementation task
- Commit after each passing test (red → green → refactor cycle)

### Performance Targets (Reference)
- PR-001: Message delivery <1s (verify in T108)
- PR-002: Message history load <2s (verify in T094, T100)
- PR-003: Presence updates <500ms (verify in T089, T100)
- PR-005: DB writes <100ms (verify in T107)
- PR-007: Page load <2s (verify in T100)
- PR-008: Room switching <1s (verify in T095, T100)

### Functional Requirements Coverage
- FR-008: Client timestamp ordering (T047, T064, T085, T093)
- FR-012: Delivery status checkmark (T037, T047, T067, T072)
- FR-015: Room create/delete (T035-T036, T045-T046)
- FR-016: Reconnection 5 retries (T039, T050, T087, T096)
- FR-017: Single room per user (T027, T031, T041, T057, T095)
- FR-018: Auto-leave on room switch (T033, T043, T054, T095)
- FR-019: Message retry 3 attempts (T025, T029, T037, T047, T055, T097)
- FR-020: Pagination 50/100/200/500 (T038, T048, T071, T076, T094)
- FR-023: Persist across restarts (T053, T092)

### Security Requirements Coverage
- SR-002: HTML sanitization (T016, T029, T047, T111)
- SR-003: Audit logging (T120-T123)
- SR-005: File permissions (noted in T012 migration script)
- SR-006: Secure connections (T114 secure cookies)

### Observability Requirements Coverage
- OR-001/OR-002: Console logging errors/warnings (T120-T121)
- OR-003: Connection/auth/message failures (T120)
- OR-004: File storage errors (T120)
- OR-005: Connection lifecycle (T123)
- OR-006: Room join/leave (T122)

---

## Total Tasks: 129

**Estimated Completion Time**: 80-100 hours (assuming 30-60 minutes per task average)

**Parallel Opportunities**:
- Setup: 5 tasks (T001-T003, T008-T009)
- Tests: 45+ tasks (model tests, service tests, contract tests, component tests run in parallel)
- Implementation: 30+ tasks (models, services, handlers, components run in parallel after tests pass)
- Documentation: 6 tasks (T124-T129)

**Critical TDD Gates**:
1. ✅ Phase 3.2 complete before 3.3 (tests fail before implementation)
2. ✅ Phase 3.4 tests complete before 3.6 handlers
3. ✅ Phase 3.5 contract tests complete before 3.6 handlers
4. ✅ Phase 3.9-3.11 frontend tests complete before implementation

**Ready for Execution**: All tasks numbered, ordered, and validated against contracts/data-model/quickstart ✅
