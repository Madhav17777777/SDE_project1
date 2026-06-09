import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { Editor } from '../components/Editor';
import { Chat } from '../components/Chat';
import { RoomHeader } from '../components/RoomHeader';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { Terminal, AlertCircle, Play, Server, Clock, HardDrive } from 'lucide-react';

interface ActiveUser {
  socketId: string;
  id: number;
  username: string;
  color: string;
}

interface RunResult {
  stdout: string;
  stderr: string;
  compile_output: string;
  message: string;
  status: { id: number; description: string };
  time?: string;
  memory?: number;
}

export const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string } | null>(null);

  // States
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [roomName, setRoomName] = useState('Loading Room...');
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  
  // Compiler Proxy States
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState('');

  // Socket & Yjs Refs
  const socketRef = useRef<Socket | null>(null);
  const yDocRef = useRef<Y.Doc | null>(null);

  // Verify auth session
  useEffect(() => {
    const token = localStorage.getItem('collab_token');
    const storedUser = localStorage.getItem('collab_user');

    if (!token || !storedUser) {
      navigate('/');
      return;
    }

    setCurrentUser(JSON.parse(storedUser));
    fetchRoomDetails(roomId!, token);
  }, [roomId, navigate]);

  const fetchRoomDetails = async (id: string, token: string) => {
    try {
      const response = await fetch(`/api/rooms/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Room not found');
      }

      const data = await response.json();
      setRoomName(data.name);
    } catch (err) {
      console.error(err);
      navigate('/dashboard');
    }
  };

  // Socket Connection management
  useEffect(() => {
    const token = localStorage.getItem('collab_token');
    if (!token || !currentUser || !roomId) return;

    // Allocate Yjs Document for this room session
    if (!yDocRef.current) {
      yDocRef.current = new Y.Doc();
    }

    // Connect WebSocket
    const socket = io(window.location.origin === 'http://localhost:5173' ? 'http://localhost:4000' : window.location.origin, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      // Join Room
      socket.emit('join-room', roomId);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // Reconnect manually if server booted the connection
        socket.connect();
      } else {
        setIsReconnecting(true);
      }
    });

    socket.on('users-update', (users: ActiveUser[]) => {
      setActiveUsers(users);
    });

    socket.on('room-error', (msg: string) => {
      alert(msg);
      navigate('/dashboard');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      if (yDocRef.current) {
        yDocRef.current.destroy();
        yDocRef.current = null;
      }
    };
  }, [roomId, currentUser, navigate]);

  const handleRunCode = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setRunResult(null);
    setRunError('');

    try {
      const token = localStorage.getItem('collab_token');
      const response = await fetch('/api/run-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code,
          language
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute code');
      }

      setRunResult(data);
    } catch (err: any) {
      setRunError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleLeaveRoom = () => {
    navigate('/dashboard');
  };

  if (!currentUser || !yDocRef.current || !socketRef.current) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center text-slate-400 gap-4">
        <div className="w-10 h-10 border-4 border-indigo-600/30 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-sm font-medium tracking-wide">Syncing environment...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col h-screen overflow-hidden">
      {/* Reconnect Banner */}
      <ConnectionBanner isConnected={isConnected} isReconnecting={isReconnecting} />

      {/* Header */}
      <RoomHeader
        roomName={roomName}
        activeUsers={activeUsers}
        language={language}
        setLanguage={setLanguage}
        onRunCode={handleRunCode}
        isRunning={isRunning}
        onLeave={handleLeaveRoom}
      />

      {/* Workspace Panel Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-4 gap-4 bg-dark-950">
        
        {/* Left Column: Chat Sidebar */}
        <div className="w-full lg:w-80 h-80 lg:h-full flex-shrink-0">
          <Chat socket={socketRef.current} roomId={roomId!} currentUser={currentUser} />
        </div>

        {/* Center/Right Area: Editor & Output Panel Stack */}
        <div className="flex-1 flex flex-col h-full gap-4 overflow-hidden">
          
          {/* Editor Container */}
          <div className="flex-1 min-h-[300px] overflow-hidden">
            <Editor
              socket={socketRef.current}
              roomId={roomId!}
              userId={currentUser.id}
              username={currentUser.username}
              language={language}
              onCodeChange={setCode}
              yDoc={yDocRef.current}
            />
          </div>

          {/* Console / Compilation Logs Panel */}
          <div className="h-60 rounded-lg bg-dark-900 border border-dark-800 flex flex-col overflow-hidden shadow-2xl">
            {/* Console Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-800 bg-dark-900/60 flex-shrink-0">
              <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>Console Logs</span>
              </div>
              {runResult && (
                <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Server className="w-3.5 h-3.5 text-indigo-400/80" />
                    Status: <span className={runResult.status.id === 3 ? 'text-emerald-450' : 'text-rose-400'}>{runResult.status.description}</span>
                  </span>
                  {runResult.time && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Time: {runResult.time}s
                    </span>
                  )}
                  {runResult.memory && (
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5" />
                      Memory: {(runResult.memory / 1024).toFixed(1)} MB
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Console Output Screen */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed selection:bg-indigo-500/20">
              {isRunning && (
                <div className="flex items-center gap-2.5 text-slate-450">
                  <div className="w-3.5 h-3.5 border-2 border-slate-500/30 border-t-slate-400 rounded-full animate-spin" />
                  <span>Spinning compile environment. Please hold...</span>
                </div>
              )}

              {runError && (
                <div className="flex items-start gap-2.5 text-rose-400 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10">
                  <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
                  <span>{runError}</span>
                </div>
              )}

              {!isRunning && !runError && !runResult && (
                <span className="text-slate-600 italic">Console is idle. Write some code and tap "Run Code" above to execute.</span>
              )}

              {runResult && (
                <div className="space-y-3">
                  {/* Compilation output errors (e.g. GCC/Java errors) */}
                  {runResult.compile_output && (
                    <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-350">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-rose-450 mb-1.5">Compilation Failure:</h4>
                      <pre className="whitespace-pre-wrap leading-5">{runResult.compile_output}</pre>
                    </div>
                  )}

                  {/* Standard Error logs */}
                  {runResult.stderr && (
                    <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-400">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-rose-450 mb-1.5">Standard Error (Runtime):</h4>
                      <pre className="whitespace-pre-wrap leading-5">{runResult.stderr}</pre>
                    </div>
                  )}

                  {/* Standard Output logs */}
                  {runResult.stdout && (
                    <div className="p-3 rounded-lg bg-dark-950/40 text-slate-200">
                      <pre className="whitespace-pre-wrap leading-5">{runResult.stdout}</pre>
                    </div>
                  )}

                  {/* Standard Output empty with success status */}
                  {!runResult.stdout && !runResult.stderr && !runResult.compile_output && (
                    <span className="text-emerald-450">Code executed successfully (no stdout/logs returned).</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
