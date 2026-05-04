const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { sendSMS } = require('../config/sms');

// Generate 6 digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc Request password reset OTP
const requestOTP = async (req, res) => {
  const { phone } = req.body;

  try {
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Check if user exists
    const user = await pool.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );

    if (!user.rows[0]) {
      return res.status(404).json({ message: 'No account found with this phone number' });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database
    await pool.query(
      `INSERT INTO otp_codes (phone, code, expires_at)
       VALUES ($1, $2, $3)`,
      [phone, otp, expiresAt]
    );

    // Send OTP via SMS
    await sendSMS(
      phone,
      `Your Fundi App password reset code is: ${otp}. Valid for 10 minutes. Do not share this code.`
    );

    res.json({ message: 'OTP sent successfully to your phone' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

// @desc Verify OTP
const verifyOTP = async (req, res) => {
  const { phone, code } = req.body;

  try {
    if (!phone || !code) {
      return res.status(400).json({ message: 'Phone and OTP code are required' });
    }

    // Find valid OTP
    const otpRecord = await pool.query(
      `SELECT * FROM otp_codes
       WHERE phone = $1
       AND code = $2
       AND expires_at > NOW()
       AND used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone, code]
    );

    if (!otpRecord.rows[0]) {
      return res.status(400).json({ message: 'Invalid or expired OTP code' });
    }

    // Mark OTP as used
    await pool.query(
      'UPDATE otp_codes SET used = true WHERE id = $1',
      [otpRecord.rows[0].id]
    );

    res.json({ message: 'OTP verified successfully', verified: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Reset password
const resetPassword = async (req, res) => {
  const { phone, code, new_password } = req.body;

  try {
    if (!phone || !code || !new_password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Verify OTP one more time
    const otpRecord = await pool.query(
      `SELECT * FROM otp_codes
       WHERE phone = $1
       AND code = $2
       AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone, code]
    );

    if (!otpRecord.rows[0]) {
      return res.status(400).json({ message: 'Invalid or expired OTP code' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    // Update password
    await pool.query(
      'UPDATE users SET password = $1 WHERE phone = $2',
      [hashedPassword, phone]
    );

    // Invalidate all OTPs for this phone
    await pool.query(
      'UPDATE otp_codes SET used = true WHERE phone = $1',
      [phone]
    );

    res.json({ message: 'Password reset successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { requestOTP, verifyOTP, resetPassword };