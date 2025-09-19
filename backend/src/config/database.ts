import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../models/User';
import { Message } from '../models/Message';
import { ChatRoom } from '../models/ChatRoom';
import { ChatRoomParticipant } from '../models/ChatRoomParticipant';
import { MessageReadStatus } from '../models/MessageReadStatus';
import { UserSession } from '../models/UserSession';
import { FileAttachment } from '../models/FileAttachment';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USER || 'chatuser',
  password: process.env.DATABASE_PASSWORD || 'chatpass',
  database: process.env.DATABASE_NAME || 'chatdb',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: [
    User,
    Message,
    ChatRoom,
    ChatRoomParticipant,
    MessageReadStatus,
    UserSession,
    FileAttachment,
  ],
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscribers/*.ts'],
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Error during database connection:', error);
    process.exit(1);
  }
};