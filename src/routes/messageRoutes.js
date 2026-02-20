
const express = require('express');
const router = express.Router();
const { editMessage, deleteMessage, toggleReaction } = require('../controllers/messageController');
const { protect } = require('../middlewares/authMiddleware');

router.put('/:id', protect, editMessage);
router.delete('/:id', protect, deleteMessage);
router.post('/:id/react', protect, toggleReaction);

module.exports = router;
