import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Message, Room, OnlineUser } from '../types';

interface ChatState {
    user: User | null;
    messages: Message[];
    rooms: Room[];
    activeRoom: Room | null; // For now just storing room object or name
    onlineUsers: OnlineUser[];
    theme: 'light' | 'dark';
    wallpaper: string;

    setUser: (user: User | null) => void;
    setTheme: (theme: 'light' | 'dark') => void;
    setWallpaper: (wallpaper: string) => void;
    setMessages: (messages: Message[]) => void;
    addMessage: (message: Message) => void;
    setRooms: (rooms: Room[]) => void;
    setActiveRoom: (room: Room | null) => void;
    setOnlineUsers: (users: OnlineUser[]) => void;
    incrementUnread: (roomIdOrName: string) => void;
    clearUnread: (roomIdOrName: string) => void;
    updateMessage: (message: Message) => void;
    updateMessagesRead: (messageIds: string[], readByUserId: string) => void;
    updateMessagesDelivered: (messageIds: string[], deliveredToUserId: string) => void;
    updateUser: (user: Partial<User>) => void;
    updateParticipantStatus: (userId: string, lastSeen: string) => void;
    logout: () => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set) => ({
            user: null,
            messages: [],
            rooms: [],
            activeRoom: null,
            onlineUsers: [],
            theme: 'light',
            wallpaper: "url('/chat-bg.png')",

            setUser: (user) => set({ user }),
            setTheme: (theme) => set({ theme }),
            setWallpaper: (wallpaper) => set({ wallpaper }),
            setMessages: (messages) => set({ messages }),
            addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
            setRooms: (rooms) => set({ rooms }),
            setActiveRoom: (activeRoom) => set({ activeRoom }),
            setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
            incrementUnread: (roomIdOrName) => set((state) => ({
                rooms: state.rooms.map(room =>
                    (room._id === roomIdOrName || room.name === roomIdOrName)
                        ? { ...room, unreadCount: (room.unreadCount || 0) + 1 }
                        : room
                )
            })),
            clearUnread: (roomIdOrName) => set((state) => ({
                rooms: state.rooms.map(room =>
                    (room._id === roomIdOrName || room.name === roomIdOrName)
                        ? { ...room, unreadCount: 0 }
                        : room
                )
            })),
            updateMessage: (updatedMessage) => set((state) => ({
                messages: state.messages.map(msg =>
                    (msg._id === updatedMessage._id) ? updatedMessage : msg
                )
            })),
            updateMessagesRead: (messageIds, readByUserId) => set((state) => ({
                messages: state.messages.map(msg => {
                    if (messageIds.includes(msg._id)) {
                        const currentReadBy = msg.readBy || [];
                        if (!currentReadBy.includes(readByUserId)) {
                            return { ...msg, readBy: [...currentReadBy, readByUserId] };
                        }
                    }
                    return msg;
                })
            })),
            updateMessagesDelivered: (messageIds, deliveredToUserId) => set((state) => ({
                messages: state.messages.map(msg => {
                    if (messageIds.includes(msg._id)) {
                        const currentDeliveredTo = msg.deliveredTo || [];
                        if (!currentDeliveredTo.includes(deliveredToUserId)) {
                            return { ...msg, deliveredTo: [...currentDeliveredTo, deliveredToUserId] };
                        }
                    }
                    return msg;
                })
            })),
            updateUser: (updates) => set((state) => ({
                user: state.user ? { ...state.user, ...updates } : null
            })),
            updateParticipantStatus: (userId, lastSeen) => set((state) => {
                const updatedRooms = state.rooms.map(room => {
                    if (!room.participants) return room;
                    return {
                        ...room,
                        participants: room.participants.map(p => {
                            const pObj = p as any;
                            if (pObj._id === userId || pObj === userId) {
                                return typeof pObj === 'object' ? { ...pObj, lastSeen } : { _id: pObj, lastSeen };
                            }
                            return p;
                        }) as any
                    };
                });

                // Also update activeRoom if it's currently focused
                let updatedActiveRoom = state.activeRoom;
                if (updatedActiveRoom && updatedActiveRoom.participants) {
                    updatedActiveRoom = {
                        ...updatedActiveRoom,
                        participants: updatedActiveRoom.participants.map(p => {
                            const pObj = p as any;
                            if (pObj._id === userId || pObj === userId) {
                                return typeof pObj === 'object' ? { ...pObj, lastSeen } : { _id: pObj, lastSeen };
                            }
                            return p;
                        }) as any
                    };
                }

                return { rooms: updatedRooms, activeRoom: updatedActiveRoom };
            }),
            logout: () => set({ user: null, messages: [], rooms: [], activeRoom: null, onlineUsers: [] }),
        }),
        {
            name: 'chat-storage',
            partialize: (state) => ({ user: state.user, activeRoom: state.activeRoom, theme: state.theme, wallpaper: state.wallpaper }), // Persist user, active room and theme
        }
    )
);
