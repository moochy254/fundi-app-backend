const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

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

// Update profile
router.put('/profile', protect, async (req, res) => {
  const { full_name, phone } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone)
       WHERE id = $3
       RETURNING id, full_name, email, phone, role`,
      [full_name, phone, req.user.id]
    );
    res.json({ message: 'Profile updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/change-password', protect, async (req, res) => {
  const { current_password, new_password } = req.body;
  try {
    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Get current user
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);

    // Check current password
    const isMatch = await bcrypt.compare(current_password, user.rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;