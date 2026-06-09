import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db';
import router from './routes';
import { setupSocketServer } from './socket';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust to specific frontend URL in production if needed
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', router);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

async function main() {
  try {
    // 1. Initialize PostgreSQL database tables
    await initDb();

    // 2. Set up WebSockets with Socket.io
    await setupSocketServer(io);

    // 3. Start server
    server.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`🚀 Collaborative Editor server listening on PORT: ${PORT}`);
      console.log(`==================================================`);
    });
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
}

main();
