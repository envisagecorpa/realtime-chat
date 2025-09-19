import 'reflect-metadata';
import dotenv from 'dotenv';
import chatServer from './server';

// Load environment variables
dotenv.config();

// Start the chat server
chatServer.start();