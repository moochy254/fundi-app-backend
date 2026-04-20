const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const pool = require('../config/db');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getProfile);

// Save push token
router.put('/push-token', protect, async (req, res) => {
  const { push_token } = req.body;
  try {
    await pool.query(
      'UPDATE users SET push_token = $1 WHERE id = $2',
      [push_token, req.user.id]
    );
    res.json({ message: 'Push token saved successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;