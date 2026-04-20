const express = require('express');
const router = express.Router();
const {
  initiatePayment,
  mpesaCallback,
  checkPaymentStatus
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/initiate', protect, initiatePayment);
router.post('/callback', mpesaCallback);
router.get('/status/:booking_id', protect, checkPaymentStatus);

module.exports = router;