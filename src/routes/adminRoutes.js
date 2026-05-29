const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

// @desc Get dashboard stats
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const [
      clients,
      providers,
      bookings,
      payments,
      pendingVerifications,
      disputes,
      suspended
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users WHERE role = 'client' AND is_suspended = false`),
      pool.query(`SELECT COUNT(*) FROM users WHERE role = 'provider' AND is_suspended = false`),
      pool.query('SELECT COUNT(*) FROM bookings'),
      pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'completed'`),
      pool.query(`SELECT COUNT(*) FROM verification_requests WHERE status = 'pending'`),
      pool.query(`SELECT COUNT(*) FROM disputes WHERE status = 'pending'`),
      pool.query(`SELECT COUNT(*) FROM users WHERE is_suspended = true`),
    ]);

    res.json({
      total_clients: parseInt(clients.rows[0].count),
      total_providers: parseInt(providers.rows[0].count),
      total_bookings: parseInt(bookings.rows[0].count),
      total_revenue: parseFloat(payments.rows[0].total),
      pending_verifications: parseInt(pendingVerifications.rows[0].count),
      pending_disputes: parseInt(disputes.rows[0].count),
      suspended_users: parseInt(suspended.rows[0].count),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Get all users
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, role,
       is_verified, is_suspended, suspended_reason, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Suspend or unsuspend user
router.put('/users/:id/suspend', protect, adminOnly, async (req, res) => {
  const { is_suspended, reason } = req.body;
  try {
    await pool.query(
      `UPDATE users SET is_suspended = $1, suspended_reason = $2 WHERE id = $3`,
      [is_suspended, reason || null, req.params.id]
    );
    res.json({
      message: `User ${is_suspended ? 'suspended' : 'unsuspended'} successfully`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Delete user
router.delete('/users/:id', protect, adminOnly, async (req, res) => {
  try {
    // Check not deleting admin
    const user = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (user.rows[0]?.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin account' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Reset user password
router.put('/users/:id/reset-password', protect, adminOnly, async (req, res) => {
  const { new_password } = req.body;
  try {
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, req.params.id]
    );
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Promote user to admin
router.put('/users/:id/promote', protect, adminOnly, async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2',
      ['admin', req.params.id]
    );
    res.json({ message: 'User promoted to admin successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Get all bookings
router.get('/bookings', protect, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*,
        c.full_name AS client_name,
        p.full_name AS provider_name,
        cat.name AS category
       FROM bookings b
       JOIN users c ON b.client_id = c.id
       JOIN users p ON b.provider_id = p.id
       JOIN categories cat ON b.category_id = cat.id
       ORDER BY b.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Cancel any booking
router.put('/bookings/:id/cancel', protect, adminOnly, async (req, res) => {
  try {
    await pool.query(
      `UPDATE bookings SET status = 'cancelled' WHERE id = $1`,
      [req.params.id]
    );
    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Get all payments
router.get('/payments', protect, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.full_name AS client_name
       FROM payments p
       JOIN users u ON p.client_id = u.id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Get all withdrawal requests
router.get('/withdrawals', protect, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT wr.*, u.full_name AS provider_name, u.phone AS provider_phone
       FROM withdrawal_requests wr
       JOIN users u ON wr.provider_id = u.id
       ORDER BY wr.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Process withdrawal (mark as completed)
router.put('/withdrawals/:id/process', protect, adminOnly, async (req, res) => {
  try {
    await pool.query(
      `UPDATE withdrawal_requests SET status = 'completed' WHERE id = $1`,
      [req.params.id]
    );
    res.json({ message: 'Withdrawal processed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Get pending verifications
router.get('/verifications', protect, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vr.*, u.full_name, u.email, u.phone
       FROM verification_requests vr
       JOIN users u ON vr.provider_id = u.id
       WHERE vr.status = 'pending'
       ORDER BY vr.created_at ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Approve or reject verification
router.put('/verifications/:id', protect, adminOnly, async (req, res) => {
  const { status, admin_note } = req.body;
  try {
    const request = await pool.query(
      'SELECT * FROM verification_requests WHERE id = $1',
      [req.params.id]
    );

    if (!request.rows[0]) {
      return res.status(404).json({ message: 'Verification not found' });
    }

    await pool.query(
      'UPDATE verification_requests SET status = $1, admin_note = $2 WHERE id = $3',
      [status, admin_note, req.params.id]
    );

    await pool.query(
      `UPDATE provider_profiles
       SET is_verified = $1, verification_status = $2, verification_note = $3
       WHERE user_id = $4`,
      [status === 'approved', status, admin_note, request.rows[0].provider_id]
    );

    res.json({ message: `Verification ${status} successfully` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Get all disputes
router.get('/disputes', protect, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*,
        u.full_name AS raised_by_name,
        b.location AS booking_location,
        cat.name AS category
       FROM disputes d
       JOIN users u ON d.raised_by = u.id
       JOIN bookings b ON d.booking_id = b.id
       JOIN categories cat ON b.category_id = cat.id
       ORDER BY d.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Resolve dispute
router.put('/disputes/:id/resolve', protect, adminOnly, async (req, res) => {
  const { status, resolution } = req.body;
  try {
    await pool.query(
      `UPDATE disputes SET status = $1, resolution = $2, resolved_by = $3
       WHERE id = $4`,
      [status, resolution, req.user.id, req.params.id]
    );
    res.json({ message: `Dispute ${status} successfully` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Get all categories
router.get('/categories', protect, adminOnly, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Add category
router.post('/categories', protect, adminOnly, async (req, res) => {
  const { name } = req.body;
  try {
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json({ message: 'Category added successfully', category: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Delete category
router.delete('/categories/:id', protect, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Send announcement
router.post('/announcements', protect, adminOnly, async (req, res) => {
  const { title, message } = req.body;
  try {
    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    // Save announcement
    await pool.query(
      'INSERT INTO announcements (title, message, sent_by) VALUES ($1, $2, $3)',
      [title, message, req.user.id]
    );

    // Get all user push tokens
    const users = await pool.query(
      'SELECT push_token FROM users WHERE push_token IS NOT NULL AND is_suspended = false'
    );

    // Send push notifications
    const axios = require('axios');
    const notifications = users.rows
      .filter(u => u.push_token)
      .map(u => ({
        to: u.push_token,
        sound: 'default',
        title,
        body: message,
      }));

    if (notifications.length > 0) {
      await axios.post('https://exp.host/--/api/v2/push/send', notifications);
    }

    res.json({
      message: `Announcement sent to ${notifications.length} users successfully`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Get revenue by month
router.get('/revenue', protect, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        TO_CHAR(created_at, 'Mon YYYY') AS month,
        SUM(amount) AS total,
        COUNT(*) AS transactions
       FROM payments
       WHERE status = 'completed'
       GROUP BY TO_CHAR(created_at, 'Mon YYYY'), DATE_TRUNC('month', created_at)
       ORDER BY DATE_TRUNC('month', created_at) DESC
       LIMIT 12`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;