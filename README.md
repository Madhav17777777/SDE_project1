# Real-time Collaborative Code Editor

A full-stack, real-time collaborative code editor designed for teams. Features multi-user sync, live cursors, compiler capabilities, room invites, and state persistence.

## Tech Stack
- **Frontend:** React, TypeScript, Monaco Editor, Tailwind CSS, Yjs (CRDT)
- **Backend:** Node.js, Express, Socket.io, Redis (Pub/Sub adapter), JWT
- **Databases:** PostgreSQL (rooms, chats, user credentials, document states), Redis (websockets)
- **Infrastructure:** Docker, Docker Compose, Nginx

---

## Features
1. **Real-time Editing:** Concurrent user editing with conflicts resolved locally by Yjs CRDTs.
2. **Live Cursors & Selection:** Highlights selection areas and tracks participants using dynamic dynamic CSS styles.
3. **Multi-language Compile:** Compile JavaScript, Python, C++, and Java through a proxied Judge0 API runner.
4. **Room Invites:** Unique room links easily shared via clipboard buttons.
5. **Interactive Chat:** Sidebars logs and caches chat logs in Postgres.
6. **State Persistence:** Entire room document is serialized to PostgreSQL database (`bytea` binaries) dynamically.

---

## Getting Started

### 1. Environment Configurations
Create a `.env` configuration file in `/server` directory:

```env
PORT=4000
DATABASE_URL=postgresql://postgres:postgres_password@postgres:5432/collab_editor
REDIS_URL=redis://redis:6379
JWT_SECRET=super_secret_key_change_me_in_production

# Optional: Judge0 Credentials (RapidAPI or custom)
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=YOUR_RAPIDAPI_KEY
JUDGE0_API_HOST=judge0-ce.p.rapidapi.com
```

### 2. Local Setup (Docker Compose)
Build and spin up database, Redis cache, backend server, and frontend client:

```bash
docker-compose up --build
```

- **Client Web Interface:** `http://localhost:80` (or proxy target ports)
- **Backend server:** `http://localhost:4000`
- **PostgreSQL Database:** `http://localhost:5432`

To run locally without containerizing the app servers:
1. Make sure PostgreSQL and Redis are running.
2. Install server packages and run developer server:
   ```bash
   cd server
   npm install
   npm run dev
   ```
3. Install client packages and run Vite dev server:
   ```bash
   cd ../client
   npm install
   npm run dev
   ```

---

## Deployment

To deploy the production-ready build containers using the Antigravity deployment engine, execute:

```bash
npx antigravity deploy
```

This will run tests, compile the source packages, verify connection endpoints, containerize the final bundles, and deploy the application.
