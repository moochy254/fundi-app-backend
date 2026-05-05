const express = require('express');
const router = express.Router();
const {
  submitVerification,
  getVerificationStatus,
  reviewVerification,
  getPendingVerifications
} = require('../controllers/verificationController');
const { protect } = require('../middleware/authMiddleware');

router.post('/submit', protect, submitVerification);
router.get('/status', protect, getVerificationStatus);
router.post('/review', protect, reviewVerification);
router.get('/pending', protect, getPendingVerifications);

module.exports = router;