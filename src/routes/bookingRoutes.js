const express = require('express');
const router = express.Router();
const {
  makeBooking,
  getBooking,
  myClientBookings,
  myProviderBookings,
  updateStatus
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, makeBooking);
router.get('/client', protect, myClientBookings);
router.get('/provider', protect, myProviderBookings);
router.get('/:id', protect, getBooking);
router.put('/:id/status', protect, updateStatus);

module.exports = router;