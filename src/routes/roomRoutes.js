const express = require('express');
const router = express.Router();
const { createRoom, getRooms, getMessagesByRoom, leaveRoom } = require('../controllers/roomController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, createRoom);
router.get('/', protect, getRooms);
router.get('/:id/messages', protect, getMessagesByRoom);
router.post('/:id/leave', protect, leaveRoom);

module.exports = router;
