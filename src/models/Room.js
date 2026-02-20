const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
        },
        type: {
            type: String,
            enum: ['public', 'private', 'group'],
            default: 'public',
        },
        participants: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        admin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Room', roomSchema);
