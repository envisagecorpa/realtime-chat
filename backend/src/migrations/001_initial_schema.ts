import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000001 implements MigrationInterface {
  name = 'InitialSchema1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM('member', 'moderator')
    `);

    await queryRunner.query(`
      CREATE TYPE "message_type_enum" AS ENUM('text', 'system', 'file_attachment')
    `);

    await queryRunner.query(`
      CREATE TYPE "delivery_status_enum" AS ENUM('sent', 'delivered', 'failed')
    `);

    await queryRunner.query(`
      CREATE TYPE "room_type_enum" AS ENUM('direct', 'group', 'public')
    `);

    await queryRunner.query(`
      CREATE TYPE "participant_role_enum" AS ENUM('member', 'admin')
    `);

    await queryRunner.query(`
      CREATE TYPE "notification_level_enum" AS ENUM('all', 'mentions', 'none')
    `);

    await queryRunner.query(`
      CREATE TYPE "presence_status_enum" AS ENUM('online', 'away', 'offline')
    `);

    await queryRunner.query(`
      CREATE TYPE "upload_status_enum" AS ENUM('pending', 'processing', 'completed', 'failed')
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "username" varchar(50) NOT NULL UNIQUE,
        "display_name" varchar(100),
        "email" varchar(255),
        "role" "user_role_enum" NOT NULL DEFAULT 'member',
        "last_seen" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Create chat_rooms table
    await queryRunner.query(`
      CREATE TABLE "chat_rooms" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL,
        "type" "room_type_enum" NOT NULL,
        "description" varchar(500),
        "is_active" boolean NOT NULL DEFAULT true,
        "max_participants" integer NOT NULL DEFAULT 100,
        "created_by_id" uuid NOT NULL REFERENCES "users"("id"),
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Create chat_room_participants table
    await queryRunner.query(`
      CREATE TABLE "chat_room_participants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "chat_room_id" uuid NOT NULL REFERENCES "chat_rooms"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "role" "participant_role_enum" NOT NULL DEFAULT 'member',
        "joined_at" timestamptz NOT NULL DEFAULT NOW(),
        "left_at" timestamptz,
        "last_read_message_id" uuid,
        "notification_level" "notification_level_enum" NOT NULL DEFAULT 'all',
        "is_muted" boolean NOT NULL DEFAULT false,
        UNIQUE("chat_room_id", "user_id")
      )
    `);

    // Create messages table with partitioning
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "content" text,
        "message_type" "message_type_enum" NOT NULL DEFAULT 'text',
        "sender_id" uuid NOT NULL REFERENCES "users"("id"),
        "chat_room_id" uuid NOT NULL REFERENCES "chat_rooms"("id"),
        "parent_message_id" uuid REFERENCES "messages"("id"),
        "delivery_status" "delivery_status_enum" NOT NULL DEFAULT 'sent',
        "delivered_at" timestamptz,
        "edited_at" timestamptz,
        "deleted_at" timestamptz,
        "has_attachments" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "content_required_for_text" CHECK (
          ("message_type" != 'text') OR ("content" IS NOT NULL AND length(trim("content")) > 0)
        ),
        CONSTRAINT "content_length_limit" CHECK (length("content") <= 2000)
      )
    `);

    // Create message_read_status table
    await queryRunner.query(`
      CREATE TABLE "message_read_status" (
        "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "read_at" timestamptz NOT NULL DEFAULT NOW(),
        "delivered_at" timestamptz,
        PRIMARY KEY ("message_id", "user_id")
      )
    `);

    // Create user_sessions table
    await queryRunner.query(`
      CREATE TABLE "user_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "socket_id" varchar(255) NOT NULL,
        "device_info" jsonb,
        "ip_address" varchar(45),
        "user_agent" text,
        "connected_at" timestamptz NOT NULL DEFAULT NOW(),
        "last_heartbeat" timestamptz NOT NULL DEFAULT NOW(),
        "disconnected_at" timestamptz,
        "presence_status" "presence_status_enum" NOT NULL DEFAULT 'online'
      )
    `);

    // Create file_attachments table
    await queryRunner.query(`
      CREATE TABLE "file_attachments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "message_id" uuid REFERENCES "messages"("id") ON DELETE CASCADE,
        "original_name" varchar(255) NOT NULL,
        "sanitized_name" varchar(255) NOT NULL,
        "mime_type" varchar(100) NOT NULL,
        "file_size" bigint NOT NULL,
        "sha256_hash" varchar(64) NOT NULL,
        "storage_provider" varchar(20) NOT NULL,
        "storage_path" text NOT NULL,
        "public_url" text,
        "upload_status" "upload_status_enum" NOT NULL DEFAULT 'pending',
        "uploaded_by_id" uuid NOT NULL REFERENCES "users"("id"),
        "access_count" integer NOT NULL DEFAULT 0,
        "last_accessed_at" timestamptz DEFAULT NOW(),
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "expires_at" timestamptz,
        CONSTRAINT "file_size_limit" CHECK ("file_size" <= 10485760),
        CONSTRAINT "unique_file_hash" UNIQUE ("sha256_hash")
      )
    `);

    // Add foreign key constraint for last_read_message_id
    await queryRunner.query(`
      ALTER TABLE "chat_room_participants"
      ADD CONSTRAINT "fk_last_read_message"
      FOREIGN KEY ("last_read_message_id") REFERENCES "messages"("id")
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "idx_messages_room_created" ON "messages" ("chat_room_id", "created_at" DESC)
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_messages_sender_created" ON "messages" ("sender_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_participants_unread" ON "chat_room_participants" ("user_id", "last_read_message_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_user_sessions_heartbeat" ON "user_sessions" ("last_heartbeat")
      WHERE "disconnected_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_file_attachments_expires" ON "file_attachments" ("expires_at")
      WHERE "expires_at" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_messages_content_fts" ON "messages"
      USING GIN (to_tsvector('english', "content"))
      WHERE "message_type" = 'text' AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_messages_content_fts"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_file_attachments_expires"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_sessions_heartbeat"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_participants_unread"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_messages_sender_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_messages_room_created"`);

    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS "file_attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "message_read_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_room_participants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_rooms"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE IF EXISTS "upload_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "presence_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "participant_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "room_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "delivery_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "message_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}