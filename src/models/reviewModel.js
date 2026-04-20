const pool = require('../config/db');

const createReview = async (booking_id, client_id, provider_id, rating, comment) => {
  const result = await pool.query(
    `INSERT INTO reviews (booking_id, client_id, provider_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [booking_id, client_id, provider_id, rating, comment]
  );
  return result.rows[0];
};

const getProviderReviews = async (provider_id) => {
  const result = await pool.query(
    `SELECT r.*, u.full_name AS client_name, u.profile_image
     FROM reviews r
     JOIN users u ON r.client_id = u.id
     WHERE r.provider_id = $1
     ORDER BY r.created_at DESC`,
    [provider_id]
  );
  return result.rows;
};

const checkExistingReview = async (booking_id) => {
  const result = await pool.query(
    `SELECT * FROM reviews WHERE booking_id = $1`,
    [booking_id]
  );
  return result.rows[0];
};

const updateProviderRating = async (provider_id) => {
  await pool.query(
    `UPDATE provider_profiles
     SET rating = (
       SELECT ROUND(AVG(rating)::numeric, 2)
       FROM reviews
       WHERE provider_id = $1
     ),
     total_jobs = (
       SELECT COUNT(*)
       FROM bookings
       WHERE provider_id = $1
       AND status = 'completed'
     )
     WHERE user_id = $1`,
    [provider_id]
  );
};

module.exports = {
  createReview,
  getProviderReviews,
  checkExistingReview,
  updateProviderRating
};