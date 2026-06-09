import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres_password@localhost:5432/collab_editor';

export const pool = new Pool({
  connectionString,
  // If running in docker, we might have slightly different configs.
  // We can add ssl config if process.env.NODE_ENV === 'production' if required.
});

export async function initDb() {
  const client = await pool.connect();
  try {
    console.log('Running database migrations...');
    await client.query('BEGIN');

    // Create Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Rooms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Room Documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS room_documents (
        room_id VARCHAR(50) PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
        document_state BYTEA,
        content TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Messages table (chat history)
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(50) REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log('Database tables verified/created successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}
