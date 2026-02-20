const Room = require('../models/Room');

// @desc    Create a new room or get existing private room
// @route   POST /api/rooms
// @access  Private
const createRoom = async (req, res) => {
    try {
        const { name, description, type, participants } = req.body;

        // Handle Private Room Logic
        if (type === 'private') {
            if (!participants || participants.length !== 2) {
                return res.status(400).json({ message: 'Private rooms require exactly 2 participants' });
            }

            // Ensure consistent naming for private rooms to check existence
            // Format: dm_ID1_ID2 (sorted)
            const sortedIds = participants.sort();
            const privateRoomName = `dm_${sortedIds[0]}_${sortedIds[1]}`;

            let room = await Room.findOne({ name: privateRoomName });

            if (room) {
                await room.populate('participants', 'username');
                return res.status(200).json(room); // Return existing room
            }

            room = await Room.create({
                name: privateRoomName,
                description: 'Direct Message',
                type: 'private',
                participants: sortedIds
            });

            await room.populate('participants', 'username');

            return res.status(201).json(room);
        }

        // Handle Group Room Logic
        if (type === 'group') {
            if (!name) {
                return res.status(400).json({ message: 'Group name is required' });
            }
            if (!participants || participants.length === 0) {
                return res.status(400).json({ message: 'Group must have participants' });
            }

            // Add creator to participants if not present
            const creatorId = req.user._id.toString();
            if (!participants.includes(creatorId)) {
                participants.push(creatorId);
            }

            const room = await Room.create({
                name,
                description: 'Group Chat',
                type: 'group',
                participants,
                admin: req.user._id
            });

            await room.populate('participants', 'username');
            return res.status(201).json(room);
        }

        // Handle Public Room Logic
        if (!name) {
            return res.status(400).json({ message: 'Room name is required' });
        }

        const roomExists = await Room.findOne({ name });

        if (roomExists) {
            return res.status(400).json({ message: 'Room already exists' });
        }

        const room = await Room.create({
            name,
            description,
            type: 'public',
            participants: [] // Public rooms might not need strict participants list initially
        });

        res.status(201).json(room);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get all rooms (Public + My Private)
// @route   GET /api/rooms
// @access  Private
const getRooms = async (req, res) => {
    try {
        // Fetch public rooms OR private rooms where current user is a participant
        // req.user.id comes from authMiddleware
        const userId = req.user._id;

        const rooms = await Room.find({
            $or: [
                { type: 'public' },
                { type: 'private', participants: userId },
                { type: 'group', participants: userId }
            ]
        }).populate('participants', 'username');

        res.status(200).json(rooms);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

const getMessagesByRoom = async (req, res) => {
    try {
        const roomIdOrName = req.params.id; // Could be _id or name based on frontend usage
        const Message = require('../models/Message'); // Require here to avoid circular dependencies if any
        const RoomModel = require('../models/Room');

        // Allow fetching by ID or name
        let query = { room: roomIdOrName };
        if (roomIdOrName.match(/^[0-9a-fA-F]{24}$/)) {
            query = {
                $or: [{ room: roomIdOrName }]
            };

            // If they pass an ID, find the room to get its name (as messages might be saved with name)
            const room = await RoomModel.findById(roomIdOrName);
            if (room) {
                query.$or.push({ room: room.name });
            }
        }

        const messages = await Message.find(query).sort({ createdAt: 1 });
        res.status(200).json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    createRoom,
    getRooms,
    getMessagesByRoom
};
