import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, Code, User, Keyboard, Hash, Calendar, ArrowRight, AlertCircle } from 'lucide-react';

interface Room {
  id: string;
  name: string;
  owner_id: number;
  owner_name?: string;
  created_at: string;
}

export const Dashboard: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [user, setUser] = useState<{ username: string; email: string } | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  // Validate session token on mount
  useEffect(() => {
    const token = localStorage.getItem('collab_token');
    const storedUser = localStorage.getItem('collab_user');

    if (!token || !storedUser) {
      handleLogout();
      return;
    }

    setUser(JSON.parse(storedUser));
    fetchRooms(token);
  }, []);

  const fetchRooms = async (token: string) => {
    try {
      const response = await fetch('/api/rooms', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch rooms');
      }
      const data = await response.json();
      setRooms(data);
    } catch (err: any) {
      console.error(err);
      setError('Could not sync workspace rooms');
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newRoomName.trim()) return;

    setCreating(true);
    try {
      const token = localStorage.getItem('collab_token');
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newRoomName }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create room');
      }

      setNewRoomName('');
      // Navigate straight to the newly created room
      navigate(`/room/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomId.trim()) return;

    // Handle full URL inputs if copy-pasted directly
    let cleanId = joinRoomId.trim();
    if (cleanId.includes('/room/')) {
      cleanId = cleanId.split('/room/')[1].split('?')[0];
    }

    navigate(`/room/${cleanId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('collab_token');
    localStorage.removeItem('collab_user');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-dark-950 p-6 md:p-12 relative overflow-hidden">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl" />

      {/* Main Container */}
      <div className="max-w-6xl mx-auto z-10 relative">
        {/* Header Bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 mb-8 border-b border-dark-850">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Developer Dashboard
            </h1>
            {user && (
              <p className="text-slate-400 mt-1 flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-400" />
                Welcome, <span className="font-semibold text-slate-300">{user.username}</span>
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 self-start md:self-auto px-4 py-2 rounded-lg bg-dark-850 hover:bg-dark-800 text-slate-350 border border-dark-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </header>

        {error && (
          <div className="flex items-center gap-2 p-4 mb-6 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-450 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Side: Room Creation & Joining utilities */}
          <div className="space-y-6">
            {/* Create Room utility */}
            <div className="glass rounded-xl p-6 shadow-xl">
              <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <span>Create Shared Workspace</span>
              </h2>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                    Room Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="E.g., Algorithms Revision"
                    className="w-full bg-dark-900 border border-dark-800 rounded-lg py-2.5 px-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-indigo-650 hover:bg-indigo-600 disabled:bg-indigo-650/50 text-white font-bold py-2.5 rounded-lg transition-colors cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  {creating ? 'Spawning...' : 'Create Room'}
                </button>
              </form>
            </div>

            {/* Join Room utility */}
            <div className="glass rounded-xl p-6 shadow-xl">
              <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-indigo-400" />
                <span>Join by Code or Link</span>
              </h2>
              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                    Invite Code / URL
                  </label>
                  <input
                    type="text"
                    required
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    placeholder="Enter short ID or invite link"
                    className="w-full bg-dark-900 border border-dark-800 rounded-lg py-2.5 px-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-750 text-white font-bold py-2.5 rounded-lg transition-colors border border-slate-700 cursor-pointer shadow-md"
                >
                  Join Room
                </button>
              </form>
            </div>
          </div>

          {/* Right Side: Available Rooms Lists */}
          <div className="lg:col-span-2">
            <div className="glass rounded-xl p-6 shadow-xl h-full flex flex-col">
              <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-400" />
                <span>Active Collaborative Rooms</span>
              </h2>

              <div className="flex-1 overflow-y-auto max-h-[500px] space-y-3 pr-2">
                {rooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 space-y-2">
                    <Code className="w-10 h-10 opacity-30 animate-pulse" />
                    <p className="text-sm">No collaborative rooms found. Create one to get started!</p>
                  </div>
                ) : (
                  rooms.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => navigate(`/room/${room.id}`)}
                      className="group flex items-center justify-between p-4 rounded-xl bg-dark-900 border border-dark-850/60 hover:border-indigo-500/35 hover:bg-dark-850/40 transition-all cursor-pointer shadow-sm"
                    >
                      <div className="flex flex-col gap-1.5">
                        <h3 className="font-semibold text-slate-200 group-hover:text-white transition-colors">
                          {room.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5 text-indigo-400/70" />
                            <code className="text-slate-400">{room.id}</code>
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            Owner: <span className="text-slate-400 font-medium">{room.owner_name || 'System'}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-450" />
                            Created: {new Date(room.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-dark-800 hover:bg-dark-750 flex items-center justify-center text-indigo-400 transition-colors group-hover:bg-indigo-650 group-hover:text-white">
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
