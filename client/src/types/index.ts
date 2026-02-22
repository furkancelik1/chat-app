export interface User {
    _id: string;
    username: string;
    email: string;
    bio?: string;
    avatarUrl?: string;
    token?: string;
}

export interface Message {
    _id: string;
    sender: string; // ID of sender
    content: string;
    type?: 'text' | 'image' | 'audio';
    fileUrl?: string;
    room: string;
    isEdited?: boolean;
    isDeleted?: boolean;
    replyTo?: Message;
    reactions?: {
        emoji: string;
        users: string[];
    }[];
    readBy?: string[];
    deliveredTo?: string[];
    createdAt: string;
}

export interface Room {
    _id: string;
    name: string;
    description?: string;
    type?: 'public' | 'private' | 'group';
    participants?: User[];
    admin?: string;
    unreadCount?: number;
    createdAt: string;
}

export interface OnlineUser {
    id: string;
    username: string;
}
