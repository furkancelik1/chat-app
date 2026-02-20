const express = require('express');
const router = express.Router();
const { createRoom, getRooms, getMessagesByRoom } = require('../controllers/roomController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, createRoom);
router.get('/', protect, getRooms);
router.get('/:id/messages', protect, getMessagesByRoom);

module.exports = router;
