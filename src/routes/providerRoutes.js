const express = require('express');
const router = express.Router();
const {
  createProfile,
  getMyProfile,
  getProviders,
  updateProfile,
  getNearby
} = require('../controllers/providerController');
const { protect } = require('../middleware/authMiddleware');

router.post('/profile', protect, createProfile);
router.get('/profile/me', protect, getMyProfile);
router.get('/', getProviders);
router.put('/profile', protect, updateProfile);
router.get('/nearby', getNearby);

module.exports = router;