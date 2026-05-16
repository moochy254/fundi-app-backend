const express = require('express');
const router = express.Router();
const { getWallet, getTransactions, withdraw } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');
const pool = require('../config/db');

router.get('/', protect, getWallet);
router.get('/transactions', protect, getTransactions);
router.post('/withdraw', protect, withdraw);

// @desc Get earnings summary
router.get('/earnings/summary', protect, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todayEarnings,
      weekEarnings,
      monthEarnings,
      totalEarnings,
      totalJobs,
      pendingPayments,
      topClients
    ] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM wallet_transactions wt
         JOIN wallets w ON wt.wallet_id = w.id
         WHERE w.provider_id = $1
         AND wt.type = 'credit'
         AND wt.created_at >= $2`,
        [req.user.id, startOfDay]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM wallet_transactions wt
         JOIN wallets w ON wt.wallet_id = w.id
         WHERE w.provider_id = $1
         AND wt.type = 'credit'
         AND wt.created_at >= $2`,
        [req.user.id, startOfWeek]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM wallet_transactions wt
         JOIN wallets w ON wt.wallet_id = w.id
         WHERE w.provider_id = $1
         AND wt.type = 'credit'
         AND wt.created_at >= $2`,
        [req.user.id, startOfMonth]
      ),
      pool.query(
        `SELECT COALESCE(total_earned, 0) AS total
         FROM wallets WHERE provider_id = $1`,
        [req.user.id]
      ),
      pool.query(
        `SELECT COUNT(*) FROM bookings
         WHERE provider_id = $1 AND status = 'completed'`,
        [req.user.id]
      ),
      pool.query(
        `SELECT COUNT(*) FROM bookings
         WHERE provider_id = $1
         AND status = 'completed'
         AND payment_released = false`,
        [req.user.id]
      ),
      pool.query(
        `SELECT u.full_name, COUNT(*) AS bookings,
         COALESCE(SUM(b.agreed_price), 0) AS total_spent
         FROM bookings b
         JOIN users u ON b.client_id = u.id
         WHERE b.provider_id = $1
         AND b.status = 'completed'
         GROUP BY u.full_name
         ORDER BY total_spent DESC
         LIMIT 5`,
        [req.user.id]
      ),
    ]);

    res.json({
      today: parseFloat(todayEarnings.rows[0].total),
      this_week: parseFloat(weekEarnings.rows[0].total),
      this_month: parseFloat(monthEarnings.rows[0].total),
      total: parseFloat(totalEarnings.rows[0]?.total || 0),
      total_jobs: parseInt(totalJobs.rows[0].count),
      pending_payments: parseInt(pendingPayments.rows[0].count),
      top_clients: topClients.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc Get monthly earnings chart data
router.get('/earnings/monthly', protect, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        TO_CHAR(wt.created_at, 'Mon') AS month,
        TO_CHAR(wt.created_at, 'MM') AS month_num,
        COALESCE(SUM(wt.amount), 0) AS earnings,
        COUNT(*) AS transactions
       FROM wallet_transactions wt
       JOIN wallets w ON wt.wallet_id = w.id
       WHERE w.provider_id = $1
       AND wt.type = 'credit'
       AND wt.created_at >= NOW() - INTERVAL '6 months'
       GROUP BY TO_CHAR(wt.created_at, 'Mon'), TO_CHAR(wt.created_at, 'MM')
       ORDER BY month_num ASC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;