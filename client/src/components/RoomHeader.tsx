import React, { useState } from 'react';
import { Play, Share2, LogOut, Code2, Users, Check } from 'lucide-react';

interface ActiveUser {
  socketId: string;
  id: number;
  username: string;
  color: string;
}

interface RoomHeaderProps {
  roomName: string;
  activeUsers: ActiveUser[];
  language: string;
  setLanguage: (lang: string) => void;
  onRunCode: () => void;
  isRunning: boolean;
  onLeave: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  roomName,
  activeUsers,
  language,
  setLanguage,
  onRunCode,
  isRunning,
  onLeave,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-dark-800 bg-dark-900 shadow-md">
      {/* Title / Info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <Code2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-slate-100">{roomName}</h1>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Users className="w-3.5 h-3.5" />
            <span>{activeUsers.length} collaborator{activeUsers.length !== 1 ? 's' : ''} online</span>
          </div>
        </div>
      </div>

      {/* Online Users Avatars */}
      <div className="flex items-center gap-1.5 overflow-x-auto max-w-[250px] md:max-w-md py-1">
        {activeUsers.map((u) => (
          <div
            key={u.socketId}
            title={u.username}
            className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 relative transition-transform hover:-translate-y-0.5 cursor-help"
            style={{ borderColor: u.color }}
          >
            {getInitials(u.username)}
            {/* Color Indicator badge */}
            <span 
              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-dark-900"
              style={{ backgroundColor: u.color }}
            />
          </div>
        ))}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Language Picker */}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="bg-dark-800 hover:bg-dark-750 text-slate-200 text-sm border border-dark-750 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 transition-all font-medium cursor-pointer"
        >
          <option value="javascript">JavaScript (Node.js)</option>
          <option value="python">Python 3</option>
          <option value="java">Java (JDK 17)</option>
          <option value="cpp">C++ (GCC 9)</option>
        </select>

        {/* Share Button */}
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-800 border border-dark-750 hover:bg-dark-750 text-slate-200 text-sm font-semibold transition-all hover:text-white cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">Link Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              <span>Share Invite</span>
            </>
          )}
        </button>

        {/* Run Code Button */}
        <button
          onClick={onRunCode}
          disabled={isRunning}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/55 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-600/10 cursor-pointer"
        >
          {isRunning ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Executing...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Run Code</span>
            </>
          )}
        </button>

        {/* Leave Button */}
        <button
          onClick={onLeave}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 hover:text-rose-300 text-sm font-semibold transition-all border border-rose-500/20 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Leave</span>
        </button>
      </div>
    </header>
  );
};
