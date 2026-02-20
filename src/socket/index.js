const { socketAuth } = require('../middlewares/authMiddleware');
const Message = require('../models/Message');

const onlineUsers = new Map(); // Store userId -> socketId

module.exports = (io) => {
    io.use(socketAuth);

    io.on('connection', async (socket) => {
        const userId = socket.user.id;
        const username = socket.user.username;
        console.log(`New client connected: ${socket.id} (User: ${username})`);

        // Track online user
        onlineUsers.set(userId, { id: userId, username });
        io.emit('online_users', Array.from(onlineUsers.values()));

        // Fetch last 50 messages
        try {
            const messages = await Message.find()
                .sort({ createdAt: -1 })
                .limit(50)
                .sort({ createdAt: 1 }); // Re-sort for display order

            socket.emit('history', messages);
        } catch (err) {
            console.error('Error fetching history:', err);
        }

        // Handle joining a room
        socket.on('join_room', (room) => {
            socket.join(room);
            console.log(`User ${userId} joined room: ${room}`);
        });

        // Handle leaving a room
        socket.on('leave_room', (room) => {
            socket.leave(room);
            console.log(`User ${userId} left room: ${room}`);
        });

        // Typing Indicators
        socket.on('typing', (room) => {
            socket.to(room).emit('typing', { userId, username });
        });

        socket.on('stop_typing', (room) => {
            socket.to(room).emit('stop_typing', { userId, username });
        });

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
            onlineUsers.delete(userId);
            io.emit('online_users', Array.from(onlineUsers.values()));
        });

        // Handle incoming messages
        socket.on('message', async (data) => {
            const room = data.room || 'general';
            console.log(`Message from ${userId} to ${room}:`, data.content);

            try {
                const msgData = {
                    sender: userId,
                    content: data.text || data.content,
                    room: room,
                    type: data.type || 'text',
                };
                if (data.fileUrl) msgData.fileUrl = data.fileUrl;
                if (data.replyTo) msgData.replyTo = data.replyTo;

                const newMessage = new Message(msgData);
                await newMessage.save();

                // Populate sender and replyTo before broadcasting
                await newMessage.populate('sender', 'username avatarUrl _id');
                if (data.replyTo) {
                    await newMessage.populate('replyTo', 'content sender');
                }

                // Broadcast to specific room
                io.to(room).emit('message', newMessage.toObject());

                // --- AI BOT LOGIC ---
                if (room === 'ai-chat' || (data.content && data.content.startsWith('@bot'))) {
                    const aiService = require('../services/aiService');
                    const aiResponse = await aiService.generateResponse(data.content);

                    const botMessage = new Message({
                        sender: '666666666666666666666666',
                        content: aiResponse,
                        room: room
                    });
                    await botMessage.save();
                    io.to(room).emit('message', botMessage.toObject());
                }

            } catch (err) {
                console.error('Error saving message:', err);
            }
        });
        // Handle marking messages as read
        socket.on('mark_as_read', async (room) => {
            try {
                // Find messages in this room that are NOT sent by the current user
                // and where the current user is NOT already in the readBy array
                const messagesToUpdate = await Message.find({
                    room: room,
                    sender: { $ne: userId },
                    readBy: { $ne: userId }
                });

                if (messagesToUpdate.length > 0) {
                    const messageIds = messagesToUpdate.map(m => m._id);

                    await Message.updateMany(
                        { _id: { $in: messageIds } },
                        { $push: { readBy: userId } }
                    );

                    // Convert ObjectIds to strings for frontend comparison
                    io.to(room).emit('messages_read', {
                        roomId: room,
                        messageIds: messageIds.map(id => id.toString()),
                        readByUserId: userId.toString()
                    });
                }
            } catch (err) {
                console.error('Error marking as read:', err);
            }
        });
    });
};
