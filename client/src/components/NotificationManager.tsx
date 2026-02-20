'use client';

import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useChatStore } from '../store/useChatStore';

function toStr(val: any): string {
    if (!val) return '';
    if (typeof val === 'object' && val._id) return val._id.toString();
    return val.toString();
}

export default function NotificationManager() {
    const { socket } = useSocket();
    const { user, activeRoom, incrementUnread } = useChatStore();

    // Refs to always have fresh values inside the socket listener
    const activeRoomRef = useRef(activeRoom);
    const userRef = useRef(user);
    useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
    useEffect(() => { userRef.current = user; }, [user]);

    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    const playBeep = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) { /* silently fail */ }
    };

    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (message: any) => {
            const currentUser = userRef.current;
            const currentRoom = activeRoomRef.current;

            // sender artık populate edilmiş obje veya string ID olabilir
            const senderId = toStr(typeof message.sender === 'object' ? message.sender._id : message.sender);
            const isFromMe = senderId === currentUser?._id;
            const isForCurrentRoom = currentRoom &&
                (currentRoom.name === message.room || currentRoom._id === message.room);

            if (!isFromMe) {
                playBeep();

                if (document.hidden || !isForCurrentRoom) {
                    if (Notification.permission === 'granted') {
                        const senderName = typeof message.sender === 'object'
                            ? message.sender.username
                            : 'New Message';
                        new Notification(senderName, {
                            body: message.type === 'image' ? '📷 Image' : (message.content || ''),
                            icon: '/icon.png'
                        });
                    }
                }

                if (!isForCurrentRoom) {
                    incrementUnread(message.room);
                }
            }
        };

        socket.on('message', handleNewMessage);
        return () => { socket.off('message', handleNewMessage); };
    }, [socket, incrementUnread]);

    return null;
}
