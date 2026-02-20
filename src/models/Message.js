const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
    {
        sender: {
            type: String, // Storing username or user ID for now
            required: true,
        },
        content: {
            type: String,
            required: function () { return this.type === 'text'; } // Content required only for text
        },
        type: {
            type: String,
            enum: ['text', 'image'],
            default: 'text'
        },
        fileUrl: {
            type: String
        },
        room: {
            type: String,
            default: 'general',
        },
        isEdited: {
            type: Boolean,
            default: false,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
        },
        reactions: {
            type: [{
                emoji: String,
                users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
            }],
            default: []
        },
        readBy: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }]
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Message', messageSchema);
