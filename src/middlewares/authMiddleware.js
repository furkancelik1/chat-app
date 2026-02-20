const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware for functionality like protecting routes
const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // In a real app, you would fetch the user from DB here
            req.user = await User.findById(decoded.id).select('-password');

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Middleware for Socket.io
const socketAuth = async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Authentication error: Token required'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('username email');

        if (!user) {
            return next(new Error('Authentication error: User not found'));
        }

        socket.user = { id: user._id.toString(), username: user.username };
        next();
    } catch (err) {
        next(new Error('Authentication error: Invalid token'));
    }
};

module.exports = { protect, socketAuth };
