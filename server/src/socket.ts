import { Server, Socket } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import * as Y from 'yjs';
import { pool } from './db';
import { verifySocketToken } from './auth';

interface RoomUser {
  id: number;
  username: string;
  color: string;
  cursor?: any;
  selection?: any;
}

interface ActiveRoom {
  doc: Y.Doc;
  users: Map<string, RoomUser>; // socketId -> RoomUser
  saveTimeout?: NodeJS.Timeout;
  isDirty: boolean;
}

// Active rooms cache
const activeRooms = new Map<string, ActiveRoom>();

// Generated colors for cursor differentiation
const CURSOR_COLORS = [
  '#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6',
  '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6',
  '#10b981', '#22c55e', '#84cc16', '#eab308', '#f97316'
];

function getRandomColor() {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
}

// Save document to database
async function saveRoomToDb(roomId: string, room: ActiveRoom) {
  if (!room.isDirty) return;

  try {
    const stateUpdate = Y.encodeStateAsUpdate(room.doc);
    const stateBuffer = Buffer.from(stateUpdate);
    const contentText = room.doc.getText('codetext').toString();

    await pool.query(
      `INSERT INTO room_documents (room_id, document_state, content, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (room_id)
       DO UPDATE SET document_state = EXCLUDED.document_state, content = EXCLUDED.content, updated_at = NOW()`,
      [roomId, stateBuffer, contentText]
    );

    room.isDirty = false;
    console.log(`Successfully saved document for room ${roomId} (Length: ${contentText.length} chars)`);
  } catch (error) {
    console.error(`Error saving room ${roomId} to DB:`, error);
  }
}

// Schedule lazy DB saving
function scheduleRoomSave(roomId: string, room: ActiveRoom) {
  room.isDirty = true;
  if (room.saveTimeout) return;

  room.saveTimeout = setTimeout(async () => {
    room.saveTimeout = undefined;
    await saveRoomToDb(roomId, room);
  }, 5000); // Debounce database saves every 5 seconds
}

export async function setupSocketServer(io: Server) {
  // Try to setup Redis adapter
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    console.log(`Attempting to connect to Redis at ${redisUrl}...`);
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    // Set connection timeout
    const connectPromise = Promise.all([pubClient.connect(), subClient.connect()]);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Redis connection timeout')), 3000)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Successfully initialized Socket.io Redis adapter.');
  } catch (error) {
    console.warn('Redis adapter setup failed. Falling back to local in-memory socket adapter. Details:', error);
  }

  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    const user = verifySocketToken(token);
    if (!user) {
      return next(new Error('Invalid token'));
    }
    (socket as any).user = user;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    let currentRoomId: string | null = null;

    console.log(`User connected: ${user.username} (${socket.id})`);

    // Join room
    socket.on('join-room', async (roomId: string) => {
      try {
        // Validate room exists in DB first
        const roomResult = await pool.query('SELECT id FROM rooms WHERE id = $1', [roomId]);
        if (roomResult.rows.length === 0) {
          socket.emit('room-error', 'Room does not exist');
          return;
        }

        currentRoomId = roomId;
        socket.join(roomId);

        // Fetch or create Y.Doc for this room
        let room = activeRooms.get(roomId);
        if (!room) {
          const doc = new Y.Doc();
          
          // Load document state from database
          const docResult = await pool.query(
            'SELECT document_state FROM room_documents WHERE room_id = $1',
            [roomId]
          );

          if (docResult.rows.length > 0 && docResult.rows[0].document_state) {
            const binaryState = docResult.rows[0].document_state;
            Y.applyUpdate(doc, new Uint8Array(binaryState));
            console.log(`Loaded existing document state from DB for room ${roomId}`);
          }

          room = {
            doc,
            users: new Map(),
            isDirty: false
          };
          activeRooms.set(roomId, room);
        }

        // Add user to active room
        const roomUser: RoomUser = {
          id: user.id,
          username: user.username,
          color: getRandomColor()
        };
        room.users.set(socket.id, roomUser);

        console.log(`User ${user.username} joined room: ${roomId}. Active count: ${room.users.size}`);

        // 1. Send initial full document sync to the client
        const syncUpdate = Y.encodeStateAsUpdate(room.doc);
        socket.emit('doc-sync', syncUpdate);

        // 2. Broadcast updated user list to everyone in the room
        io.to(roomId).emit('users-update', Array.from(room.users.entries()).map(([sid, u]) => ({
          socketId: sid,
          id: u.id,
          username: u.username,
          color: u.color,
          cursor: u.cursor,
          selection: u.selection
        })));

      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('room-error', 'Internal server error while joining room');
      }
    });

    // Handle document updates
    socket.on('doc-update', (update: Buffer) => {
      if (!currentRoomId) return;

      const room = activeRooms.get(currentRoomId);
      if (!room) return;

      try {
        // Apply update to server's Y.Doc
        Y.applyUpdate(room.doc, new Uint8Array(update));
        
        // Broadcast the raw update to other clients
        socket.to(currentRoomId).emit('doc-update', update);

        // Save progress to database lazily
        scheduleRoomSave(currentRoomId, room);
      } catch (err) {
        console.error('Error applying doc update:', err);
      }
    });

    // Handle user cursor moves
    socket.on('cursor-move', (cursorData: { position: any, selection: any }) => {
      if (!currentRoomId) return;

      const room = activeRooms.get(currentRoomId);
      if (!room) return;

      const roomUser = room.users.get(socket.id);
      if (!roomUser) return;

      roomUser.cursor = cursorData.position;
      roomUser.selection = cursorData.selection;

      // Broadcast cursor change
      socket.to(currentRoomId).emit('cursor-update', {
        socketId: socket.id,
        userId: roomUser.id,
        username: roomUser.username,
        color: roomUser.color,
        position: cursorData.position,
        selection: cursorData.selection
      });
    });

    // Handle chat messaging
    socket.on('chat-message', async (content: string) => {
      if (!currentRoomId || !content.trim()) return;

      try {
        // Insert message to database
        const result = await pool.query(
          `INSERT INTO messages (room_id, user_id, username, content, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING id, room_id, user_id, username, content, created_at`,
          [currentRoomId, user.id, user.username, content]
        );

        const newMessage = result.rows[0];

        // Broadcast chat event
        io.to(currentRoomId).emit('chat-message', newMessage);
      } catch (err) {
        console.error('Error sending chat message:', err);
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${user.username} (${socket.id})`);
      
      if (!currentRoomId) return;
      const room = activeRooms.get(currentRoomId);
      if (!room) return;

      // Remove user
      room.users.delete(socket.id);

      // Notify others in room
      socket.to(currentRoomId).emit('user-left', socket.id);
      
      // Update users list
      io.to(currentRoomId).emit('users-update', Array.from(room.users.entries()).map(([sid, u]) => ({
        socketId: sid,
        id: u.id,
        username: u.username,
        color: u.color,
        cursor: u.cursor,
        selection: u.selection
      })));

      // If room is empty, clear in-memory docs and flush state to DB
      if (room.users.size === 0) {
        console.log(`Room ${currentRoomId} is empty. Flushing state and clearing cache.`);
        
        // Cancel save schedule
        if (room.saveTimeout) {
          clearTimeout(room.saveTimeout);
          room.saveTimeout = undefined;
        }

        // Save immediately
        await saveRoomToDb(currentRoomId, room);
        
        // Remove from memory cache
        activeRooms.delete(currentRoomId);
      }
    });
  });
}
