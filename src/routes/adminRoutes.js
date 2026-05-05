const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// @desc Get dashboard stats
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const [
      users,
      bookings,
      payments,
      providers,
      pendingVerifications
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['client']),
      pool.query('SELECT COUNT(*) FROM bookings'),
      pool.query('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = $1', ['completed']),
      pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['provider']),
      pool.query('SELECT COUNT(*) FROM verification_requests WHERE status = $1', ['pending']),
    ]);

    res.json({
      total_clients: parseInt(users.rows[0].count),
      total_providers: parseInt(providers.rows[0].count),
      total_bookings: parseInt(bookings.rows[0].count),
      total_revenue: parseFloat(payments.rows[0].total),
      pending_verifications: parseInt(pendingVerifications.rows[0].count),
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
      `SELECT id, full_name, email, phone, role, is_verified, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
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

// @desc Ban or unban user
router.put('/users/:id/ban', protect, adminOnly, async (req, res) => {
  const { is_banned } = req.body;
  try {
    await pool.query(
      'UPDATE users SET is_verified = $1 WHERE id = $2',
      [!is_banned, req.params.id]
    );
    res.json({ message: `User ${is_banned ? 'banned' : 'unbanned'} successfully` });
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