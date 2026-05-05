const express = require('express');
const router = express.Router();
const {
  getOrCreateChat,
  getChatMessages,
  getUserChats
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.get('/booking/:booking_id', protect, getOrCreateChat);
router.get('/messages/:chat_id', protect, getChatMessages);
router.get('/my-chats', protect, getUserChats);

module.exports = router;