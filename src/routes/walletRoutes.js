const express = require('express');
const router = express.Router();
const { getWallet, getTransactions, withdraw } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getWallet);
router.get('/transactions', protect, getTransactions);
router.post('/withdraw', protect, withdraw);

module.exports = router;