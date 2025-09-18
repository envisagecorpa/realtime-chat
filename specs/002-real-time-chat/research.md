# Technical Research: Real-time Chat System Implementation

**Research Date**: 2025-09-18
**Feature**: Real-time chat system with message history and user presence
**Research Scope**: WebSocket patterns, PostgreSQL optimization, Redis presence tracking, file upload handling, message archiving

## WebSocket Implementation Patterns

### Decision: Socket.IO with Redis Adapter

**Rationale**: Socket.IO provides essential chat features (automatic reconnection, rooms, broadcasting) with minimal development overhead. While native WebSocket offers better raw performance, Socket.IO's battle-tested features outweigh the 42-byte message overhead for chat applications.

**Technical Implementation**:
- Connection registry pattern with heartbeat mechanism (30s intervals, 45s timeout)
- Namespace + room hybrid architecture (`/chat/direct`, `/chat/groups`, `/chat/public`)
- Per-user offline message queuing with Redis lists
- Horizontal scaling with Redis cluster and sticky sessions

**Performance Targets**:
- 1000+ concurrent connections per server instance
- <50ms message delivery latency
- 10,000+ messages/second throughput

**Alternatives Considered**:
- Native WebSocket: Better performance but requires custom reconnection and room management
- SockJS: Good fallback support but smaller ecosystem than Socket.IO

## PostgreSQL Schema Optimization

### Decision: Partitioned Tables with Optimized Indexing

**Rationale**: Time-based partitioning enables efficient archiving while compound indexes optimize query performance for conversation history retrieval.

**Schema Strategy**:
- Monthly partitioning on `created_at` timestamp
- Enhanced message table with delivery status tracking
- Separate `message_read_status` table for read receipts
- BYTEA with EXTERNAL storage for file attachments up to 10MB

**Key Indexes**:
```sql
-- Message retrieval by room (most common query)
CREATE INDEX idx_messages_room_created
ON messages (chat_room_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Full-text search capability
CREATE INDEX idx_messages_content_fts
ON messages USING GIN (to_tsvector('english', content));
```

**Performance Considerations**:
- 15-20% write overhead from indexes, justified by 10x+ query improvements
- 30% storage overhead, mitigated by 30-day retention policy
- pg_partman for automated partition management

**Alternatives Considered**:
- File system storage: Complex backup/recovery, chose PostgreSQL for ACID compliance
- Large Objects: BYTEA with EXTERNAL storage performs better for 10MB files

## Redis Presence Tracking Patterns

### Decision: Multi-Pattern Hybrid Approach

**Rationale**: Different presence aspects require different Redis patterns for optimal performance and reliability.

**Implementation Strategy**:
- **Online Users**: Redis Sets with TTL (5-minute TTL, 1-minute heartbeat)
- **Detailed Status**: Hash-based storage with metadata (status, device, location)
- **Typing Indicators**: TTL-based keys with 10-second expiration
- **Session Management**: Multi-connection support with device tracking

**Data Structures**:
```typescript
// User presence with automatic cleanup
presence:user:{userId} -> Hash{status, lastSeen, device, socketId}
presence:online -> Set{userId1, userId2, ...}
typing:{roomId}:{userId} -> TTL key (10 seconds)
session:{sessionId} -> Hash{userId, socketId, connectedAt, ipAddress}
```

**Persistence Strategy**: AOF with `everysec` fsync + RDB snapshots for crash recovery

**Alternatives Considered**:
- Database-only: Too slow (>100ms latency) for real-time requirements
- In-memory only: Data loss on restart, chose Redis for persistence

## File Upload Handling

### Decision: Hybrid Cloud + Local Processing

**Rationale**: Local filesystem for validation/processing (fast, secure) with cloud storage for permanence (scalable, CDN-enabled).

**Architecture Components**:
- tus.io protocol for resumable uploads with 1MB chunks
- Multi-layer security: MIME validation, magic number checking, malware scanning
- Rate limiting: 20 uploads per hour per user
- File deduplication via SHA-256 hashing

**Storage Strategy**:
```typescript
interface FileAttachment {
  originalName: string;
  sanitizedName: string;
  size: number; // <= 10MB limit
  sha256Hash: string;
  storageProvider: 'local' | 's3' | 'cloudinary';
  publicUrl?: string;
  uploadStatus: 'pending' | 'processing' | 'completed' | 'failed';
}
```

**Integration Pattern**: WebSocket events for upload progress, automatic message creation on completion

**Alternatives Considered**:
- Database storage: Chosen for files ≤10MB for simplified backup/recovery
- Direct cloud upload: Local processing provides better security validation

## Message Archiving Automation

### Decision: PostgreSQL pg_cron with Parquet Archives

**Rationale**: Native database scheduling with columnar archive format provides optimal performance and compliance with 30-day retention.

**Automation Strategy**:
- Daily batch jobs at 2:00 AM (off-peak hours)
- Three-phase migration: snapshot → export → cleanup
- Parquet format with Snappy compression (70%+ compression ratio)
- Hierarchical directory structure: `/archives/year=2025/month=09/day=01/`

**Processing Pattern**:
```typescript
// Batch processing with resource limits
const ARCHIVE_CONFIG = {
  batchSize: 10000,
  maxConcurrency: 3,
  resourceLimits: { cpu: 25, memory: 512, connections: 2 }
};
```

**Error Handling**: Comprehensive retry strategies, dead letter queues, transaction safety with rollback

**Alternatives Considered**:
- External cron jobs: pg_cron provides better transaction safety
- JSON archives: Parquet offers better compression and query performance

## Technology Stack Decisions

### Backend Framework
**Decision**: Node.js 18+ with TypeScript, Express.js, Socket.IO
- Mature ecosystem with real-time capabilities
- TypeScript for type safety and maintainability
- Socket.IO Redis adapter for horizontal scaling

### Database Layer
**Decision**: PostgreSQL 15+ for persistence, Redis 7+ for ephemeral data
- PostgreSQL: ACID compliance, advanced indexing, partitioning support
- Redis: Sub-millisecond performance for presence and sessions

### Frontend Framework
**Decision**: React 18 with TanStack Query and Socket.IO client
- Component composition for maintainable UI
- TanStack Query for server state management
- Socket.IO client for real-time features

### Testing Strategy
**Decision**: Jest + Supertest (backend), Jest + React Testing Library (frontend)
- Comprehensive test coverage including contract tests
- TDD approach with failing tests before implementation

## Performance Benchmarks

**Concurrent Users**: 10 minimum, scaling to 1000+ per hour
**Message Latency**: <100ms delivery target
**Database Performance**: <200ms for conversation history queries
**File Upload**: Resumable uploads with progress tracking
**Memory Usage**: ~2MB per 1000 WebSocket connections

## Security Considerations

**Authentication**: JWT-based with username-only login
**Authorization**: Room-based permissions, moderator roles
**File Security**: Multi-layer validation, malware scanning, rate limiting
**Data Protection**: Encrypted WebSocket connections (WSS), secure file handling

## Implementation Roadmap

1. **Phase 1** (Weeks 1-2): Core WebSocket implementation with basic messaging
2. **Phase 2** (Weeks 3-4): Database schema, user presence, message history
3. **Phase 3** (Weeks 5-6): File upload system with security validation
4. **Phase 4** (Weeks 7-8): Message archiving automation and cleanup
5. **Phase 5** (Weeks 9-10): Performance optimization and monitoring

This research provides the technical foundation for implementing a scalable, secure, and maintainable real-time chat system that meets all specified requirements while following modern best practices.