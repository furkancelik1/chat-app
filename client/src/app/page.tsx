'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '../store/useChatStore';
import { useSocket } from '../context/SocketContext';
import api from '../lib/api';

import NotificationManager from '../components/NotificationManager';
import EmojiPicker from 'emoji-picker-react';
import { Moon, Sun, Search, MoreVertical, Phone, Video, Smile, Paperclip, Send, ArrowLeft, Check, CheckCheck, Pencil, Trash2, Reply, Users, MessageSquare, UserCircle2, X, ChevronDown, Mic, Loader2 } from 'lucide-react';

// Helper: string'e dönüştür (ObjectId vs string karşılaştırması için)
function toStr(val: any): string {
  if (!val) return '';
  if (typeof val === 'object' && val._id) return val._id.toString();
  return val.toString();
}

// Helper: zaman formatla
function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatLastSeen(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function Home() {
  const router = useRouter();
  const {
    user, rooms, activeRoom, messages, onlineUsers,
    setRooms, setActiveRoom, clearUnread, updateMessage,
    addMessage, setMessages, updateUser, updateMessagesRead, theme, setTheme,
    updateParticipantStatus, updateMessagesDelivered, wallpaper, setWallpaper
  } = useChatStore();
  const { socket } = useSocket();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<{ _id: string, username: string }[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const WALLPAPER_OPTIONS = [
    { name: 'Default Dark', value: "url('/chat-bg.png')" },
    { name: 'Solid Dark', value: "none" },
    { name: 'Midnight Blue', value: "linear-gradient(to right bottom, #1e3a8a, #312e81)" },
    { name: 'Emerald Forest', value: "linear-gradient(to top right, #047857, #064e3b)" },
    { name: 'Deep Purple', value: "linear-gradient(to right, #4c1d95, #7e22ce)" },
    { name: 'Abyss', value: "linear-gradient(135deg, #1f2937, #111827)" },
    { name: 'Royal', value: "radial-gradient(circle, #5b21b6, #312e81)" }
  ];

  const typingTimerRef = useRef<any>(null);

  // Auth
  useEffect(() => {
    if (!user) router.push('/login');
  }, [user, router]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('typing', ({ username }: { username: string }) => {
      setTypingUsers(prev => [...new Set([...prev, username])]);
    });
    socket.on('stop_typing', ({ username }: { username: string }) => {
      setTypingUsers(prev => prev.filter(u => u !== username));
    });
    socket.on('message_updated', (message: any) => {
      updateMessage(message);
    });
    socket.on('messages_read', ({ messageIds, readByUserId }: { roomId: string, messageIds: string[], readByUserId: string }) => {
      updateMessagesRead(messageIds, readByUserId);
    });
    socket.on('messages_delivered', ({ messageIds, deliveredToUserId }: { roomId: string, messageIds: string[], deliveredToUserId: string }) => {
      updateMessagesDelivered(messageIds, deliveredToUserId);
    });
    socket.on('user_offline', ({ userId, lastSeen }: { userId: string, lastSeen: string }) => {
      updateParticipantStatus(userId, lastSeen);
    });

    return () => {
      socket.off('typing');
      socket.off('stop_typing');
      socket.off('message_updated');
      socket.off('messages_read');
      socket.off('messages_delivered');
      socket.off('user_offline');
    };
  }, [socket, updateMessage, updateMessagesRead, updateMessagesDelivered, updateParticipantStatus]);

  // Typing emitter with debounce
  const handleTyping = useCallback(() => {
    if (!activeRoom || !socket) return;
    socket.emit('typing', activeRoom.name);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit('stop_typing', activeRoom.name);
    }, 2000);
  }, [activeRoom, socket]);

  // Auto-scroll + mark as read
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (activeRoom && socket) {
      socket.emit('mark_as_read', activeRoom.name);
    }
  }, [messages, activeRoom, socket]);

  // Fetch rooms
  useEffect(() => {
    if (!user || !socket) return;
    api.get('/rooms', { headers: { Authorization: `Bearer ${user.token}` } }).then(res => {
      setRooms(res.data);
      res.data.forEach((r: any) => socket.emit('join_room', r.name));
    }).catch(console.error);
  }, [user, socket, setRooms]);

  // --- Voice Recording Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        setRecordingTime(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      };

      mediaRecorder.start();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone.');
    }
  };

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        clearInterval(recordingTimerRef.current);
        setIsRecording(false);
        setIsUploadingAudio(true);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop()); // Stop mic light

        if (audioBlob.size > 0 && activeRoom) {
          try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'voice-message.webm');

            const res = await api.post('/upload', formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
                Authorization: `Bearer ${user?.token}`
              }
            });

            socket?.emit('message', {
              room: activeRoom.name,
              content: 'Sent a voice message',
              type: 'audio',
              fileUrl: res.data.fileUrl
            });
          } catch (err) {
            console.error('Failed to upload audio:', err);
            alert('Failed to send voice message');
          }
        }
        setIsUploadingAudio(false);
      };
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        clearInterval(recordingTimerRef.current);
        setIsRecording(false);
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !input.trim() || !activeRoom || !socket) return;
    setShowEmojiPicker(false);

    if (editingMessage) {
      api.put(`/messages/${editingMessage._id}`, { content: input }, {
        headers: { Authorization: `Bearer ${user.token}` }
      }).then(res => {
        updateMessage(res.data);
        setEditingMessage(null);
        setInput('');
      }).catch(() => alert('Failed to edit message'));
    } else {
      socket.emit('message', {
        room: activeRoom.name,
        content: input,
        replyTo: replyingTo ? replyingTo._id : null
      });
      setReplyingTo(null);
      setInput('');
    }
    inputRef.current?.focus();
  };

  const handleJoinRoom = (room: any) => {
    clearUnread(room.name);
    clearUnread(room._id);
    setActiveRoom(room);
    setShowSidebar(false);
    setShowChatSearch(false);
    setChatSearchQuery('');
    setShowChatOptions(false);
    socket?.emit('join_room', room.name);
    socket?.emit('mark_as_delivered', room.name);
    socket?.emit('mark_as_read', room.name);
  };

  // Filtreli odalar (son mesaj dahil)
  const getRoomMessages = (roomName: string) => {
    return messages.filter(m => m.room === roomName);
  };
  const getLastMessage = (roomName: string) => {
    const msgs = getRoomMessages(roomName);
    return msgs[msgs.length - 1] || null;
  };

  const filteredRooms = rooms.filter(r => {
    if (!searchQuery) return true;
    const label = r.type === 'private'
      ? (r.participants?.find((p: any) => toStr(p._id || p) !== user?._id)?.username || r.name)
      : r.name;
    return label.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Sidebar'daki oda rengi
  const isOnline = (userId: string) => onlineUsers.some(u => u.id === userId);

  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
      <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
    </div>
  );

  // Aktif odadaki mesajları getir
  let activeMessages = activeRoom
    ? messages.filter(m => m.room === activeRoom.name)
    : [];

  if (chatSearchQuery) {
    activeMessages = activeMessages.filter(m =>
      m.content?.toLowerCase().includes(chatSearchQuery.toLowerCase())
    );
  }

  // Utils for formatting last seen dates
  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `last seen today at ${timeStr}`;
    const dateStr = date.toLocaleDateString();
    return `last seen ${dateStr} at ${timeStr}`;
  };

  // Header bilgisi
  const getHeaderInfo = () => {
    if (!activeRoom) return { name: '', subtitle: '', isOnlineUser: false };
    if (activeRoom.type === 'private') {
      const other = activeRoom.participants?.find((p: any) => toStr(p._id || p) !== user._id) as any;
      const otherName = other?.username || 'Unknown';
      const otherId = other?._id || other;
      const online = isOnline(toStr(otherId));
      let subtitle = online ? 'online' : '';
      if (!online && other?.lastSeen) {
        subtitle = formatLastSeen(other.lastSeen);
      }
      return { name: otherName, subtitle, isOnlineUser: online, avatar: other?.avatarUrl };
    }
    if (activeRoom.type === 'group') {
      const count = activeRoom.participants?.length || 0;
      return { name: activeRoom.name, subtitle: `${count} participants`, isOnlineUser: false };
    }
    return { name: `# ${activeRoom.name}`, subtitle: activeRoom.description || '', isOnlineUser: false };
  };
  const headerInfo = getHeaderInfo();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
      <NotificationManager />

      {/* ========== SIDEBAR ========== */}
      <div className={`
        ${showSidebar ? 'flex' : 'hidden'} md:flex
        w-full md:w-[380px] lg:w-[400px]
        bg-gray-50 dark:bg-slate-950 flex-col shrink-0
        border-r border-gray-200 dark:border-white/10
      `}>

        {/* Sidebar Header */}
        <div className="px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <button onClick={() => setShowProfileModal(true)} className="shrink-0 touch-manipulation">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Me" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-[#6b7280] flex items-center justify-center text-gray-900 dark:text-white font-bold text-lg">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
            </button>
            <span className="text-gray-900 dark:text-white font-semibold text-base hidden sm:block">{user.username}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition touch-manipulation"
            >
              <Search size={20} />
            </button>
            <button
              onClick={() => setShowGroupModal(true)}
              className="p-2 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition touch-manipulation"
              title="New Group"
            >
              <Users size={20} />
            </button>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition touch-manipulation"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="px-3 py-2 bg-gray-50 dark:bg-slate-950">
            <div className="flex items-center bg-white/80 dark:bg-white dark:bg-slate-900/80 backdrop-blur-md rounded-2xl px-3 gap-2">
              <Search size={16} className="text-gray-600 dark:text-slate-300 shrink-0" />
              <input
                type="text"
                placeholder="Search or start new chat"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent py-2 text-sm text-gray-900 dark:text-white placeholder-[#8696a0] focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-gray-600 dark:text-slate-300"><X size={16} /></button>
              )}
            </div>
          </div>
        )}

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">

          {/* AI Bot - pinned */}
          <button
            onClick={() => handleJoinRoom({ _id: 'ai-chat', name: 'ai-chat', description: 'Chat with AI', type: 'public' })}
            className={`w-full flex items-center px-3 py-3 gap-3 hover:bg-gray-200 dark:hover:bg-white/10 transition-all duration-300 ease-in-out hover:scale-[1.02] touch-manipulation ${activeRoom?.name === 'ai-chat' ? 'bg-gray-100/80 dark:bg-white dark:bg-slate-800/80 backdrop-blur-sm' : ''}`}
          >
            <div className="h-12 w-12 rounded-full bg-purple-600 flex items-center justify-center text-2xl shrink-0">🤖</div>
            <div className="flex-1 min-w-0 text-left border-b border-gray-200 dark:border-white/10 pb-3">
              <div className="flex justify-between items-baseline">
                <span className="text-gray-900 dark:text-white font-medium text-sm">AI Bot</span>
                <span className="text-gray-500 dark:text-slate-400 text-xs shrink-0 ml-2">
                  {getLastMessage('ai-chat') ? formatLastSeen(getLastMessage('ai-chat')!.createdAt) : ''}
                </span>
              </div>
              <div className="flex justify-between items-center mt-0.5">
                <span className="text-gray-500 dark:text-slate-400 text-xs truncate">Ask me anything...</span>
              </div>
            </div>
          </button>

          {/* All rooms (public, group, private) merged into one list */}
          {filteredRooms.map((room) => {
            const isPrivate = room.type === 'private';
            const isGroup = room.type === 'group';
            const other = isPrivate
              ? room.participants?.find((p: any) => toStr(p._id || p) !== user._id) as any
              : null;
            const label = isPrivate
              ? (other?.username || 'Unknown')
              : room.name;
            const otherId = other?._id || other;
            const online = isPrivate && isOnline(toStr(otherId));
            const lastMsg = getLastMessage(room.name);
            const lastMsgText = lastMsg
              ? (lastMsg.isDeleted ? 'Message deleted' : lastMsg.type === 'image' ? '📷 Image' : lastMsg.content)
              : (room.description || '');
            const unread = room.unreadCount || 0;
            const isActive = activeRoom?._id === room._id;

            return (
              <button
                key={room._id}
                onClick={() => handleJoinRoom(room)}
                className={`w-full flex items-center px-3 py-3 gap-3 hover:bg-gray-200 dark:hover:bg-white/10 transition-all duration-300 ease-in-out hover:scale-[1.02] touch-manipulation ${isActive ? 'bg-gray-100/80 dark:bg-white dark:bg-slate-800/80 backdrop-blur-sm' : ''}`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  {isPrivate && other?.avatarUrl ? (
                    <img src={other.avatarUrl} alt={label} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center text-gray-900 dark:text-white font-bold text-lg
                      ${isGroup ? 'bg-[#6b7280]' : 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]'}`}>
                      {isGroup ? <Users size={22} className="text-white" /> : label.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-950" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left border-b border-gray-200 dark:border-white/10 pb-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-gray-900 dark:text-white font-medium text-sm truncate mr-2">{label}</span>
                    <span className={`text-xs shrink-0 ${unread > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-slate-400'}`}>
                      {lastMsg ? formatLastSeen(lastMsg.createdAt) : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-gray-500 dark:text-slate-400 text-xs truncate mr-2">{lastMsgText}</span>
                    {unread > 0 && (
                      <span className="shrink-0 min-w-[20px] h-5 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {filteredRooms.length === 0 && searchQuery && (
            <div className="text-center text-gray-500 dark:text-slate-400 text-sm py-12">No chats found</div>
          )}

          {/* Online Users Section */}
          {onlineUsers.filter(u => u.id !== user._id).length > 0 && !searchQuery && (
            <div className="mt-2">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Online — {onlineUsers.filter(u => u.id !== user._id).length}
              </div>
              {onlineUsers.filter(u => u.id !== user._id).map(u => (
                <button
                  key={u.id}
                  onClick={() => {
                    api.post('/rooms', { type: 'private', participants: [user._id, u.id] }, {
                      headers: { Authorization: `Bearer ${user.token}` }
                    }).then(res => {
                      const room = res.data;
                      if (!rooms.find(r => r._id === room._id)) setRooms([...rooms, room]);
                      handleJoinRoom(room);
                    }).catch(() => alert('Failed to start chat'));
                  }}
                  className="w-full flex items-center px-3 py-2.5 gap-3 hover:bg-gray-200 dark:hover:bg-white/10 transition-all duration-300 ease-in-out hover:scale-[1.02] touch-manipulation"
                >
                  <div className="relative shrink-0">
                    <div className="h-10 w-10 rounded-full bg-[#6b7280] flex items-center justify-center text-gray-900 dark:text-white font-bold">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-950" />
                  </div>
                  <span className="text-[#d1d7db] text-sm">{u.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ========== CHAT AREA ========== */}
      <div className={`${showSidebar ? 'hidden' : 'flex'} md:flex flex-1 flex-col min-w-0 bg-[#0b141a]`}
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'400\'%3E%3C/svg%3E")' }}
      >
        {activeRoom ? (
          <>
            {/* Chat Header */}
            <div className="px-3 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between shadow-sm z-10 w-full">
              <div className="flex items-center gap-3">
                <button
                  className="md:hidden p-1 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white touch-manipulation"
                  onClick={() => setShowSidebar(true)}
                >
                  <ArrowLeft size={22} />
                </button>

                {/* Avatar */}
                <div className="relative">
                  {activeRoom.type === 'private' && (headerInfo as any).avatar ? (
                    <img src={(headerInfo as any).avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-gray-900 dark:text-white font-bold
                      ${activeRoom.type === 'group' ? 'bg-[#6b7280]' : activeRoom.name === 'ai-chat' ? 'bg-purple-600' : 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]'}`}>
                      {activeRoom.name === 'ai-chat' ? '🤖' :
                        activeRoom.type === 'group' ? <Users size={18} className="text-white" /> :
                          headerInfo.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {headerInfo.isOnlineUser && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-200 dark:border-white/10" />
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="text-gray-900 dark:text-white font-semibold text-sm leading-tight truncate">{headerInfo.name}</h2>
                  {headerInfo.subtitle && (
                    <p className="text-gray-500 dark:text-slate-400 text-xs truncate">{headerInfo.subtitle}</p>
                  )}
                  {typingUsers.length > 0 && (
                    <p className="text-indigo-600 dark:text-indigo-400 text-xs animate-pulse truncate">
                      {typingUsers.join(', ')} typing...
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  onClick={() => { setShowChatSearch(!showChatSearch); setShowChatOptions(false); }}
                  className={`p-2 rounded-full transition touch-manipulation ${showChatSearch ? 'text-gray-900 dark:text-white bg-gray-200 dark:bg-white/10' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10'}`}
                >
                  <Search size={20} />
                </button>
                <div className="relative">
                  <button
                    onClick={() => { setShowChatOptions(!showChatOptions); setShowChatSearch(false); }}
                    className={`p-2 rounded-full transition touch-manipulation ${showChatOptions ? 'text-gray-900 dark:text-white bg-gray-200 dark:bg-white/10' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10'}`}
                  >
                    <MoreVertical size={20} />
                  </button>
                  {showChatOptions && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowChatOptions(false)}></div>
                      <div className="absolute top-12 right-0 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                        <button
                          onClick={() => { setShowWallpaperModal(true); setShowChatOptions(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-colors border-b border-gray-200 dark:border-white/10"
                        >
                          Change wallpaper
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to clear this chat?')) {
                              api.delete(`/messages/room/${activeRoom.name}`, { headers: { Authorization: `Bearer ${user.token}` } })
                                .then(() => { setMessages(messages.filter(m => m.room !== activeRoom.name)); setShowChatOptions(false); })
                                .catch(() => alert('Failed to clear chat'));
                            }
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:text-white transition-colors"
                        >
                          Clear chat
                        </button>
                        {activeRoom.type === 'group' && (
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to leave this group?')) {
                                api.post(`/rooms/${activeRoom._id}/leave`, {}, { headers: { Authorization: `Bearer ${user.token}` } })
                                  .then(() => {
                                    setRooms(rooms.filter(r => r._id !== activeRoom._id));
                                    setActiveRoom(null);
                                    setShowChatOptions(false);
                                  })
                                  .catch(() => alert('Failed to leave group'));
                              }
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            Leave group
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* In-chat Search Bar */}
            {showChatSearch && (
              <div className="px-3 py-2 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-white/10 shadow-sm z-10 transition-all">
                <div className="flex items-center bg-gray-50 dark:bg-slate-950 rounded-lg px-3 gap-2">
                  <Search size={16} className="text-gray-500 dark:text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search messages..."
                    value={chatSearchQuery}
                    onChange={e => setChatSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none border-none"
                    autoFocus
                  />
                  {chatSearchQuery && (
                    <button onClick={() => setChatSearchQuery('')} className="text-gray-500 dark:text-slate-400 hover:text-slate-200">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className={`flex-1 overflow-y-auto px-4 py-3 space-y-1 ${wallpaper === 'none' ? 'bg-gray-100 dark:bg-slate-900' : ''}`} style={wallpaper !== 'none' ? { backgroundImage: wallpaper, backgroundSize: wallpaper.includes('url') ? 'auto' : 'cover' } : {}}>
              {activeMessages.map((msg, idx) => {
                const senderIdStr = toStr(typeof msg.sender === 'object' ? (msg.sender as any)._id : msg.sender);
                const isMe = senderIdStr === user._id;
                const isBot = senderIdStr === '666666666666666666666666';

                // Sender name
                let senderObj: any = null;
                if (typeof msg.sender === 'object') senderObj = msg.sender;
                else if (activeRoom.participants) senderObj = activeRoom.participants.find((p: any) => toStr(p._id || p) === senderIdStr);
                if (!senderObj) senderObj = onlineUsers.find(ou => ou.id === senderIdStr);
                const senderName = isMe ? user.username : (isBot ? 'AI Bot' : (senderObj?.username || `User ${senderIdStr.slice(-4)}`));

                // Check status: readBy array vs user._id
                const readByOthers = msg.readBy
                  ? msg.readBy.filter(id => toStr(id) !== user._id).length > 0
                  : false;

                const deliveredToOthers = msg.deliveredTo
                  ? msg.deliveredTo.filter(id => toStr(id) !== user._id).length > 0
                  : false;

                // Aynı sender arka arkaya mı?
                const prevMsg = idx > 0 ? activeMessages[idx - 1] : null;
                const sameSenderAsPrev = prevMsg && toStr(typeof prevMsg.sender === 'object' ? (prevMsg.sender as any)._id : prevMsg.sender) === senderIdStr;

                if (msg.isDeleted) {
                  return (
                    <div key={msg._id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                      <div className={`flex items-center gap-1 px-3 py-2 rounded-2xl text-xs italic text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-white/10
                        ${isMe ? 'bg-indigo-600 shadow-md border border-indigo-500/30' : 'bg-white/80 dark:bg-white dark:bg-slate-900/80 backdrop-blur-md'}`}>
                        <Trash2 size={12} />
                        This message was deleted
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg._id || idx} className={`group flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2 ${sameSenderAsPrev ? 'mt-0.5' : 'mt-2'}`}>

                    {/* Avatar (others only, show on first of group) */}
                    {!isMe && (
                      <div className="shrink-0 w-8 self-end">
                        {!sameSenderAsPrev ? (
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-gray-900 dark:text-white
                            ${isBot ? 'bg-purple-500' : 'bg-[#6b7280]'}`}>
                            {isBot ? '🤖' : senderName.charAt(0).toUpperCase()}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`relative max-w-[80%] sm:max-w-[65%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {/* Message action buttons (hover) */}
                      <div className={`absolute -top-9 ${isMe ? 'right-0' : 'left-8'} hidden group-hover:flex gap-0.5 bg-white/95 dark:bg-white dark:bg-slate-800/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 shadow-2xl border border-gray-200 dark:border-white/10 shadow-lg rounded-2xl p-1 z-20 items-center`}>
                        {['👍', '❤️', '😂', '😮', '😢'].map(emoji => (
                          <button key={emoji} onClick={() => {
                            api.post(`/messages/${msg._id}/react`, { emoji }, {
                              headers: { Authorization: `Bearer ${user?.token}` }
                            }).then(res => updateMessage(res.data)).catch(() => { });
                          }} className="text-base hover:scale-125 transition-transform p-1 touch-manipulation">{emoji}</button>
                        ))}
                        <div className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-0.5" />
                        <button onClick={() => setReplyingTo(msg)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-600 dark:text-slate-300 touch-manipulation" title="Reply">
                          <Reply size={14} />
                        </button>
                        {isMe && (
                          <>
                            <button onClick={() => { setEditingMessage(msg); setInput(msg.content); inputRef.current?.focus(); }}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-600 dark:text-slate-300 touch-manipulation" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => {
                              if (confirm('Delete this message?')) {
                                api.delete(`/messages/${msg._id}`, { headers: { Authorization: `Bearer ${user?.token}` } })
                                  .catch(() => alert('Failed to delete'));
                              }
                            }} className="p-1.5 hover:bg-red-900/30 rounded text-red-400 touch-manipulation" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>

                      <div className={`relative px-3 py-1.5 rounded-2xl shadow-sm text-sm
                        ${isMe
                          ? 'bg-indigo-600 shadow-md border border-indigo-500/30 text-gray-800 dark:text-slate-100 rounded-tr-none'
                          : 'bg-white/80 dark:bg-white dark:bg-slate-900/80 backdrop-blur-md text-gray-800 dark:text-slate-100 rounded-tl-none'
                        }
                        ${sameSenderAsPrev && !isMe ? 'rounded-tl-lg' : ''}
                        ${sameSenderAsPrev && isMe ? 'rounded-tr-lg' : ''}
                      `}>
                        {/* Sender name in groups */}
                        {!isMe && !sameSenderAsPrev && (activeRoom.type === 'group' || activeRoom.type === 'public') && (
                          <div className="text-[11px] font-semibold mb-0.5 text-indigo-600 dark:text-indigo-400">{senderName}</div>
                        )}

                        {/* Reply block */}
                        {msg.replyTo && (
                          <div className={`mb-1.5 px-2 py-1 rounded border-l-[3px] text-xs ${isMe ? 'border-indigo-500 bg-indigo-900/40 border-indigo-500/50' : 'border-[#8696a0] bg-white dark:bg-gray-100/50 dark:bg-slate-900/50'}`}>
                            <div className="font-semibold text-indigo-600 dark:text-indigo-400 text-[11px] mb-0.5">
                              {typeof msg.replyTo === 'object' ? (msg.replyTo as any).sender?.username || 'Reply' : 'Reply'}
                            </div>
                            <div className="text-gray-500 dark:text-slate-400 truncate text-[11px]">
                              {typeof msg.replyTo === 'object' ? (msg.replyTo as any).content : '...'}
                            </div>
                          </div>
                        )}

                        {/* Image / Audio / Text */}
                        {msg.type === 'image' && msg.fileUrl ? (
                          <img
                            src={msg.fileUrl}
                            alt="Shared"
                            className="max-w-full rounded-xl mb-1 cursor-pointer hover:opacity-90 transition max-h-64 object-cover"
                            onClick={() => window.open(msg.fileUrl, '_blank')}
                          />
                        ) : msg.type === 'audio' && msg.fileUrl ? (
                          <audio controls src={msg.fileUrl} className="max-w-[200px] sm:max-w-[250px] mb-1" />
                        ) : (
                          <p className="whitespace-pre-wrap break-words leading-relaxed">
                            {msg.content}
                            {msg.isEdited && <span className="text-[10px] opacity-50 ml-1">(edited)</span>}
                          </p>
                        )}

                        {/* Time + Ticks */}
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="text-[10px] text-gray-500 dark:text-slate-400">{formatTime(msg.createdAt)}</span>
                          {isMe && (
                            readByOthers ? (
                              <CheckCheck size={16} className="text-sky-400 shrink-0" />
                            ) : deliveredToOthers ? (
                              <CheckCheck size={16} className="text-gray-500 dark:text-slate-400 shrink-0" />
                            ) : (
                              <Check size={16} className="text-gray-500 dark:text-slate-400 shrink-0" />
                            )
                          )}
                        </div>

                        {/* Reactions */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {msg.reactions.map((r, i) => {
                              const hasReacted = r.users.some(uid => toStr(uid) === user._id);
                              return (
                                <button key={i} onClick={() => {
                                  api.post(`/messages/${msg._id}/react`, { emoji: r.emoji }, {
                                    headers: { Authorization: `Bearer ${user?.token}` }
                                  }).then(res => updateMessage(res.data)).catch(() => { });
                                }}
                                  className={`text-[11px] px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 transition-all duration-300 ease-in-out hover:scale-[1.02] touch-manipulation
                                    ${hasReacted ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]/20 border-indigo-500/50' : 'bg-white dark:bg-gray-100/50 dark:bg-slate-900/50 border-gray-200 dark:border-white/10'}`}>
                                  <span>{r.emoji}</span>
                                  <span className="font-semibold text-gray-800 dark:text-slate-100">{r.users.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-2 py-2 sm:px-4 sm:py-3 bg-white/80 dark:bg-white dark:bg-slate-900/80 backdrop-blur-md">
              {/* Reply preview */}
              {replyingTo && (
                <div className="flex items-center justify-between bg-gray-100/80 dark:bg-white dark:bg-slate-800/80 backdrop-blur-sm px-3 py-2 mb-2 rounded-2xl border-l-4 border-indigo-500">
                  <div className="min-w-0 mr-2">
                    <div className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                      {toStr(typeof replyingTo.sender === 'object' ? (replyingTo.sender as any)._id : replyingTo.sender) === user._id ? 'You' : 'Reply'}
                    </div>
                    <div className="text-gray-500 dark:text-slate-400 text-xs truncate">{replyingTo.content}</div>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white shrink-0 p-1 touch-manipulation">
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Edit preview */}
              {editingMessage && (
                <div className="flex items-center justify-between bg-gray-100/80 dark:bg-white dark:bg-slate-800/80 backdrop-blur-sm px-3 py-2 mb-2 rounded-2xl border-l-4 border-yellow-500">
                  <div className="min-w-0 mr-2">
                    <div className="text-yellow-400 text-xs font-semibold flex items-center gap-1"><Pencil size={11} /> Editing</div>
                    <div className="text-gray-500 dark:text-slate-400 text-xs truncate">{editingMessage.content}</div>
                  </div>
                  <button onClick={() => { setEditingMessage(null); setInput(''); }} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white shrink-0 p-1 touch-manipulation">
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Emoji picker */}
              {showEmojiPicker && (
                <div className="absolute bottom-20 left-2 z-50 max-w-[calc(100vw-1rem)]">
                  <EmojiPicker
                    onEmojiClick={(d) => setInput(prev => prev + d.emoji)}
                    width={typeof window !== 'undefined' && window.innerWidth < 400 ? window.innerWidth - 16 : 350}
                    height={380}
                  />
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-2.5 rounded-full transition shrink-0 touch-manipulation ${showEmojiPicker ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-slate-300'} hover:bg-gray-200 dark:hover:bg-white/10`}>
                  <Smile size={22} />
                </button>

                <label className="cursor-pointer p-2.5 text-gray-600 dark:text-slate-300 hover:text-indigo-600 dark:text-indigo-400 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition shrink-0 touch-manipulation">
                  <Paperclip size={22} />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file || !activeRoom) return;
                    const fd = new FormData();
                    fd.append('file', file);
                    api.post('/upload', fd, {
                      headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${user.token}` }
                    }).then(res => {
                      socket?.emit('message', { room: activeRoom.name, content: 'Shared an image', type: 'image', fileUrl: res.data.fileUrl });
                    }).catch(() => alert('Failed to upload image'));
                  }} />
                </label>

                {!isRecording ? (
                  <>
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => { setInput(e.target.value); handleTyping(); }}
                      placeholder="Type a message"
                      className="flex-1 min-w-0 px-4 py-2.5 rounded-2xl bg-gray-100/80 dark:bg-white dark:bg-slate-800/80 backdrop-blur-sm text-gray-800 dark:text-slate-100 placeholder-[#8696a0] focus:outline-none text-base border-none"
                      style={{ fontSize: '16px' }}
                    />
                  </>
                ) : (
                  <div className="flex-1 flex items-center bg-gray-100/80 dark:bg-white dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl px-4 py-2.5">
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse mr-3"></div>
                    <span className="text-gray-900 dark:text-white font-mono text-sm">{formatRecordingTime(recordingTime)}</span>
                    <div className="flex-1"></div>
                    <button type="button" onClick={cancelRecording} className="text-gray-500 hover:text-red-500 p-1 mr-2 touch-manipulation transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}

                {input.trim() ? (
                  <button
                    type="submit"
                    disabled={isUploadingAudio}
                    className="p-2.5 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:bg-indigo-600 dark:hover:bg-indigo-400 disabled:bg-gray-100/80 dark:bg-white dark:bg-slate-800/80 backdrop-blur-sm disabled:text-gray-500 dark:text-slate-400 text-white rounded-full transition shrink-0 touch-manipulation"
                  >
                    {isUploadingAudio ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
                ) : isRecording ? (
                  <button
                    type="button"
                    onClick={stopAndSendRecording}
                    disabled={isUploadingAudio}
                    className="p-2.5 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:bg-indigo-600 dark:hover:bg-indigo-400 disabled:bg-gray-100/80 dark:bg-white dark:bg-slate-800/80 backdrop-blur-sm disabled:text-gray-500 dark:text-slate-400 text-white rounded-full transition shrink-0 touch-manipulation"
                  >
                    {isUploadingAudio ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="p-2.5 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:bg-indigo-600 dark:hover:bg-indigo-400 text-white rounded-full transition shrink-0 touch-manipulation"
                  >
                    <Mic size={20} />
                  </button>
                )}
              </form>
            </div>
          </>
        ) : (
          /* Welcome screen */
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950">
            <div className="bg-gray-100/80 dark:bg-white dark:bg-slate-800/80 backdrop-blur-sm p-10 rounded-full mb-6">
              <MessageSquare size={64} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-gray-800 dark:text-slate-100 text-3xl font-light mb-3">WhatsApp Web</h2>
            <p className="text-gray-500 dark:text-slate-400 text-sm text-center max-w-sm px-4">
              Send and receive messages without keeping your phone online.
            </p>
            <div className="mt-6 flex items-center gap-2 text-gray-500 dark:text-slate-400 text-xs">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              End-to-end encrypted
            </div>
          </div>
        )}
      </div>

      {/* ========== GROUP MODAL ========== */}
      {
        showGroupModal && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
            <div className="bg-gray-50 dark:bg-slate-950 rounded-t-2xl sm:rounded-xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                <h2 className="text-gray-900 dark:text-white font-semibold text-lg">New Group</h2>
                <button onClick={() => { setShowGroupModal(false); setNewGroupName(''); setSelectedUsers([]); }}
                  className="text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 touch-manipulation">
                  <X size={20} />
                </button>
              </div>

              <div className="px-5 py-4">
                <input
                  className="w-full bg-gray-100/80 dark:bg-white dark:bg-slate-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-[#8696a0] px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00a884] text-base border-none"
                  placeholder="Group name"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-2">
                <p className="text-gray-500 dark:text-slate-400 text-xs px-2 mb-2 uppercase font-semibold tracking-wider">Add participants</p>
                <FetchUsersEffect user={user} setAllUsers={setAllUsers} />
                {allUsers.filter(u => u._id !== user._id).map(u => {
                  const online = isOnline(u._id);
                  const checked = selectedUsers.includes(u._id);
                  return (
                    <label key={u._id} htmlFor={`gu-${u._id}`}
                      className="flex items-center px-3 py-3 rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10 cursor-pointer transition-all duration-300 ease-in-out hover:scale-[1.02]">
                      <div className="relative mr-3 shrink-0">
                        <div className="h-10 w-10 rounded-full bg-[#6b7280] flex items-center justify-center text-gray-900 dark:text-white font-bold">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        {online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-950" />}
                      </div>
                      <span className="flex-1 text-gray-800 dark:text-slate-100 text-sm">{u.username}</span>
                      <input type="checkbox" id={`gu-${u._id}`} className="hidden"
                        checked={checked}
                        onChange={e => {
                          if (e.target.checked) setSelectedUsers([...selectedUsers, u._id]);
                          else setSelectedUsers(selectedUsers.filter(id => id !== u._id));
                        }}
                      />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ease-in-out hover:scale-[1.02]
                      ${checked ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] border-indigo-500' : 'border-[#8696a0]'}`}>
                        {checked && <Check size={12} className="text-white" />}
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="px-5 py-4 border-t border-gray-200 dark:border-white/10">
                <button
                  onClick={() => {
                    if (!newGroupName.trim()) return alert('Please enter a group name');
                    if (selectedUsers.length === 0) return alert('Please select at least one participant');
                    api.post('/rooms', { name: newGroupName, type: 'group', participants: selectedUsers }, {
                      headers: { Authorization: `Bearer ${user.token}` }
                    }).then(res => {
                      setRooms([...rooms, res.data]);
                      setShowGroupModal(false);
                      setNewGroupName('');
                      setSelectedUsers([]);
                      handleJoinRoom(res.data);
                    }).catch(err => alert(err.response?.data?.message || 'Failed to create group'));
                  }}
                  className="w-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:bg-indigo-600 dark:hover:bg-indigo-400 text-white font-semibold py-3 rounded-xl transition touch-manipulation"
                >
                  Create Group {selectedUsers.length > 0 && `(${selectedUsers.length})`}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* ========== PROFILE MODAL ========== */}
      {
        showProfileModal && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
            <div className="bg-gray-50 dark:bg-slate-950 rounded-t-2xl sm:rounded-xl w-full max-w-md shadow-2xl">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                <h2 className="text-gray-900 dark:text-white font-semibold text-lg">Profile</h2>
                <button onClick={() => setShowProfileModal(false)}
                  className="text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 touch-manipulation">
                  <X size={20} />
                </button>
              </div>

              <div className="p-5">
                {/* Avatar */}
                <div className="flex flex-col items-center mb-6">
                  <div className="relative h-24 w-24 mb-2">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Profile" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <div className="h-full w-full rounded-full bg-[#6b7280] flex items-center justify-center text-3xl text-gray-900 dark:text-white font-bold">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 active:bg-black/40 rounded-full cursor-pointer transition group touch-manipulation">
                      <Pencil size={20} className="text-gray-900 dark:text-white opacity-0 group-hover:opacity-100 group-active:opacity-100" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append('image', file);
                        api.post('/upload', fd, {
                          headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${user.token}` }
                        }).then(res => {
                          api.put('/users/profile', { avatarUrl: res.data.fileUrl }, { headers: { Authorization: `Bearer ${user.token}` } })
                            .then(() => updateUser({ avatarUrl: res.data.fileUrl }));
                        }).catch(() => alert('Failed to upload'));
                      }} />
                    </label>
                  </div>
                  <p className="text-gray-900 dark:text-white font-semibold text-lg">{user.username}</p>
                  <p className="text-gray-500 dark:text-slate-400 text-sm">{user.email}</p>
                </div>

                {/* Bio */}
                <div className="mb-4">
                  <label className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold uppercase tracking-wider block mb-2">About</label>
                  <textarea
                    className="w-full bg-gray-100/80 dark:bg-white dark:bg-slate-800/80 backdrop-blur-sm text-gray-800 dark:text-slate-100 placeholder-[#8696a0] px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00a884] text-sm resize-none border-none"
                    rows={3}
                    defaultValue={user.bio || ''}
                    onBlur={(e) => {
                      const newBio = e.target.value;
                      if (newBio === user.bio) return;
                      api.put('/users/profile', { bio: newBio }, { headers: { Authorization: `Bearer ${user.token}` } })
                        .then(() => updateUser({ bio: newBio }))
                        .catch(() => alert('Failed to update bio'));
                    }}
                    placeholder="Hey there! I am using WhatsApp."
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )
      }
      {/* WALLPAPER MODAL */}
      {
        showWallpaperModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10 flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Chat Wallpaper</h3>
                <button onClick={() => setShowWallpaperModal(false)} className="text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition touch-manipulation">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  {WALLPAPER_OPTIONS.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setWallpaper(opt.value);
                        setShowWallpaperModal(false);
                      }}
                      className={`flex flex-col items-center gap-2 touch-manipulation group`}
                    >
                      <div
                        className={`w-full aspect-video rounded-xl border-2 transition-all duration-300 ${wallpaper === opt.value ? 'border-indigo-500 scale-105 shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'border-gray-200 dark:border-white/10 group-hover:border-gray-400 dark:group-hover:border-white/30'}`}
                        style={opt.value !== 'none' ? { background: opt.value, backgroundSize: opt.value.includes('url') ? 'auto' : 'cover' } : { backgroundColor: theme === 'dark' ? '#0f172a' : '#f3f4f6' }}
                      />
                      <span className={`text-xs ${wallpaper === opt.value ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-gray-600 dark:text-slate-400'}`}>{opt.name}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )
      }

    </div >
  );
}

function FetchUsersEffect({ user, setAllUsers }: { user: any, setAllUsers: Function }) {
  useEffect(() => {
    api.get('/auth/users', { headers: { Authorization: `Bearer ${user.token}` } })
      .then(res => setAllUsers(res.data))
      .catch(console.error);
  }, [user, setAllUsers]);
  return null;
}
