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
const pool = require('../config/db');

router.post('/profile', protect, createProfile);
router.get('/profile/me', protect, getMyProfile);
router.get('/', getProviders);
router.put('/profile', protect, updateProfile);
router.get('/nearby', getNearby);

// Smart Search
router.get('/search', async (req, res) => {
  const {
    query,
    category_id,
    min_rating,
    max_rating,
    location,
    is_available,
    sort_by
  } = req.query;

  try {
    let conditions = ['pp.is_available = true'];
    let params = [];
    let paramCount = 1;

    // Search by name or bio
    if (query) {
      params.push(`%${query}%`);
      conditions.push(`(
        u.full_name ILIKE $${paramCount} OR
        pp.bio ILIKE $${paramCount} OR
        pp.location ILIKE $${paramCount} OR
        c.name ILIKE $${paramCount}
      )`);
      paramCount++;
    }

    // Filter by category
    if (category_id) {
      params.push(category_id);
      conditions.push(`pp.category_id = $${paramCount}`);
      paramCount++;
    }

    // Filter by minimum rating
    if (min_rating) {
      params.push(min_rating);
      conditions.push(`pp.rating >= $${paramCount}`);
      paramCount++;
    }

    // Filter by maximum rating
    if (max_rating) {
      params.push(max_rating);
      conditions.push(`pp.rating <= $${paramCount}`);
      paramCount++;
    }

    // Filter by location
    if (location) {
      params.push(`%${location}%`);
      conditions.push(`pp.location ILIKE $${paramCount}`);
      paramCount++;
    }

    // Filter by availability
    if (is_available !== undefined) {
      params.push(is_available === 'true');
      conditions.push(`pp.is_available = $${paramCount}`);
      paramCount++;
    }

    // Sort options
    let orderBy = 'pp.rating DESC';
    if (sort_by === 'rating') orderBy = 'pp.rating DESC';
    if (sort_by === 'jobs') orderBy = 'pp.total_jobs DESC';
    if (sort_by === 'newest') orderBy = 'pp.created_at DESC';

    const sqlQuery = `
      SELECT pp.*, u.full_name, u.email, u.phone,
             u.profile_image, c.name AS category
      FROM provider_profiles pp
      JOIN users u ON pp.user_id = u.id
      JOIN categories c ON pp.category_id = c.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
    `;

    const result = await pool.query(sqlQuery, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;