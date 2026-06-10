import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool } from './db';
import { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  authenticateToken, 
  AuthenticatedRequest 
} from './auth';

const router = Router();

// --- AUTH ROUTING ---

// Sign Up
router.post('/auth/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password are required' });
  }

  try {
    // Check if user exists
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash and insert
    const passwordHash = hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, passwordHash]
    );

    const newUser = result.rows[0];
    const token = generateToken(newUser);

    res.status(201).json({ token, user: newUser });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Login
router.post('/auth/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: 'Credentials and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [usernameOrEmail]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (!comparePassword(password, user.password_hash)) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const payload = { id: user.id, username: user.username, email: user.email };
    const token = generateToken(payload);

    res.json({ token, user: payload });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Me
router.get('/auth/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// --- ROOM ROUTING ---

// Create Room
router.post('/rooms', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { name } = req.body;
  const ownerId = req.user?.id;

  if (!name) {
    return res.status(400).json({ error: 'Room name is required' });
  }

  const roomId = crypto.randomBytes(4).toString('hex'); // Nice 8 character hex code

  try {
    // Insert Room
    await pool.query(
      'INSERT INTO rooms (id, name, owner_id) VALUES ($1, $2, $3)',
      [roomId, name, ownerId]
    );

    // Seed Empty Room Document State
    await pool.query(
      'INSERT INTO room_documents (room_id, document_state, content) VALUES ($1, $2, $3)',
      [roomId, null, '']
    );

    res.status(201).json({ id: roomId, name, owner_id: ownerId });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Could not create room' });
  }
});

// Get User's Rooms
router.get('/rooms', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  try {
    // List all rooms for now (since it's a shared environment) or filter by user owner
    const result = await pool.query(
      'SELECT r.*, u.username as owner_name FROM rooms r LEFT JOIN users u ON r.owner_id = u.id ORDER BY r.created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Could not retrieve rooms' });
  }
});

// Get Specific Room Info
router.get('/rooms/:roomId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { roomId } = req.params;
  try {
    const result = await pool.query(
      'SELECT r.*, u.username as owner_name FROM rooms r LEFT JOIN users u ON r.owner_id = u.id WHERE r.id = $1',
      [roomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get room info error:', error);
    res.status(500).json({ error: 'Could not check room status' });
  }
});

// Get Room Messages
router.get('/rooms/:roomId/messages', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { roomId } = req.params;
  try {
    const result = await pool.query(
      'SELECT m.*, u.username FROM messages m LEFT JOIN users u ON m.user_id = u.id WHERE m.room_id = $1 ORDER BY m.created_at ASC LIMIT 100',
      [roomId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Could not fetch room messages' });
  }
});

// --- CODE RUNNER PROXY (JUDGE0 & PISTON FALLBACK) ---

const decodeBase64 = (str?: string) => str ? Buffer.from(str, 'base64').toString('utf-8') : '';

async function runCodeWithPiston(code: string, language: string, stdin?: string) {
  let lang = language.toLowerCase();
  if (lang === 'js') lang = 'javascript';
  if (lang === 'py') lang = 'python';
  if (lang === 'c++') lang = 'cpp';

  console.log(`Running code execution fallback via Piston API for language: ${lang}`);
  
  const response = await fetch('https://emkc.org/api/v2/piston/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      language: lang,
      version: '*',
      files: [
        {
          content: code,
        },
      ],
      stdin: stdin || '',
    }),
  });

  if (!response.ok) {
    throw new Error(`Piston compiler returned error: ${await response.text()}`);
  }

  const data = (await response.json()) as any;
  const stdout = data.run.stdout || '';
  const stderr = data.run.stderr || '';
  const outputMsg = data.run.output || '';
  
  return {
    stdout: stdout,
    stderr: stderr,
    compile_output: '',
    message: outputMsg,
    status: {
      id: data.run.code === 0 ? 3 : 11, // 3: Accepted, 11: Runtime Error
      description: data.run.code === 0 ? 'Accepted' : 'Runtime Error',
    },
    time: undefined,
    memory: undefined,
  };
}

router.post('/run-code', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { code, language, stdin } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: 'Code and language are required' });
  }

  // Map user-friendly language strings to Judge0 language IDs
  // https://ce.judge0.com/languages
  let languageId = 93; // default JS Node.js 18.15.0
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
      languageId = 93; // Node.js 18.15.0
      break;
    case 'python':
    case 'py':
      languageId = 92; // Python 3.11.2
      break;
    case 'java':
      languageId = 91; // JDK 17.0.6
      break;
    case 'cpp':
    case 'c++':
      languageId = 54; // C++ (GCC 9.2.0)
      break;
    default:
      return res.status(400).json({ error: `Unsupported language: ${language}` });
  }

  const judge0Url = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
  const judge0Key = process.env.JUDGE0_API_KEY || '';
  const judge0Host = process.env.JUDGE0_API_HOST || 'judge0-ce.p.rapidapi.com';

  // Fallback immediately to Piston if the key is missing or set to placeholder
  const isKeyInvalid = !judge0Key || judge0Key === 'YOUR_RAPIDAPI_KEY';
  if (isKeyInvalid) {
    try {
      const fallbackResult = await runCodeWithPiston(code, language, stdin);
      return res.json(fallbackResult);
    } catch (err: any) {
      console.error('Piston fallback failed:', err);
      return res.status(500).json({ error: `Failed to compile/execute code: ${err.message}` });
    }
  }

  const isRapidAPI = judge0Url.includes('rapidapi.com');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (judge0Key) {
    if (isRapidAPI) {
      headers['x-rapidapi-key'] = judge0Key;
      headers['x-rapidapi-host'] = judge0Host;
    } else {
      headers['X-Auth-Token'] = judge0Key;
    }
  }

  try {
    const bodyPayload = {
      source_code: Buffer.from(code).toString('base64'),
      language_id: languageId,
      stdin: stdin ? Buffer.from(stdin).toString('base64') : '',
    };

    console.log(`Forwarding run request to Judge0 at ${judge0Url} with language_id: ${languageId}`);

    // Request code execution with sync wait
    const response = await fetch(`${judge0Url}/submissions?base64_encoded=true&wait=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Judge0 submission failed:', errorText);

      // If key issue is returned by RapidAPI (401/403 or message), fallback to Piston
      if (response.status === 401 || response.status === 403 || errorText.includes('Invalid API key') || errorText.includes('API key')) {
        console.log('RapidAPI returned key auth error. Falling back to Piston API.');
        const fallbackResult = await runCodeWithPiston(code, language, stdin);
        return res.json(fallbackResult);
      }

      return res.status(response.status).json({ error: `Code compiler returned error: ${errorText}` });
    }

    const data = (await response.json()) as any;
    
    // Decode output fields
    const output = {
      stdout: decodeBase64(data.stdout),
      stderr: decodeBase64(data.stderr),
      compile_output: decodeBase64(data.compile_output),
      message: decodeBase64(data.message),
      status: data.status, // { id, description }
      time: data.time,
      memory: data.memory,
    };

    res.json(output);
  } catch (error: any) {
    console.error('Error running code through Judge0 proxy:', error);
    // If Judge0 fetch itself fails (e.g. network/dns error), fallback to Piston as last resort
    try {
      console.log('Network error contacting Judge0. Falling back to Piston API.');
      const fallbackResult = await runCodeWithPiston(code, language, stdin);
      return res.json(fallbackResult);
    } catch (fallbackErr: any) {
      res.status(500).json({ error: `Failed to compile/execute code: ${error.message} (Fallback failed: ${fallbackErr.message})` });
    }
  }
});

export default router;
