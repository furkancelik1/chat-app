'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '../store/useChatStore';
import { useSocket } from '../context/SocketContext';
import api from '../lib/api';

import NotificationManager from '../components/NotificationManager';
import EmojiPicker from 'emoji-picker-react';
import { Moon, Sun, Search, MoreVertical, Phone, Video, Smile, Paperclip, Send, ArrowLeft, Check, CheckCheck, Pencil, Trash2, Reply, Users, MessageSquare, UserCircle2, X, ChevronDown } from 'lucide-react';

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
    addMessage, updateUser, updateMessagesRead, theme, setTheme
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

    return () => {
      socket.off('typing');
      socket.off('stop_typing');
      socket.off('message_updated');
      socket.off('messages_read');
    };
  }, [socket, updateMessage, updateMessagesRead]);

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
    socket?.emit('join_room', room.name);
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
    <div className="flex h-screen items-center justify-center bg-white dark:bg-[#111b21]">
      <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
    </div>
  );

  // Aktif odadaki mesajları getir
  const activeMessages = activeRoom
    ? messages.filter(m => m.room === activeRoom.name)
    : [];

  // Header bilgisi
  const getHeaderInfo = () => {
    if (!activeRoom) return { name: '', subtitle: '', isOnlineUser: false };
    if (activeRoom.type === 'private') {
      const other = activeRoom.participants?.find((p: any) => toStr(p._id || p) !== user._id) as any;
      const otherName = other?.username || 'Unknown';
      const otherId = other?._id || other;
      const online = isOnline(toStr(otherId));
      return { name: otherName, subtitle: online ? 'online' : '', isOnlineUser: online, avatar: other?.avatarUrl };
    }
    if (activeRoom.type === 'group') {
      const count = activeRoom.participants?.length || 0;
      return { name: activeRoom.name, subtitle: `${count} participants`, isOnlineUser: false };
    }
    return { name: `# ${activeRoom.name}`, subtitle: activeRoom.description || '', isOnlineUser: false };
  };
  const headerInfo = getHeaderInfo();

  return (
    <div className="flex h-screen bg-[#111b21] overflow-hidden">
      <NotificationManager />

      {/* ========== SIDEBAR ========== */}
      <div className={`
        ${showSidebar ? 'flex' : 'hidden'} md:flex
        w-full md:w-[380px] lg:w-[400px]
        bg-[#111b21] flex-col shrink-0
        border-r border-[#202c33]
      `}>

        {/* Sidebar Header */}
        <div className="px-4 py-3 bg-[#202c33] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <button onClick={() => setShowProfileModal(true)} className="shrink-0 touch-manipulation">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Me" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-[#6b7280] flex items-center justify-center text-white font-bold text-lg">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
            </button>
            <span className="text-white font-semibold text-base hidden sm:block">{user.username}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 text-[#aebac1] hover:text-white hover:bg-[#2a3942] rounded-full transition touch-manipulation"
            >
              <Search size={20} />
            </button>
            <button
              onClick={() => setShowGroupModal(true)}
              className="p-2 text-[#aebac1] hover:text-white hover:bg-[#2a3942] rounded-full transition touch-manipulation"
              title="New Group"
            >
              <Users size={20} />
            </button>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 text-[#aebac1] hover:text-white hover:bg-[#2a3942] rounded-full transition touch-manipulation"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="px-3 py-2 bg-[#111b21]">
            <div className="flex items-center bg-[#202c33] rounded-lg px-3 gap-2">
              <Search size={16} className="text-[#aebac1] shrink-0" />
              <input
                type="text"
                placeholder="Search or start new chat"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent py-2 text-sm text-white placeholder-[#8696a0] focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-[#aebac1]"><X size={16} /></button>
              )}
            </div>
          </div>
        )}

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">

          {/* AI Bot - pinned */}
          <button
            onClick={() => handleJoinRoom({ _id: 'ai-chat', name: 'ai-chat', description: 'Chat with AI', type: 'public' })}
            className={`w-full flex items-center px-3 py-3 gap-3 hover:bg-[#2a3942] transition-colors touch-manipulation ${activeRoom?.name === 'ai-chat' ? 'bg-[#2a3942]' : ''}`}
          >
            <div className="h-12 w-12 rounded-full bg-purple-600 flex items-center justify-center text-2xl shrink-0">🤖</div>
            <div className="flex-1 min-w-0 text-left border-b border-[#202c33] pb-3">
              <div className="flex justify-between items-baseline">
                <span className="text-white font-medium text-sm">AI Bot</span>
                <span className="text-[#8696a0] text-xs shrink-0 ml-2">
                  {getLastMessage('ai-chat') ? formatLastSeen(getLastMessage('ai-chat')!.createdAt) : ''}
                </span>
              </div>
              <div className="flex justify-between items-center mt-0.5">
                <span className="text-[#8696a0] text-xs truncate">Ask me anything...</span>
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
                className={`w-full flex items-center px-3 py-3 gap-3 hover:bg-[#2a3942] transition-colors touch-manipulation ${isActive ? 'bg-[#2a3942]' : ''}`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  {isPrivate && other?.avatarUrl ? (
                    <img src={other.avatarUrl} alt={label} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg
                      ${isGroup ? 'bg-[#6b7280]' : 'bg-[#00a884]'}`}>
                      {isGroup ? <Users size={22} /> : label.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#111b21]" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left border-b border-[#202c33] pb-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-white font-medium text-sm truncate mr-2">{label}</span>
                    <span className={`text-xs shrink-0 ${unread > 0 ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                      {lastMsg ? formatLastSeen(lastMsg.createdAt) : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-[#8696a0] text-xs truncate mr-2">{lastMsgText}</span>
                    {unread > 0 && (
                      <span className="shrink-0 min-w-[20px] h-5 bg-[#00a884] text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {filteredRooms.length === 0 && searchQuery && (
            <div className="text-center text-[#8696a0] text-sm py-12">No chats found</div>
          )}

          {/* Online Users Section */}
          {onlineUsers.filter(u => u.id !== user._id).length > 0 && !searchQuery && (
            <div className="mt-2">
              <div className="px-4 py-2 text-xs font-semibold text-[#8696a0] uppercase tracking-wider">
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
                  className="w-full flex items-center px-3 py-2.5 gap-3 hover:bg-[#2a3942] transition-colors touch-manipulation"
                >
                  <div className="relative shrink-0">
                    <div className="h-10 w-10 rounded-full bg-[#6b7280] flex items-center justify-center text-white font-bold">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#111b21]" />
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
            <div className="px-3 py-2 bg-[#202c33] flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3">
                <button
                  className="md:hidden p-1 text-[#aebac1] hover:text-white touch-manipulation"
                  onClick={() => setShowSidebar(true)}
                >
                  <ArrowLeft size={22} />
                </button>

                {/* Avatar */}
                <div className="relative">
                  {activeRoom.type === 'private' && (headerInfo as any).avatar ? (
                    <img src={(headerInfo as any).avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold
                      ${activeRoom.type === 'group' ? 'bg-[#6b7280]' : activeRoom.name === 'ai-chat' ? 'bg-purple-600' : 'bg-[#00a884]'}`}>
                      {activeRoom.name === 'ai-chat' ? '🤖' :
                        activeRoom.type === 'group' ? <Users size={18} /> :
                          headerInfo.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {headerInfo.isOnlineUser && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#202c33]" />
                  )}
                </div>

                <div>
                  <h2 className="text-white font-semibold text-sm leading-tight">{headerInfo.name}</h2>
                  {headerInfo.subtitle && (
                    <p className="text-[#8696a0] text-xs">{headerInfo.subtitle}</p>
                  )}
                  {typingUsers.length > 0 && (
                    <p className="text-[#00a884] text-xs animate-pulse">
                      {typingUsers.join(', ')} typing...
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button className="p-2 text-[#aebac1] hover:text-white hover:bg-[#2a3942] rounded-full transition touch-manipulation">
                  <Search size={20} />
                </button>
                <button className="p-2 text-[#aebac1] hover:text-white hover:bg-[#2a3942] rounded-full transition touch-manipulation">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1" style={{ backgroundImage: "url('/chat-bg.png')" }}>
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

                // Tik durumu: readBy array'ini string olarak karşılaştır
                const readByOthers = msg.readBy
                  ? msg.readBy.filter(id => toStr(id) !== user._id).length > 0
                  : false;

                // Aynı sender arka arkaya mı?
                const prevMsg = idx > 0 ? activeMessages[idx - 1] : null;
                const sameSenderAsPrev = prevMsg && toStr(typeof prevMsg.sender === 'object' ? (prevMsg.sender as any)._id : prevMsg.sender) === senderIdStr;

                if (msg.isDeleted) {
                  return (
                    <div key={msg._id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                      <div className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs italic text-[#8696a0] border border-[#8696a0]/30
                        ${isMe ? 'bg-[#005c4b]' : 'bg-[#202c33]'}`}>
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
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white
                            ${isBot ? 'bg-purple-500' : 'bg-[#6b7280]'}`}>
                            {isBot ? '🤖' : senderName.charAt(0).toUpperCase()}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`relative max-w-[80%] sm:max-w-[65%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {/* Message action buttons (hover) */}
                      <div className={`absolute -top-9 ${isMe ? 'right-0' : 'left-8'} hidden group-hover:flex gap-0.5 bg-[#233138] border border-[#3d4a52] shadow-lg rounded-lg p-1 z-20 items-center`}>
                        {['👍', '❤️', '😂', '😮', '😢'].map(emoji => (
                          <button key={emoji} onClick={() => {
                            api.post(`/messages/${msg._id}/react`, { emoji }, {
                              headers: { Authorization: `Bearer ${user?.token}` }
                            }).then(res => updateMessage(res.data)).catch(() => { });
                          }} className="text-base hover:scale-125 transition-transform p-1 touch-manipulation">{emoji}</button>
                        ))}
                        <div className="w-px h-5 bg-[#3d4a52] mx-0.5" />
                        <button onClick={() => setReplyingTo(msg)} className="p-1.5 hover:bg-[#3d4a52] rounded text-[#aebac1] touch-manipulation" title="Reply">
                          <Reply size={14} />
                        </button>
                        {isMe && (
                          <>
                            <button onClick={() => { setEditingMessage(msg); setInput(msg.content); inputRef.current?.focus(); }}
                              className="p-1.5 hover:bg-[#3d4a52] rounded text-[#aebac1] touch-manipulation" title="Edit">
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

                      <div className={`relative px-3 py-1.5 rounded-lg shadow-sm text-sm
                        ${isMe
                          ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                          : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                        }
                        ${sameSenderAsPrev && !isMe ? 'rounded-tl-lg' : ''}
                        ${sameSenderAsPrev && isMe ? 'rounded-tr-lg' : ''}
                      `}>
                        {/* Sender name in groups */}
                        {!isMe && !sameSenderAsPrev && (activeRoom.type === 'group' || activeRoom.type === 'public') && (
                          <div className="text-[11px] font-semibold mb-0.5 text-[#00a884]">{senderName}</div>
                        )}

                        {/* Reply block */}
                        {msg.replyTo && (
                          <div className={`mb-1.5 px-2 py-1 rounded border-l-[3px] text-xs ${isMe ? 'border-[#00a884] bg-[#004c3f]' : 'border-[#8696a0] bg-[#182229]'}`}>
                            <div className="font-semibold text-[#00a884] text-[11px] mb-0.5">
                              {typeof msg.replyTo === 'object' ? (msg.replyTo as any).sender?.username || 'Reply' : 'Reply'}
                            </div>
                            <div className="text-[#8696a0] truncate text-[11px]">
                              {typeof msg.replyTo === 'object' ? (msg.replyTo as any).content : '...'}
                            </div>
                          </div>
                        )}

                        {/* Image */}
                        {msg.type === 'image' && msg.fileUrl ? (
                          <img
                            src={msg.fileUrl}
                            alt="Shared"
                            className="max-w-full rounded-md mb-1 cursor-pointer hover:opacity-90 transition max-h-64 object-cover"
                            onClick={() => window.open(msg.fileUrl, '_blank')}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap break-words leading-relaxed">
                            {msg.content}
                            {msg.isEdited && <span className="text-[10px] opacity-50 ml-1">(edited)</span>}
                          </p>
                        )}

                        {/* Time + Ticks */}
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="text-[10px] text-[#8696a0]">{formatTime(msg.createdAt)}</span>
                          {isMe && (
                            readByOthers ? (
                              <CheckCheck size={16} className="text-[#53bdeb] shrink-0" />
                            ) : (
                              <CheckCheck size={16} className="text-[#8696a0] shrink-0" />
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
                                  className={`text-[11px] px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 transition-colors touch-manipulation
                                    ${hasReacted ? 'bg-[#00a884]/20 border-[#00a884]/50' : 'bg-[#182229] border-[#3d4a52]'}`}>
                                  <span>{r.emoji}</span>
                                  <span className="font-semibold text-[#e9edef]">{r.users.length}</span>
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
            <div className="px-2 py-2 sm:px-4 sm:py-3 bg-[#202c33]">
              {/* Reply preview */}
              {replyingTo && (
                <div className="flex items-center justify-between bg-[#2a3942] px-3 py-2 mb-2 rounded-lg border-l-4 border-[#00a884]">
                  <div className="min-w-0 mr-2">
                    <div className="text-[#00a884] text-xs font-semibold">
                      {toStr(typeof replyingTo.sender === 'object' ? (replyingTo.sender as any)._id : replyingTo.sender) === user._id ? 'You' : 'Reply'}
                    </div>
                    <div className="text-[#8696a0] text-xs truncate">{replyingTo.content}</div>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-[#8696a0] hover:text-white shrink-0 p-1 touch-manipulation">
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Edit preview */}
              {editingMessage && (
                <div className="flex items-center justify-between bg-[#2a3942] px-3 py-2 mb-2 rounded-lg border-l-4 border-yellow-500">
                  <div className="min-w-0 mr-2">
                    <div className="text-yellow-400 text-xs font-semibold flex items-center gap-1"><Pencil size={11} /> Editing</div>
                    <div className="text-[#8696a0] text-xs truncate">{editingMessage.content}</div>
                  </div>
                  <button onClick={() => { setEditingMessage(null); setInput(''); }} className="text-[#8696a0] hover:text-white shrink-0 p-1 touch-manipulation">
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
                  className={`p-2.5 rounded-full transition shrink-0 touch-manipulation ${showEmojiPicker ? 'text-[#00a884]' : 'text-[#aebac1]'} hover:bg-[#2a3942]`}>
                  <Smile size={22} />
                </button>

                <label className="cursor-pointer p-2.5 text-[#aebac1] hover:text-[#00a884] hover:bg-[#2a3942] rounded-full transition shrink-0 touch-manipulation">
                  <Paperclip size={22} />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file || !activeRoom) return;
                    const fd = new FormData();
                    fd.append('image', file);
                    api.post('/upload', fd, {
                      headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${user.token}` }
                    }).then(res => {
                      socket?.emit('message', { room: activeRoom.name, content: 'Shared an image', type: 'image', fileUrl: res.data.fileUrl });
                    }).catch(() => alert('Failed to upload image'));
                  }} />
                </label>

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => { setInput(e.target.value); handleTyping(); }}
                  placeholder="Type a message"
                  className="flex-1 min-w-0 px-4 py-2.5 rounded-lg bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] focus:outline-none text-base border-none"
                  style={{ fontSize: '16px' }}
                />

                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2.5 bg-[#00a884] hover:bg-[#02be9b] disabled:bg-[#2a3942] disabled:text-[#8696a0] text-white rounded-full transition shrink-0 touch-manipulation"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Welcome screen */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#222e35]">
            <div className="bg-[#2a3942] p-10 rounded-full mb-6">
              <MessageSquare size={64} className="text-[#00a884]" />
            </div>
            <h2 className="text-[#e9edef] text-3xl font-light mb-3">WhatsApp Web</h2>
            <p className="text-[#8696a0] text-sm text-center max-w-sm px-4">
              Send and receive messages without keeping your phone online.
            </p>
            <div className="mt-6 flex items-center gap-2 text-[#8696a0] text-xs">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              End-to-end encrypted
            </div>
          </div>
        )}
      </div>

      {/* ========== GROUP MODAL ========== */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-[#111b21] rounded-t-2xl sm:rounded-xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-[#202c33] flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">New Group</h2>
              <button onClick={() => { setShowGroupModal(false); setNewGroupName(''); setSelectedUsers([]); }}
                className="text-[#aebac1] hover:text-white p-1 rounded-full hover:bg-[#2a3942] touch-manipulation">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4">
              <input
                className="w-full bg-[#2a3942] text-white placeholder-[#8696a0] px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00a884] text-base border-none"
                placeholder="Group name"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                style={{ fontSize: '16px' }}
              />
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-2">
              <p className="text-[#8696a0] text-xs px-2 mb-2 uppercase font-semibold tracking-wider">Add participants</p>
              <FetchUsersEffect user={user} setAllUsers={setAllUsers} />
              {allUsers.filter(u => u._id !== user._id).map(u => {
                const online = isOnline(u._id);
                const checked = selectedUsers.includes(u._id);
                return (
                  <label key={u._id} htmlFor={`gu-${u._id}`}
                    className="flex items-center px-3 py-3 rounded-lg hover:bg-[#2a3942] cursor-pointer transition-colors">
                    <div className="relative mr-3 shrink-0">
                      <div className="h-10 w-10 rounded-full bg-[#6b7280] flex items-center justify-center text-white font-bold">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      {online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#111b21]" />}
                    </div>
                    <span className="flex-1 text-[#e9edef] text-sm">{u.username}</span>
                    <input type="checkbox" id={`gu-${u._id}`} className="hidden"
                      checked={checked}
                      onChange={e => {
                        if (e.target.checked) setSelectedUsers([...selectedUsers, u._id]);
                        else setSelectedUsers(selectedUsers.filter(id => id !== u._id));
                      }}
                    />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                      ${checked ? 'bg-[#00a884] border-[#00a884]' : 'border-[#8696a0]'}`}>
                      {checked && <Check size={12} className="text-white" />}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="px-5 py-4 border-t border-[#202c33]">
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
                className="w-full bg-[#00a884] hover:bg-[#02be9b] text-white font-semibold py-3 rounded-xl transition touch-manipulation"
              >
                Create Group {selectedUsers.length > 0 && `(${selectedUsers.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== PROFILE MODAL ========== */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-[#111b21] rounded-t-2xl sm:rounded-xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-[#202c33] flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Profile</h2>
              <button onClick={() => setShowProfileModal(false)}
                className="text-[#aebac1] hover:text-white p-1 rounded-full hover:bg-[#2a3942] touch-manipulation">
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
                    <div className="h-full w-full rounded-full bg-[#6b7280] flex items-center justify-center text-3xl text-white font-bold">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 active:bg-black/40 rounded-full cursor-pointer transition group touch-manipulation">
                    <Pencil size={20} className="text-white opacity-0 group-hover:opacity-100 group-active:opacity-100" />
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
                <p className="text-white font-semibold text-lg">{user.username}</p>
                <p className="text-[#8696a0] text-sm">{user.email}</p>
              </div>

              {/* Bio */}
              <div className="mb-4">
                <label className="text-[#00a884] text-xs font-semibold uppercase tracking-wider block mb-2">About</label>
                <textarea
                  className="w-full bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00a884] text-sm resize-none border-none"
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
      )}
    </div>
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
