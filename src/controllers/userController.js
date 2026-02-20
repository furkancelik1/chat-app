
const User = require('../models/User');

// @desc    Get user profile (self)
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.bio = req.body.bio || user.bio;
            user.avatarUrl = req.body.avatarUrl || user.avatarUrl;

            // If we wanted to update password or other fields, we could do it here too.
            if (req.body.password) {
                // user.password = req.body.password; // Assuming pre-save hook handles hashing
                // I haven't implemented pre-save hook hashing in User.js yet, so skipping for now.
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                bio: updatedUser.bio,
                avatarUrl: updatedUser.avatarUrl,
                token: req.headers.authorization.split(' ')[1] // Return same token
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getProfile,
    updateProfile
};
