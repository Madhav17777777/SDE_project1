import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Send, MessageSquare } from 'lucide-react';

interface ChatMessage {
  id?: number;
  room_id: string;
  user_id?: number;
  username: string;
  content: string;
  created_at: string;
}

interface ChatProps {
  socket: Socket;
  roomId: string;
  currentUser: { id: number; username: string };
}

export const Chat: React.FC<ChatProps> = ({ socket, roomId, currentUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial chat logs from database
  useEffect(() => {
    const fetchChatLogs = async () => {
      try {
        const token = localStorage.getItem('collab_token');
        const response = await fetch(`/api/rooms/${roomId}/messages`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const logs = await response.json();
          setMessages(logs);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };

    fetchChatLogs();

    // Listen to real-time incoming chat messages
    const handleNewMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('chat-message', handleNewMessage);

    return () => {
      socket.off('chat-message', handleNewMessage);
    };
  }, [socket, roomId]);

  // Scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    socket.emit('chat-message', newMessage);
    setNewMessage('');
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col h-full border border-dark-800 rounded-lg bg-dark-900 overflow-hidden shadow-2xl">
      {/* Chat Header */}
      <div className="flex items-center gap-2 p-4 border-b border-dark-800 bg-dark-900/60">
        <MessageSquare className="w-5 h-5 text-indigo-400" />
        <h3 className="font-semibold text-slate-200">Room Chat</h3>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 space-y-2">
            <MessageSquare className="w-8 h-8 opacity-40" />
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.username === currentUser.username;
            return (
              <div key={index} className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                {/* Avatar Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ${
                  isMe ? 'bg-indigo-600' : 'bg-slate-700'
                }`}>
                  {getInitials(msg.username)}
                </div>

                {/* Message Bubble */}
                <div className="flex flex-col max-w-[75%]">
                  <div className={`flex items-center gap-1.5 text-xs text-slate-400 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="font-medium text-slate-350">{msg.username}</span>
                    <span className="text-[10px] opacity-70">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                    isMe 
                      ? 'bg-indigo-600/90 text-white rounded-tr-none' 
                      : 'bg-dark-800 text-slate-200 rounded-tl-none border border-dark-750'
                  }`}>
                    <p className="break-all whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Form */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-dark-800 bg-dark-900/60 flex items-center gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Send a message..."
          className="flex-1 bg-dark-800 hover:bg-dark-750 focus:bg-dark-750 text-slate-200 border border-dark-750 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-55 disabled:hover:bg-indigo-600 text-white flex items-center justify-center transition-colors shadow-lg cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
