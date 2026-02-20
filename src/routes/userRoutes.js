
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/profile').get(protect, getProfile).put(protect, updateProfile);

module.exports = router;
