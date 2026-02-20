'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../store/useChatStore';
import { OnlineUser } from '../types';

interface SocketContextData {
    socket: Socket | null;
    isConnected: boolean;
    connectSocket: (token: string) => void;
    disconnectSocket: () => void;
}

const SocketContext = createContext<SocketContextData | undefined>(undefined);

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const { setOnlineUsers, addMessage, activeRoom } = useChatStore();

    const connectSocket = (token: string) => {
        if (socket) return;

        const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
            auth: { token },
            autoConnect: true,
        });

        newSocket.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        newSocket.on('online_users', (users: OnlineUser[]) => {
            setOnlineUsers(users);
        });

        newSocket.on('message', (message) => {
            // Only add message if it belongs to current room or general notification
            // For simplicity, adding all and filtering in UI store
            addMessage(message);
        });

        setSocket(newSocket);
    };

    const disconnectSocket = () => {
        if (socket) {
            socket.disconnect();
            setSocket(null);
            setIsConnected(false);
        }
    };

    useEffect(() => {
        // Auto-connect if user is persisted
        const user = useChatStore.getState().user;
        if (user?.token && !socket) {
            connectSocket(user.token);
        }

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, []); // Run once on mount

    return (
        <SocketContext.Provider value={{ socket, isConnected, connectSocket, disconnectSocket }}>
            {children}
        </SocketContext.Provider>
    );
};
