import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { ChatRoom } from '../models/ChatRoom';
import { ChatRoomParticipant } from '../models/ChatRoomParticipant';
import { Message } from '../models/Message';

export const seedDevData = async (): Promise<void> => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const chatRoomRepository = AppDataSource.getRepository(ChatRoom);
    const participantRepository = AppDataSource.getRepository(ChatRoomParticipant);
    const messageRepository = AppDataSource.getRepository(Message);

    console.log('Seeding development data...');

    // Create test users
    const users = await userRepository.save([
      {
        username: 'alice',
        displayName: 'Alice Johnson',
        email: 'alice@example.com',
        role: 'member',
      },
      {
        username: 'bob',
        displayName: 'Bob Smith',
        email: 'bob@example.com',
        role: 'member',
      },
      {
        username: 'charlie',
        displayName: 'Charlie Brown',
        email: 'charlie@example.com',
        role: 'member',
      },
      {
        username: 'moderator',
        displayName: 'Moderator User',
        email: 'mod@example.com',
        role: 'moderator',
      },
    ]);

    console.log('Created test users:', users.map(u => u.username));

    // Create test chat rooms
    const rooms = await chatRoomRepository.save([
      {
        name: 'General Chat',
        type: 'public',
        description: 'General discussion for everyone',
        createdBy: users[0],
      },
      {
        name: 'Development Team',
        type: 'group',
        description: 'Private group for development team',
        createdBy: users[0],
        maxParticipants: 10,
      },
      {
        name: 'Alice & Bob',
        type: 'direct',
        description: 'Direct message between Alice and Bob',
        createdBy: users[0],
        maxParticipants: 2,
      },
    ]);

    console.log('Created chat rooms:', rooms.map(r => r.name));

    // Add participants to rooms
    const participants = [];

    // General Chat - all users
    for (const user of users) {
      participants.push({
        chatRoom: rooms[0],
        user: user,
        role: user.username === 'moderator' ? 'admin' : 'member',
      });
    }

    // Development Team - Alice, Bob, Charlie
    for (let i = 0; i < 3; i++) {
      participants.push({
        chatRoom: rooms[1],
        user: users[i],
        role: i === 0 ? 'admin' : 'member',
      });
    }

    // Direct message - Alice and Bob
    participants.push(
      {
        chatRoom: rooms[2],
        user: users[0],
        role: 'member',
      },
      {
        chatRoom: rooms[2],
        user: users[1],
        role: 'member',
      }
    );

    await participantRepository.save(participants);
    console.log('Added participants to rooms');

    // Create sample messages
    const messages = await messageRepository.save([
      {
        content: 'Welcome to the general chat! 👋',
        messageType: 'text',
        sender: users[3], // moderator
        chatRoom: rooms[0],
      },
      {
        content: 'Hello everyone! Excited to be here.',
        messageType: 'text',
        sender: users[0], // alice
        chatRoom: rooms[0],
      },
      {
        content: 'Hi Alice! Welcome aboard!',
        messageType: 'text',
        sender: users[1], // bob
        chatRoom: rooms[0],
      },
      {
        content: 'Let\'s discuss the new project requirements.',
        messageType: 'text',
        sender: users[0], // alice
        chatRoom: rooms[1],
      },
      {
        content: 'Sure! I\'ve prepared some initial mockups.',
        messageType: 'text',
        sender: users[1], // bob
        chatRoom: rooms[1],
      },
      {
        content: 'Hey Bob, can we schedule a quick call?',
        messageType: 'text',
        sender: users[0], // alice
        chatRoom: rooms[2],
      },
      {
        content: 'Absolutely! How about 2 PM today?',
        messageType: 'text',
        sender: users[1], // bob
        chatRoom: rooms[2],
      },
    ]);

    console.log('Created sample messages:', messages.length);

    console.log('Development data seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding development data:', error);
    throw error;
  }
};