const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');

// router.use(authMiddleware);

// POST a new message
router.post('/messages', chatController.sendMessage);

// POST to get all conversations for a user
router.post('/conversations', chatController.getConversations);

// FIXED: Changed to POST to get message history for a conversation.
// This allows the app to send both the user's ID and the other user's ID.
router.post('/messages/history', chatController.getMessages);

module.exports = router;
