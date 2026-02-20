
const Message = require('../models/Message');

// @desc    Edit a message
// @route   PUT /api/messages/:id
// @access  Private
const editMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Check if user is sender
        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        message.content = content;
        message.isEdited = true;
        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(message.room).emit('message_updated', message);
        }

        res.status(200).json(message);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete a message (Soft delete)
// @route   DELETE /api/messages/:id
// @access  Private
const deleteMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Check if user is sender
        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        message.isDeleted = true;
        message.content = 'This message was deleted'; // Optional: clear content
        await message.save();

        const io = req.app.get('io');
        if (io) {
            // We can emit 'message_updated' since it is a soft delete, 
            // or 'message_deleted' if we want specific handling.
            // 'message_updated' is easier if the frontend just replaces the message object.
            io.to(message.room).emit('message_updated', message);
        }

        res.status(200).json({ message: 'Message removed', id: req.params.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Toggle a reaction on a message
// @route   POST /api/messages/:id/react
// @access  Private
const toggleReaction = async (req, res) => {
    try {
        const { emoji } = req.body;
        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const userIdStr = req.user._id.toString();

        // Ensure reactions array exists (for older messages)
        if (!message.reactions) {
            message.reactions = [];
        }

        // Find if this reaction emoji already exists
        const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);

        if (reactionIndex > -1) {
            // Emoji exists
            const userIndex = message.reactions[reactionIndex].users.findIndex(u => u.toString() === userIdStr);

            if (userIndex > -1) {
                // User already reacted with this emoji -> Remove reaction
                message.reactions[reactionIndex].users.splice(userIndex, 1);

                // If no users left for this emoji, remove the emoji object
                if (message.reactions[reactionIndex].users.length === 0) {
                    message.reactions.splice(reactionIndex, 1);
                }
            } else {
                // User hasn't reacted with this emoji -> Add reaction
                message.reactions[reactionIndex].users.push(req.user._id);
            }
        } else {
            // Emoji doesn't exist -> Add new reaction object
            message.reactions.push({
                emoji,
                users: [req.user._id]
            });
        }

        await message.save();

        const updatedMessage = await Message.findById(message._id);

        const io = req.app.get('io');
        if (io) {
            io.to(updatedMessage.room).emit('message_updated', updatedMessage);
        }

        res.status(200).json(updatedMessage);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    editMessage,
    deleteMessage,
    toggleReaction
};
