
# Implementation Plan: Real-Time Chat System

**Branch**: `001-real-time-chat` | **Date**: 2025-10-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-real-time-chat/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code, or `AGENTS.md` for all other agents).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Real-time chat system enabling users to communicate in chat rooms via web browser. Users join one room at a time, send/receive messages instantly via WebSocket connections, view message history with pagination, and see real-time presence indicators for online users. Messages and room data persist to file-based storage (SQLite database files). Frontend built with Vue.js and TailwindCSS, backend with Node.js/Express and Socket.IO.

## Technical Context
**Language/Version**: JavaScript (Node.js 18+), Vue.js 3.x
**Primary Dependencies**:
  - Backend: Express.js, Socket.IO, SQLite3, Redis (session management)
  - Frontend: Vue.js 3, Socket.IO client, TailwindCSS
**Storage**: SQLite (file-based database), Redis (in-memory session store)
**Testing**: Jest (backend unit/integration), Vitest (frontend), Supertest (API contract tests)
**Target Platform**: Web browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+), Node.js server
**Project Type**: web (frontend + backend)
**Performance Goals**: <1s message delivery, <2s page load, <500ms presence updates, 10 concurrent connections
**Constraints**: <100ms file write operations, max 10 concurrent users across all rooms, username-only auth (no passwords)
**Scale/Scope**: 10 total concurrent users across all rooms, permanent message retention, 50-500 messages per page

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality (NON-NEGOTIABLE)
- [x] **Single Responsibility**: ✅ Backend separates Socket.IO handlers, storage layer, and Express API; Frontend separates components, services, and views
- [x] **DRY Principle**: ✅ Shared utilities for message validation, timestamp formatting, error handling
- [x] **Readability First**: ✅ Clear naming conventions (messageService, RoomList.vue, socket-handlers.js)
- [x] **Type Safety**: ⚠️ DEVIATION - JavaScript does not have static typing; Will use JSDoc annotations + ESLint strict mode
- [x] **Error Handling**: ✅ All Socket.IO events, file I/O, and Redis operations wrapped with try-catch
- [x] **Code Review Required**: ✅ PR process enforced via GitHub branch protection

**Status**: PASS with justification (Type Safety deviation documented in Complexity Tracking)

### II. Testing Standards (NON-NEGOTIABLE)
- [x] **TDD Workflow**: ✅ Contract tests written first for Socket.IO events and REST endpoints
- [x] **Coverage Minimums**: ✅ Target 80% unit coverage, 100% contract coverage for all APIs/events
- [x] **Test Categories**: ✅ Contract (Supertest for REST + Socket.IO event schemas), Integration (room switching, message persistence), Unit (validators, formatters)
- [x] **Test Quality**: ✅ Jest/Vitest provide fast, isolated tests; Redis/SQLite use in-memory for tests
- [x] **No Skipped Tests**: ✅ All tests must pass before merge

**Status**: PASS

### III. User Experience Consistency
- [x] **Design System**: ✅ TailwindCSS provides consistent design tokens; extract reusable Vue components
- [x] **Interaction Patterns**: ✅ Consistent button styles, form inputs, loading states across all views
- [x] **Performance Budgets**: ✅ Spec defines <2s page load, <100ms interactions, <500ms API responses
- [x] **Accessibility**: ✅ Keyboard navigation (UI-009), WCAG 2.1 AA semantic HTML, ARIA labels
- [x] **Error Messages**: ✅ User-friendly error handling (connection failures, retry messages)
- [x] **Responsive Design**: ⚠️ DEVIATION - Mobile not explicitly tested; Web-only with responsive CSS

**Status**: PASS with justification (Mobile testing deferred; responsive CSS ensures tablet/desktop support)

### IV. Maintainability Requirements
- [x] **Documentation**: ✅ JSDoc for all public APIs, inline comments for complex Socket.IO event flows
- [x] **Architecture Decisions**: ✅ ADR to document: WebSocket vs SSE, SQLite vs PostgreSQL, Redis session strategy
- [x] **Dependency Management**: ✅ package.json locks versions, npm audit for vulnerabilities
- [x] **Modularity**: ✅ Backend: routes/ handlers/ services/ models/; Frontend: components/ views/ services/
- [x] **Refactoring Budget**: ✅ 20% sprint capacity reserved
- [x] **Monitoring & Observability**: ⚠️ DEVIATION - Spec requires only console logging (OR-001, OR-002); no metrics/tracing

**Status**: PASS with justification (Basic console logging acceptable for initial release; metrics deferred)

### V. Security & Data Protection
- [x] **Secure by Default**: ✅ Username validation, message sanitization (SR-002), file permissions (SR-005)
- [x] **Data Encryption**: ⚠️ DEVIATION - Spec does not require encryption at rest; SQLite files protected via filesystem permissions only
- [x] **Secret Management**: ✅ Environment variables for Redis/SQLite paths, no hardcoded secrets
- [x] **Audit Logging**: ✅ Security events logged (SR-003): login attempts, authentication failures
- [x] **Regular Audits**: ✅ npm audit automated in CI
- [x] **Privacy Compliance**: ✅ Public rooms only (SR-004), no sensitive PII beyond username

**Status**: PASS with justification (Encryption at rest not required by spec; file permissions sufficient)

### Initial Constitution Check Result: ✅ PASS
All deviations justified by spec constraints. See Complexity Tracking for details.

## Project Structure

### Documentation (this feature)
```
specs/001-real-time-chat/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── socket-events.yaml    # Socket.IO event contracts
│   └── rest-api.yaml         # REST API contracts (if any)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
backend/
├── src/
│   ├── models/          # User, Message, Room models
│   ├── services/        # MessageService, RoomService, StorageService
│   ├── handlers/        # Socket.IO event handlers
│   ├── routes/          # Express REST routes (if needed)
│   ├── middleware/      # Authentication, error handling
│   └── server.js        # Express + Socket.IO initialization
├── data/                # SQLite database files
├── tests/
│   ├── contract/        # Socket.IO event schema tests
│   ├── integration/     # Room switching, message persistence tests
│   └── unit/            # Service/model unit tests
└── package.json

frontend/
├── src/
│   ├── components/      # MessageList, UserPresence, RoomSelector, ChatInput
│   ├── views/           # ChatRoom.vue, Login.vue
│   ├── services/        # socket-service.js, storage-service.js
│   ├── composables/     # useMessages.js, usePresence.js
│   └── main.js          # Vue app initialization
├── tests/
│   ├── unit/            # Component unit tests
│   └── integration/     # E2E chat flow tests
└── package.json

shared/
└── types/               # Shared type definitions (JSDoc), validation schemas
```

**Structure Decision**: Web application structure (Option 2) with separate backend/ and frontend/ directories. Backend handles WebSocket connections, message persistence, and room management. Frontend provides Vue.js SPA with Socket.IO client. Shared folder contains common validation schemas and type definitions.

## Phase 0: Outline & Research

No unknowns in Technical Context - all clarifications resolved. Research focuses on best practices for chosen technologies.

**Research Tasks**:
1. Socket.IO best practices for room management and presence tracking
2. SQLite connection pooling and concurrent write handling in Node.js
3. Redis session management patterns for WebSocket authentication
4. Vue 3 Composition API patterns for real-time data binding
5. TailwindCSS component architecture for chat interfaces
6. Jest/Vitest testing strategies for Socket.IO applications

**Output**: research.md (created in Phase 0 execution below)

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

**Artifacts to Generate**:
1. **data-model.md**: User, Message, Room, Session entities with SQLite schema
2. **contracts/socket-events.yaml**: Socket.IO event contracts (join_room, send_message, user_presence, etc.)
3. **contracts/rest-api.yaml**: REST endpoints (if authentication requires separate HTTP endpoint)
4. **Contract tests**: Jest tests validating Socket.IO event payloads
5. **quickstart.md**: Manual testing steps for chat flow
6. **CLAUDE.md**: Agent context file with tech stack and recent changes

**Output**: All Phase 1 artifacts (generated below)

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs:
  - Each Socket.IO event contract → contract test task [P]
  - Each entity (User, Message, Room) → model creation task [P]
  - Each user story → integration test scenario
  - Frontend components (MessageList, RoomSelector, etc.) → component test + implementation
- Implementation tasks to make tests pass (TDD order)

**Ordering Strategy**:
- **Setup**: Project init, dependencies, linting config
- **Tests First (TDD)**: Contract tests for all Socket.IO events, integration tests for user stories
- **Backend Core**: Models (User, Message, Room) → Services → Socket.IO handlers
- **Frontend Core**: Services (socket-service) → Components (MessageList, ChatInput) → Views (ChatRoom)
- **Integration**: Connect frontend to backend, Redis session management
- **Polish**: Unit tests, performance validation, quickstart execution

**Estimated Output**: ~35-40 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Type Safety (JavaScript vs TypeScript) | Spec does not mandate TypeScript; JSDoc provides documentation without build overhead | TypeScript adds build complexity; JSDoc + ESLint strict mode provides adequate type hints for small project |
| Observability (metrics/tracing) | Spec explicitly limits to console logging (OR-001, OR-002) | Full observability (Prometheus, Jaeger) overkill for 10-user scale; console logs sufficient for debugging |
| Mobile Testing | Spec defines web browser interface (UI-011: Chrome, Firefox, Safari, Edge); mobile not mentioned | Responsive CSS provides tablet/desktop support; dedicated mobile testing deferred until mobile requirements clarified |
| Data Encryption at Rest | Spec does not require encryption; file permissions (SR-005) sufficient | Encryption adds key management complexity; public chat rooms contain no sensitive PII beyond username |
| SQLite vs JSON/text files | Spec clarified to accept SQLite as file-based database format (DP-001-003 updated) | Pure JSON/text files lack concurrent write safety, indexing, and query performance needed for <2s loads (PR-002) |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - research.md created
- [x] Phase 1: Design complete (/plan command) - data-model.md, contracts/, quickstart.md, CLAUDE.md created
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - Approach documented above
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS (re-evaluated below)
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

**Post-Design Constitution Re-Evaluation**:
- ✅ **Code Quality**: Design maintains separation of concerns (models, services, handlers, components)
- ✅ **Testing Standards**: Contract tests defined in socket-events.yaml; TDD workflow preserved
- ✅ **UX Consistency**: TailwindCSS design tokens documented; component architecture defined
- ✅ **Maintainability**: Data model with clear schemas; SQLite migrations defined
- ✅ **Security**: Input validation documented (username regex, content length, sanitization)
- **Result**: No new violations; design complies with constitution

**Data Model Refinements (Post-Review)**:
- ✅ Added `retry_count` to Message entity (tracks FR-019 retry attempts 0-3)
- ✅ Added `deleted_at` to Room entity (soft delete for FR-015; preserves messages)
- ✅ Added `last_seen_at` to User entity (persistent "last seen" timestamp for offline users)
- ✅ Added partial index `idx_rooms_active` for efficient active room queries
- ✅ Updated spec.md DP-001-003 to clarify SQLite as acceptable file-based storage
- ✅ All missing fields identified in validation review now addressed

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
