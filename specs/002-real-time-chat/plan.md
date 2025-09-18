# Implementation Plan: Real-time Chat System with Message History and User Presence

**Branch**: `002-real-time-chat` | **Date**: 2025-09-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-real-time-chat/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Real-time chat system enabling instant messaging between users with persistent message history, user presence tracking, file sharing, and moderation capabilities. Built using WebSocket for real-time communication, PostgreSQL for message persistence, and Redis for session management.

## Technical Context
**Language/Version**: Node.js 18+ with TypeScript
**Primary Dependencies**: Express.js, Socket.IO, TypeORM, Redis client
**Storage**: PostgreSQL for message history, Redis for presence/sessions
**Testing**: Jest + Supertest (backend), Jest + React Testing Library (frontend)
**Target Platform**: Modern web browsers (Chrome 90+, Firefox 88+, Safari 14+)
**Project Type**: web - determines source structure
**Performance Goals**: Support 10-1000 concurrent users, message delivery <100ms
**Constraints**: 30-day message retention with automated archiving, 10MB file upload limit
**Scale/Scope**: 10 concurrent users minimum, scalable to 1000+ users per hour

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitutional Principles Applied**:
- **Test-First Development**: All contract tests written before implementation
- **Library-First Architecture**: WebSocket handling, message processing as independent services
- **Clear Separation**: Backend API separate from frontend React components
- **Observability**: Structured logging for message delivery, presence changes, errors

**Constitution Status**: PASS - No violations detected

## Project Structure

### Documentation (this feature)
```
specs/002-real-time-chat/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/          # TypeORM entities (User, Message, ChatRoom)
│   ├── services/        # Business logic (MessageService, PresenceService)
│   ├── api/            # REST API controllers
│   ├── socket/         # WebSocket event handlers
│   └── middleware/     # Auth, validation, error handling
└── tests/
    ├── contract/       # API contract tests
    ├── integration/    # End-to-end tests
    └── unit/          # Service unit tests

frontend/
├── src/
│   ├── components/     # React components (ChatRoom, MessageList)
│   ├── pages/         # Page components (Login, Dashboard)
│   ├── services/      # API clients, WebSocket setup
│   ├── hooks/         # Custom React hooks
│   └── types/         # TypeScript type definitions
└── tests/
    └── components/    # Component tests
```

**Structure Decision**: Option 2 - Web application with separate backend and frontend

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - WebSocket implementation patterns for scale (10-1000 users)
   - PostgreSQL schema optimization for chat history queries
   - Redis patterns for user presence and session management
   - File upload handling and storage strategies
   - Message archiving automation patterns

2. **Generate and dispatch research agents**:
   ```
   Research WebSocket scalability patterns for real-time chat applications
   Research PostgreSQL indexing strategies for chat message history
   Research Redis patterns for user presence tracking in chat systems
   Research file upload handling with 10MB limit constraints
   Research message archiving patterns for 30-day retention policies
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all technical decisions resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - User: identity, status, role (member/moderator)
   - Message: content, metadata, delivery status
   - ChatRoom: direct/group conversations
   - UserSession: connection tracking
   - MessageHistory: archival records

2. **Generate API contracts** from functional requirements:
   - REST endpoints for user management, chat rooms, file uploads
   - WebSocket events for real-time messaging, presence, typing indicators
   - Output OpenAPI schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint/event
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Real-time message delivery scenarios
   - Presence tracking validation
   - Message history retrieval tests
   - File upload boundary testing

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
   - Add Socket.IO, TypeORM, Redis technologies
   - Update project structure and commands
   - Preserve manual additions

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P]
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Models before services before UI
- Database setup before API endpoints
- Backend complete before frontend integration
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No constitutional violations identified. Architecture follows established patterns:
- Clear separation between backend/frontend
- Test-first development approach
- Service-oriented design for scalability
- Standard web application structure

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*